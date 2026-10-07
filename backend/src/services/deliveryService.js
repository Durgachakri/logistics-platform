const db = require('../config/database');
const { generateId } = require('../utils/idGenerator');
const { validateTransition } = require('./stateMachine');

async function verifyDriverAssignment(connection, shipmentId, driverId) {
  const [assignments] = await connection.query(
    `SELECT assignment_id, shipment_id, driver_id, vehicle_id, status
     FROM driver_assignments
     WHERE shipment_id = ? AND driver_id = ? AND status = 'ACTIVE'
     FOR UPDATE`,
    [shipmentId, driverId]
  );

  if (assignments.length === 0) {
    const error = new Error('Access denied: You are not actively assigned to this shipment');
    error.statusCode = 403;
    throw error;
  }

  return assignments[0];
}

async function updateShipmentStatusByDriver({
  shipmentId,
  driverId,
  userId,
  targetStatus,
  location,
  notes,
  idempotencyKey
}) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    if (idempotencyKey) {
      const [existingEvents] = await connection.query(
        `SELECT event_id, shipment_id, event_type, created_at
         FROM delivery_events
         WHERE idempotency_key = ?`,
        [idempotencyKey]
      );

      if (existingEvents.length > 0) {
        await connection.commit();
        return {
          idempotent: true,
          message: 'Duplicate request detected. Returning existing event.',
          event: existingEvents[0]
        };
      }
    }

    const [shipments] = await connection.query(
      `SELECT shipment_id, status, payment_method, payment_status
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
    const assignment = await verifyDriverAssignment(connection, shipmentId, driverId);

    validateTransition(shipment.status, targetStatus, 'DRIVER');

    let nextPaymentStatus = shipment.payment_status;

    if (targetStatus === 'DELIVERED') {
      if (shipment.payment_method === 'COD') {
        nextPaymentStatus = 'PAID';
      }

      await connection.query(
        `UPDATE shipments
         SET status = ?, payment_status = ?, updated_at = NOW()
         WHERE shipment_id = ?`,
        [targetStatus, nextPaymentStatus, shipmentId]
      );

      await connection.query(
        `UPDATE driver_assignments
         SET status = 'COMPLETED', ended_at = NOW()
         WHERE assignment_id = ?`,
        [assignment.assignment_id]
      );

      await connection.query(
        `UPDATE drivers SET current_status = 'AVAILABLE', updated_at = NOW() WHERE driver_id = ?`,
        [driverId]
      );

      await connection.query(
        `UPDATE vehicles SET current_status = 'AVAILABLE', driver_id = NULL, updated_at = NOW() WHERE vehicle_id = ?`,
        [assignment.vehicle_id]
      );
    } else if (targetStatus === 'DELIVERY_FAILED') {
      if (!notes || !notes.trim()) {
        const error = new Error('A failure reason/note is required when marking a delivery as failed');
        error.statusCode = 400;
        throw error;
      }

      await connection.query(
        `UPDATE shipments SET status = ?, updated_at = NOW() WHERE shipment_id = ?`,
        [targetStatus, shipmentId]
      );

      await connection.query(
        `UPDATE driver_assignments
         SET status = 'CANCELLED', ended_at = NOW()
         WHERE assignment_id = ?`,
        [assignment.assignment_id]
      );

      await connection.query(
        `UPDATE drivers SET current_status = 'AVAILABLE', updated_at = NOW() WHERE driver_id = ?`,
        [driverId]
      );

      await connection.query(
        `UPDATE vehicles SET current_status = 'AVAILABLE', driver_id = NULL, updated_at = NOW() WHERE vehicle_id = ?`,
        [assignment.vehicle_id]
      );
    } else {
      await connection.query(
        `UPDATE shipments SET status = ?, updated_at = NOW() WHERE shipment_id = ?`,
        [targetStatus, shipmentId]
      );

      if (targetStatus === 'IN_TRANSIT') {
        await connection.query(
          `UPDATE drivers SET current_status = 'IN_TRANSIT', updated_at = NOW() WHERE driver_id = ?`,
          [driverId]
        );
        await connection.query(
          `UPDATE vehicles SET current_status = 'IN_TRANSIT', updated_at = NOW() WHERE vehicle_id = ?`,
          [assignment.vehicle_id]
        );
      }
    }

    const eventId = generateId('EVT');
    const actualIdemKey = idempotencyKey || `evt-${shipmentId}-${targetStatus}-${Date.now()}`;

    await connection.query(
      `INSERT INTO delivery_events (
        event_id, shipment_id, driver_id, event_type, location, notes, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [eventId, shipmentId, driverId, targetStatus, location || null, notes || null, actualIdemKey]
    );

    const auditId = generateId('AUD');
    await connection.query(
      `INSERT INTO audit_logs (audit_id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, 'SHIPMENT', ?, ?, NOW())`,
      [
        auditId,
        userId,
        targetStatus === 'DELIVERY_FAILED' ? 'DELIVERY_FAILED' : 'DELIVERY_STATUS_UPDATED',
        shipmentId,
        JSON.stringify({
          previous_status: shipment.status,
          new_status: targetStatus,
          payment_status: nextPaymentStatus
        })
      ]
    );

    await connection.commit();

    return {
      success: true,
      shipment_id: shipmentId,
      status: targetStatus,
      payment_status: nextPaymentStatus,
      event_id: eventId
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function reassignShipment({ shipmentId, newDriverId, newVehicleId, adminUserId, userRole }) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [shipments] = await connection.query(
      `SELECT shipment_id, status FROM shipments WHERE shipment_id = ? FOR UPDATE`,
      [shipmentId]
    );

    if (shipments.length === 0) {
      const error = new Error('Shipment not found');
      error.statusCode = 404;
      throw error;
    }

    const shipment = shipments[0];

    if (shipment.status !== 'DELIVERY_FAILED' && shipment.status !== 'RESCHEDULED') {
      const error = new Error(`Cannot reassign shipment in status '${shipment.status}'. Must be DELIVERY_FAILED or RESCHEDULED.`);
      error.statusCode = 400;
      throw error;
    }

    await connection.query(
      `UPDATE driver_assignments
       SET status = 'REASSIGNED', ended_at = NOW()
       WHERE shipment_id = ? AND status = 'ACTIVE'`,
      [shipmentId]
    );

    const [drivers] = await connection.query(
      `SELECT driver_id, name, status, current_status FROM drivers WHERE driver_id = ? FOR UPDATE`,
      [newDriverId]
    );

    if (drivers.length === 0 || drivers[0].status !== 'ACTIVE' || drivers[0].current_status !== 'AVAILABLE') {
      const error = new Error('Selected driver is not available for assignment');
      error.statusCode = 409;
      throw error;
    }

    const [vehicles] = await connection.query(
      `SELECT vehicle_id, registration_number, status, current_status FROM vehicles WHERE vehicle_id = ? FOR UPDATE`,
      [newVehicleId]
    );

    if (vehicles.length === 0 || vehicles[0].status !== 'ACTIVE' || vehicles[0].current_status !== 'AVAILABLE') {
      const error = new Error('Selected vehicle is not available for assignment');
      error.statusCode = 409;
      throw error;
    }

    const assignmentId = generateId('ASN');
    await connection.query(
      `INSERT INTO driver_assignments (
        assignment_id, shipment_id, driver_id, vehicle_id, assigned_by, assigned_at, status
      ) VALUES (?, ?, ?, ?, ?, NOW(), 'ACTIVE')`,
      [assignmentId, shipmentId, newDriverId, newVehicleId, adminUserId]
    );

    await connection.query(
      `UPDATE shipments SET status = 'ASSIGNED', updated_at = NOW() WHERE shipment_id = ?`,
      [shipmentId]
    );

    await connection.query(
      `UPDATE drivers SET current_status = 'ASSIGNED', updated_at = NOW() WHERE driver_id = ?`,
      [newDriverId]
    );

    await connection.query(
      `UPDATE vehicles SET current_status = 'ASSIGNED', driver_id = ?, updated_at = NOW() WHERE vehicle_id = ?`,
      [newDriverId, newVehicleId]
    );

    const eventId = generateId('EVT');
    await connection.query(
      `INSERT INTO delivery_events (
        event_id, shipment_id, driver_id, event_type, location, notes, idempotency_key
      ) VALUES (?, ?, ?, 'RESCHEDULED', 'Dispatch Hub', ?, ?)`,
      [eventId, shipmentId, newDriverId, 'Shipment reassigned and rescheduled', `event-reassign-${assignmentId}`]
    );

    const auditId = generateId('AUD');
    await connection.query(
      `INSERT INTO audit_logs (audit_id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, 'DELIVERY_RESCHEDULED', 'DRIVER_ASSIGNMENT', ?, ?, NOW())`,
      [
        auditId,
        adminUserId,
        assignmentId,
        JSON.stringify({ shipment_id: shipmentId, new_driver_id: newDriverId, new_vehicle_id: newVehicleId })
      ]
    );

    await connection.commit();

    return {
      assignment_id: assignmentId,
      shipment_id: shipmentId,
      driver_id: newDriverId,
      vehicle_id: newVehicleId,
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
  verifyDriverAssignment,
  updateShipmentStatusByDriver,
  reassignShipment
};