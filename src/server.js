const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  process.env.BASE_URL?.replace(/\/$/, ''),
  'https://humble-aqua-python.103-108-220-145.cpanel.site'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowed => {
      return origin.replace(/\/$/, '') === allowed.replace(/\/$/, '');
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('CORS Blocked Origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
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
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
