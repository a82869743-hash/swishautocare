const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ───── GET /api/salary — list payments ─────
router.get('/', async (req, res) => {
  try {
    const { staff_id, payment_month } = req.query;
    let query = `SELECT sp.*, s.full_name as staff_name, s.staff_code
                 FROM staff_payments sp
                 JOIN staff s ON sp.staff_id = s.id`;
    const conditions = [];
    const params = [];

    if (staff_id) {
      conditions.push('sp.staff_id = ?');
      params.push(parseInt(staff_id));
    }
    if (payment_month) {
      conditions.push('sp.payment_month = ?');
      params.push(payment_month);
    }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY sp.payment_date DESC';

    const [rows] = await db.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /salary error:', err);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// ───── GET /api/salary/calculate/:staffId ─────
router.get('/calculate/:staffId', async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: 'Month and year required' });
    }

    // Get staff info
    const [staffRows] = await db.query('SELECT id, full_name, monthly_salary FROM staff WHERE id = ?', [req.params.staffId]);
    if (staffRows.length === 0) return res.status(404).json({ error: 'Staff not found' });
    const staff = staffRows[0];

    // Get attendance for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().slice(0, 10);

    const [records] = await db.query(
      `SELECT status FROM attendance WHERE staff_id = ? AND attendance_date BETWEEN ? AND ?`,
      [req.params.staffId, startDate, endDate]
    );

    const present = records.filter(r => r.status === 'present').length;
    const half = records.filter(r => r.status === 'half').length;
    const effectiveDays = present + (half * 0.5);

    // Formula: (monthly_salary / 26) × effectiveDays
    const dailyRate = parseFloat(staff.monthly_salary) / 26;
    const calculatedSalary = Math.round(dailyRate * effectiveDays * 100) / 100;

    res.json({
      staff_id: staff.id,
      staff_name: staff.full_name,
      monthly_salary: parseFloat(staff.monthly_salary),
      days_present: present,
      half_days: half,
      effective_days: effectiveDays,
      calculated_salary: calculatedSalary
    });
  } catch (err) {
    console.error('GET /salary/calculate error:', err);
    res.status(500).json({ error: 'Failed to calculate salary' });
  }
});

// ───── POST /api/salary — record payment ─────
router.post('/', async (req, res) => {
  try {
    const {
      staff_id, payment_date, payment_month, days_present,
      calculated_salary, paid_amount, payment_type, payment_mode, notes
    } = req.body;

    if (!staff_id || !payment_date || !payment_month || !paid_amount || !payment_type || !payment_mode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [result] = await db.execute(
      `INSERT INTO staff_payments (staff_id, payment_date, payment_month, days_present, calculated_salary, paid_amount, payment_type, payment_mode, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [staff_id, payment_date, payment_month, days_present || 0, calculated_salary || 0, parseFloat(paid_amount), payment_type, payment_mode, notes || null]
    );

    res.status(201).json({ id: result.insertId, message: 'Payment recorded' });
  } catch (err) {
    console.error('POST /salary error:', err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

module.exports = router;
