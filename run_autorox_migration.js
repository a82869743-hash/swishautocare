// Run: node run_autorox_migration.js
// Executes: migration_autorox.sql + seed_service_catalog.sql
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    multipleStatements: true,
    waitForConnections: true,
    connectionLimit: 1,
  });

  try {
    console.log('Connected to', process.env.DB_NAME);

    // ── AutoRox ALTER statements (safe — ignores if column exists) ──
    const alterStatements = [
      // job_card_services additions
      "ALTER TABLE job_card_services ADD COLUMN part_no VARCHAR(50) DEFAULT NULL AFTER part_code",
      "ALTER TABLE job_card_services ADD COLUMN labour_code VARCHAR(50) DEFAULT NULL AFTER part_no",
      "ALTER TABLE job_card_services ADD COLUMN price_type ENUM('mrp','price') DEFAULT 'price' AFTER rate",
      "ALTER TABLE job_card_services ADD COLUMN is_selected TINYINT(1) DEFAULT 1 AFTER tax_amount",
      "ALTER TABLE job_card_services ADD COLUMN sort_order INT DEFAULT 0 AFTER is_selected",

      // job_cards additions
      "ALTER TABLE job_cards ADD COLUMN insurance_company VARCHAR(200) DEFAULT NULL",
      "ALTER TABLE job_cards ADD COLUMN claim_no VARCHAR(100) DEFAULT NULL",
      "ALTER TABLE job_cards ADD COLUMN accident_date DATE DEFAULT NULL",
      "ALTER TABLE job_cards ADD COLUMN delivery_date DATE DEFAULT NULL",
      "ALTER TABLE job_cards ADD COLUMN approval_status ENUM('pending','approved','rejected') DEFAULT NULL",
      "ALTER TABLE job_cards ADD COLUMN approval_date DATE DEFAULT NULL",
      "ALTER TABLE job_cards ADD COLUMN parts_order_count INT DEFAULT 0",
      "ALTER TABLE job_cards ADD COLUMN parts_inward_count INT DEFAULT 0",
      "ALTER TABLE job_cards ADD COLUMN parts_issue_count INT DEFAULT 0",
      "ALTER TABLE job_cards ADD COLUMN parts_pending INT DEFAULT 0",
      "ALTER TABLE job_cards ADD COLUMN parts_approved INT DEFAULT 0",
      "ALTER TABLE job_cards ADD COLUMN parts_rejected INT DEFAULT 0",
    ];

    console.log('\n─── Running ALTER statements ───');
    for (const stmt of alterStatements) {
      try {
        await pool.execute(stmt);
        console.log('✓ ' + stmt.slice(0, 70));
      } catch (err) {
        if (err.message.includes('Duplicate column')) {
          console.log('  ⊘ Column already exists, skipping');
        } else {
          console.log('  ✗ ' + err.message.slice(0, 80));
        }
      }
    }

    // ── Create service_catalog table ──
    console.log('\n─── Creating service_catalog table ───');
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS service_catalog (
          id INT AUTO_INCREMENT PRIMARY KEY,
          item_name VARCHAR(200) NOT NULL,
          item_type ENUM('part','labour') NOT NULL DEFAULT 'labour',
          category ENUM(
            'relevant_parts','all_services','wheel_alignment','wheel_balancing',
            'wash_detailing','pms_checkup','tyres_services','general'
          ) DEFAULT 'general',
          part_no VARCHAR(50) DEFAULT NULL,
          labour_code VARCHAR(50) DEFAULT NULL,
          default_rate DECIMAL(10,2) DEFAULT 0.00,
          default_tax_pct DECIMAL(5,2) DEFAULT 18.00,
          hsn_sac VARCHAR(20) DEFAULT NULL,
          is_active TINYINT(1) DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_category (category),
          INDEX idx_item_name (item_name),
          INDEX idx_item_type (item_type)
        )
      `);
      console.log('✓ service_catalog table ready');
    } catch (err) {
      console.log('  ' + err.message.slice(0, 80));
    }

    // ── Create bill_dispatch_log table ──
    console.log('\n─── Creating bill_dispatch_log table ───');
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS bill_dispatch_log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          job_card_id INT NOT NULL,
          invoice_id INT DEFAULT NULL,
          dispatch_type ENUM('whatsapp','sms') NOT NULL,
          mobile_no VARCHAR(15) NOT NULL,
          message_template VARCHAR(100) NOT NULL,
          status ENUM('sent','failed','queued') DEFAULT 'queued',
          msg91_request_id VARCHAR(100) DEFAULT NULL,
          error_message TEXT DEFAULT NULL,
          dispatched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE,
          INDEX idx_job_card (job_card_id)
        )
      `);
      console.log('✓ bill_dispatch_log table ready');
    } catch (err) {
      console.log('  ' + err.message.slice(0, 80));
    }

    // ── Seed service_catalog ──
    console.log('\n─── Seeding service_catalog ───');
    try {
      const seedSQL = fs.readFileSync(
        path.join(__dirname, 'src', 'config', 'seed_service_catalog.sql'),
        'utf8'
      );
      await pool.query(seedSQL);
      console.log('✓ Service catalog seeded');
    } catch (err) {
      console.log('  Seed:', err.message.slice(0, 80));
    }

    // ── Verify ──
    console.log('\n─── Verification ───');
    const [catalogCount] = await pool.query('SELECT COUNT(*) as cnt FROM service_catalog');
    console.log(`  service_catalog rows: ${catalogCount[0].cnt}`);

    const [dispatchCheck] = await pool.query("SHOW TABLES LIKE 'bill_dispatch_log'");
    console.log(`  bill_dispatch_log exists: ${dispatchCheck.length > 0 ? 'YES' : 'NO'}`);

    const [jcsColumns] = await pool.query("SHOW COLUMNS FROM job_card_services LIKE 'is_selected'");
    console.log(`  is_selected column exists: ${jcsColumns.length > 0 ? 'YES' : 'NO'}`);

    console.log('\n✅ AutoRox migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
