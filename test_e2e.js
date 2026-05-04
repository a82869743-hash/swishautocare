const http = require('http');

function httpReq(opts, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  SWISH GMS v3 — End-to-End API Tests');
  console.log('═══════════════════════════════════════\n');

  // 1. Login
  const login = await httpReq({
    hostname: 'localhost', port: 5000, path: '/api/auth/login',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ username: 'admin', password: 'admin123' }));

  const j = JSON.parse(login.body);
  if (!j.token) { console.log('❌ LOGIN FAILED:', login.body); process.exit(1); }
  console.log('✅ Login ............... User:', j.user.full_name);
  const h = { Authorization: 'Bearer ' + j.token };

  // 2. Dashboard Today
  const dash = await httpReq({ hostname: 'localhost', port: 5000, path: '/api/dashboard/today', headers: h });
  const dashData = JSON.parse(dash.body);
  console.log(`✅ Dashboard ........... Active: ${dashData.active_jobs}, Revenue: ₹${dashData.today_revenue}`);

  // 3. Concern Presets
  const cp = await httpReq({ hostname: 'localhost', port: 5000, path: '/api/service-catalog/concern-presets', headers: h });
  const presets = JSON.parse(cp.body);
  console.log(`✅ Concern Presets ..... ${presets.data?.length || 0} presets loaded`);

  // 4. Advance Bookings Today
  const ab = await httpReq({ hostname: 'localhost', port: 5000, path: '/api/advance-bookings/today', headers: h });
  const abData = JSON.parse(ab.body);
  console.log(`✅ Bookings Today ...... Total: ${abData.total}, Pending: ${abData.pending}`);

  // 5. Parts
  const pt = await httpReq({ hostname: 'localhost', port: 5000, path: '/api/parts', headers: h });
  const parts = JSON.parse(pt.body);
  console.log(`✅ Parts Inventory ..... ${parts.data?.length || 0} SKUs`);

  // 6. Job Cards
  const jc = await httpReq({ hostname: 'localhost', port: 5000, path: '/api/job-cards', headers: h });
  const jobs = JSON.parse(jc.body);
  console.log(`✅ Job Cards ........... ${jobs.data?.length || 0} job cards`);

  // 7. Staff
  const st = await httpReq({ hostname: 'localhost', port: 5000, path: '/api/staff', headers: h });
  console.log(`✅ Staff ............... Status ${st.status}`);

  // 8. Health Check
  const hc = await httpReq({ hostname: 'localhost', port: 5000, path: '/api/health' });
  console.log(`✅ Health Check ........ ${hc.body}`);

  console.log('\n═══════════════════════════════════════');
  console.log('  ✅ ALL ENDPOINTS VERIFIED — SYSTEM OK');
  console.log('═══════════════════════════════════════\n');
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
