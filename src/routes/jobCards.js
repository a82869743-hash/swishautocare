const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ───── Number Generators ─────
async function generateJobNo() {
  const today = new Date().toISOString().slice(0, 10);
  const dateStr = today.replace(/-/g, '');
  const [rows] = await db.query('SELECT COUNT(*) as cnt FROM job_cards WHERE DATE(job_date) = ?', [today]);
  return `SCW-J${dateStr.slice(2)}-${String(rows[0].cnt + 1).padStart(3, '0')}`;
}

async function generateRfeNo() {
  const today = new Date().toISOString().slice(0, 10);
  const dateStr = today.replace(/-/g, '');
  const [rows] = await db.query("SELECT COUNT(*) as cnt FROM job_cards WHERE rfe_no IS NOT NULL AND DATE(job_date) = ?", [today]);
  return `RFE-${dateStr.slice(2)}-${String(rows[0].cnt + 1).padStart(3, '0')}`;
}

async function generateInvoiceNo() {
  const today = new Date().toISOString().slice(0, 10);
  const dateStr = today.replace(/-/g, '');
  const [rows] = await db.query('SELECT COUNT(*) as cnt FROM invoices WHERE DATE(created_at) = ?', [today]);
  return `INV-${dateStr.slice(2)}-${String(rows[0].cnt + 1).padStart(3, '0')}`;
}

async function generateEstimateNo() {
  const today = new Date().toISOString().slice(0, 10);
  const dateStr = today.replace(/-/g, '');
  const [rows] = await db.query('SELECT COUNT(*) as cnt FROM estimates WHERE DATE(created_at) = ?', [today]);
  return `EST-${dateStr.slice(2)}-${String(rows[0].cnt + 1).padStart(3, '0')}`;
}

// ═══════════════════════════════════════════════════════════════
// GET /api/job-cards — List with full search + pipeline filters
// ═══════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { status, completion_type, date, search, page = 1, limit = 50 } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      if (status === 'active') {
        where += " AND jc.status IN ('rfe','estimation','spares_pending','wip','ready')";
      } else {
        where += ' AND jc.status = ?';
        params.push(status);
      }
    }
    if (completion_type && completion_type !== 'all') {
      where += ' AND jc.completion_type = ?';
      params.push(completion_type);
    }
    if (date) {
      where += ' AND DATE(jc.job_date) = ?';
      params.push(date);
    }
    if (search) {
      where += ' AND (jc.reg_no LIKE ? OR jc.car_name LIKE ? OR jc.owner_name LIKE ? OR jc.mobile_no LIKE ? OR jc.job_no LIKE ? OR jc.rfe_no LIKE ? OR c.customer_name LIKE ? OR c.mobile_no LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q, q, q, q, q, q);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM job_cards jc LEFT JOIN customers c ON jc.customer_id = c.id ${where}`,
      params
    );

    const [rows] = await db.query(
      `SELECT jc.*, s.full_name as assigned_staff_name, 
              c.customer_name as cust_name, c.mobile_no as cust_mobile, c.customer_type,
              v.make as vehicle_make, v.model as vehicle_model, v.fuel_type as vehicle_fuel,
              inv.invoice_no, inv.total_amount as invoice_total
       FROM job_cards jc
       LEFT JOIN staff s ON jc.assigned_staff_id = s.id
       LEFT JOIN customers c ON jc.customer_id = c.id
       LEFT JOIN vehicles v ON jc.vehicle_id = v.id
       LEFT JOIN invoices inv ON inv.job_card_id = jc.id
       ${where}
       ORDER BY jc.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    // Attach services for each job card
    for (const job of rows) {
      const [services] = await db.query(
        'SELECT id, service_name, item_type, part_code, qty, rate, amount, discount_pct, hsn_sac, tax_pct, tax_amount FROM job_card_services WHERE job_card_id = ? ORDER BY id',
        [job.id]
      );
      job.services = services;
      job.subtotal = services.reduce((sum, s) => sum + parseFloat(s.amount) * (s.qty || 1), 0);

      if (job.completion_type === 'invoice') {
        const [inv] = await db.query('SELECT * FROM invoices WHERE job_card_id = ?', [job.id]);
        job.invoice = inv[0] || null;
      } else if (job.completion_type === 'estimate') {
        const [est] = await db.query('SELECT * FROM estimates WHERE job_card_id = ?', [job.id]);
        job.estimate = est[0] || null;
      }
    }

    res.json({ data: rows, total: countRows[0].total, page: parseInt(page) });
  } catch (err) {
    console.error('GET /job-cards error:', err);
    res.status(500).json({ error: 'Failed to fetch job cards' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/job-cards/export/estimates
// ═══════════════════════════════════════════════════════════════
router.get('/export/estimates', async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const [rows] = await db.query(
      `SELECT jc.job_no, jc.reg_no, jc.car_name, jc.owner_name, jc.mobile_no,
              e.estimate_no, e.subtotal, e.payment_mode, e.created_at as estimate_date,
              GROUP_CONCAT(CONCAT(jcs.service_name, ': ₹', jcs.amount) SEPARATOR ' | ') as services_detail
       FROM estimates e
       JOIN job_cards jc ON e.job_card_id = jc.id
       LEFT JOIN job_card_services jcs ON jcs.job_card_id = jc.id
       WHERE MONTH(e.created_at) = ? AND YEAR(e.created_at) = ?
       GROUP BY e.id ORDER BY e.created_at DESC`,
      [m, y]
    );

    const headers = ['Estimate No', 'Job No', 'Reg No', 'Car Name', 'Owner', 'Mobile', 'Services', 'Subtotal', 'Payment Mode', 'Date'];
    let csv = '\uFEFF' + headers.join(',') + '\n';
    for (const r of rows) {
      csv += [
        r.estimate_no, r.job_no, r.reg_no,
        `"${(r.car_name || '').replace(/"/g, '""')}"`,
        `"${(r.owner_name || '').replace(/"/g, '""')}"`,
        r.mobile_no || '', `"${(r.services_detail || '').replace(/"/g, '""')}"`,
        r.subtotal, r.payment_mode, r.estimate_date
      ].join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="estimates_${y}_${String(m).padStart(2, '0')}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Export estimates error:', err);
    res.status(500).json({ error: 'Failed to export' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/job-cards/:id — Single job card with full details
// ═══════════════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT jc.*, s.full_name as assigned_staff_name,
              c.customer_name as cust_name, c.mobile_no as cust_mobile, c.customer_type,
              c.company_name, c.gstin, c.email as cust_email, c.alt_mobile,
              c.address_line, c.colony_street, c.city, c.state, c.pincode, c.contact_person, c.driver_name,
              v.make, v.model as vehicle_model, v.year as vehicle_year, v.variant, v.vin, v.engine_no, v.fuel_type, v.vehicle_color
       FROM job_cards jc
       LEFT JOIN staff s ON jc.assigned_staff_id = s.id
       LEFT JOIN customers c ON jc.customer_id = c.id
       LEFT JOIN vehicles v ON jc.vehicle_id = v.id
       WHERE jc.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Job card not found' });

    const job = rows[0];

    // Services
    const [services] = await db.query(
      'SELECT * FROM job_card_services WHERE job_card_id = ? ORDER BY id', [job.id]
    );
    job.services = services;
    job.subtotal = services.reduce((sum, s) => sum + parseFloat(s.amount) * (s.qty || 1), 0);

    // Concerns
    const [concerns] = await db.query(
      'SELECT * FROM customer_concerns WHERE job_card_id = ? ORDER BY id', [job.id]
    );
    job.concerns = concerns;

    // Advance payments
    const [advances] = await db.query(
      'SELECT * FROM advance_payments WHERE job_card_id = ? ORDER BY id', [job.id]
    );
    job.advance_payments = advances;

    // Invoice or Estimate
    if (job.completion_type === 'invoice') {
      const [inv] = await db.query('SELECT * FROM invoices WHERE job_card_id = ?', [job.id]);
      job.invoice = inv[0] || null;
    } else if (job.completion_type === 'estimate') {
      const [est] = await db.query('SELECT * FROM estimates WHERE job_card_id = ?', [job.id]);
      job.estimate = est[0] || null;
    }

    res.json(job);
  } catch (err) {
    console.error('GET /job-cards/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch job card' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/job-cards — Create (multi-step CRM flow)
// ═══════════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const {
      // Vehicle
      reg_no, car_name, odometer, avg_km_day, service_type, service_advisor,
      estimated_delivery, is_inhouse, vehicle_id,
      // Vehicle details for new vehicle
      make, model, year, variant, vin, engine_no, fuel_type, vehicle_color,
      // Customer
      customer_id, owner_name, mobile_no,
      // Customer details for new customer
      customer_type, customer_name, company_name, gstin, ref_no, alt_mobile, email,
      contact_person, driver_name, address_line, colony_street, city, state, state_code, pincode, birth_date, is_sez,
      // Job
      assigned_staff_id, notes, services, concerns,
      // Insurance
      insurance_company, insurance_claim_no,
      // Advance payment
      advance_payment
    } = req.body;

    if (!reg_no || !car_name) {
      return res.status(400).json({ error: 'Registration number and car name required' });
    }

    // 1. Create or link customer
    let finalCustomerId = customer_id || null;
    if (!finalCustomerId && (customer_name || owner_name) && mobile_no) {
      const [existing] = await db.query(
        'SELECT id FROM customers WHERE mobile_no = ? LIMIT 1', [mobile_no]
      );
      if (existing.length > 0) {
        finalCustomerId = existing[0].id;
      } else {
        const [custResult] = await db.execute(
          `INSERT INTO customers (customer_type, customer_name, company_name, gstin, ref_no,
            mobile_no, alt_mobile, email, contact_person, driver_name,
            address_line, colony_street, city, state, state_code, pincode, birth_date, is_sez)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            customer_type || 'individual', customer_name || owner_name, company_name || null,
            gstin || null, ref_no || null, mobile_no, alt_mobile || null, email || null,
            contact_person || null, driver_name || null, address_line || null,
            colony_street || null, city || null, state || null, state_code || null,
            pincode || null, birth_date || null, is_sez ? 1 : 0
          ]
        );
        finalCustomerId = custResult.insertId;
      }
    }

    // 2. Create or link vehicle
    let finalVehicleId = vehicle_id || null;
    if (!finalVehicleId && reg_no) {
      const [existingV] = await db.query('SELECT id FROM vehicles WHERE reg_no = ?', [reg_no.toUpperCase().trim()]);
      if (existingV.length > 0) {
        finalVehicleId = existingV[0].id;
        // Update vehicle details if provided
        if (make || model) {
          await db.execute(
            'UPDATE vehicles SET make = COALESCE(?, make), model = COALESCE(?, model), year = COALESCE(?, year), variant = COALESCE(?, variant), vin = COALESCE(?, vin), engine_no = COALESCE(?, engine_no), fuel_type = COALESCE(?, fuel_type), vehicle_color = COALESCE(?, vehicle_color), customer_id = COALESCE(?, customer_id) WHERE id = ?',
            [make, model, year, variant, vin, engine_no, fuel_type, vehicle_color, finalCustomerId, finalVehicleId]
          );
        }
      } else {
        const [vResult] = await db.execute(
          `INSERT INTO vehicles (customer_id, reg_no, make, model, year, variant, vin, engine_no, fuel_type, vehicle_color)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [finalCustomerId, reg_no.toUpperCase().trim(), make || null, model || null, year || null,
           variant || null, vin || null, engine_no || null, fuel_type || 'petrol', vehicle_color || null]
        );
        finalVehicleId = vResult.insertId;
      }
    }

    // 3. Create job card
    const job_no = await generateJobNo();
    const rfe_no = await generateRfeNo();

    const [result] = await db.execute(
      `INSERT INTO job_cards (job_no, rfe_no, reg_no, car_name, owner_name, mobile_no,
        customer_id, vehicle_id, odometer, avg_km_day, service_type, service_advisor,
        estimated_delivery, is_inhouse, assigned_staff_id, notes, status,
        insurance_company, insurance_claim_no)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'rfe', ?, ?)`,
      [
        job_no, rfe_no, reg_no.toUpperCase().trim(), car_name,
        customer_name || owner_name || '', mobile_no || '',
        finalCustomerId, finalVehicleId,
        odometer || null, avg_km_day || 25, service_type || null, service_advisor || null,
        estimated_delivery || null, is_inhouse ? 1 : 0,
        assigned_staff_id || null, notes || null,
        insurance_company || null, insurance_claim_no || null
      ]
    );
    const jobId = result.insertId;

    // 4. Insert services
    if (services && Array.isArray(services)) {
      for (const svc of services) {
        if (svc.service_name && svc.amount !== undefined) {
          await db.execute(
            `INSERT INTO job_card_services (job_card_id, service_name, item_type, part_code, qty, rate, amount, discount_pct, hsn_sac, tax_pct, tax_amount)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              jobId, svc.service_name, svc.item_type || 'labour', svc.part_code || null,
              svc.qty || 1, svc.rate || parseFloat(svc.amount) || 0, parseFloat(svc.amount) || 0,
              svc.discount_pct || 0, svc.hsn_sac || null,
              svc.tax_pct !== undefined ? svc.tax_pct : 18, svc.tax_amount || 0
            ]
          );
        }
      }
    }

    // 5. Insert concerns
    if (concerns && Array.isArray(concerns)) {
      for (const c of concerns) {
        if (c.trim()) {
          await db.execute('INSERT INTO customer_concerns (job_card_id, concern_text) VALUES (?, ?)', [jobId, c.trim()]);
        }
      }
    }

    // 6. Insert advance payment
    if (advance_payment && advance_payment.amount > 0) {
      await db.execute(
        'INSERT INTO advance_payments (job_card_id, payment_type, bank_name, cheque_no, amount, payment_date) VALUES (?, ?, ?, ?, ?, ?)',
        [
          jobId, advance_payment.payment_type || 'cash', advance_payment.bank_name || null,
          advance_payment.cheque_no || null, advance_payment.amount,
          advance_payment.payment_date || new Date().toISOString().slice(0, 10)
        ]
      );
    }

    res.status(201).json({ id: jobId, job_no, rfe_no, message: 'Job card created' });
  } catch (err) {
    console.error('POST /job-cards error:', err);
    res.status(500).json({ error: 'Failed to create job card' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PUT /api/job-cards/:id — Update
// ═══════════════════════════════════════════════════════════════
router.put('/:id', async (req, res) => {
  try {
    const [existing] = await db.query('SELECT status, vehicle_id FROM job_cards WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Job card not found' });
    if (['invoiced', 'done'].includes(existing[0].status)) {
      return res.status(400).json({ error: 'Cannot edit a completed job card' });
    }

    const { reg_no, car_name, owner_name, mobile_no, assigned_staff_id, notes, services,
            odometer, avg_km_day, service_type, service_advisor, estimated_delivery, concerns,
            make, model, year, variant, fuel_type, vehicle_color, vin, engine_no } = req.body;

    const updates = [];
    const values = [];

    if (reg_no !== undefined) { updates.push('reg_no = ?'); values.push(reg_no.toUpperCase().trim()); }
    if (car_name !== undefined) { updates.push('car_name = ?'); values.push(car_name); }
    if (owner_name !== undefined) { updates.push('owner_name = ?'); values.push(owner_name); }
    if (mobile_no !== undefined) { updates.push('mobile_no = ?'); values.push(mobile_no); }
    if (assigned_staff_id !== undefined) { updates.push('assigned_staff_id = ?'); values.push(assigned_staff_id); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
    if (odometer !== undefined) { updates.push('odometer = ?'); values.push(odometer); }
    if (avg_km_day !== undefined) { updates.push('avg_km_day = ?'); values.push(avg_km_day); }
    if (service_type !== undefined) { updates.push('service_type = ?'); values.push(service_type); }
    if (service_advisor !== undefined) { updates.push('service_advisor = ?'); values.push(service_advisor); }
    if (estimated_delivery !== undefined) { updates.push('estimated_delivery = ?'); values.push(estimated_delivery); }

    if (updates.length > 0) {
      values.push(req.params.id);
      await db.execute(`UPDATE job_cards SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    // Update vehicle details if provided
    const vehicleId = existing[0].vehicle_id;
    if (vehicleId && (make !== undefined || model !== undefined || year !== undefined || variant !== undefined || fuel_type !== undefined || vehicle_color !== undefined || vin !== undefined || engine_no !== undefined)) {
      const vUpdates = [];
      const vValues = [];
      if (make !== undefined) { vUpdates.push('make = ?'); vValues.push(make || null); }
      if (model !== undefined) { vUpdates.push('model = ?'); vValues.push(model || null); }
      if (year !== undefined) { vUpdates.push('year = ?'); vValues.push(year || null); }
      if (variant !== undefined) { vUpdates.push('variant = ?'); vValues.push(variant || null); }
      if (fuel_type !== undefined) { vUpdates.push('fuel_type = ?'); vValues.push(fuel_type || null); }
      if (vehicle_color !== undefined) { vUpdates.push('vehicle_color = ?'); vValues.push(vehicle_color || null); }
      if (vin !== undefined) { vUpdates.push('vin = ?'); vValues.push(vin || null); }
      if (engine_no !== undefined) { vUpdates.push('engine_no = ?'); vValues.push(engine_no || null); }
      
      if (vUpdates.length > 0) {
        vValues.push(vehicleId);
        await db.execute(`UPDATE vehicles SET ${vUpdates.join(', ')} WHERE id = ?`, vValues);
      }
    }

    // Replace services
    if (services && Array.isArray(services)) {
      await db.execute('DELETE FROM job_card_services WHERE job_card_id = ?', [req.params.id]);
      for (const svc of services) {
        if (svc.service_name && svc.amount !== undefined) {
          await db.execute(
            `INSERT INTO job_card_services (job_card_id, service_name, item_type, part_code, qty, rate, amount, discount_pct, hsn_sac, tax_pct, tax_amount)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              req.params.id, svc.service_name, svc.item_type || 'labour', svc.part_code || null,
              svc.qty || 1, svc.rate || parseFloat(svc.amount), parseFloat(svc.amount),
              svc.discount_pct || 0, svc.hsn_sac || null,
              svc.tax_pct !== undefined ? svc.tax_pct : 18, svc.tax_amount || 0
            ]
          );
        }
      }
    }

    // Replace concerns
    if (concerns && Array.isArray(concerns)) {
      await db.execute('DELETE FROM customer_concerns WHERE job_card_id = ?', [req.params.id]);
      for (const c of concerns) {
        if (c.trim()) {
          await db.execute('INSERT INTO customer_concerns (job_card_id, concern_text) VALUES (?, ?)', [req.params.id, c.trim()]);
        }
      }
    }

    res.json({ message: 'Job card updated' });
  } catch (err) {
    console.error('PUT /job-cards/:id error:', err);
    res.status(500).json({ error: 'Failed to update job card' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PATCH /api/job-cards/:id/status — Pipeline status transition
// ═══════════════════════════════════════════════════════════════
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['rfe', 'estimation', 'spares_pending', 'wip', 'ready', 'delivered', 'invoiced'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const closedStatuses = ['delivered', 'invoiced'];
    const closedAt = closedStatuses.includes(status) ? 'NOW()' : 'NULL';

    await db.execute(
      `UPDATE job_cards SET status = ?, closed_at = ${closedAt} WHERE id = ?`,
      [status, req.params.id]
    );

    res.json({ message: `Status updated to ${status}` });
  } catch (err) {
    console.error('PATCH /job-cards/:id/status error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/job-cards/:id/generate-invoice
// ═══════════════════════════════════════════════════════════════
router.post('/:id/generate-invoice', async (req, res) => {
  try {
    const { payment_mode, gst_percent } = req.body;
    if (!payment_mode || !['cash', 'upi', 'card', 'bank'].includes(payment_mode)) {
      return res.status(400).json({ error: 'Valid payment mode required' });
    }

    const gst = parseFloat(gst_percent) || 18;
    const [existing] = await db.query('SELECT * FROM job_cards WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Job card not found' });
    if (['invoiced', 'done'].includes(existing[0].status)) return res.status(400).json({ error: 'Job already completed' });

    const [services] = await db.query(
      'SELECT SUM(amount * COALESCE(qty, 1)) as subtotal FROM job_card_services WHERE job_card_id = ?', [req.params.id]
    );
    const subtotal = parseFloat(services[0].subtotal) || 0;
    if (subtotal <= 0) return res.status(400).json({ error: 'No services or subtotal is 0' });

    const gst_amount = parseFloat((subtotal * gst / 100).toFixed(2));
    const total_amount = parseFloat((subtotal + gst_amount).toFixed(2));
    const invoice_no = await generateInvoiceNo();

    await db.execute(
      `UPDATE job_cards SET status = 'invoiced', completion_type = 'invoice', final_amount = ?, payment_mode = ?, closed_at = NOW() WHERE id = ?`,
      [total_amount, payment_mode, req.params.id]
    );

    await db.execute(
      `INSERT INTO invoices (job_card_id, invoice_no, subtotal, gst_percent, gst_amount, total_amount, payment_mode) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, invoice_no, subtotal, gst, gst_amount, total_amount, payment_mode]
    );

    res.json({ message: 'Invoice generated', invoice_no, subtotal, gst_percent: gst, gst_amount, total_amount, payment_mode });
  } catch (err) {
    console.error('Generate invoice error:', err);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/job-cards/:id/save-estimate
// ═══════════════════════════════════════════════════════════════
router.post('/:id/save-estimate', async (req, res) => {
  try {
    const { payment_mode } = req.body;
    if (!payment_mode || !['cash', 'upi', 'card', 'bank'].includes(payment_mode)) {
      return res.status(400).json({ error: 'Valid payment mode required' });
    }

    const [existing] = await db.query('SELECT * FROM job_cards WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Job card not found' });
    if (['invoiced', 'done'].includes(existing[0].status)) return res.status(400).json({ error: 'Job already completed' });

    const [services] = await db.query(
      'SELECT SUM(amount * COALESCE(qty, 1)) as subtotal FROM job_card_services WHERE job_card_id = ?', [req.params.id]
    );
    const subtotal = parseFloat(services[0].subtotal) || 0;
    if (subtotal <= 0) return res.status(400).json({ error: 'No services or subtotal is 0' });

    const estimate_no = await generateEstimateNo();

    await db.execute(
      `UPDATE job_cards SET status = 'delivered', completion_type = 'estimate', final_amount = ?, payment_mode = ?, closed_at = NOW() WHERE id = ?`,
      [subtotal, payment_mode, req.params.id]
    );

    await db.execute(
      `INSERT INTO estimates (job_card_id, estimate_no, subtotal, payment_mode) VALUES (?, ?, ?, ?)`,
      [req.params.id, estimate_no, subtotal, payment_mode]
    );

    res.json({ message: 'Estimate saved', estimate_no, subtotal, payment_mode });
  } catch (err) {
    console.error('Save estimate error:', err);
    res.status(500).json({ error: 'Failed to save estimate' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/job-cards/:id/services — List services for a job card
// ═══════════════════════════════════════════════════════════════
router.get('/:id/services', async (req, res) => {
  try {
    const [services] = await db.query(
      `SELECT id, service_name, item_type, part_code, part_no, labour_code, qty, rate, amount, 
              discount_pct, hsn_sac, tax_pct, tax_amount, price_type, is_selected, sort_order
       FROM job_card_services WHERE job_card_id = ? ORDER BY sort_order, id`,
      [req.params.id]
    );

    // Compute totals for selected services
    const selected = services.filter(s => s.is_selected === 1 || s.is_selected === undefined);
    const totals = {
      parts_excl_tax:  selected.filter(s => s.item_type === 'part').reduce((sum, s) => sum + parseFloat(s.amount || 0), 0),
      labour_excl_tax: selected.filter(s => s.item_type === 'labour').reduce((sum, s) => sum + parseFloat(s.amount || 0), 0),
      tax_total:       selected.reduce((sum, s) => sum + parseFloat(s.tax_amount || 0), 0),
      grand_total:     selected.reduce((sum, s) => sum + parseFloat(s.amount || 0) + parseFloat(s.tax_amount || 0), 0),
      selected_count:  selected.length,
      total_count:     services.length,
    };

    // Normalize is_selected to 0|1 integers
    const normalized = services.map(s => ({ ...s, is_selected: s.is_selected ?? 1 }));

    res.json({ data: normalized, services: normalized, totals });
  } catch (err) {
    console.error('GET /job-cards/:id/services error:', err);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/job-cards/:id/services — Add a service line item
// ═══════════════════════════════════════════════════════════════
router.post('/:id/services', async (req, res) => {
  try {
    const [job] = await db.query('SELECT id, status FROM job_cards WHERE id = ?', [req.params.id]);
    if (job.length === 0) return res.status(404).json({ error: 'Job card not found' });
    if (['invoiced', 'done'].includes(job[0].status)) {
      return res.status(400).json({ error: 'Cannot add services to a completed job' });
    }

    const { service_name, item_type, part_code, part_no, labour_code, qty, rate, amount,
            discount_pct, hsn_sac, tax_pct, tax_amount, price_type, is_selected, sort_order } = req.body;

    if (!service_name) return res.status(400).json({ error: 'Service name is required' });

    const finalRate = parseFloat(rate) || parseFloat(amount) || 0;
    const finalQty = parseInt(qty) || 1;
    const finalAmount = parseFloat(amount) || (finalRate * finalQty);

    const [result] = await db.execute(
      `INSERT INTO job_card_services 
        (job_card_id, service_name, item_type, part_code, part_no, labour_code, qty, rate, amount, 
         discount_pct, hsn_sac, tax_pct, tax_amount, price_type, is_selected, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.id, service_name, item_type || 'labour', part_code || null,
        part_no || null, labour_code || null, finalQty, finalRate, finalAmount,
        discount_pct || 0, hsn_sac || null, tax_pct !== undefined ? tax_pct : 18,
        tax_amount || 0, price_type || 'fixed', is_selected !== undefined ? is_selected : 1,
        sort_order || 0
      ]
    );

    // Fetch the created service
    const [created] = await db.query('SELECT * FROM job_card_services WHERE id = ?', [result.insertId]);

    res.status(201).json({ data: created[0], message: 'Service added' });
  } catch (err) {
    console.error('POST /job-cards/:id/services error:', err);
    res.status(500).json({ error: 'Failed to add service' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PATCH /api/job-cards/services/:serviceId — Auto-save single field
// ═══════════════════════════════════════════════════════════════
router.patch('/services/:serviceId', async (req, res) => {
  try {
    // Verify service exists and job is not completed
    const [svc] = await db.query(
      `SELECT jcs.id, jcs.job_card_id, jc.status 
       FROM job_card_services jcs
       JOIN job_cards jc ON jcs.job_card_id = jc.id
       WHERE jcs.id = ?`,
      [req.params.serviceId]
    );
    if (svc.length === 0) return res.status(404).json({ error: 'Service not found' });
    if (['invoiced', 'done'].includes(svc[0].status)) {
      return res.status(400).json({ error: 'Cannot edit services on a completed job' });
    }

    const allowedFields = ['service_name', 'item_type', 'part_code', 'part_no', 'labour_code',
      'qty', 'rate', 'amount', 'discount_pct', 'hsn_sac', 'tax_pct', 'tax_amount',
      'price_type', 'is_selected', 'sort_order'];

    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    // Auto-compute amount if rate or qty changes
    if ((req.body.rate !== undefined || req.body.qty !== undefined) && req.body.amount === undefined) {
      const rate = req.body.rate !== undefined ? parseFloat(req.body.rate) : null;
      const qty = req.body.qty !== undefined ? parseInt(req.body.qty) : null;

      if (rate !== null || qty !== null) {
        const [current] = await db.query('SELECT rate, qty FROM job_card_services WHERE id = ?', [req.params.serviceId]);
        const finalRate = rate !== null ? rate : parseFloat(current[0].rate);
        const finalQty = qty !== null ? qty : parseInt(current[0].qty);
        updates.push('amount = ?');
        values.push(finalRate * finalQty);
      }
    }

    values.push(req.params.serviceId);
    await db.execute(`UPDATE job_card_services SET ${updates.join(', ')} WHERE id = ?`, values);

    // Return updated service
    const [updated] = await db.query('SELECT * FROM job_card_services WHERE id = ?', [req.params.serviceId]);

    res.json({ data: updated[0], message: 'Service updated' });
  } catch (err) {
    console.error('PATCH /job-cards/services/:serviceId error:', err);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// ═══════════════════════════════════════════════════════════════
// DELETE /api/job-cards/services/:serviceId — Remove a service
// ═══════════════════════════════════════════════════════════════
router.delete('/services/:serviceId', async (req, res) => {
  try {
    const [svc] = await db.query(
      `SELECT jcs.id, jc.status 
       FROM job_card_services jcs
       JOIN job_cards jc ON jcs.job_card_id = jc.id
       WHERE jcs.id = ?`,
      [req.params.serviceId]
    );
    if (svc.length === 0) return res.status(404).json({ error: 'Service not found' });
    if (['invoiced', 'done'].includes(svc[0].status)) {
      return res.status(400).json({ error: 'Cannot delete services on a completed job' });
    }

    await db.execute('DELETE FROM job_card_services WHERE id = ?', [req.params.serviceId]);
    res.json({ message: 'Service deleted' });
  } catch (err) {
    console.error('DELETE /job-cards/services/:serviceId error:', err);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/job-cards/:id/dispatch — Send invoice via WhatsApp/SMS
// ═══════════════════════════════════════════════════════════════
router.post('/:id/dispatch', async (req, res) => {
  try {
    const { channel } = req.body; // 'whatsapp' | 'sms' | 'both'
    if (!channel || !['whatsapp', 'sms', 'both'].includes(channel)) {
      return res.status(400).json({ error: 'Valid channel required: whatsapp, sms, or both' });
    }

    const [job] = await db.query(
      `SELECT jc.*, c.customer_name, c.mobile_no as cust_mobile, c.email as cust_email,
              inv.invoice_no, inv.total_amount, inv.subtotal, inv.gst_amount,
              est.estimate_no, est.subtotal as est_subtotal
       FROM job_cards jc
       LEFT JOIN customers c ON jc.customer_id = c.id  
       LEFT JOIN invoices inv ON inv.job_card_id = jc.id
       LEFT JOIN estimates est ON est.job_card_id = jc.id
       WHERE jc.id = ?`,
      [req.params.id]
    );
    if (job.length === 0) return res.status(404).json({ error: 'Job card not found' });

    const j = job[0];
    const mobile = j.cust_mobile || j.mobile_no;
    if (!mobile) return res.status(400).json({ error: 'No mobile number found for customer' });

    const msg91 = require('../utils/msg91');
    const results = {};

    const docType = j.invoice_no ? 'Invoice' : 'Estimate';
    const docNo = j.invoice_no || j.estimate_no || j.job_no;
    const totalAmt = j.total_amount || j.est_subtotal || j.final_amount || 0;

    if (channel === 'whatsapp' || channel === 'both') {
      results.whatsapp = await msg91.sendWhatsApp({
        to: mobile,
        templateName: process.env.MSG91_WA_TEMPLATE_NAME || 'invoice_notification',
        params: [
          { type: 'text', text: j.customer_name || j.owner_name || 'Customer' },
          { type: 'text', text: docNo },
          { type: 'text', text: `₹${totalAmt.toLocaleString('en-IN')}` },
          { type: 'text', text: j.car_name || '' },
          { type: 'text', text: j.reg_no || '' }
        ],
        jobCardId: req.params.id,
        userId: req.user?.id || null
      });
    }

    if (channel === 'sms' || channel === 'both') {
      const smsMsg = `Dear ${j.customer_name || j.owner_name || 'Customer'}, your ${docType} ${docNo} for ${j.car_name} (${j.reg_no}) totalling Rs.${totalAmt} has been generated. Thank you - Swish Auto Care`;
      results.sms = await msg91.sendSMS({
        to: mobile,
        message: smsMsg,
        jobCardId: req.params.id,
        userId: req.user?.id || null
      });
    }

    res.json({ message: `${docType} dispatched via ${channel}`, results });
  } catch (err) {
    console.error('POST /job-cards/:id/dispatch error:', err);
    res.status(500).json({ error: 'Failed to dispatch' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/job-cards/:id/dispatch-history — Get dispatch log
// ═══════════════════════════════════════════════════════════════
router.get('/:id/dispatch-history', async (req, res) => {
  try {
    const msg91 = require('../utils/msg91');
    const history = await msg91.getDispatchHistory(req.params.id);
    res.json({ data: history });
  } catch (err) {
    console.error('GET /job-cards/:id/dispatch-history error:', err);
    res.status(500).json({ error: 'Failed to fetch dispatch history' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ── MEDIA UPLOADS (Before/After Photos) ──
// ═══════════════════════════════════════════════════════════════
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const mediaStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(__dirname, '../../uploads/media', String(req.params.id));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const stamp = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `${stamp}${ext}`);
  },
});
const uploadMedia = multer({
  storage: mediaStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  },
});

// GET /api/job-cards/:id/media — List media for a job card
router.get('/:id/media', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM job_card_media WHERE job_card_id = ? ORDER BY stage, created_at DESC',
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ data: [] });
    console.error('GET /job-cards/:id/media error:', err);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

// POST /api/job-cards/:id/media — Upload media file
router.post('/:id/media', uploadMedia.single('media'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    const stage = ['before', 'after', 'other'].includes(req.body.stage) ? req.body.stage : 'before';
    const filePath = `uploads/media/${req.params.id}/${req.file.filename}`;

    const [result] = await db.execute(
      `INSERT INTO job_card_media (job_card_id, media_type, stage, file_name, file_path, mime_type, file_size, caption, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.id, mediaType, stage,
        req.file.originalname, filePath,
        req.file.mimetype, req.file.size,
        req.body.caption || null,
        req.user?.id || null,
      ]
    );

    res.status(201).json({ id: result.insertId, file_path: filePath, message: 'Media uploaded' });
  } catch (err) {
    console.error('POST /job-cards/:id/media error:', err);
    res.status(500).json({ error: 'Failed to upload media' });
  }
});

// DELETE /api/job-cards/:id/media/:mediaId — Delete a media file
router.delete('/:id/media/:mediaId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT file_path FROM job_card_media WHERE id = ? AND job_card_id = ?',
      [req.params.mediaId, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Media not found' });

    // Delete from disk
    const fullPath = path.join(__dirname, '../..', rows[0].file_path);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    await db.execute('DELETE FROM job_card_media WHERE id = ?', [req.params.mediaId]);
    res.json({ message: 'Media deleted' });
  } catch (err) {
    console.error('DELETE /job-cards/:id/media error:', err);
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/job-cards/:id/invoice-html — Render printable invoice
// ═══════════════════════════════════════════════════════════════
router.get('/:id/invoice-html', async (req, res) => {
  try {
    // ── Load logo as base64 ──
    const fs = require('fs');
    const path = require('path');
    let logoBase64 = '';
    try {
      const logoPath = path.join(__dirname, '../../uploads/swish-logo.png');
      if (fs.existsSync(logoPath)) {
        logoBase64 = fs.readFileSync(logoPath).toString('base64');
      }
    } catch { /* ignore */ }

    // ── Fetch job card ──
    const [jobs] = await db.query(
      `SELECT jc.*, s.full_name as advisor_name
       FROM job_cards jc
       LEFT JOIN staff s ON jc.assigned_staff_id = s.id
       WHERE jc.id = ?`, [req.params.id]
    );
    if (jobs.length === 0) return res.status(404).send('Job card not found');
    const job = jobs[0];

    // ── Fetch invoice ──
    let invoice = null;
    try {
      const [inv] = await db.query('SELECT * FROM invoices WHERE job_card_id = ? ORDER BY id DESC LIMIT 1', [req.params.id]);
      if (inv.length > 0) invoice = inv[0];
    } catch { /* table may not exist */ }

    // ── Fetch services ──
    const [services] = await db.query(
      'SELECT * FROM job_card_services WHERE job_card_id = ? ORDER BY sort_order ASC, id ASC',
      [req.params.id]
    );

    // ── Fetch customer ──
    let customer = {};
    try {
      const [cust] = await db.query('SELECT * FROM customers WHERE id = ?', [job.customer_id]);
      if (cust.length > 0) customer = cust[0];
    } catch { /* noop */ }

    const custName = customer.customer_name || job.owner_name || '—';
    const custMobile = customer.mobile_no || job.mobile_no || '';
    const custEmail = customer.email || '';
    const custGstin = customer.gstin || '';

    // ── Separate parts and labour ──
    const parts = services.filter(s => (s.item_type || '').toLowerCase() === 'part');
    const labours = services.filter(s => (s.item_type || '').toLowerCase() !== 'part');

    const calcRows = (rows) => {
      let taxableVal = 0, gstTotal = 0, discTotal = 0;
      rows.forEach(s => {
        const lineAmt = (parseFloat(s.amount) || 0) * (parseInt(s.qty) || 1);
        const taxAmt = parseFloat(s.tax_amount) || 0;
        taxableVal += lineAmt;
        gstTotal += taxAmt;
        discTotal += (parseFloat(s.discount_pct) || 0) > 0 ? lineAmt * (parseFloat(s.discount_pct) / 100) : 0;
      });
      return { taxableVal, gstTotal, discTotal, roundOff: Math.round(taxableVal + gstTotal) };
    };

    const partsTotals = calcRows(parts);
    const labourTotals = calcRows(labours);

    const partsTotal = partsTotals.roundOff;
    const labourTotal = labourTotals.roundOff;
    const totalGst = partsTotals.gstTotal + labourTotals.gstTotal;
    const grandTotal = partsTotal + labourTotal;
    const totalTaxable = partsTotals.taxableVal + labourTotals.taxableVal;

    const invNo = invoice ? invoice.invoice_no : (job.job_no || '—');
    const invDate = invoice ? new Date(invoice.created_at) : new Date();

    // ── Formatters ──
    const fmtCurrency = (n) => '₹ ' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtDate = (d) => {
      const dt = new Date(d);
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${months[dt.getMonth()]} ${String(dt.getDate()).padStart(2,'0')} ${dt.getFullYear()}`;
    };

    // ── Amount to words ──
    function numberToWords(num) {
      if (num === 0) return 'Zero';
      const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
      const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
      function convert(n) {
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '');
        if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' and ' + convert(n%100) : '');
        if (n < 100000) return convert(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' ' + convert(n%1000) : '');
        if (n < 10000000) return convert(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' ' + convert(n%100000) : '');
        return convert(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' ' + convert(n%10000000) : '');
      }
      const intPart = Math.floor(Math.abs(num));
      return 'INR ' + convert(intPart) + ' Rupees Only';
    }

    // ── Build parts rows HTML ──
    let partsRowsHtml = '';
    parts.forEach((s, i) => {
      const lineAmt = (parseFloat(s.amount) || 0) * (parseInt(s.qty) || 1);
      const taxAmt = parseFloat(s.tax_amount) || 0;
      partsRowsHtml += `<tr>
        <td>${i+1}</td>
        <td>${s.service_name || ''}</td>
        <td>${(s.item_type || '').charAt(0).toUpperCase() + (s.item_type || '').slice(1)}</td>
        <td>${s.hsn_sac || ''}</td>
        <td>${s.tax_pct || 18}</td>
        <td style="text-align:center;">${s.qty || 1}.00</td>
        <td style="text-align:right;">${(parseFloat(s.rate) || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
        <td style="text-align:right;">${lineAmt.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
        <td style="text-align:right;">${(lineAmt + taxAmt).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
      </tr>`;
    });

    // ── Build labour rows HTML ──
    let labourRowsHtml = '';
    labours.forEach((s, i) => {
      const lineAmt = (parseFloat(s.amount) || 0) * (parseInt(s.qty) || 1);
      const taxAmt = parseFloat(s.tax_amount) || 0;
      labourRowsHtml += `<tr>
        <td>${i+1}</td>
        <td>${s.service_name || ''}</td>
        <td>Description</td>
        <td>${s.hsn_sac || '998714'}</td>
        <td>${s.tax_pct || 18}</td>
        <td style="text-align:center;">${s.qty || 1}.00</td>
        <td style="text-align:right;">${(parseFloat(s.rate) || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
        <td style="text-align:right;">${lineAmt.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
        <td style="text-align:right;">${(lineAmt + taxAmt).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
      </tr>`;
    });

    // ── CGST / SGST split (half of GST each) ──
    const cgstPct = 9;
    const sgstPct = 9;
    const cgstAmt = (totalTaxable * cgstPct / 100);
    const sgstAmt = (totalTaxable * sgstPct / 100);

    // ── Insurance info ──
    let insuranceHtml = '';
    if (job.insurance_company) {
      insuranceHtml = `
        <tr><td colspan="2" style="padding:6px 8px;"><strong>Company Name:</strong> ${job.insurance_company}</td></tr>
        ${job.cust_mobile || custMobile ? `<tr><td colspan="2" style="padding:4px 8px;"><strong>Mobile No:</strong> ${job.cust_mobile || custMobile}</td></tr>` : ''}
        ${job.insurance_claim_no ? `<tr><td colspan="2" style="padding:4px 8px;"><strong>Claim No:</strong> ${job.insurance_claim_no}</td></tr>` : ''}
      `;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tax Invoice - ${invNo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; background: #f5f5f5; }
    .page { max-width: 800px; margin: 20px auto; background: #fff; padding: 30px 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    
    /* Header */
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 5px; }
    .header-top { display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 8px; }
    .header-logo { width: 100px; height: auto; }
    .header-text h1 { font-size: 20px; font-weight: 900; letter-spacing: 1px; margin-bottom: 3px; }
    .header-text p { font-size: 11px; line-height: 1.5; color: #333; }
    .header-text .gstin { font-weight: 700; font-size: 12px; }
    .tax-invoice-title { font-size: 16px; font-weight: 700; text-decoration: underline; margin-top: 8px; }

    /* Info Section */
    .info-section { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #000; margin-bottom: 15px; }
    .info-left { border-right: 1px solid #000; padding: 0; }
    .info-right { padding: 0; }
    .info-left .company-block { padding: 10px; border-bottom: 1px solid #000; }
    .info-left .company-block p { font-size: 11px; line-height: 1.6; }
    .info-left .insurance-block { padding: 10px; }
    .info-left .insurance-block p { font-size: 11px; line-height: 1.6; }
    .info-right table { width: 100%; border-collapse: collapse; }
    .info-right td { padding: 6px 10px; font-size: 11px; border-bottom: 1px solid #ccc; }
    .info-right td:first-child { font-weight: 600; white-space: nowrap; width: 45%; }
    .info-right .customer-block { padding: 10px; border-top: 1px solid #000; }
    .info-right .customer-block p { font-size: 11px; line-height: 1.6; }

    /* Tables */
    .section-table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
    .section-table th { background: #e8e8e8; padding: 6px 8px; font-size: 10px; font-weight: 700; text-align: left; border: 1px solid #999; text-transform: uppercase; }
    .section-table td { padding: 5px 8px; font-size: 11px; border: 1px solid #ccc; }
    .section-table tr:nth-child(even) { background: #fafafa; }
    
    /* Subtotals */
    .sub-totals { width: 100%; margin-bottom: 15px; }
    .sub-totals td { padding: 4px 10px; font-size: 11px; }
    .sub-totals .label { text-align: right; font-weight: 600; padding-right: 15px; }
    .sub-totals .value { text-align: right; font-weight: 600; width: 120px; font-family: monospace; }

    /* Grand Summary */
    .grand-summary { width: 400px; margin-left: auto; border: 1px solid #000; border-collapse: collapse; margin-bottom: 15px; }
    .grand-summary td { padding: 6px 12px; font-size: 12px; border-bottom: 1px solid #ccc; }
    .grand-summary .label { font-weight: 700; }
    .grand-summary .value { text-align: right; font-family: monospace; font-weight: 600; }
    .grand-summary tr:last-child td { border-bottom: none; font-weight: 900; font-size: 13px; background: #f0f0f0; }

    /* Tax Table */
    .tax-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #000; }
    .tax-table th { background: #e8e8e8; padding: 6px 8px; font-size: 10px; font-weight: 700; text-align: center; border: 1px solid #999; }
    .tax-table td { padding: 6px 10px; font-size: 11px; border: 1px solid #ccc; text-align: center; font-family: monospace; }
    .tax-table tr:last-child { font-weight: 900; background: #f5f5f5; }

    /* Footer */
    .amount-words { font-size: 12px; margin: 15px 0 10px; }
    .amount-words strong { font-weight: 700; }
    .certification { font-size: 11px; line-height: 1.6; margin-bottom: 40px; }
    .signatures { display: flex; justify-content: space-between; margin-top: 50px; padding-top: 0; }
    .sig-block { text-align: center; min-width: 180px; }
    .sig-block .line { border-top: 1px solid #000; margin-bottom: 5px; width: 180px; }
    .sig-block p { font-size: 10px; }

    /* Print */
    .no-print { text-align: center; padding: 15px; }
    .no-print button { background: #1e3a5f; color: #fff; border: none; padding: 10px 28px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; margin: 0 5px; }
    .no-print button:hover { background: #0f172a; }
    .no-print button.sec { background: #e5e7eb; color: #374151; }
    .no-print button.sec:hover { background: #d1d5db; }

    @media print {
      body { background: #fff; }
      .page { box-shadow: none; margin: 0; padding: 20px 30px; }
      .no-print { display: none !important; }
      @page { margin: 8mm; size: A4; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">🖨️ Print / Save as PDF</button>
    <button class="sec" onclick="window.close()">✕ Close</button>
  </div>

  <div class="page">
    <!-- ═══ HEADER ═══ -->
    <div class="header">
      <div class="header-top">
        ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" class="header-logo" alt="Swish Logo" />` : ''}
        <div class="header-text">
          <h1>SWISH AUTO CARE</h1>
          <p>Swish Auto Care, Opp YES Bank Next To Chocolate Room,, Gotri Vasna Road,<br>
          Vadodara, Gujarat (GJ) - 390007.</p>
          <p class="gstin">GSTIN: 24AEKFS9354K1ZE</p>
        </div>
      </div>
      <div class="tax-invoice-title">Tax Invoice</div>
    </div>

    <!-- ═══ INFO SECTION ═══ -->
    <div class="info-section">
      <div class="info-left">
        <div class="company-block">
          <p><strong>SWISH AUTO CARE</strong></p>
          <p>Swish Auto Care, Opp YES Bank Next To Chocolate Room,, Gotri<br>
          Vasna Road, Vadodara, Gujarat (GJ) - 390007.</p>
          <p>GSTIN: 24AEKFS9354K1ZE</p>
          <p>Contact: 9879143252</p>
          <p>Email: swishautocare@gmail.com</p>
        </div>
        <div class="insurance-block">
          ${insuranceHtml || '<p style="color:#999;">—</p>'}
        </div>
      </div>
      <div class="info-right">
        <table>
          <tr><td>Invoice No:</td><td>${invNo}</td></tr>
          <tr><td>Date:</td><td>${fmtDate(invDate)}</td></tr>
          <tr><td>Job Card No:</td><td>${job.job_no}</td></tr>
          <tr><td>Vehicle No:</td><td>${job.reg_no}</td></tr>
          <tr><td>Advisor Name:</td><td>${job.advisor_name || job.cust_mobile || ''}</td></tr>
          <tr><td>Service Type:</td><td>${job.service_type || 'General Service'}</td></tr>
        </table>
        <div class="customer-block">
          <p><strong>Customer :</strong>${custName}</p>
          <p><strong>Vehicle:</strong> ${job.car_name || ''}</p>
          <p><strong>Kilometer:</strong> ${job.odometer ? parseInt(job.odometer).toLocaleString() : '—'}</p>
          <p><strong>Color :</strong> ${job.vehicle_color || '—'}</p>
          <p><strong>Fuel:</strong> ${job.fuel_type || '—'}</p>
          <p><strong>PH:</strong> ${custMobile}</p>
          <p><strong>Email:</strong> ${custEmail}</p>
        </div>
      </div>
    </div>

    <!-- ═══ PARTS TABLE ═══ -->
    ${parts.length > 0 ? `
    <table class="section-table">
      <thead>
        <tr>
          <th style="width:30px;">#</th>
          <th>Part Name</th>
          <th style="width:70px;">Description</th>
          <th style="width:70px;">HSN / SAC</th>
          <th style="width:70px;">GST Rate (%)</th>
          <th style="width:60px;">Quantity</th>
          <th style="width:90px;">Unit Price (₹)</th>
          <th style="width:90px;">Taxable (₹)</th>
          <th style="width:100px;">Parts Total (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${partsRowsHtml}
      </tbody>
    </table>
    <table class="sub-totals">
      <tr><td class="label">Taxable Value</td><td class="value">${fmtCurrency(partsTotals.taxableVal)}</td></tr>
      <tr><td class="label">GST Total</td><td class="value">${fmtCurrency(partsTotals.gstTotal)}</td></tr>
      <tr><td class="label">Discount Total</td><td class="value">${fmtCurrency(partsTotals.discTotal)}</td></tr>
      <tr><td class="label">Round off</td><td class="value">${fmtCurrency(partsTotals.roundOff)}</td></tr>
    </table>
    ` : ''}

    <!-- ═══ LABOUR / SERVICES TABLE ═══ -->
    ${labours.length > 0 ? `
    <table class="section-table">
      <thead>
        <tr>
          <th style="width:30px;">#</th>
          <th>Service</th>
          <th style="width:80px;">Description</th>
          <th style="width:70px;">HSN / SAC</th>
          <th style="width:70px;">GST Rate (%)</th>
          <th style="width:60px;">Quantity</th>
          <th style="width:90px;">Unit Price (₹)</th>
          <th style="width:90px;">Taxable (₹)</th>
          <th style="width:100px;">Labour Total (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${labourRowsHtml}
      </tbody>
    </table>
    <table class="sub-totals">
      <tr><td class="label">Taxable Value</td><td class="value">${fmtCurrency(labourTotals.taxableVal)}</td></tr>
      <tr><td class="label">GST Total</td><td class="value">${fmtCurrency(labourTotals.gstTotal)}</td></tr>
      <tr><td class="label">Discount Total</td><td class="value">${fmtCurrency(labourTotals.discTotal)}</td></tr>
      <tr><td class="label">Round off</td><td class="value">${fmtCurrency(labourTotals.roundOff)}</td></tr>
    </table>
    ` : ''}

    <!-- ═══ GRAND SUMMARY ═══ -->
    <table class="grand-summary">
      <tr><td class="label">Parts Total</td><td class="value">${fmtCurrency(partsTotal)}</td></tr>
      <tr><td class="label">Labour Total</td><td class="value">${fmtCurrency(labourTotal)}</td></tr>
      <tr><td class="label">GST Total</td><td class="value">${fmtCurrency(totalGst)}</td></tr>
      <tr><td class="label">Grand Total</td><td class="value">${fmtCurrency(partsTotal + labourTotal)}</td></tr>
      <tr><td class="label">Round off</td><td class="value">${fmtCurrency(grandTotal)}</td></tr>
      <tr><td class="label">Balance</td><td class="value">${fmtCurrency(grandTotal)}</td></tr>
    </table>

    <!-- ═══ CGST / SGST TAX BREAKDOWN ═══ -->
    <table class="tax-table">
      <thead>
        <tr>
          <th rowspan="2">Taxable Value (₹)</th>
          <th colspan="2">CGST</th>
          <th colspan="2">SGST</th>
        </tr>
        <tr>
          <th>%</th>
          <th>Amt (₹)</th>
          <th>%</th>
          <th>Amt (₹)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${totalTaxable.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
          <td>${cgstPct}</td>
          <td>${cgstAmt.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
          <td>${sgstPct}</td>
          <td>${sgstAmt.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
        </tr>
        <tr>
          <td><strong>${totalTaxable.toLocaleString('en-IN', {minimumFractionDigits:2})}</strong></td>
          <td></td>
          <td><strong>${cgstAmt.toLocaleString('en-IN', {minimumFractionDigits:2})}</strong></td>
          <td></td>
          <td><strong>${sgstAmt.toLocaleString('en-IN', {minimumFractionDigits:2})}</strong></td>
        </tr>
      </tbody>
    </table>

    <!-- ═══ AMOUNT IN WORDS ═══ -->
    <p class="amount-words"><strong>Amount ( in Words ):</strong> ${numberToWords(grandTotal)}</p>

    <!-- ═══ CERTIFICATION ═══ -->
    <p class="certification">
      I certify that the work has been done to my satisfaction and that I have taken delivery of the vehicle in good
      condition, with all items /valuables and parts intact
    </p>

    <!-- ═══ SIGNATURES ═══ -->
    <div class="signatures">
      <div class="sig-block">
        <div class="line"></div>
        <p>Customer / Authorized Signatory</p>
      </div>
      <div class="sig-block">
        <div class="line"></div>
        <p>Service Advisor Signature</p>
      </div>
      <div class="sig-block">
        <div class="line"></div>
        <p>Cashier / Authorized Signature</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('GET /job-cards/:id/invoice-html error:', err);
    res.status(500).send('Failed to generate invoice');
  }
});


module.exports = router;
