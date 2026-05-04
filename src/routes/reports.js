const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ───── GET /api/reports/daily?date= ─────
router.get('/daily', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    // Section 1: Invoices (completed jobs with GST)
    const [invoices] = await db.query(
      `SELECT i.invoice_no, jc.job_no, jc.reg_no, jc.car_name,
              i.subtotal, i.gst_percent, i.gst_amount, i.total_amount, i.payment_mode
       FROM invoices i
       JOIN job_cards jc ON i.job_card_id = jc.id
       WHERE DATE(i.created_at) = ?`, [date]
    );

    // Section 2: Estimates (completed jobs without GST)
    const [estimates] = await db.query(
      `SELECT e.estimate_no, jc.job_no, jc.reg_no, jc.car_name,
              e.subtotal, e.payment_mode
       FROM estimates e
       JOIN job_cards jc ON e.job_card_id = jc.id
       WHERE DATE(e.created_at) = ?`, [date]
    );

    // Section 3: Product Sales
    const [products] = await db.query(
      `SELECT product_name, price, customer_name, payment_mode
       FROM product_sales WHERE DATE(sale_date) = ?`, [date]
    );

    // Section 4: Cash In
    const [cashIn] = await db.query(
      "SELECT category, description, amount, entry_date FROM cash_ledger WHERE entry_type = 'in' AND DATE(entry_date) = ?", [date]
    );

    // Section 5: Cash Out
    const [cashOut] = await db.query(
      "SELECT category, description, amount, entry_date FROM cash_ledger WHERE entry_type = 'out' AND DATE(entry_date) = ?", [date]
    );

    // Section 6: Staff Payments
    const [salaries] = await db.query(
      `SELECT s.full_name, sp.payment_month, sp.paid_amount, sp.payment_mode, sp.payment_type
       FROM staff_payments sp JOIN staff s ON sp.staff_id = s.id WHERE DATE(sp.payment_date) = ?`, [date]
    );

    // Section 7: Attendance
    const [attendance] = await db.query(
      `SELECT s.full_name, a.status FROM attendance a JOIN staff s ON a.staff_id = s.id WHERE a.attendance_date = ?`, [date]
    );

    // Totals
    const invoiceTotal = invoices.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0);
    const estimateTotal = estimates.reduce((s, r) => s + parseFloat(r.subtotal || 0), 0);
    const productTotal = products.reduce((s, r) => s + parseFloat(r.price || 0), 0);
    const cashInTotal = cashIn.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const cashOutTotal = cashOut.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const salaryTotal = salaries.reduce((s, r) => s + parseFloat(r.paid_amount || 0), 0);

    const totalIncome = invoiceTotal + estimateTotal + productTotal + cashInTotal;
    const totalExpense = cashOutTotal + salaryTotal;

    res.json({
      date,
      sections: { invoices, estimates, products, cashIn, cashOut, salaries, attendance },
      totals: { invoiceTotal, estimateTotal, productTotal, cashInTotal, cashOutTotal, salaryTotal, totalIncome, totalExpense },
      net_balance: totalIncome - totalExpense
    });
  } catch (err) {
    console.error('GET /reports/daily error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

module.exports = router;
