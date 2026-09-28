const express = require('express');
const cors = require('cors');
const path = require('path');
const dns = require('dns').promises;
const net = require('net');
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

// Temporary network diagnostic for the Aiven MySQL connection.
app.get('/api/db-network-test', async (req, res) => {
  const host = process.env.DB_HOST;
  const configuredPort = Number(process.env.DB_PORT) || 3306;
  const port =
    host && host.includes('aivencloud.com') && configuredPort === 3306
      ? 24025
      : configuredPort;

  try {
    const addresses = await dns.lookup(host, { all: true });

    const tests = await Promise.all(
      addresses.map(
        ({ address, family }) =>
          new Promise((resolve) => {
            const socket = net.createConnection({
              host: address,
              port,
              family
            });

            const startedAt = Date.now();

            const finish = (result) => {
              socket.destroy();
              resolve({
                address,
                family,
                ...result,
                durationMs: Date.now() - startedAt
              });
            };

            socket.setTimeout(5000);

            socket.once('connect', () => {
              finish({ status: 'CONNECTED' });
            });

            socket.once('timeout', () => {
              finish({ status: 'TIMEOUT' });
            });

            socket.once('error', (error) => {
              finish({
                status: 'ERROR',
                code: error.code,
                message: error.message
              });
            });
          })
      )
    );

    res.json({
      status: 'OK',
      host,
      port,
      addresses,
      tests
    });
  } catch (error) {
    console.error('Database network diagnostic failed:', error);

    res.status(500).json({
      status: 'ERROR',
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
