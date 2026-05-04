const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ───── GET /api/parts-sales ─────
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    let query = `SELECT ps.*, p.part_name, p.part_code
                 FROM parts_sales ps
                 JOIN parts p ON ps.part_id = p.id`;
    const params = [];

    if (date) {
      query += ' WHERE DATE(ps.sale_date) = ?';
      params.push(date);
    }
    query += ' ORDER BY ps.sale_date DESC';

    const [rows] = await db.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /parts-sales error:', err);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// ───── POST /api/parts-sales — ATOMIC STOCK DEDUCTION ─────
router.post('/', async (req, res) => {
  try {
    const { part_id, quantity, unit_price, customer_name, payment_mode, job_card_id } = req.body;

    if (!part_id || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Part and valid quantity required' });
    }
    if (!payment_mode) {
      return res.status(400).json({ error: 'Payment mode required' });
    }

    // Atomic stock deduction: only succeeds if enough stock
    const [updateResult] = await db.execute(
      'UPDATE parts SET stock_qty = stock_qty - ? WHERE id = ? AND stock_qty >= ?',
      [parseInt(quantity), part_id, parseInt(quantity)]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    const total_amount = parseFloat(unit_price) * parseInt(quantity);

    const [insertResult] = await db.execute(
      `INSERT INTO parts_sales (part_id, quantity, unit_price, total_amount, customer_name, payment_mode, job_card_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [part_id, parseInt(quantity), parseFloat(unit_price), total_amount, customer_name || null, payment_mode, job_card_id || null]
    );

    // Get the part name for the response
    const [partRows] = await db.query('SELECT part_name, stock_qty FROM parts WHERE id = ?', [part_id]);

    res.status(201).json({
      id: insertResult.insertId,
      part_name: partRows[0]?.part_name,
      remaining_stock: partRows[0]?.stock_qty,
      total_amount,
      message: 'Sale recorded'
    });
  } catch (err) {
    console.error('POST /parts-sales error:', err);
    res.status(500).json({ error: 'Failed to record sale' });
  }
});

module.exports = router;
