const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ═══════════════════════════════════════════════════════════════
// GET /api/service-catalog — Search & filter service catalog
// ═══════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { search, category, item_type, limit = 50 } = req.query;
    let where = 'WHERE is_active = 1';
    const params = [];

    if (category && category !== 'all') {
      where += ' AND category = ?';
      params.push(category);
    }
    if (item_type && item_type !== 'all') {
      where += ' AND item_type = ?';
      params.push(item_type);
    }
    if (search) {
      where += ' AND (name LIKE ? OR hsn_sac LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q);
    }

    const [rows] = await db.query(
      `SELECT * FROM service_catalog ${where} ORDER BY category, name LIMIT ?`,
      [...params, parseInt(limit)]
    );

    res.json({ data: rows });
  } catch (err) {
    console.error('GET /service-catalog error:', err);
    res.status(500).json({ error: 'Failed to fetch service catalog' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/service-catalog/categories — Get category list with counts
// ═══════════════════════════════════════════════════════════════
router.get('/categories', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT category, COUNT(*) as count FROM service_catalog WHERE is_active = 1 GROUP BY category ORDER BY category`
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /service-catalog/categories error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/service-catalog — Add new catalog item
// ═══════════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const { name, category, item_type, default_rate, hsn_sac, tax_pct } = req.body;
    if (!name) return res.status(400).json({ error: 'Service name is required' });

    const [result] = await db.execute(
      `INSERT INTO service_catalog (name, category, item_type, default_rate, hsn_sac, tax_pct)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, category || 'general', item_type || 'labour', default_rate || 0, hsn_sac || null, tax_pct || 18]
    );

    res.status(201).json({ id: result.insertId, message: 'Catalog item added' });
  } catch (err) {
    console.error('POST /service-catalog error:', err);
    res.status(500).json({ error: 'Failed to add catalog item' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/service-catalog/concern-presets — Preset concern chips
// ═══════════════════════════════════════════════════════════════
router.get('/concern-presets', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, concern_text, category FROM concern_presets WHERE is_active = 1 ORDER BY sort_order, id'
    );
    res.json({ data: rows });
  } catch (err) {
    // Graceful fallback if table doesn't exist yet
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ data: [] });
    }
    console.error('GET /concern-presets error:', err);
    res.status(500).json({ error: 'Failed to fetch concern presets' });
  }
});

module.exports = router;
