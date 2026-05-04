const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/dashboard/today — Enhanced with CRM metrics
router.get('/today', async (req, res) => {
  try {
    // Pipeline counts
    const [rfeRows] = await db.query("SELECT COUNT(*) as cnt FROM job_cards WHERE status = 'rfe'");
    const [estimationRows] = await db.query("SELECT COUNT(*) as cnt FROM job_cards WHERE status = 'estimation'");
    const [sparesRows] = await db.query("SELECT COUNT(*) as cnt FROM job_cards WHERE status = 'spares_pending'");
    const [wipRows] = await db.query("SELECT COUNT(*) as cnt FROM job_cards WHERE status = 'wip'");
    const [readyRows] = await db.query("SELECT COUNT(*) as cnt FROM job_cards WHERE status = 'ready'");

    // Pipeline values
    const [rfeVal] = await db.query(
      "SELECT COALESCE(SUM(jcs.amount * COALESCE(jcs.qty,1)), 0) as total FROM job_card_services jcs JOIN job_cards jc ON jcs.job_card_id = jc.id WHERE jc.status = 'rfe'"
    );
    const [estimationVal] = await db.query(
      "SELECT COALESCE(SUM(jcs.amount * COALESCE(jcs.qty,1)), 0) as total FROM job_card_services jcs JOIN job_cards jc ON jcs.job_card_id = jc.id WHERE jc.status = 'estimation'"
    );
    const [wipVal] = await db.query(
      "SELECT COALESCE(SUM(jcs.amount * COALESCE(jcs.qty,1)), 0) as total FROM job_card_services jcs JOIN job_cards jc ON jcs.job_card_id = jc.id WHERE jc.status = 'wip'"
    );
    const [readyVal] = await db.query(
      "SELECT COALESCE(SUM(jcs.amount * COALESCE(jcs.qty,1)), 0) as total FROM job_card_services jcs JOIN job_cards jc ON jcs.job_card_id = jc.id WHERE jc.status = 'ready'"
    );

    // Legacy active count (rfe + estimation + spares + wip + ready)
    const active_jobs = rfeRows[0].cnt + estimationRows[0].cnt + sparesRows[0].cnt + wipRows[0].cnt + readyRows[0].cnt;

    // Completed jobs today
    const [doneRows] = await db.query(
      "SELECT COUNT(*) as cnt FROM job_cards WHERE status IN ('delivered','invoiced') AND DATE(closed_at) = CURDATE()"
    );

    // Today's invoice revenue
    const [invoiceRev] = await db.query(
      "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE DATE(created_at) = CURDATE()"
    );
    // Today's estimate revenue
    const [estimateRev] = await db.query(
      "SELECT COALESCE(SUM(subtotal), 0) as total FROM estimates WHERE DATE(created_at) = CURDATE()"
    );
    // Product sales
    const [productRev] = await db.query(
      "SELECT COALESCE(SUM(price), 0) as total FROM product_sales WHERE DATE(sale_date) = CURDATE()"
    );
    const today_revenue = parseFloat(invoiceRev[0].total) + parseFloat(estimateRev[0].total) + parseFloat(productRev[0].total);

    // Invoice/Estimate counts
    const [invCount] = await db.query("SELECT COUNT(*) as cnt FROM invoices WHERE DATE(created_at) = CURDATE()");
    const [estCount] = await db.query("SELECT COUNT(*) as cnt FROM estimates WHERE DATE(created_at) = CURDATE()");

    // Cash balance
    const [cashInRows] = await db.query("SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE entry_type = 'in'");
    const [cashOutRows] = await db.query("SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE entry_type = 'out'");
    const cash_balance = parseFloat(cashInRows[0].total) - parseFloat(cashOutRows[0].total);

    // Staff present
    const [staffRows] = await db.query(
      "SELECT COUNT(*) as cnt FROM attendance WHERE attendance_date = CURDATE() AND status IN ('present', 'half')"
    );
    const [totalStaff] = await db.query("SELECT COUNT(*) as cnt FROM staff WHERE is_active = 1");

    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

    res.json({
      // Pipeline metrics (5 cards)
      pipeline: {
        rfe: { count: rfeRows[0].cnt, value: parseFloat(rfeVal[0].total) },
        estimation: { count: estimationRows[0].cnt, value: parseFloat(estimationVal[0].total) },
        spares_pending: { count: sparesRows[0].cnt, value: 0 },
        wip: { count: wipRows[0].cnt, value: parseFloat(wipVal[0].total) },
        ready: { count: readyRows[0].cnt, value: parseFloat(readyVal[0].total) },
      },
      // Legacy compatible
      active_jobs,
      completed_jobs: doneRows[0].cnt,
      today_revenue,
      invoice_revenue: parseFloat(invoiceRev[0].total),
      estimate_revenue: parseFloat(estimateRev[0].total),
      invoices_today: invCount[0].cnt,
      estimates_today: estCount[0].cnt,
      cash_balance,
      staff_present: staffRows[0].cnt,
      total_staff: totalStaff[0].cnt,
      date: today
    });
  } catch (err) {
    console.error('GET /dashboard/today error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// GET /api/dashboard/chart-data — Revenue over last 7 days
router.get('/chart-data', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const [invoiceData] = await db.query(
      `SELECT DATE(created_at) as date, SUM(total_amount) as total
       FROM invoices WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(created_at) ORDER BY date`,
      [days]
    );
    const [estimateData] = await db.query(
      `SELECT DATE(created_at) as date, SUM(subtotal) as total
       FROM estimates WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(created_at) ORDER BY date`,
      [days]
    );
    const [jobsData] = await db.query(
      `SELECT DATE(job_date) as date, COUNT(*) as count
       FROM job_cards WHERE job_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(job_date) ORDER BY date`,
      [days]
    );

    res.json({ invoice_revenue: invoiceData, estimate_revenue: estimateData, jobs_created: jobsData });
  } catch (err) {
    console.error('GET /dashboard/chart-data error:', err);
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

module.exports = router;
