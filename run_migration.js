/**
 * V3 Migration Runner
 * Run: node run_migration.js
 * Applies migration_v3_features.sql to the database.
 * Uses a robust SQL parser that handles multi-line statements correctly.
 */
const fs = require('fs');
const path = require('path');
const db = require('./src/config/db');

function splitSQL(sql) {
  // Remove block comments  /* ... */
  sql = sql.replace(/\/\*[\s\S]*?\*\//g, '');

  const statements = [];
  let current = '';
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    // Handle string literals — skip semicolons inside quotes
    if (inString) {
      current += ch;
      if (ch === stringChar && sql[i - 1] !== '\\') {
        inString = false;
      }
      continue;
    }

    // Start of string literal
    if (ch === "'" || ch === '"') {
      inString = true;
      stringChar = ch;
      current += ch;
      continue;
    }

    // Skip line comments (-- ...)
    if (ch === '-' && sql[i + 1] === '-') {
      const nl = sql.indexOf('\n', i);
      if (nl === -1) break;
      i = nl;
      continue;
    }

    // Semicolon = end of statement
    if (ch === ';') {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += ch;
  }

  // Catch trailing statement without semicolon
  const trimmed = current.trim();
  if (trimmed.length > 0) {
    statements.push(trimmed);
  }

  return statements;
}

async function run() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   SWISH GMS v3 — Database Migration       ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  const sqlPath = path.join(__dirname, 'migration_v3_features.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('❌ migration_v3_features.sql not found!');
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf-8');
  const statements = splitSQL(sql);

  console.log(`Found ${statements.length} SQL statements to execute.\n`);

  let success = 0;
  let skipped = 0;
  let errors = 0;

  for (let idx = 0; idx < statements.length; idx++) {
    const stmt = statements[idx];
    const preview = stmt.split('\n')[0].slice(0, 80);
    try {
      await db.execute(stmt);
      console.log(`✅ [${idx + 1}/${statements.length}] ${preview}...`);
      success++;
    } catch (err) {
      // Ignore "already exists" errors for idempotency
      const safe = [
        'ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME', 'ER_TABLE_EXISTS_ERROR',
        'ER_DUP_ENTRY', 'ER_CANT_DROP_FIELD_OR_KEY', 'ER_DUP_COLUMN_NAME'
      ];
      if (safe.includes(err.code)) {
        console.log(`⏭️  [${idx + 1}/${statements.length}] ${preview}... (already applied)`);
        skipped++;
      } else {
        console.error(`❌ [${idx + 1}/${statements.length}] ${preview}...`);
        console.error(`   Code: ${err.code}`);
        console.error(`   Error: ${err.message}\n`);
        errors++;
      }
    }
  }

  console.log(`\n─────────────────────────────────────`);
  console.log(`✅ ${success} applied  ⏭️  ${skipped} skipped  ❌ ${errors} errors`);
  console.log(`─────────────────────────────────────\n`);

  process.exit(errors > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
