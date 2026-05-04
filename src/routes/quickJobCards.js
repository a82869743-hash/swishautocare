const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

const router = express.Router();
router.use(auth);

// ─── Number Generator (same pattern as jobCards.js) ───
async function generateJobNo() {
  const today = new Date().toISOString().slice(0, 10);
  const dateStr = today.replace(/-/g, '');
  const [rows] = await db.query('SELECT COUNT(*) as cnt FROM job_cards WHERE DATE(job_date) = ?', [today]);
  return `SCW-J${dateStr.slice(2)}-${String(rows[0].cnt + 1).padStart(3, '0')}`;
}

// ═══════════════════════════════════════════════════════════════
// GET /api/quick-job-cards/quick-services — List active quick services
// ═══════════════════════════════════════════════════════════════
router.get('/quick-services', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, service_name, default_rate, sort_order FROM quick_services WHERE is_active = 1 ORDER BY sort_order ASC'
    );
    res.json({ data: rows });
  } catch (err) {
    // If quick_services table doesn't exist yet, return empty array
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.warn('quick_services table not found — run migration_quick_jobcard.sql');
      return res.json({ data: [] });
    }
    console.error('GET /quick-services error:', err);
    res.status(500).json({ error: 'Failed to fetch quick services' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/quick-job-cards — Create a quick job card
// ═══════════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const {
      reg_no, owner_name, mobile, car_name, car_make, car_model,
      services, custom_service, custom_service_rate
    } = req.body;

    // Validate required fields
    if (!reg_no || !owner_name || !mobile || !car_name) {
      return res.status(400).json({ error: 'reg_no, owner_name, mobile, and car_name are required' });
    }

    // 1. Generate job_no using EXACT same pattern as jobCards.js
    const job_no = await generateJobNo();

    // 2. Generate public_token using uuid v4
    const public_token = uuidv4();

    // 3. INSERT into job_cards — try full schema first, fall back to base schema
    let result;
    try {
      [result] = await db.execute(
        `INSERT INTO job_cards (job_no, reg_no, car_name, owner_name, mobile_no, status, is_quick_job, public_token)
         VALUES (?, ?, ?, ?, ?, 'rfe', 1, ?)`,
        [job_no, reg_no.toUpperCase().trim(), car_name, owner_name, mobile, public_token]
      );
    } catch (insertErr) {
      // Fallback: columns from migration_quick_jobcard.sql may not exist, or 'rfe' status not in enum
      console.warn('Quick job INSERT fallback:', insertErr.message);
      try {
        [result] = await db.execute(
          `INSERT INTO job_cards (job_no, reg_no, car_name, owner_name, mobile_no, status)
           VALUES (?, ?, ?, ?, ?, 'rfe')`,
          [job_no, reg_no.toUpperCase().trim(), car_name, owner_name, mobile]
        );
      } catch (fallbackErr) {
        // Final fallback: 'rfe' status doesn't exist in base schema, use 'active'
        [result] = await db.execute(
          `INSERT INTO job_cards (job_no, reg_no, car_name, owner_name, mobile_no, status)
           VALUES (?, ?, ?, ?, ?, 'active')`,
          [job_no, reg_no.toUpperCase().trim(), car_name, owner_name, mobile]
        );
      }
    }
    const jobId = result.insertId;

    // 4. Helper to INSERT a service line item — try CRM schema, fall back to base schema
    async function insertService(jobCardId, serviceName, qty, rate, amount) {
      try {
        await db.execute(
          `INSERT INTO job_card_services (job_card_id, service_name, item_type, qty, rate, amount, tax_pct)
           VALUES (?, ?, 'labour', ?, ?, ?, 0)`,
          [jobCardId, serviceName, qty, rate, amount]
        );
      } catch (svcErr) {
        // Fallback: CRM columns (item_type, qty, rate, tax_pct) may not exist
        await db.execute(
          `INSERT INTO job_card_services (job_card_id, service_name, amount)
           VALUES (?, ?, ?)`,
          [jobCardId, serviceName, amount]
        );
      }
    }

    // 5. If services[] provided, INSERT each into job_card_services
    if (services && Array.isArray(services)) {
      for (const svc of services) {
        if (svc.service_name && svc.amount !== undefined) {
          await insertService(
            jobId,
            svc.service_name,
            svc.qty || 1,
            svc.rate || parseFloat(svc.amount) || 0,
            parseFloat(svc.amount) || 0
          );
        }
      }
    }

    // 6. If custom_service provided, INSERT as a service line item
    if (custom_service && custom_service.trim()) {
      const customRate = parseFloat(custom_service_rate) || 0;
      await insertService(jobId, custom_service.trim(), 1, customRate, customRate);
    }

    // 7. Build tracking URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
    const tracking_url = `${baseUrl}/track/${public_token}`;

    res.status(201).json({
      id: jobId,
      job_no,
      public_token,
      tracking_url,
      message: 'Quick job card created'
    });
  } catch (err) {
    console.error('POST /quick-job-cards error:', err);
    res.status(500).json({ error: 'Failed to create quick job card' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/quick-job-cards/send-tracking-sms — Send tracking link SMS
// ═══════════════════════════════════════════════════════════════
router.post('/send-tracking-sms', async (req, res) => {
  try {
    const { job_card_id } = req.body;
    if (!job_card_id) {
      return res.status(400).json({ error: 'job_card_id is required' });
    }

    // Fetch job card
    const [rows] = await db.query(
      'SELECT id, job_no, owner_name, mobile_no, public_token FROM job_cards WHERE id = ?',
      [job_card_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Job card not found' });
    }

    const job = rows[0];
    if (!job.public_token) {
      return res.status(400).json({ error: 'No tracking token found for this job card' });
    }

    const mobile = job.mobile_no;
    if (!mobile) {
      return res.status(400).json({ error: 'No mobile number found on job card' });
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
    const tracking_url = `${baseUrl}/track/${job.public_token}`;
    const message = `Dear ${job.owner_name}, track your Swish Auto Care job card ${job.job_no} at: ${tracking_url}`;

    // Call msg91 sendSMS
    const msg91 = require('../utils/msg91');
    await msg91.sendSMS({
      to: mobile,
      message,
      jobCardId: job_card_id,
      userId: req.user?.id || null
    });

    // Log in bill_dispatch_log
    try {
      await db.execute(
        `INSERT INTO bill_dispatch_log (job_card_id, dispatch_type, recipient_no, template_name, status)
         VALUES (?, 'sms', ?, 'tracking_link', 'sent')`,
        [job_card_id, mobile]
      );
    } catch (logErr) {
      console.error('Failed to log SMS dispatch (non-fatal):', logErr.message);
    }

    res.json({ message: 'SMS sent' });
  } catch (err) {
    console.error('POST /send-tracking-sms error:', err);
    res.status(500).json({ error: 'Failed to send tracking SMS' });
  }
});

module.exports = router;
