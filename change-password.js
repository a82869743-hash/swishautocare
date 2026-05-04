const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function changePassword() {
  try {
    const pool = await mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    const hash = await bcrypt.hash('admin123', 10);
    const [result] = await pool.execute('UPDATE admin_users SET password_hash = ? WHERE username = ?', [hash, 'admin']);
    
    if (result.affectedRows > 0) {
      console.log('✅ Password successfully updated to: admin123');
    } else {
      console.log('❌ Could not find admin user in database.');
    }
    
    await pool.end();
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.error('❌ Error: Could not connect to MySQL. Is the database running?');
    } else {
      console.error('❌ Error:', err.message);
    }
  }
}

changePassword();
