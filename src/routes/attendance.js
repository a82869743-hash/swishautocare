const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ───── GET /api/attendance?date=YYYY-MM-DD ─────
router.get('/', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const [rows] = await db.query(
      `SELECT s.id as staff_id, s.full_name as staff_name, s.staff_code,
              a.status, a.id as attendance_id,
              TIME_FORMAT(a.entry_time, '%H:%i') as entry_time,
              TIME_FORMAT(a.exit_time, '%H:%i') as exit_time
       FROM staff s
       LEFT JOIN attendance a ON a.staff_id = s.id AND a.attendance_date = ?
       WHERE s.is_active = 1
       ORDER BY s.staff_code ASC`,
      [date]
    );
    res.json({ date, records: rows });
  } catch (err) {
    console.error('GET /attendance error:', err);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// ───── POST /api/attendance/bulk ─────
router.post('/bulk', async (req, res) => {
  try {
    const { date, records } = req.body;
    if (!date || !records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Date and records array required' });
    }

    let count = 0;
    for (const r of records) {
      if (!r.staff_id || !r.status) continue;
      const entryTime = r.entry_time || null;
      const exitTime = r.exit_time || null;
      await db.execute(
        `INSERT INTO attendance (staff_id, attendance_date, status, entry_time, exit_time)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), entry_time = VALUES(entry_time), exit_time = VALUES(exit_time), updated_at = NOW()`,
        [r.staff_id, date, r.status, entryTime, exitTime]
      );
      count++;
    }

    res.json({ message: 'Attendance saved', count });
  } catch (err) {
    console.error('POST /attendance/bulk error:', err);
    res.status(500).json({ error: 'Failed to save attendance' });
  }
});

// ───── GET /api/attendance/summary/:staffId ─────
router.get('/summary/:staffId', async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: 'Month and year query params required' });
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().slice(0, 10);

    const [records] = await db.query(
      `SELECT attendance_date, status,
              TIME_FORMAT(entry_time, '%H:%i') as entry_time,
              TIME_FORMAT(exit_time, '%H:%i') as exit_time
       FROM attendance
       WHERE staff_id = ? AND attendance_date BETWEEN ? AND ?
       ORDER BY attendance_date ASC`,
      [req.params.staffId, startDate, endDate]
    );

    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const half = records.filter(r => r.status === 'half').length;

    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    res.json({
      staff_id: parseInt(req.params.staffId),
      month: `${monthNames[parseInt(month)]} ${year}`,
      present,
      absent,
      half,
      effective_days: present + (half * 0.5),
      records
    });
  } catch (err) {
    console.error('GET /attendance/summary error:', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

module.exports = router;
