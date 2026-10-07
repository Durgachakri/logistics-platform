const db = require('../config/database');
const { generateId, generateShipmentNumber } = require('../utils/idGenerator');
const { logAudit } = require('./auditService');

async function getCustomerProfile(userId) {
  const [rows] = await db.query(
    `SELECT customer_id, user_id, customer_number, name, phone, email, address, status, created_at, updated_at
     FROM customers
     WHERE user_id = ?`,
    [userId]
  );
  if (rows.length === 0) {
    const error = new Error('Customer profile not found');
    error.statusCode = 404;
    throw error;
  }
  return rows[0];
}

async function updateCustomerProfile(userId, { name, phone, address }) {
  const customer = await getCustomerProfile(userId);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const updatedName = name || customer.name;
    const updatedPhone = phone || customer.phone;
    const updatedAddress = address || customer.address;

    await connection.query(
      `UPDATE customers
       SET name = ?, phone = ?, address = ?, updated_at = NOW()
       WHERE customer_id = ?`,
      [updatedName, updatedPhone, updatedAddress, customer.customer_id]
    );

    if (name && name !== customer.name) {
      await connection.query(
        `UPDATE users SET name = ?, updated_at = NOW() WHERE user_id = ?`,
        [name, userId]
      );
    }

    await logAudit(connection, {
      userId,
      action: 'CUSTOMER_PROFILE_UPDATED',
      entityType: 'CUSTOMER',
      entityId: customer.customer_id,
      metadata: { previous: { name: customer.name, phone: customer.phone }, updated: { name: updatedName, phone: updatedPhone } }
    });

    await connection.commit();
    return getCustomerProfile(userId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function createShipment({
  userId,
  pickup_address,
  delivery_address,
  package_description,
  package_weight_kg,
  priority,
  payment_method,
  scheduled_pickup_date,
  scheduled_delivery_date
}) {
  const customer = await getCustomerProfile(userId);

  if (!pickup_address || !delivery_address || !package_description || !package_weight_kg) {
    const error = new Error('pickup_address, delivery_address, package_description, and package_weight_kg are required');
    error.statusCode = 400;
    throw error;
  }

  const weight = parseFloat(package_weight_kg);
  if (isNaN(weight) || weight <= 0) {
    const error = new Error('package_weight_kg must be a positive number');
    error.statusCode = 400;
    throw error;
  }

  const resolvedPaymentMethod = (payment_method || 'COD').toUpperCase();
  if (resolvedPaymentMethod !== 'COD') {
    const error = new Error('Only Cash on Delivery (COD) is supported as a payment method');
    error.statusCode = 400;
    throw error;
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const shipmentId = generateId('SHP');
    const shipmentNumber = generateShipmentNumber();

    await connection.query(
      `INSERT INTO shipments (
        shipment_id, shipment_number, customer_id, pickup_address, delivery_address,
        package_description, package_weight_kg, priority, payment_method, payment_status,
        scheduled_pickup_date, scheduled_delivery_date, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COD', 'PENDING', ?, ?, 'CREATED', NOW(), NOW())`,
      [
        shipmentId,
        shipmentNumber,
        customer.customer_id,
        pickup_address,
        delivery_address,
        package_description,
        weight,
        priority || 'NORMAL',
        scheduled_pickup_date || null,
        scheduled_delivery_date || null
      ]
    );

    const eventId = generateId('EVT');
    await connection.query(
      `INSERT INTO delivery_events (
        event_id, shipment_id, event_type, location, notes, idempotency_key, created_at
      ) VALUES (?, ?, 'CREATED', ?, 'Shipment booked with COD payment', ?, NOW())`,
      [eventId, shipmentId, pickup_address, `event-created-${shipmentId}`]
    );

    await logAudit(connection, {
      userId,
      action: 'SHIPMENT_CREATED',
      entityType: 'SHIPMENT',
      entityId: shipmentId,
      metadata: {
        shipment_number: shipmentNumber,
        weight_kg: weight,
        payment_method: 'COD',
        payment_status: 'PENDING'
      }
    });

    await connection.commit();

    return {
      shipment_id: shipmentId,
      shipment_number: shipmentNumber,
      customer_id: customer.customer_id,
      pickup_address,
      delivery_address,
      package_description,
      package_weight_kg: weight,
      priority: priority || 'NORMAL',
      payment_method: 'COD',
      payment_status: 'PENDING',
      status: 'CREATED'
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function getCustomerShipments(userId) {
  const customer = await getCustomerProfile(userId);
  const [rows] = await db.query(
    `SELECT shipment_id, shipment_number, customer_id, pickup_address, delivery_address,
            package_description, package_weight_kg, priority, payment_method, payment_status,
            scheduled_pickup_date, scheduled_delivery_date, status, created_at, updated_at
     FROM shipments
     WHERE customer_id = ?
     ORDER BY created_at DESC`,
    [customer.customer_id]
  );
  return rows;
}

async function getShipmentByIdForCustomer(userId, shipmentId) {
  const customer = await getCustomerProfile(userId);
  const [rows] = await db.query(
    `SELECT * FROM shipments WHERE shipment_id = ?`,
    [shipmentId]
  );

  if (rows.length === 0) {
    const error = new Error('Shipment not found');
    error.statusCode = 404;
    throw error;
  }

  const shipment = rows[0];
  if (shipment.customer_id !== customer.customer_id) {
    const error = new Error('Access denied: You do not own this shipment');
    error.statusCode = 403;
    throw error;
  }

  const [events] = await db.query(
    `SELECT * FROM delivery_events WHERE shipment_id = ? ORDER BY created_at ASC`,
    [shipmentId]
  );

  const [pod] = await db.query(
    `SELECT * FROM proof_of_delivery WHERE shipment_id = ?`,
    [shipmentId]
  );

  return {
    ...shipment,
    events,
    proof_of_delivery: pod.length > 0 ? pod[0] : null
  };
}

async function cancelShipmentByCustomer(userId, shipmentId) {
  const customer = await getCustomerProfile(userId);
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT shipment_id, customer_id, status FROM shipments WHERE shipment_id = ? FOR UPDATE`,
      [shipmentId]
    );

    if (rows.length === 0) {
      const error = new Error('Shipment not found');
      error.statusCode = 404;
      throw error;
    }

    const shipment = rows[0];
    if (shipment.customer_id !== customer.customer_id) {
      const error = new Error('Access denied: You do not own this shipment');
      error.statusCode = 403;
      throw error;
    }

    if (shipment.status !== 'CREATED' && shipment.status !== 'ASSIGNED') {
      const error = new Error(`Cannot cancel shipment with status '${shipment.status}'. Only CREATED or ASSIGNED shipments can be cancelled.`);
      error.statusCode = 400;
      throw error;
    }

    await connection.query(
      `UPDATE shipments SET status = 'CANCELLED', updated_at = NOW() WHERE shipment_id = ?`,
      [shipmentId]
    );

    const [assignments] = await connection.query(
      `SELECT assignment_id, driver_id, vehicle_id FROM driver_assignments WHERE shipment_id = ? AND status = 'ACTIVE'`,
      [shipmentId]
    );

    if (assignments.length > 0) {
      const asn = assignments[0];
      await connection.query(
        `UPDATE driver_assignments SET status = 'CANCELLED', ended_at = NOW() WHERE assignment_id = ?`,
        [asn.assignment_id]
      );
      await connection.query(`UPDATE drivers SET current_status = 'AVAILABLE', updated_at = NOW() WHERE driver_id = ?`, [asn.driver_id]);
      await connection.query(`UPDATE vehicles SET current_status = 'AVAILABLE', driver_id = NULL, updated_at = NOW() WHERE vehicle_id = ?`, [asn.vehicle_id]);
    }

    const eventId = generateId('EVT');
    await connection.query(
      `INSERT INTO delivery_events (
        event_id, shipment_id, event_type, location, notes, idempotency_key, created_at
      ) VALUES (?, ?, 'CANCELLED', 'Customer Location', 'Shipment cancelled by customer', ?, NOW())`,
      [eventId, shipmentId, `event-cancelled-${shipmentId}-${Date.now()}`]
    );

    await logAudit(connection, {
      userId,
      action: 'SHIPMENT_CANCELLED',
      entityType: 'SHIPMENT',
      entityId: shipmentId,
      metadata: { previous_status: shipment.status, new_status: 'CANCELLED' }
    });

    await connection.commit();
    return { shipment_id: shipmentId, status: 'CANCELLED' };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  getCustomerProfile,
  updateCustomerProfile,
  createShipment,
  getCustomerShipments,
  getShipmentByIdForCustomer,
  cancelShipmentByCustomer
};