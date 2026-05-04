const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function populateDB() {
  const csvPath = path.join(__dirname, '../../../car model dataset.csv');
  console.log('Reading CSV from:', csvPath);
  
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  
  // Skip header line
  const dataLines = lines.slice(1);
  
  const vehicleMap = new Map();
  
  for (const line of dataLines) {
    const parts = line.split(',');
    if (parts.length < 4) continue;
    
    // Structure: Index, Make, Model, Variant
    const make = parts[1].trim();
    const model = parts[2].trim();
    let variant = parts[3].trim();
    
    // Basic cleanup
    if (!make || !model) continue;
    
    const key = `${make.toLowerCase()}_${model.toLowerCase()}`;
    
    if (!vehicleMap.has(key)) {
      vehicleMap.set(key, { make, model, variants: new Set(), fuelTypes: new Set() });
    }
    
    const entry = vehicleMap.get(key);
    if (variant) {
      entry.variants.add(variant);
      
      // Try to infer fuel type from variant
      const vLower = variant.toLowerCase();
      if (vLower.includes('cng')) entry.fuelTypes.add('CNG');
      else if (vLower.includes('electric') || vLower.includes('ev')) entry.fuelTypes.add('Electric');
      else if (vLower.includes('hybrid')) entry.fuelTypes.add('Hybrid');
      else if (vLower.match(/\b(d|diesel)\b/)) entry.fuelTypes.add('Diesel');
      else if (vLower.match(/\b(p|petrol)\b/)) entry.fuelTypes.add('Petrol');
    }
  }

  // Fallback fuel types
  for (const [key, entry] of vehicleMap.entries()) {
    if (entry.fuelTypes.size === 0) {
      entry.fuelTypes.add('Petrol'); // default to Petrol
      entry.fuelTypes.add('Diesel'); // default to Diesel
    }
  }

  console.log(`Found ${vehicleMap.size} unique Make/Model combinations.`);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'swish_gms'
  });

  console.log('Connected to Database. Adding variants column if not exists...');
  try {
    await conn.query('ALTER TABLE vehicle_master ADD COLUMN variants JSON DEFAULT NULL');
    console.log('Added variants column to vehicle_master table.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('variants column already exists.');
    } else {
      console.error('Error adding column:', err);
    }
  }

  console.log('Clearing existing table...');
  await conn.query('TRUNCATE TABLE vehicle_master');

  console.log('Inserting vehicles into vehicle_master...');
  let count = 0;
  for (const [key, entry] of vehicleMap.entries()) {
    const fuelTypesJson = JSON.stringify(Array.from(entry.fuelTypes));
    const variantsJson = JSON.stringify(Array.from(entry.variants));
    
    await conn.query(
      'INSERT INTO vehicle_master (make, model, fuel_types, variants) VALUES (?, ?, ?, ?)',
      [entry.make, entry.model, fuelTypesJson, variantsJson]
    );
    count++;
  }

  console.log(`Successfully inserted ${count} vehicle entries with variants.`);
  
  await conn.end();
}

populateDB().catch(console.error);
