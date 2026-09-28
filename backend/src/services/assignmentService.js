const db = require('../config/database');
const { generateId } = require('../utils/idGenerator');
const { validateTransition } = require('./stateMachine');

/**
 * Assigns a driver and vehicle to a shipment using strict row-level locking
 * (SELECT ... FOR UPDATE) to prevent race conditions during concurrent assignments.
 */
async function assignDriverAndVehicle({ shipmentId, driverId, vehicleId, assignedByUserId, userRole }) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Lock shipment row to prevent concurrent assignment attempts on the same shipment
    const [shipments] = await connection.query(
      `SELECT shipment_id, status, customer_id
       FROM shipments
       WHERE shipment_id = ?
       FOR UPDATE`,
      [shipmentId]
    );

    if (shipments.length === 0) {
      const error = new Error('Shipment not found');
      error.statusCode = 404;
      throw error;
    }

    const shipment = shipments[0];

    // Validate state machine rule: only CREATED or RESCHEDULED can be ASSIGNED
    validateTransition(shipment.status, 'ASSIGNED', userRole);

    // 2. Lock driver row to prevent two dispatchers assigning the same driver simultaneously
    const [drivers] = await connection.query(
      `SELECT driver_id, name, status, current_status
       FROM drivers
       WHERE driver_id = ?
       FOR UPDATE`,
      [driverId]
    );

    if (drivers.length === 0) {
      const error = new Error('Driver not found');
      error.statusCode = 404;
      throw error;
    }

    const driver = drivers[0];

    if (driver.status !== 'ACTIVE') {
      const error = new Error(`Cannot assign driver: account status is '${driver.status}'`);
      error.statusCode = 400;
      throw error;
    }

    if (driver.current_status !== 'AVAILABLE') {
      const error = new Error(`Driver ${driver.name} is currently ${driver.current_status} and unavailable`);
      error.statusCode = 409;
      throw error;
    }

    // Verify driver has no active assignment record
    const [activeDriverAssignments] = await connection.query(
      `SELECT assignment_id FROM driver_assignments
       WHERE driver_id = ? AND status = 'ACTIVE'
       FOR UPDATE`,
      [driverId]
    );

    if (activeDriverAssignments.length > 0) {
      const error = new Error(`Driver ${driver.name} already has an active assignment`);
      error.statusCode = 409;
      throw error;
    }

    // 3. Lock vehicle row to prevent two dispatchers assigning the same vehicle simultaneously
    const [vehicles] = await connection.query(
      `SELECT vehicle_id, registration_number, status, current_status
       FROM vehicles
       WHERE vehicle_id = ?
       FOR UPDATE`,
      [vehicleId]
    );

    if (vehicles.length === 0) {
      const error = new Error('Vehicle not found');
      error.statusCode = 404;
      throw error;
    }

    const vehicle = vehicles[0];

    if (vehicle.status !== 'ACTIVE') {
      const error = new Error(`Cannot assign vehicle: status is '${vehicle.status}'`);
      error.statusCode = 400;
      throw error;
    }

    if (vehicle.current_status === 'MAINTENANCE') {
      const error = new Error(`Vehicle ${vehicle.registration_number} is under MAINTENANCE and cannot be assigned`);
      error.statusCode = 400;
      throw error;
    }

    if (vehicle.current_status !== 'AVAILABLE') {
      const error = new Error(`Vehicle ${vehicle.registration_number} is currently ${vehicle.current_status} and unavailable`);
      error.statusCode = 409;
      throw error;
    }

    // Verify vehicle has no active assignment record
    const [activeVehicleAssignments] = await connection.query(
      `SELECT assignment_id FROM driver_assignments
       WHERE vehicle_id = ? AND status = 'ACTIVE'
       FOR UPDATE`,
      [vehicleId]
    );

    if (activeVehicleAssignments.length > 0) {
      const error = new Error(`Vehicle ${vehicle.registration_number} is already in an active assignment`);
      error.statusCode = 409;
      throw error;
    }

    // 4. Create assignment record
    const assignmentId = generateId('ASN');
    await connection.query(
      `INSERT INTO driver_assignments (
        assignment_id, shipment_id, driver_id, vehicle_id, assigned_by, assigned_at, status
      ) VALUES (?, ?, ?, ?, ?, NOW(), 'ACTIVE')`,
      [assignmentId, shipmentId, driverId, vehicleId, assignedByUserId]
    );

    // 5. Update shipment status
    await connection.query(
      `UPDATE shipments SET status = 'ASSIGNED', updated_at = NOW() WHERE shipment_id = ?`,
      [shipmentId]
    );

    // 6. Update driver current_status
    await connection.query(
      `UPDATE drivers SET current_status = 'ASSIGNED' WHERE driver_id = ?`,
      [driverId]
    );

    // 7. Update vehicle current_status and associate driver
    await connection.query(
      `UPDATE vehicles SET current_status = 'ASSIGNED', driver_id = ? WHERE vehicle_id = ?`,
      [driverId, vehicleId]
    );

    // 8. Record delivery event
    const eventId = generateId('EVT');
    await connection.query(
      `INSERT INTO delivery_events (
        event_id, shipment_id, driver_id, event_type, location, notes, idempotency_key
      ) VALUES (?, ?, ?, 'ASSIGNED', 'Dispatch Hub', ?, ?)`,
      [
        eventId,
        shipmentId,
        driverId,
        `Assigned to driver ${driver.name} with vehicle ${vehicle.registration_number}`,
        `event-assign-${assignmentId}`
      ]
    );

    // 9. Record audit log
    const auditId = generateId('AUD');
    await connection.query(
      `INSERT INTO audit_logs (audit_id, user_id, action, entity_type, entity_id, metadata)
       VALUES (?, ?, 'DRIVER_ASSIGNED', 'DRIVER_ASSIGNMENT', ?, ?)`,
      [
        auditId,
        assignedByUserId,
        assignmentId,
        JSON.stringify({ shipment_id: shipmentId, driver_id: driverId, vehicle_id: vehicleId })
      ]
    );

    await connection.commit();

    return {
      assignment_id: assignmentId,
      shipment_id: shipmentId,
      driver_id: driverId,
      vehicle_id: vehicleId,
      status: 'ASSIGNED'
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  assignDriverAndVehicle
};