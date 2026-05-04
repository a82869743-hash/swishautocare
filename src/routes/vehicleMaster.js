const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

router.use(auth);

// ───── GET /api/vehicle-master/makes?q=hyun ─────
// Returns matching makes for autocomplete
router.get('/makes', async (req, res) => {
  try {
    const { q = '' } = req.query;
    const [rows] = await db.query(
      `SELECT DISTINCT make FROM vehicle_master 
       WHERE make LIKE ? AND is_active = 1 
       ORDER BY make ASC LIMIT 20`,
      [`%${q}%`]
    );
    res.json(rows.map(r => r.make));
  } catch (err) {
    console.error('GET /vehicle-master/makes error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ───── GET /api/vehicle-master/models?make=Hyundai&q=cre ─────
// Returns matching models for a given make + optional search
router.get('/models', async (req, res) => {
  try {
    const { make, q = '' } = req.query;

    let query = `SELECT model, fuel_types, variants FROM vehicle_master WHERE is_active = 1`;
    const params = [];

    if (make) {
      query += ` AND make = ?`;
      params.push(make);
    }
    if (q) {
      query += ` AND model LIKE ?`;
      params.push(`%${q}%`);
    }

    query += ` ORDER BY model ASC LIMIT 30`;

    const [rows] = await db.query(query, params);
    res.json(rows.map(r => ({
      model: r.model,
      fuel_types: typeof r.fuel_types === 'string' ? JSON.parse(r.fuel_types) : (r.fuel_types || []),
      variants: typeof r.variants === 'string' ? JSON.parse(r.variants) : (r.variants || [])
    })));
  } catch (err) {
    console.error('GET /vehicle-master/models error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
