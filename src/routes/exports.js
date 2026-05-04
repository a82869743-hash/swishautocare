const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');
const { createExcelResponse } = require('../utils/excel');

const router = express.Router();
router.use(auth);

// ───── GET /api/exports/job-cards ─────
router.get('/job-cards', async (req, res) => {
  try {
    const from = req.query.from || '2020-01-01';
    const to = req.query.to || '2099-12-31';
    const [rows] = await db.query(
      `SELECT jc.job_no as 'Job No', jc.job_type as 'Type', jc.reg_no as 'Reg No',
              jc.car_name as 'Car Name', jc.owner_name as 'Owner', jc.mobile_no as 'Mobile',
              jc.service_type as 'Service', s.full_name as 'Staff',
              jc.estimated_amount as 'Estimated ₹', jc.final_amount as 'Final ₹',
              jc.payment_mode as 'Payment Mode', jc.status as 'Status',
              jc.job_date as 'Job Date', jc.closed_at as 'Closed At'
       FROM job_cards jc LEFT JOIN staff s ON jc.assigned_staff_id = s.id
       WHERE DATE(jc.job_date) BETWEEN ? AND ?
       ORDER BY jc.job_date DESC`,
      [from, to]
    );
    createExcelResponse(res, `SwishGMS_JobCards.xlsx`, [
      { sheetName: 'Job Cards', data: rows.length ? rows : [{ 'No Data': 'No job cards in range' }] }
    ]);
  } catch (err) {
    console.error('GET /exports/job-cards error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ───── GET /api/exports/staff-attendance ─────
router.get('/staff-attendance', async (req, res) => {
  try {
    const month = req.query.month || (new Date().getMonth() + 1);
    const year = req.query.year || new Date().getFullYear();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().slice(0, 10);

    const [staffRows] = await db.query(
      `SELECT staff_code as 'Staff Code', full_name as 'Name', role as 'Role',
              mobile_no as 'Mobile', date_of_joining as 'Joining Date',
              monthly_salary as 'Salary', IF(is_active, 'Active', 'Inactive') as 'Status'
       FROM staff ORDER BY staff_code`
    );

    const [attRows] = await db.query(
      `SELECT s.full_name as 'Staff', a.attendance_date as 'Date', a.status as 'Status'
       FROM attendance a JOIN staff s ON a.staff_id = s.id
       WHERE a.attendance_date BETWEEN ? AND ?
       ORDER BY s.full_name, a.attendance_date`,
      [startDate, endDate]
    );

    createExcelResponse(res, `SwishGMS_StaffAttendance.xlsx`, [
      { sheetName: 'Staff Master', data: staffRows.length ? staffRows : [{ 'No Data': 'No staff' }] },
      { sheetName: 'Attendance', data: attRows.length ? attRows : [{ 'No Data': 'No attendance' }] }
    ]);
  } catch (err) {
    console.error('GET /exports/staff-attendance error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ───── GET /api/exports/parts-inventory ─────
router.get('/parts-inventory', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT part_code as 'Part Code', part_name as 'Name', category as 'Category',
              unit as 'Unit', buying_price as 'Buy Price', selling_price as 'Sell Price',
              stock_qty as 'Stock Qty', low_stock_alert as 'Low Stock Alert'
       FROM parts ORDER BY part_code`
    );
    createExcelResponse(res, `SwishGMS_PartsInventory.xlsx`, [
      { sheetName: 'Parts', data: rows.length ? rows : [{ 'No Data': 'No parts' }] }
    ]);
  } catch (err) {
    console.error('GET /exports/parts-inventory error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ───── GET /api/exports/accounts ─────
router.get('/accounts', async (req, res) => {
  try {
    const from = req.query.from || new Date().toISOString().slice(0, 10);
    const to = req.query.to || from;

    const [rows] = await db.query(
      `(SELECT DATE(closed_at) as 'Date', 'Job Revenue' as 'Type',
              CONCAT(job_no, ' - ', reg_no) as 'Description', final_amount as 'Amount', job_no as 'Reference'
       FROM job_cards WHERE status = 'done' AND DATE(closed_at) BETWEEN ? AND ?)
      UNION ALL
      (SELECT DATE(ps.sale_date), 'Parts Sale', CONCAT(p.part_name, ' x', ps.quantity),
              ps.total_amount, p.part_code
       FROM parts_sales ps JOIN parts p ON ps.part_id = p.id WHERE DATE(ps.sale_date) BETWEEN ? AND ?)
      UNION ALL
      (SELECT DATE(entry_date), 'Cash In', description, amount, category
       FROM cash_ledger WHERE entry_type = 'in' AND DATE(entry_date) BETWEEN ? AND ?)
      UNION ALL
      (SELECT DATE(entry_date), 'Cash Out', description, amount, category
       FROM cash_ledger WHERE entry_type = 'out' AND DATE(entry_date) BETWEEN ? AND ?)
      UNION ALL
      (SELECT DATE(sp.payment_date), 'Staff Payment', CONCAT(s.full_name, ' - ', sp.payment_month),
              sp.paid_amount, s.staff_code
       FROM staff_payments sp JOIN staff s ON sp.staff_id = s.id WHERE DATE(sp.payment_date) BETWEEN ? AND ?)
      ORDER BY 1 DESC`,
      [from, to, from, to, from, to, from, to, from, to]
    );

    createExcelResponse(res, `SwishGMS_Accounts.xlsx`, [
      { sheetName: 'Transactions', data: rows.length ? rows : [{ 'No Data': 'No transactions' }] }
    ]);
  } catch (err) {
    console.error('GET /exports/accounts error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

module.exports = router;
