const express = require('express');
const db = require('../config/db');

const router = express.Router();
// ── NO AUTH MIDDLEWARE — This is a PUBLIC route ──

// ═══════════════════════════════════════════════════════════════
// GET /api/public/job-card/:token — Public job card tracking
// ═══════════════════════════════════════════════════════════════
router.get('/job-card/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token || token.length < 10) {
      return res.status(400).json({ error: 'Invalid tracking token' });
    }

    // Fetch job card by public_token — ONLY expose safe fields
    const [rows] = await db.query(
      `SELECT 
        jc.id,
        jc.job_no,
        jc.reg_no,
        jc.car_name,
        jc.owner_name,
        jc.status,
        jc.job_date,
        jc.service_type,
        jc.vehicle_make,
        jc.vehicle_model,
        jc.is_quick_job
       FROM job_cards jc
       WHERE jc.public_token = ?
       LIMIT 1`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Job card not found' });
    }

    const job = rows[0];

    // Fetch services (only names & amounts — no internal fields)
    const [services] = await db.query(
      `SELECT service_name, item_type, qty, rate, amount
       FROM job_card_services
       WHERE job_card_id = ?
       ORDER BY id ASC`,
      [job.id]
    );

    // Compute total
    const total = services.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);

    // Fetch media (photos) — safe fallback if table doesn't exist
    let media = [];
    try {
      const [mediaRows] = await db.query(
        `SELECT file_path, stage, caption FROM job_card_media WHERE job_card_id = ? ORDER BY stage, id`,
        [job.id]
      );
      media = mediaRows.map(m => ({
        url: m.file_path,
        stage: m.stage,
        caption: m.caption || null,
      }));
    } catch (mediaErr) {
      if (mediaErr.code !== 'ER_NO_SUCH_TABLE') console.error('Media fetch error:', mediaErr);
    }

    // Build a user-friendly status label
    const STATUS_LABELS = {
      rfe: 'Request for Estimation',
      estimation: 'Estimation Prepared',
      spares_pending: 'Waiting for Spare Parts',
      wip: 'Work in Progress',
      ready: 'Ready for Delivery',
      delivered: 'Delivered',
      invoiced: 'Invoiced & Completed'
    };

    res.json({
      job_no: job.job_no,
      reg_no: job.reg_no,
      car_name: job.car_name,
      owner_name: job.owner_name,
      status: job.status,
      status_label: STATUS_LABELS[job.status] || job.status,
      job_date: job.job_date,
      service_type: job.service_type,
      vehicle_make: job.vehicle_make,
      vehicle_model: job.vehicle_model,
      is_quick_job: job.is_quick_job,
      services: services.map(s => ({
        name: s.service_name,
        type: s.item_type,
        qty: s.qty,
        rate: s.rate,
        amount: s.amount
      })),
      total,
      media
    });
  } catch (err) {
    console.error('GET /public/job-card/:token error:', err);
    res.status(500).json({ error: 'Failed to fetch job card status' });
  }
});

module.exports = router;
