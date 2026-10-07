const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { generateId } = require('../utils/idGenerator');
const { logAudit } = require('./auditService');

async function getAllDrivers() {
  const [rows] = await db.query(
    `SELECT d.driver_id, d.user_id, d.employee_number, d.name, d.phone,
            d.license_number, d.license_expiry, d.status, d.current_status,
            u.email, u.status AS user_status
     FROM drivers d
     JOIN users u ON d.user_id = u.user_id
     ORDER BY d.name ASC`
  );
  return rows;
}

async function getDriverById(driverId) {
  const [rows] = await db.query(
    `SELECT d.driver_id, d.user_id, d.employee_number, d.name, d.phone,
            d.license_number, d.license_expiry, d.status, d.current_status,
            u.email, u.status AS user_status
     FROM drivers d
     JOIN users u ON d.user_id = u.user_id
     WHERE d.driver_id = ?`,
    [driverId]
  );
  if (rows.length === 0) {
    const error = new Error('Driver not found');
    error.statusCode = 404;
    throw error;
  }
  return rows[0];
}

async function createDriver({ name, email, password, phone, employeeNumber, licenseNumber, licenseExpiry, adminUserId }) {
  if (!name || !email || !password || !phone || !employeeNumber || !licenseNumber || !licenseExpiry) {
    const error = new Error('All driver fields including password are required');
    error.statusCode = 400;
    throw error;
  }

  const [existingUser] = await db.query('SELECT user_id FROM users WHERE email = ?', [email]);
  if (existingUser.length > 0) {
    const error = new Error('A user with this email address already exists');
    error.statusCode = 409;
    throw error;
  }

  const [existingEmp] = await db.query('SELECT driver_id FROM drivers WHERE employee_number = ?', [employeeNumber]);
  if (existingEmp.length > 0) {
    const error = new Error('A driver with this employee number already exists');
    error.statusCode = 409;
    throw error;
  }

  const [existingLic] = await db.query('SELECT driver_id FROM drivers WHERE license_number = ?', [licenseNumber]);
  if (existingLic.length > 0) {
    const error = new Error('A driver with this license number already exists');
    error.statusCode = 409;
    throw error;
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = generateId('USR');
    const driverId = generateId('DRV');

    await connection.query(
      `INSERT INTO users (user_id, name, email, password_hash, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'DRIVER', 'ACTIVE', NOW(), NOW())`,
      [userId, name, email, passwordHash]
    );

    await connection.query(
      `INSERT INTO drivers (driver_id, user_id, employee_number, name, phone, license_number, license_expiry, status, current_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'AVAILABLE', NOW(), NOW())`,
      [driverId, userId, employeeNumber, name, phone, licenseNumber, licenseExpiry]
    );

    await logAudit(connection, {
      userId: adminUserId,
      action: 'DRIVER_CREATED',
      entityType: 'DRIVER',
      entityId: driverId,
      metadata: { name, email, employee_number: employeeNumber, license_number: licenseNumber }
    });

    await connection.commit();

    return {
      driver_id: driverId,
      user_id: userId,
      employee_number: employeeNumber,
      name,
      email,
      phone,
      license_number: licenseNumber,
      license_expiry: licenseExpiry,
      status: 'ACTIVE',
      current_status: 'AVAILABLE'
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function updateDriver(driverId, { name, phone, licenseNumber, licenseExpiry, adminUserId }) {
  const driver = await getDriverById(driverId);

  if (licenseNumber && licenseNumber !== driver.license_number) {
    const [existingLic] = await db.query(
      'SELECT driver_id FROM drivers WHERE license_number = ? AND driver_id != ?',
      [licenseNumber, driverId]
    );
    if (existingLic.length > 0) {
      const error = new Error('License number is already used by another driver');
      error.statusCode = 409;
      throw error;
    }
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const updatedName = name || driver.name;
    const updatedPhone = phone || driver.phone;
    const updatedLicense = licenseNumber || driver.license_number;
    const updatedExpiry = licenseExpiry || driver.license_expiry;

    await connection.query(
      `UPDATE drivers
       SET name = ?, phone = ?, license_number = ?, license_expiry = ?, updated_at = NOW()
       WHERE driver_id = ?`,
      [updatedName, updatedPhone, updatedLicense, updatedExpiry, driverId]
    );

    if (name && name !== driver.name) {
      await connection.query(
        `UPDATE users SET name = ?, updated_at = NOW() WHERE user_id = ?`,
        [name, driver.user_id]
      );
    }

    await logAudit(connection, {
      userId: adminUserId,
      action: 'DRIVER_UPDATED',
      entityType: 'DRIVER',
      entityId: driverId,
      metadata: { previous: { name: driver.name, phone: driver.phone }, updated: { name: updatedName, phone: updatedPhone } }
    });

    await connection.commit();

    return getDriverById(driverId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function setDriverStatus(driverId, newStatus, adminUserId) {
  if (!['ACTIVE', 'INACTIVE'].includes(newStatus)) {
    const error = new Error('Invalid status. Expected ACTIVE or INACTIVE');
    error.statusCode = 400;
    throw error;
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      'SELECT driver_id, user_id, status, current_status FROM drivers WHERE driver_id = ? FOR UPDATE',
      [driverId]
    );
    if (rows.length === 0) {
      const error = new Error('Driver not found');
      error.statusCode = 404;
      throw error;
    }

    const driver = rows[0];

    if (newStatus === 'INACTIVE') {
      const [activeAssignments] = await connection.query(
        "SELECT assignment_id FROM driver_assignments WHERE driver_id = ? AND status = 'ACTIVE'",
        [driverId]
      );
      if (activeAssignments.length > 0) {
        const error = new Error('Cannot deactivate a driver with an active shipment assignment.');
        error.statusCode = 400;
        throw error;
      }

      await connection.query(
        "UPDATE drivers SET status = 'INACTIVE', current_status = 'OFF_DUTY', updated_at = NOW() WHERE driver_id = ?",
        [driverId]
      );
      await connection.query(
        "UPDATE users SET status = 'INACTIVE', updated_at = NOW() WHERE user_id = ?",
        [driver.user_id]
      );
    } else {
      await connection.query(
        "UPDATE drivers SET status = 'ACTIVE', current_status = 'AVAILABLE', updated_at = NOW() WHERE driver_id = ?",
        [driverId]
      );
      await connection.query(
        "UPDATE users SET status = 'ACTIVE', updated_at = NOW() WHERE user_id = ?",
        [driver.user_id]
      );
    }

    await logAudit(connection, {
      userId: adminUserId,
      action: newStatus === 'ACTIVE' ? 'DRIVER_ACTIVATED' : 'DRIVER_DEACTIVATED',
      entityType: 'DRIVER',
      entityId: driverId,
      metadata: { previous_status: driver.status, new_status: newStatus }
    });

    await connection.commit();
    return getDriverById(driverId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  getAllDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  setDriverStatus
};