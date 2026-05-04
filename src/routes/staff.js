const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ───── Staff Code Generator ─────
async function generateStaffCode() {
  const [rows] = await db.query('SELECT staff_code FROM staff ORDER BY id DESC LIMIT 1');
  if (rows.length === 0) return 'SAC-STF-001';
  const last = rows[0].staff_code; // e.g. SAC-STF-004
  const num = parseInt(last.split('-')[2]) + 1;
  return `SAC-STF-${String(num).padStart(3, '0')}`;
}

// ───── GET /api/staff ─────
router.get('/', async (req, res) => {
  try {
    const { is_active } = req.query;
    let query = 'SELECT * FROM staff';
    const params = [];
    if (is_active !== undefined) {
      query += ' WHERE is_active = ?';
      params.push(parseInt(is_active));
    }
    query += ' ORDER BY staff_code ASC';
    const [rows] = await db.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /staff error:', err);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// ───── POST /api/staff ─────
router.post('/', async (req, res) => {
  try {
    const { full_name, role, mobile_no, date_of_joining, monthly_salary } = req.body;
    if (!full_name || !role || !monthly_salary) {
      return res.status(400).json({ error: 'Full name, role, and monthly salary are required' });
    }
    const staff_code = await generateStaffCode();
    const [result] = await db.execute(
      `INSERT INTO staff (staff_code, full_name, role, mobile_no, date_of_joining, monthly_salary)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [staff_code, full_name, role, mobile_no || null, date_of_joining || null, parseFloat(monthly_salary)]
    );
    res.status(201).json({ id: result.insertId, staff_code, message: 'Staff member added' });
  } catch (err) {
    console.error('POST /staff error:', err);
    res.status(500).json({ error: 'Failed to add staff' });
  }
});

// ───── PUT /api/staff/:id ─────
router.put('/:id', async (req, res) => {
  try {
    const allowedFields = ['full_name', 'role', 'mobile_no', 'date_of_joining', 'monthly_salary', 'is_active'];
    const updates = [];
    const values = [];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.params.id);
    await db.execute(`UPDATE staff SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Staff updated' });
  } catch (err) {
    console.error('PUT /staff/:id error:', err);
    res.status(500).json({ error: 'Failed to update staff' });
  }
});

// ───── PATCH /api/staff/:id/toggle ─────
router.patch('/:id/toggle', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT is_active FROM staff WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Staff not found' });
    const newStatus = rows[0].is_active === 1 ? 0 : 1;
    await db.execute('UPDATE staff SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);
    res.json({ message: `Staff ${newStatus ? 'activated' : 'deactivated'}`, is_active: newStatus });
  } catch (err) {
    console.error('PATCH /staff/:id/toggle error:', err);
    res.status(500).json({ error: 'Failed to toggle staff status' });
  }
});

module.exports = router;
