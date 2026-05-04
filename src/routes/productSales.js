const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ───── GET /api/product-sales ─────
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    let query = 'SELECT * FROM product_sales';
    const params = [];

    if (date) {
      query += ' WHERE DATE(sale_date) = ?';
      params.push(date);
    }
    query += ' ORDER BY sale_date DESC';

    const [rows] = await db.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /product-sales error:', err);
    res.status(500).json({ error: 'Failed to fetch product sales' });
  }
});

// ───── POST /api/product-sales ─────
router.post('/', async (req, res) => {
  try {
    const { product_name, price, customer_name, payment_mode } = req.body;

    if (!product_name || !price || parseFloat(price) <= 0) {
      return res.status(400).json({ error: 'Product name and valid price are required' });
    }
    if (!payment_mode) {
      return res.status(400).json({ error: 'Payment mode is required' });
    }

    const [result] = await db.execute(
      `INSERT INTO product_sales (product_name, price, customer_name, payment_mode)
       VALUES (?, ?, ?, ?)`,
      [product_name, parseFloat(price), customer_name || null, payment_mode.toLowerCase()]
    );

    res.status(201).json({
      id: result.insertId,
      product_name,
      price: parseFloat(price),
      message: 'Sale recorded successfully'
    });
  } catch (err) {
    console.error('POST /product-sales error:', err);
    res.status(500).json({ error: 'Failed to record sale' });
  }
});

module.exports = router;
