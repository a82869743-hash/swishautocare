const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ───── Part Code Generator ─────
async function generatePartCode() {
  const [rows] = await db.query('SELECT part_code FROM parts ORDER BY id DESC LIMIT 1');
  if (rows.length === 0) return 'SAC-PRT-001';
  const last = rows[0].part_code;
  const num = parseInt(last.split('-')[2]) + 1;
  return `SAC-PRT-${String(num).padStart(3, '0')}`;
}

// ───── GET /api/parts ─────
router.get('/', async (req, res) => {
  try {
    const { category, low_stock } = req.query;
    let query = 'SELECT *, (stock_qty <= low_stock_alert) as is_low FROM parts';
    const conditions = [];
    const params = [];

    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (low_stock === 'true') {
      conditions.push('stock_qty <= low_stock_alert');
    }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY part_code ASC';

    const [rows] = await db.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /parts error:', err);
    res.status(500).json({ error: 'Failed to fetch parts' });
  }
});

// ───── POST /api/parts ─────
router.post('/', async (req, res) => {
  try {
    const { part_name, category, unit, buying_price, selling_price, stock_qty, low_stock_alert } = req.body;
    if (!part_name || !selling_price) {
      return res.status(400).json({ error: 'Part name and selling price required' });
    }
    const part_code = await generatePartCode();
    const [result] = await db.execute(
      `INSERT INTO parts (part_code, part_name, category, unit, buying_price, selling_price, stock_qty, low_stock_alert)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [part_code, part_name, category || 'General', unit || 'pc', buying_price || 0, selling_price, stock_qty || 0, low_stock_alert || 5]
    );
    res.status(201).json({ id: result.insertId, part_code, message: 'Part added' });
  } catch (err) {
    console.error('POST /parts error:', err);
    res.status(500).json({ error: 'Failed to add part' });
  }
});

// ───── PUT /api/parts/:id ─────
router.put('/:id', async (req, res) => {
  try {
    const allowedFields = ['part_name', 'category', 'unit', 'buying_price', 'selling_price', 'stock_qty', 'low_stock_alert'];
    const updates = [];
    const values = [];
    for (const f of allowedFields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.params.id);
    await db.execute(`UPDATE parts SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Part updated' });
  } catch (err) {
    console.error('PUT /parts/:id error:', err);
    res.status(500).json({ error: 'Failed to update part' });
  }
});

// ───── PATCH /api/parts/:id/stock ─────
router.patch('/:id/stock', async (req, res) => {
  try {
    const { adjustment } = req.body;
    if (adjustment === undefined || adjustment === 0) {
      return res.status(400).json({ error: 'Adjustment value required' });
    }
    await db.execute(
      'UPDATE parts SET stock_qty = stock_qty + ? WHERE id = ?',
      [parseInt(adjustment), req.params.id]
    );
    const [rows] = await db.query('SELECT stock_qty FROM parts WHERE id = ?', [req.params.id]);
    res.json({ message: 'Stock adjusted', new_stock: rows[0]?.stock_qty });
  } catch (err) {
    console.error('PATCH /parts/:id/stock error:', err);
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
});

module.exports = router;
