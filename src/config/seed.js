const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    console.log('Seeding database...');

    // 1. Hash admin password and insert admin user
    const passwordHash = await bcrypt.hash('swish@2024', 10);
    await connection.execute(
      `INSERT INTO admin_users (username, full_name, password_hash)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      ['admin', 'GK Admin', passwordHash]
    );
    console.log('✓ Admin user created (admin / swish@2024)');

    // 2. Insert sample staff
    const staffData = [
      ['SAC-STF-001', 'Rajan Mehta', 'Senior Detailer', '9898989898', '2024-01-15', 18000],
      ['SAC-STF-002', 'Suresh Kumar', 'Washer', '9876543210', '2024-03-01', 12000],
      ['SAC-STF-003', 'Vikram Patel', 'PPF Technician', '9712345678', '2024-06-10', 22000],
      ['SAC-STF-004', 'Arjun Shah', 'Supervisor', '9823456789', '2023-11-01', 25000]
    ];

    for (const s of staffData) {
      await connection.execute(
        `INSERT INTO staff (staff_code, full_name, role, mobile_no, date_of_joining, monthly_salary)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)`,
        s
      );
    }
    console.log('✓ 4 staff members created');

    console.log('\n🎉 Seed complete');
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

seed();
