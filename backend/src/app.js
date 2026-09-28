const express = require('express');
const cors = require('cors');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');
const db = require('./config/database');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const driverRoutes = require('./routes/driverRoutes');
const customerRoutes = require('./routes/customerRoutes');

const app = express();

// Global Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Proof-of-delivery static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Temporary database connectivity check
app.get('/api/db-test', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 AS result');

    res.json({
      status: 'OK',
      database: 'connected',
      result: rows[0]
    });
  } catch (error) {
    console.error('Database connection test failed:', error);

    res.status(500).json({
      status: 'ERROR',
      database: 'connection failed',
      message: error.message,
      code: error.code
    });
  }
});

// Explicit API Route groups
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api', customerRoutes);

// Centralized error handler
app.use(errorHandler);

// Start a normal HTTP server only when running locally.
// Vercel imports this file as a serverless function and provides the server.
const PORT = process.env.PORT || 5000;
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Logistics API Server running on port ${PORT}`);
  });
}

module.exports = app;
