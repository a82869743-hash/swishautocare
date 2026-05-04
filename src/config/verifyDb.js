const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

async function verify() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  const [tables] = await c.query('SHOW TABLES');
  console.log('=== TABLES ===');
  tables.forEach(t => console.log('  ' + Object.values(t)[0]));

  console.log('\n=== JOB_CARDS COLUMNS ===');
  const [jc] = await c.query('DESCRIBE job_cards');
  jc.forEach(r => console.log(`  ${r.Field}: ${r.Type} ${r.Null === 'YES' ? '(nullable)' : '(required)'}`));

  console.log('\n=== JOB_CARD_SERVICES COLUMNS ===');
  const [jcs] = await c.query('DESCRIBE job_card_services');
  jcs.forEach(r => console.log(`  ${r.Field}: ${r.Type}`));

  console.log('\n=== INVOICES COLUMNS ===');
  const [inv] = await c.query('DESCRIBE invoices');
  inv.forEach(r => console.log(`  ${r.Field}: ${r.Type}`));

  console.log('\n=== ESTIMATES COLUMNS ===');
  const [est] = await c.query('DESCRIBE estimates');
  est.forEach(r => console.log(`  ${r.Field}: ${r.Type}`));

  console.log('\n=== SEEDED DATA ===');
  const [admins] = await c.query('SELECT id, username, full_name FROM admin_users');
  console.log('Admin users:', admins.length);
  admins.forEach(a => console.log(`  ${a.username} (${a.full_name})`));

  const [staff] = await c.query('SELECT id, staff_code, full_name FROM staff');
  console.log('Staff members:', staff.length);
  staff.forEach(s => console.log(`  ${s.staff_code} - ${s.full_name}`));

  console.log('\n✅ Database verification complete!');
  await c.end();
}

verify().catch(e => { console.error(e); process.exit(1); });
