const db = require('../config/database');
const { generateId } = require('../utils/idGenerator');
const { canCancelShipment } = require('../services/stateMachine');

// GET /api/customers/me
async function getProfile(req, res, next) {
  try {
    const customerId = req.customer.customer_id;
    const [rows] = await db.query(
      `SELECT customer_id, customer_number, name, phone, email, address, status, created_at
       FROM customers
       WHERE customer_id = ?`,
      [customerId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer profile not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

// PUT /api/customers/me
async function updateProfile(req, res, next) {
  try {
    const customerId = req.customer.customer_id;
    const { name, phone, address } = req.body;

    await db.query(
      `UPDATE customers
       SET name = COALESCE(?, name),
           phone = COALESCE(?, phone),
           address = COALESCE(?, address)
       WHERE customer_id = ?`,
      [name, phone, address, customerId]
    );

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err) {
    next(err);
  }
}

// POST /api/shipments
async function createShipment(req, res, next) {
  const connection = await db.getConnection();
  try {
    const customerId = req.customer.customer_id;
    const {
      pickup_address,
      delivery_address,
      package_description,
      package_weight_kg,
      priority = 'NORMAL',
      scheduled_pickup_date,
      scheduled_delivery_date
    } = req.body;

    if (!pickup_address || !delivery_address || !package_description || !package_weight_kg) {
      return res.status(400).json({
        success: false,
        message: 'Missing required shipment fields: pickup_address, delivery_address, package_description, package_weight_kg'
      });
    }

    const shipmentId = generateId('SHP');
    const shipmentNumber = `SHIP-${Math.floor(10000 + Math.random() * 90000)}`;

    await connection.beginTransaction();

    await connection.query(
      `INSERT INTO shipments (
        shipment_id, shipment_number, customer_id, pickup_address, delivery_address,
        package_description, package_weight_kg, priority, scheduled_pickup_date,
        scheduled_delivery_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CREATED')`,
      [
        shipmentId,
        shipmentNumber,
        customerId,
        pickup_address,
        delivery_address,
        package_description,
        package_weight_kg,
        priority,
        scheduled_pickup_date || null,
        scheduled_delivery_date || null
      ]
    );


    const eventId = generateId('EVT');
    await connection.query(
      `INSERT INTO delivery_events (
        event_id, shipment_id, driver_id, event_type, location, notes, idempotency_key
      ) VALUES (?, ?, NULL, 'CREATED', ?, 'Shipment created by customer', ?)`,
      [eventId, shipmentId, pickup_address, `event-create-${shipmentId}`]
    );


    const auditId = generateId('AUD');
    await connection.query(
      `INSERT INTO audit_logs (audit_id, user_id, action, entity_type, entity_id, metadata)
       VALUES (?, ?, 'SHIPMENT_CREATED', 'SHIPMENT', ?, ?)`,
      [auditId, req.user.user_id, shipmentId, JSON.stringify({ customer_id: customerId })]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Shipment created successfully',
      data: {
        shipment_id: shipmentId,
        shipment_number: shipmentNumber,
        status: 'CREATED'
      }
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

// GET /api/shipments
async function getMyShipments(req, res, next) {
  try {
    const customerId = req.customer.customer_id;
    const [shipments] = await db.query(
      `SELECT * FROM shipments
       WHERE customer_id = ?
       ORDER BY created_at DESC`,
      [customerId]
    );

    res.json({ success: true, count: shipments.length, data: shipments });
  } catch (err) {
    next(err);
  }
}

// GET /api/shipments/:id (with IDOR protection)
async function getShipmentById(req, res, next) {
  try {
    const customerId = req.customer.customer_id;
    const shipmentId = req.params.id;

    const [rows] = await db.query(
      `SELECT * FROM shipments WHERE shipment_id = ?`,
      [shipmentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    const shipment = rows[0];

    // Enforce Customer Ownership
    if (shipment.customer_id !== customerId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not own this shipment'
      });
    }

    // Fetch delivery events timeline
    const [events] = await db.query(
      `SELECT * FROM delivery_events WHERE shipment_id = ? ORDER BY created_at ASC`,
      [shipmentId]
    );

    // Fetch proof of delivery if available
    const [proofs] = await db.query(
      `SELECT * FROM proof_of_delivery WHERE shipment_id = ?`,
      [shipmentId]
    );

    res.json({
      success: true,
      data: {
        ...shipment,
        events,
        proof_of_delivery: proofs[0] || null
      }
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/shipments/:id/cancel
async function cancelShipment(req, res, next) {
  const connection = await db.getConnection();
  try {
    const customerId = req.customer.customer_id;
    const shipmentId = req.params.id;

    await connection.beginTransaction();

    // Lock shipment row
    const [rows] = await connection.query(
      `SELECT shipment_id, customer_id, status FROM shipments WHERE shipment_id = ? FOR UPDATE`,
      [shipmentId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    const shipment = rows[0];

    // Check ownership
    if (shipment.customer_id !== customerId) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: 'Access denied: You do not own this shipment' });
    }

    // Verify cancellation eligibility
    if (!canCancelShipment(shipment.status)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot cancel shipment with status '${shipment.status}'. Only CREATED or ASSIGNED shipments can be cancelled.`
      });
    }

    // If shipment was ASSIGNED, release driver & vehicle
    if (shipment.status === 'ASSIGNED') {
      const [assignments] = await connection.query(
        `SELECT assignment_id, driver_id, vehicle_id
         FROM driver_assignments
         WHERE shipment_id = ? AND status = 'ACTIVE' FOR UPDATE`,
        [shipmentId]
      );

      if (assignments.length > 0) {
        const assignment = assignments[0];

        // Mark assignment as CANCELLED
        await connection.query(
          `UPDATE driver_assignments
           SET status = 'CANCELLED', ended_at = NOW()
           WHERE assignment_id = ?`,
          [assignment.assignment_id]
        );

        // Restore driver status
        await connection.query(
          `UPDATE drivers SET current_status = 'AVAILABLE' WHERE driver_id = ?`,
          [assignment.driver_id]
        );

        // Restore vehicle status
        await connection.query(
          `UPDATE vehicles SET current_status = 'AVAILABLE', driver_id = NULL WHERE vehicle_id = ?`,
          [assignment.vehicle_id]
        );
      }
    }

    // Update shipment status to CANCELLED
    await connection.query(
      `UPDATE shipments SET status = 'CANCELLED', updated_at = NOW() WHERE shipment_id = ?`,
      [shipmentId]
    );

    // Record delivery event
    const eventId = generateId('EVT');
    await connection.query(
      `INSERT INTO delivery_events (event_id, shipment_id, driver_id, event_type, location, notes, idempotency_key)
       VALUES (?, ?, NULL, 'CANCELLED', 'Customer Location', 'Cancelled by customer', ?)`,
      [eventId, shipmentId, `event-cancel-${shipmentId}`]
    );

    // Record audit log
    const auditId = generateId('AUD');
    await connection.query(
      `INSERT INTO audit_logs (audit_id, user_id, action, entity_type, entity_id, metadata)
       VALUES (?, ?, 'SHIPMENT_CANCELLED', 'SHIPMENT', ?, ?)`,
      [auditId, req.user.user_id, shipmentId, JSON.stringify({ previous_status: shipment.status })]
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Shipment cancelled successfully and any assigned resources were released'
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

module.exports = {
  getProfile,
  updateProfile,
  createShipment,
  getMyShipments,
  getShipmentById,
  cancelShipment
};