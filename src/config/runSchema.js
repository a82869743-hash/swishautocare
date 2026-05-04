const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function runSchema() {
  // Connect WITHOUT database (since we're creating it)
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    multipleStatements: true
  });

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Running schema.sql...');
    await connection.query(sql);
    console.log('✅ Schema executed successfully — all tables created!');
    
    // Verify tables
    await connection.query('USE swish_gms');
    const [tables] = await connection.query('SHOW TABLES');
    console.log('\nTables created:');
    tables.forEach(t => {
      const name = Object.values(t)[0];
      console.log(`  ✓ ${name}`);
    });
  } catch (err) {
    console.error('Schema error:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runSchema();
