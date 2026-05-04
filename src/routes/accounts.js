const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ───── GET /api/accounts/summary ─────
router.get('/summary', async (req, res) => {
  try {
    const from = req.query.from || new Date().toISOString().slice(0, 10);
    const to = req.query.to || from;

    // Invoice revenue (with GST)
    const [invoiceRev] = await db.query(
      "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE DATE(created_at) BETWEEN ? AND ?",
      [from, to]
    );
    // Estimate revenue (no GST — subtotal only)
    const [estimateRev] = await db.query(
      "SELECT COALESCE(SUM(subtotal), 0) as total FROM estimates WHERE DATE(created_at) BETWEEN ? AND ?",
      [from, to]
    );
    // Product sales revenue
    const [productRev] = await db.query(
      "SELECT COALESCE(SUM(price), 0) as total FROM product_sales WHERE DATE(sale_date) BETWEEN ? AND ?",
      [from, to]
    );
    // Cash in (other)
    const [cashIn] = await db.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE entry_type = 'in' AND DATE(entry_date) BETWEEN ? AND ?",
      [from, to]
    );
    // Staff payments
    const [staffPay] = await db.query(
      "SELECT COALESCE(SUM(paid_amount), 0) as total FROM staff_payments WHERE DATE(payment_date) BETWEEN ? AND ?",
      [from, to]
    );
    // Cash out (other)
    const [cashOut] = await db.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE entry_type = 'out' AND DATE(entry_date) BETWEEN ? AND ?",
      [from, to]
    );

    const income = {
      invoice_revenue: parseFloat(invoiceRev[0].total),
      estimate_revenue: parseFloat(estimateRev[0].total),
      product_revenue: parseFloat(productRev[0].total),
      cash_in_other: parseFloat(cashIn[0].total),
    };
    income.total = income.invoice_revenue + income.estimate_revenue + income.product_revenue + income.cash_in_other;

    const expense = {
      staff_payments: parseFloat(staffPay[0].total),
      cash_out_other: parseFloat(cashOut[0].total),
    };
    expense.total = expense.staff_payments + expense.cash_out_other;

    res.json({
      from, to, income, expense,
      net_balance: income.total - expense.total
    });
  } catch (err) {
    console.error('GET /accounts/summary error:', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// ───── GET /api/accounts/transactions ─────
router.get('/transactions', async (req, res) => {
  try {
    const from = req.query.from || new Date().toISOString().slice(0, 10);
    const to = req.query.to || from;

    const [rows] = await db.query(
      `(SELECT i.created_at as date,
              CONCAT('Invoice: ', i.invoice_no, ' - ', jc.reg_no, ' (', jc.car_name, ')') as description,
              i.total_amount as amount, 'invoice' as type, i.invoice_no as reference
       FROM invoices i
       JOIN job_cards jc ON i.job_card_id = jc.id
       WHERE DATE(i.created_at) BETWEEN ? AND ?)
      UNION ALL
      (SELECT e.created_at as date,
              CONCAT('Estimate: ', e.estimate_no, ' - ', jc.reg_no, ' (', jc.car_name, ')') as description,
              e.subtotal as amount, 'estimate' as type, e.estimate_no as reference
       FROM estimates e
       JOIN job_cards jc ON e.job_card_id = jc.id
       WHERE DATE(e.created_at) BETWEEN ? AND ?)
      UNION ALL
      (SELECT sale_date as date, CONCAT('Product: ', product_name) as description,
              price as amount, 'product' as type, CONCAT('#', id) as reference
       FROM product_sales
       WHERE DATE(sale_date) BETWEEN ? AND ?)
      UNION ALL
      (SELECT entry_date as date, description, amount, 'cash_in' as type, category as reference
       FROM cash_ledger WHERE entry_type = 'in' AND DATE(entry_date) BETWEEN ? AND ?)
      UNION ALL
      (SELECT entry_date as date, description, amount, 'cash_out' as type, category as reference
       FROM cash_ledger WHERE entry_type = 'out' AND DATE(entry_date) BETWEEN ? AND ?)
      UNION ALL
      (SELECT sp.payment_date as date, CONCAT('Salary: ', s.full_name, ' - ', sp.payment_month) as description,
              sp.paid_amount as amount, 'salary' as type, s.staff_code as reference
       FROM staff_payments sp JOIN staff s ON sp.staff_id = s.id
       WHERE DATE(sp.payment_date) BETWEEN ? AND ?)
      ORDER BY date DESC`,
      [from, to, from, to, from, to, from, to, from, to, from, to]
    );

    res.json({ data: rows });
  } catch (err) {
    console.error('GET /accounts/transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

module.exports = router;
