const db = require('../config/database');
const { generateId } = require('../utils/idGenerator');
const { logAudit } = require('./auditService');

async function getAllVehicles() {
  const [rows] = await db.query(
    `SELECT v.vehicle_id, v.registration_number, v.vehicle_type, v.capacity_kg,
            v.status, v.current_status, v.driver_id, v.last_service_date,
            d.name AS assigned_driver_name
     FROM vehicles v
     LEFT JOIN drivers d ON v.driver_id = d.driver_id
     ORDER BY v.registration_number ASC`
  );
  return rows;
}

async function getVehicleById(vehicleId) {
  const [rows] = await db.query(
    `SELECT v.vehicle_id, v.registration_number, v.vehicle_type, v.capacity_kg,
            v.status, v.current_status, v.driver_id, v.last_service_date,
            d.name AS assigned_driver_name
     FROM vehicles v
     LEFT JOIN drivers d ON v.driver_id = d.driver_id
     WHERE v.vehicle_id = ?`,
    [vehicleId]
  );
  if (rows.length === 0) {
    const error = new Error('Vehicle not found');
    error.statusCode = 404;
    throw error;
  }
  return rows[0];
}

async function createVehicle({ registrationNumber, vehicleType, capacityKg, lastServiceDate, adminUserId }) {
  if (!registrationNumber || !vehicleType || !capacityKg) {
    const error = new Error('registrationNumber, vehicleType, and capacityKg are required');
    error.statusCode = 400;
    throw error;
  }

  const parsedCapacity = parseFloat(capacityKg);
  if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
    const error = new Error('capacity_kg must be a positive number');
    error.statusCode = 400;
    throw error;
  }

  const [existingReg] = await db.query(
    'SELECT vehicle_id FROM vehicles WHERE registration_number = ?',
    [registrationNumber]
  );
  if (existingReg.length > 0) {
    const error = new Error('A vehicle with this registration number already exists');
    error.statusCode = 409;
    throw error;
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const vehicleId = generateId('VEH');

    await connection.query(
      `INSERT INTO vehicles (vehicle_id, registration_number, vehicle_type, capacity_kg, status, current_status, last_service_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', 'AVAILABLE', ?, NOW(), NOW())`,
      [vehicleId, registrationNumber, vehicleType, parsedCapacity, lastServiceDate || null]
    );

    await logAudit(connection, {
      userId: adminUserId,
      action: 'VEHICLE_CREATED',
      entityType: 'VEHICLE',
      entityId: vehicleId,
      metadata: { registration_number: registrationNumber, vehicle_type: vehicleType, capacity_kg: parsedCapacity }
    });

    await connection.commit();

    return {
      vehicle_id: vehicleId,
      registration_number: registrationNumber,
      vehicle_type: vehicleType,
      capacity_kg: parsedCapacity,
      status: 'ACTIVE',
      current_status: 'AVAILABLE',
      last_service_date: lastServiceDate || null
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function updateVehicle(vehicleId, { vehicleType, capacityKg, lastServiceDate, adminUserId }) {
  const vehicle = await getVehicleById(vehicleId);

  let parsedCapacity = vehicle.capacity_kg;
  if (capacityKg !== undefined) {
    parsedCapacity = parseFloat(capacityKg);
    if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
      const error = new Error('capacity_kg must be a positive number');
      error.statusCode = 400;
      throw error;
    }
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const updatedType = vehicleType || vehicle.vehicle_type;
    const updatedServiceDate = lastServiceDate !== undefined ? lastServiceDate : vehicle.last_service_date;

    await connection.query(
      `UPDATE vehicles
       SET vehicle_type = ?, capacity_kg = ?, last_service_date = ?, updated_at = NOW()
       WHERE vehicle_id = ?`,
      [updatedType, parsedCapacity, updatedServiceDate, vehicleId]
    );

    await logAudit(connection, {
      userId: adminUserId,
      action: 'VEHICLE_UPDATED',
      entityType: 'VEHICLE',
      entityId: vehicleId,
      metadata: { previous: { type: vehicle.vehicle_type, capacity: vehicle.capacity_kg }, updated: { type: updatedType, capacity: parsedCapacity } }
    });

    await connection.commit();
    return getVehicleById(vehicleId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function setVehicleStatus(vehicleId, newStatus, adminUserId) {
  if (!['ACTIVE', 'INACTIVE'].includes(newStatus)) {
    const error = new Error('Invalid status. Expected ACTIVE or INACTIVE');
    error.statusCode = 400;
    throw error;
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      'SELECT vehicle_id, status, current_status FROM vehicles WHERE vehicle_id = ? FOR UPDATE',
      [vehicleId]
    );
    if (rows.length === 0) {
      const error = new Error('Vehicle not found');
      error.statusCode = 404;
      throw error;
    }
    const vehicle = rows[0];

    if (newStatus === 'INACTIVE') {
      const [activeAssignments] = await connection.query(
        "SELECT assignment_id FROM driver_assignments WHERE vehicle_id = ? AND status = 'ACTIVE'",
        [vehicleId]
      );
      if (activeAssignments.length > 0) {
        const error = new Error('Cannot deactivate a vehicle with an active shipment assignment.');
        error.statusCode = 400;
        throw error;
      }

      await connection.query(
        "UPDATE vehicles SET status = 'INACTIVE', current_status = 'OFF_DUTY', driver_id = NULL, updated_at = NOW() WHERE vehicle_id = ?",
        [vehicleId]
      );
    } else {
      await connection.query(
        "UPDATE vehicles SET status = 'ACTIVE', current_status = 'AVAILABLE', updated_at = NOW() WHERE vehicle_id = ?",
        [vehicleId]
      );
    }

    await logAudit(connection, {
      userId: adminUserId,
      action: newStatus === 'ACTIVE' ? 'VEHICLE_ACTIVATED' : 'VEHICLE_DEACTIVATED',
      entityType: 'VEHICLE',
      entityId: vehicleId,
      metadata: { previous_status: vehicle.status, new_status: newStatus }
    });

    await connection.commit();
    return getVehicleById(vehicleId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function setVehicleMaintenance(vehicleId, isMaintenance, adminUserId) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      'SELECT vehicle_id, status, current_status FROM vehicles WHERE vehicle_id = ? FOR UPDATE',
      [vehicleId]
    );
    if (rows.length === 0) {
      const error = new Error('Vehicle not found');
      error.statusCode = 404;
      throw error;
    }
    const vehicle = rows[0];

    if (isMaintenance) {
      const [activeAssignments] = await connection.query(
        "SELECT assignment_id FROM driver_assignments WHERE vehicle_id = ? AND status = 'ACTIVE'",
        [vehicleId]
      );
      if (activeAssignments.length > 0) {
        const error = new Error('Cannot put an actively assigned vehicle into maintenance.');
        error.statusCode = 400;
        throw error;
      }

      await connection.query(
        "UPDATE vehicles SET current_status = 'MAINTENANCE', updated_at = NOW() WHERE vehicle_id = ?",
        [vehicleId]
      );
    } else {
      if (vehicle.status !== 'ACTIVE') {
        const error = new Error('Cannot set inactive vehicle to available.');
        error.statusCode = 400;
        throw error;
      }
      await connection.query(
        "UPDATE vehicles SET current_status = 'AVAILABLE', updated_at = NOW() WHERE vehicle_id = ?",
        [vehicleId]
      );
    }

    await logAudit(connection, {
      userId: adminUserId,
      action: isMaintenance ? 'VEHICLE_MARKED_MAINTENANCE' : 'VEHICLE_MARKED_AVAILABLE',
      entityType: 'VEHICLE',
      entityId: vehicleId,
      metadata: { previous: vehicle.current_status, new: isMaintenance ? 'MAINTENANCE' : 'AVAILABLE' }
    });

    await connection.commit();
    return getVehicleById(vehicleId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  setVehicleStatus,
  setVehicleMaintenance
};