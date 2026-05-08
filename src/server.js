const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'https://humble-aqua-python.103-108-220-145.cpanel.site',
  'https://swishautocare.onrender.com',
  process.env.BASE_URL?.replace(/\/$/, '')
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Static file serving for uploads (media, etc.)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/job-cards', require('./routes/jobCards'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/salary', require('./routes/salary'));
app.use('/api/product-sales', require('./routes/productSales'));
app.use('/api/cash-ledger', require('./routes/cashLedger'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/parts', require('./routes/parts'));
app.use('/api/exports', require('./routes/exports'));
app.use('/api/service-catalog', require('./routes/serviceCatalog'));
app.use('/api/vehicle-master', require('./routes/vehicleMaster'));
app.use('/api/quick-job-cards', require('./routes/quickJobCards'));
app.use('/api/advance-bookings', require('./routes/advanceBookings'));

// ── Public routes (NO auth) ──
app.use('/api/public', require('./routes/publicTracking'));

// Health check
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    const [rows] = await require('./config/db').query('SELECT 1');
    if (rows) dbStatus = 'connected';
  } catch (err) {
    dbStatus = `error: ${err.message}`;
  }
  
  res.json({ 
    status: 'ok', 
    database: dbStatus,
    timestamp: new Date().toISOString() 
  });
});

// Serve frontend static files in production
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

// Catch-all route to serve index.html for React/Vite router (must be after API routes)
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
