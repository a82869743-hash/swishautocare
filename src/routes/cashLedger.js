const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ───── GET /api/cash-ledger ─────
router.get('/', async (req, res) => {
  try {
    const { from, to, entry_type } = req.query;
    let query = 'SELECT * FROM cash_ledger';
    const conditions = [];
    const params = [];

    if (from) {
      conditions.push('DATE(entry_date) >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('DATE(entry_date) <= ?');
      params.push(to);
    }
    if (entry_type) {
      conditions.push('entry_type = ?');
      params.push(entry_type);
    }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY entry_date DESC';

    const [rows] = await db.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /cash-ledger error:', err);
    res.status(500).json({ error: 'Failed to fetch ledger' });
  }
});

// ───── POST /api/cash-ledger ─────
router.post('/', async (req, res) => {
  try {
    const { entry_type, amount, category, description, entry_date } = req.body;

    if (!entry_type || !['in', 'out'].includes(entry_type)) {
      return res.status(400).json({ error: 'Entry type must be "in" or "out"' });
    }
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const [result] = await db.execute(
      `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date)
       VALUES (?, ?, ?, ?, ?)`,
      [entry_type, parseFloat(amount), category || 'Other', description.trim(), entry_date || new Date().toISOString().slice(0, 19).replace('T', ' ')]
    );

    res.status(201).json({ id: result.insertId, message: 'Ledger entry created' });
  } catch (err) {
    console.error('POST /cash-ledger error:', err);
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

module.exports = router;
