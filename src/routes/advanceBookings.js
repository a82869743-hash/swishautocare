const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ─── Number Generator ────────────────────────────────────────────
async function generateBookingNo() {
  const today = new Date().toISOString().slice(0, 10);
  const dateStr = today.replace(/-/g, '');
  const [rows] = await db.query(
    'SELECT COUNT(*) as cnt FROM advance_bookings WHERE DATE(created_at) = ?',
    [today]
  );
  return `SAC-BK-${dateStr.slice(2)}-${String(rows[0].cnt + 1).padStart(3, '0')}`;
}

// ═══════════════════════════════════════════════════════════════
// GET /api/advance-bookings — List with filters
// ═══════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { status, date, search, page = 1, limit = 50 } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      where += ' AND ab.status = ?';
      params.push(status);
    }
    if (date) {
      where += ' AND ab.booking_date = ?';
      params.push(date);
    }
    if (search) {
      where += ' AND (ab.customer_name LIKE ? OR ab.mobile_no LIKE ? OR ab.reg_no LIKE ? OR ab.booking_no LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q, q);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM advance_bookings ab ${where}`,
      params
    );

    const [rows] = await db.query(
      `SELECT ab.*, jc.job_no
       FROM advance_bookings ab
       LEFT JOIN job_cards jc ON ab.job_card_id = jc.id
       ${where}
       ORDER BY ab.booking_date ASC, ab.booking_time ASC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({ data: rows, total: countRows[0].total, page: parseInt(page) });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ data: [], total: 0, page: 1 });
    }
    console.error('GET /advance-bookings error:', err);
    res.status(500).json({ error: 'Failed to fetch advance bookings' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/advance-bookings/today — Today's bookings count (dashboard widget)
// ═══════════════════════════════════════════════════════════════
router.get('/today', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [rows] = await db.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'arrived' THEN 1 ELSE 0 END) as arrived
       FROM advance_bookings
       WHERE booking_date = ?`,
      [today]
    );

    const [upcoming] = await db.query(
      `SELECT id, booking_no, customer_name, mobile_no, reg_no, car_name, 
              service_type, booking_time, status
       FROM advance_bookings
       WHERE booking_date = ? AND status IN ('pending','confirmed')
       ORDER BY booking_time ASC
       LIMIT 5`,
      [today]
    );

    res.json({ ...rows[0], upcoming });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ total: 0, pending: 0, confirmed: 0, arrived: 0, upcoming: [] });
    }
    console.error('GET /advance-bookings/today error:', err);
    res.status(500).json({ error: 'Failed to fetch today bookings' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/advance-bookings/:id — Single booking
// ═══════════════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ab.*, jc.job_no, jc.status as job_status
       FROM advance_bookings ab
       LEFT JOIN job_cards jc ON ab.job_card_id = jc.id
       WHERE ab.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /advance-bookings/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/advance-bookings — Create
// ═══════════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const {
      customer_name, mobile_no, reg_no, car_name,
      service_type, booking_date, booking_time, notes
    } = req.body;

    if (!customer_name || !mobile_no || !booking_date) {
      return res.status(400).json({ error: 'customer_name, mobile_no and booking_date are required' });
    }

    const booking_no = await generateBookingNo();

    const [result] = await db.execute(
      `INSERT INTO advance_bookings 
        (booking_no, customer_name, mobile_no, reg_no, car_name, service_type, booking_date, booking_time, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        booking_no, customer_name, mobile_no,
        reg_no || null, car_name || null, service_type || null,
        booking_date, booking_time || null, notes || null,
        req.user?.id || null
      ]
    );

    res.status(201).json({ id: result.insertId, booking_no, message: 'Booking created' });
  } catch (err) {
    console.error('POST /advance-bookings error:', err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PATCH /api/advance-bookings/:id/status — Update status
// ═══════════════════════════════════════════════════════════════
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, job_card_id } = req.body;
    const validStatuses = ['pending', 'confirmed', 'arrived', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updates = ['status = ?'];
    const values = [status];

    if (job_card_id) {
      updates.push('job_card_id = ?');
      values.push(job_card_id);
    }

    values.push(req.params.id);
    await db.execute(
      `UPDATE advance_bookings SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({ message: `Booking status updated to ${status}` });
  } catch (err) {
    console.error('PATCH /advance-bookings/:id/status error:', err);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PUT /api/advance-bookings/:id — Edit booking
// ═══════════════════════════════════════════════════════════════
router.put('/:id', async (req, res) => {
  try {
    const {
      customer_name, mobile_no, reg_no, car_name,
      service_type, booking_date, booking_time, notes
    } = req.body;

    await db.execute(
      `UPDATE advance_bookings SET
        customer_name = ?, mobile_no = ?, reg_no = ?, car_name = ?,
        service_type = ?, booking_date = ?, booking_time = ?, notes = ?
       WHERE id = ?`,
      [
        customer_name, mobile_no, reg_no || null, car_name || null,
        service_type || null, booking_date, booking_time || null,
        notes || null, req.params.id
      ]
    );

    res.json({ message: 'Booking updated' });
  } catch (err) {
    console.error('PUT /advance-bookings/:id error:', err);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// ═══════════════════════════════════════════════════════════════
// DELETE /api/advance-bookings/:id — Delete (only pending/cancelled)
// ═══════════════════════════════════════════════════════════════
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT status FROM advance_bookings WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    if (rows[0].status === 'arrived') {
      return res.status(400).json({ error: 'Cannot delete an arrived booking' });
    }
    await db.execute('DELETE FROM advance_bookings WHERE id = ?', [req.params.id]);
    res.json({ message: 'Booking deleted' });
  } catch (err) {
    console.error('DELETE /advance-bookings/:id error:', err);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

module.exports = router;
