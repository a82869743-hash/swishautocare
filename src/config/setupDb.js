/**
 * Database setup script — creates the database and all tables.
 * Run with: npm run setup-db
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function setupDB() {
  // Connect WITHOUT database (to create it)
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    multipleStatements: true
  });

  try {
    console.log('🔧 Setting up database...');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    await connection.query(sql);

    console.log('✅ Database "swish_gms" created with all tables');
  } catch (err) {
    console.error('Setup error:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

setupDB();
