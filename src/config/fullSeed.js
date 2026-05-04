const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function fullSeed() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST, user: process.env.DB_USER,
    password: process.env.DB_PASS, database: process.env.DB_NAME
  });

  console.log('🌱 Starting full seed...');

  // ── 1. Admin user ──
  const hash = await bcrypt.hash('swish@2024', 10);
  await pool.execute(
    `INSERT INTO admin_users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
    ['admin', hash, 'Swish Admin', 'admin']
  );
  console.log('✅ Admin user seeded');

  // ── 2. Staff (skip if exists) ──
  const staffData = [
    ['SAC-STF-001', 'Ravi Kumar', 'Senior Detailer', '9876543210', '2024-01-15', 18000],
    ['SAC-STF-002', 'Priya Sharma', 'Washer', '9876543211', '2024-03-01', 12000],
    ['SAC-STF-003', 'Amit Patel', 'Ceramic Specialist', '9876543212', '2024-06-10', 22000],
    ['SAC-STF-004', 'Neha Gupta', 'Helper', '9876543213', '2025-01-20', 10000],
  ];
  for (const s of staffData) {
    await pool.execute(
      `INSERT INTO staff (staff_code, full_name, role, mobile_no, date_of_joining, monthly_salary)
       VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), role = VALUES(role), monthly_salary = VALUES(monthly_salary)`,
      s
    );
  }
  console.log('✅ 4 staff seeded');

  // ── 3. Parts (skip if exists) ──
  const partsData = [
    ['SAC-PRT-001', 'Ceramic Coat 9H', 'Ceramics', 'ml', 1200, 3500, 15, 5],
    ['SAC-PRT-002', 'Car Shampoo Premium', 'Wash', 'bottle', 250, 450, 30, 10],
    ['SAC-PRT-003', 'Microfiber Cloth Pack', 'Accessories', 'pack', 180, 350, 25, 8],
    ['SAC-PRT-004', 'Paint Protection Film', 'PPF', 'roll', 4500, 8000, 8, 3],
    ['SAC-PRT-005', 'Interior Perfume', 'Detailing', 'bottle', 120, 280, 40, 10],
  ];
  for (const p of partsData) {
    await pool.execute(
      `INSERT INTO parts (part_code, part_name, category, unit, buying_price, selling_price, stock_qty, low_stock_alert)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE part_name = VALUES(part_name), stock_qty = VALUES(stock_qty)`,
      p
    );
  }
  console.log('✅ 5 parts seeded');

  // ── Helper: date offsets ──
  const dateOffset = (days) => {
    const d = new Date(); d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  };
  const today = dateOffset(0);

  // Get staff IDs
  const [staffRows] = await pool.query('SELECT id, full_name FROM staff ORDER BY id');
  const staffIds = staffRows.map(r => r.id);

  // ── 4. Job Cards (8 total) ──
  const jobCards = [
    // 3 active today
    { job_type: 'full', reg_no: 'GJ-06-AB-1234', car_name: 'Swift Dzire', owner_name: 'Raj Shah', mobile: '9998887776', service: 'Ceramic Coating', staff: staffIds[2], est: 8500, date: today, status: 'active' },
    { job_type: 'full', reg_no: 'GJ-01-CD-5678', car_name: 'Hyundai Creta', owner_name: 'Meera Patel', mobile: '9998887775', service: 'Full Detailing', staff: staffIds[0], est: 5500, date: today, status: 'active' },
    { job_type: 'wash', reg_no: 'GJ-06-EF-9012', car_name: 'Honda City', owner_name: 'Walk-in', mobile: '', service: 'Quick Wash', staff: staffIds[1], est: 400, date: today, status: 'active' },
    // 5 done (past 7 days)
    { job_type: 'full', reg_no: 'GJ-05-GH-3456', car_name: 'Maruti Baleno', owner_name: 'Ankit Joshi', mobile: '9998887774', service: 'PPF Install', staff: staffIds[2], est: 15000, final: 14500, pay: 'upi', date: dateOffset(1), status: 'done' },
    { job_type: 'wash', reg_no: 'GJ-06-IJ-7890', car_name: 'Tata Nexon', owner_name: 'Walk-in', mobile: '', service: 'Exterior Wash', staff: staffIds[1], est: 300, final: 300, pay: 'cash', date: dateOffset(2), status: 'done' },
    { job_type: 'full', reg_no: 'GJ-01-KL-2345', car_name: 'Kia Seltos', owner_name: 'Divya Mehta', mobile: '9998887773', service: 'Interior + Exterior', staff: staffIds[0], est: 3500, final: 3800, pay: 'upi', date: dateOffset(3), status: 'done' },
    { job_type: 'wash', reg_no: 'GJ-06-MN-6789', car_name: 'Wagon R', owner_name: 'Walk-in', mobile: '', service: 'Quick Wash', staff: staffIds[3], est: 250, final: 250, pay: 'cash', date: dateOffset(5), status: 'done' },
    { job_type: 'full', reg_no: 'GJ-05-OP-0123', car_name: 'MG Hector', owner_name: 'Suresh Nair', mobile: '9998887772', service: 'Ceramic + PPF', staff: staffIds[2], est: 22000, final: 21000, pay: 'bank', date: dateOffset(6), status: 'done' },
  ];

  // Clear existing job cards for clean demo
  await pool.execute('DELETE FROM job_cards');

  for (let i = 0; i < jobCards.length; i++) {
    const jc = jobCards[i];
    const seq = String(i + 1).padStart(3, '0');
    const jobNo = `SAC-${jc.date.replace(/-/g, '')}-${seq}`;
    if (jc.status === 'done') {
      await pool.execute(
        `INSERT INTO job_cards (job_no, job_type, reg_no, car_name, owner_name, mobile_no, service_type, assigned_staff_id, estimated_amount, final_amount, payment_mode, status, job_date, closed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'done', ?, ?)`,
        [jobNo, jc.job_type, jc.reg_no, jc.car_name, jc.owner_name, jc.mobile || null, jc.service, jc.staff, jc.est, jc.final, jc.pay, jc.date, jc.date + ' 18:00:00']
      );
    } else {
      await pool.execute(
        `INSERT INTO job_cards (job_no, job_type, reg_no, car_name, owner_name, mobile_no, service_type, assigned_staff_id, estimated_amount, status, job_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
        [jobNo, jc.job_type, jc.reg_no, jc.car_name, jc.owner_name, jc.mobile || null, jc.service, jc.staff, jc.est, jc.date]
      );
    }
  }
  console.log('✅ 8 job cards seeded (3 active, 5 done)');

  // ── 5. Attendance (14 days) ──
  await pool.execute('DELETE FROM attendance');
  const statuses = ['present', 'absent', 'half'];
  for (let day = 0; day < 14; day++) {
    const d = dateOffset(day);
    for (const sid of staffIds) {
      // Weighted random: 70% present, 15% half, 15% absent
      const r = Math.random();
      const st = r < 0.70 ? 'present' : r < 0.85 ? 'half' : 'absent';
      await pool.execute(
        'INSERT INTO attendance (staff_id, attendance_date, status) VALUES (?, ?, ?)',
        [sid, d, st]
      );
    }
  }
  console.log('✅ 14 days attendance seeded for 4 staff');

  // ── 6. Salary Payments ──
  await pool.execute('DELETE FROM staff_payments');
  await pool.execute(
    `INSERT INTO staff_payments (staff_id, payment_date, payment_month, days_present, calculated_salary, paid_amount, payment_type, payment_mode, notes)
     VALUES (?, ?, 'February 2026', 22, 15231, 15231, 'salary', 'bank', 'Feb salary')`,
    [staffIds[0], dateOffset(5)]
  );
  await pool.execute(
    `INSERT INTO staff_payments (staff_id, payment_date, payment_month, days_present, calculated_salary, paid_amount, payment_type, payment_mode, notes)
     VALUES (?, ?, 'March 2026', 0, 0, 5000, 'advance', 'cash', 'March advance')`,
    [staffIds[2], dateOffset(2)]
  );
  console.log('✅ 2 salary payments seeded');

  // ── 7. Parts Sales (10 entries) ──
  await pool.execute('DELETE FROM parts_sales');
  const [partRows] = await pool.query('SELECT id, selling_price FROM parts ORDER BY id');
  const salesData = [
    { pi: 0, qty: 1, day: 0, cust: 'Raj Shah', pay: 'upi' },
    { pi: 1, qty: 2, day: 0, cust: 'Walk-in', pay: 'cash' },
    { pi: 4, qty: 3, day: 1, cust: 'Meera Patel', pay: 'upi' },
    { pi: 2, qty: 2, day: 1, cust: null, pay: 'cash' },
    { pi: 0, qty: 1, day: 2, cust: 'Ankit Joshi', pay: 'card' },
    { pi: 3, qty: 1, day: 3, cust: 'Divya Mehta', pay: 'upi' },
    { pi: 1, qty: 3, day: 3, cust: 'Walk-in', pay: 'cash' },
    { pi: 4, qty: 2, day: 4, cust: null, pay: 'cash' },
    { pi: 2, qty: 1, day: 5, cust: 'Suresh Nair', pay: 'upi' },
    { pi: 1, qty: 1, day: 6, cust: 'Walk-in', pay: 'cash' },
  ];
  for (const s of salesData) {
    const part = partRows[s.pi];
    const total = part.selling_price * s.qty;
    await pool.execute(
      `INSERT INTO parts_sales (part_id, quantity, unit_price, total_amount, customer_name, payment_mode, sale_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [part.id, s.qty, part.selling_price, total, s.cust, s.pay, dateOffset(s.day) + ' 14:00:00']
    );
  }
  console.log('✅ 10 parts sales seeded');

  // ── 8. Cash Ledger (12 entries) ──
  await pool.execute('DELETE FROM cash_ledger');
  const ledgerData = [
    { type: 'in', amt: 5000, cat: 'Other', desc: 'Opening cash balance', day: 6 },
    { type: 'out', amt: 850, cat: 'Utilities', desc: 'Electricity bill', day: 5 },
    { type: 'out', amt: 200, cat: 'Supplies', desc: 'Cleaning supplies', day: 5 },
    { type: 'in', amt: 2000, cat: 'Other', desc: 'Customer advance payment', day: 4 },
    { type: 'out', amt: 500, cat: 'Supplies', desc: 'Buffer pads + polish', day: 3 },
    { type: 'in', amt: 1500, cat: 'Refund', desc: 'Vendor refund on damaged goods', day: 3 },
    { type: 'out', amt: 1200, cat: 'Utilities', desc: 'Water tanker', day: 2 },
    { type: 'out', amt: 350, cat: 'Supplies', desc: 'Masking tape + gloves', day: 2 },
    { type: 'in', amt: 3000, cat: 'Other', desc: 'Custom tinting job (walk-in)', day: 1 },
    { type: 'out', amt: 150, cat: 'Other', desc: 'Tea + snacks for staff', day: 1 },
    { type: 'in', amt: 1000, cat: 'Advance', desc: 'Booking advance from Meera Patel', day: 0 },
    { type: 'out', amt: 600, cat: 'Utilities', desc: 'Internet bill', day: 0 },
  ];
  for (const l of ledgerData) {
    await pool.execute(
      `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date)
       VALUES (?, ?, ?, ?, ?)`,
      [l.type, l.amt, l.cat, l.desc, dateOffset(l.day) + ' 10:00:00']
    );
  }
  console.log('✅ 12 cash ledger entries seeded');

  console.log('\n🎉 Full seed complete! The demo is ready.');
  await pool.end();
  process.exit(0);
}

fullSeed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
