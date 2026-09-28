const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const host = process.env.DB_HOST || 'localhost';
const configuredPort = Number(process.env.DB_PORT) || 3306;

// Aiven exposes MySQL on the service-specific public port.
// If an Aiven hostname is used and DB_PORT was accidentally left at
// the normal local MySQL port, use Aiven's actual port.
const port =
  host.includes('aivencloud.com') && configuredPort === 3306
    ? 24025
    : configuredPort;

const poolConfig = {
  host,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'logistics_db',
  port,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
};

// Aiven MySQL requires an encrypted TLS connection.
// Set DB_SSL=true in Vercel for the cloud database.
if (process.env.DB_SSL === 'true') {
  poolConfig.ssl = {
    rejectUnauthorized: false
  };
}

const pool = mysql.createPool(poolConfig);

module.exports = pool;
