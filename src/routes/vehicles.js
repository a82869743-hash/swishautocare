const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ───── GET /api/vehicles — List / Search ─────
router.get('/', async (req, res) => {
  try {
    const { search, customer_id, page = 1, limit = 50 } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (search) {
      where += ' AND (v.reg_no LIKE ? OR v.make LIKE ? OR v.model LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q);
    }
    if (customer_id) {
      where += ' AND v.customer_id = ?';
      params.push(customer_id);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [rows] = await db.query(
      `SELECT v.*, c.customer_name, c.mobile_no as customer_mobile
       FROM vehicles v
       LEFT JOIN customers c ON v.customer_id = c.id
       ${where}
       ORDER BY v.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({ data: rows });
  } catch (err) {
    console.error('GET /vehicles error:', err);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

// ───── GET /api/vehicles/lookup/:regNo — Find by registration ─────
router.get('/lookup/:regNo', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT v.*, c.id as customer_id, c.customer_name, c.mobile_no as customer_mobile,
              c.customer_type, c.company_name, c.email, c.city, c.state
       FROM vehicles v
       LEFT JOIN customers c ON v.customer_id = c.id
       WHERE v.reg_no = ?`,
      [req.params.regNo.toUpperCase().trim()]
    );
    if (rows.length === 0) return res.json({ found: false });
    res.json({ found: true, vehicle: rows[0] });
  } catch (err) {
    console.error('GET /vehicles/lookup error:', err);
    res.status(500).json({ error: 'Lookup failed' });
  }
});

// ───── GET /api/vehicles/:id — Single vehicle with service history ─────
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT v.*, c.customer_name, c.mobile_no as customer_mobile
       FROM vehicles v LEFT JOIN customers c ON v.customer_id = c.id WHERE v.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Vehicle not found' });

    const vehicle = rows[0];
    const [history] = await db.query(
      `SELECT jc.id, jc.job_no, jc.status, jc.service_type, jc.final_amount, jc.job_date
       FROM job_cards jc WHERE jc.vehicle_id = ? OR jc.reg_no = ?
       ORDER BY jc.created_at DESC LIMIT 20`,
      [vehicle.id, vehicle.reg_no]
    );
    vehicle.service_history = history;

    res.json(vehicle);
  } catch (err) {
    console.error('GET /vehicles/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
});

// ───── POST /api/vehicles — Create ─────
router.post('/', async (req, res) => {
  try {
    const { customer_id, reg_no, make, model, year, variant, vin, engine_no, fuel_type, vehicle_color } = req.body;
    if (!reg_no) return res.status(400).json({ error: 'Registration number required' });

    const [result] = await db.execute(
      `INSERT INTO vehicles (customer_id, reg_no, make, model, year, variant, vin, engine_no, fuel_type, vehicle_color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [customer_id || null, reg_no.toUpperCase().trim(), make || null, model || null, year || null,
       variant || null, vin || null, engine_no || null, fuel_type || 'petrol', vehicle_color || null]
    );

    res.status(201).json({ id: result.insertId, message: 'Vehicle added' });
  } catch (err) {
    console.error('POST /vehicles error:', err);
    res.status(500).json({ error: 'Failed to add vehicle' });
  }
});

// ───── PUT /api/vehicles/:id — Update ─────
router.put('/:id', async (req, res) => {
  try {
    const allowed = ['customer_id', 'reg_no', 'make', 'model', 'year', 'variant', 'vin', 'engine_no', 'fuel_type', 'vehicle_color'];
    const updates = [];
    const values = [];
    for (const f of allowed) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(f === 'reg_no' ? req.body[f].toUpperCase().trim() : req.body[f]);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.params.id);
    await db.execute(`UPDATE vehicles SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Vehicle updated' });
  } catch (err) {
    console.error('PUT /vehicles/:id error:', err);
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

module.exports = router;
