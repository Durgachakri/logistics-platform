const db = require('../config/database');
const deliveryService = require('../services/deliveryService');
const podService = require('../services/podService');

// GET /api/driver/shipments
async function getAssignedShipments(req, res, next) {
  try {
    const driverId = req.driver.driver_id;

    const [shipments] = await db.query(
      `SELECT s.*, da.assignment_id, da.vehicle_id, v.registration_number, v.vehicle_type
       FROM shipments s
       JOIN driver_assignments da ON s.shipment_id = da.shipment_id
       JOIN vehicles v ON da.vehicle_id = v.vehicle_id
       WHERE da.driver_id = ? AND da.status = 'ACTIVE'
       ORDER BY s.scheduled_pickup_date ASC`,
      [driverId]
    );

    res.json({ success: true, count: shipments.length, data: shipments });
  } catch (err) {
    next(err);
  }
}

// GET /api/driver/shipments/:id
async function getAssignedShipmentDetails(req, res, next) {
  try {
    const driverId = req.driver.driver_id;
    const shipmentId = req.params.id;

    // Verify driver assignment first
    const [assignments] = await db.query(
      `SELECT assignment_id FROM driver_assignments
       WHERE shipment_id = ? AND driver_id = ? AND status = 'ACTIVE'`,
      [shipmentId, driverId]
    );

    if (assignments.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not assigned to this shipment'
      });
    }

    const [shipments] = await db.query(`SELECT * FROM shipments WHERE shipment_id = ?`, [shipmentId]);
    const [events] = await db.query(`SELECT * FROM delivery_events WHERE shipment_id = ? ORDER BY created_at ASC`, [shipmentId]);

    res.json({
      success: true,
      data: {
        ...shipments[0],
        events
      }
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/driver/shipments/:id/pickup
async function markPickup(req, res, next) {
  try {
    const result = await deliveryService.updateShipmentStatusByDriver({
      shipmentId: req.params.id,
      driverId: req.driver.driver_id,
      userId: req.user.user_id,
      targetStatus: 'PICKUP_CONFIRMED',
      location: req.body.location || 'Pickup Location',
      notes: req.body.notes || 'Package picked up by driver',
      idempotencyKey: req.body.idempotency_key
    });

    res.json({ success: true, message: 'Pickup confirmed', data: result });
  } catch (err) {
    next(err);
  }
}

// POST /api/driver/shipments/:id/transit
async function markInTransit(req, res, next) {
  try {
    const result = await deliveryService.updateShipmentStatusByDriver({
      shipmentId: req.params.id,
      driverId: req.driver.driver_id,
      userId: req.user.user_id,
      targetStatus: 'IN_TRANSIT',
      location: req.body.location || 'Transit Route',
      notes: req.body.notes || 'In transit to destination',
      idempotencyKey: req.body.idempotency_key
    });

    res.json({ success: true, message: 'Shipment marked in transit', data: result });
  } catch (err) {
    next(err);
  }
}

// POST /api/driver/shipments/:id/out-for-delivery
async function markOutForDelivery(req, res, next) {
  try {
    const result = await deliveryService.updateShipmentStatusByDriver({
      shipmentId: req.params.id,
      driverId: req.driver.driver_id,
      userId: req.user.user_id,
      targetStatus: 'OUT_FOR_DELIVERY',
      location: req.body.location || 'Local Delivery Area',
      notes: req.body.notes || 'Out for final delivery',
      idempotencyKey: req.body.idempotency_key
    });

    res.json({ success: true, message: 'Shipment out for delivery', data: result });
  } catch (err) {
    next(err);
  }
}

// POST /api/driver/shipments/:id/delivery
async function markDelivered(req, res, next) {
  try {
    const result = await deliveryService.updateShipmentStatusByDriver({
      shipmentId: req.params.id,
      driverId: req.driver.driver_id,
      userId: req.user.user_id,
      targetStatus: 'DELIVERED',
      location: req.body.location || 'Delivery Destination',
      notes: req.body.notes || 'Delivered successfully',
      idempotencyKey: req.body.idempotency_key
    });

    res.json({ success: true, message: 'Shipment delivered successfully', data: result });
  } catch (err) {
    next(err);
  }
}

// POST /api/driver/shipments/:id/fail
async function markFailed(req, res, next) {
  try {
    const { reason, location } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A failure reason is required'
      });
    }

    const result = await deliveryService.updateShipmentStatusByDriver({
      shipmentId: req.params.id,
      driverId: req.driver.driver_id,
      userId: req.user.user_id,
      targetStatus: 'DELIVERY_FAILED',
      location: location || 'Delivery Location',
      notes: reason,
      idempotencyKey: req.body.idempotency_key
    });

    res.json({ success: true, message: 'Delivery marked as failed', data: result });
  } catch (err) {
    next(err);
  }
}

// POST /api/driver/shipments/:id/proof
async function uploadProof(req, res, next) {
  try {
    const data = await podService.uploadProofOfDelivery({
      shipmentId: req.params.id,
      driverId: req.driver.driver_id,
      userId: req.user.user_id,
      file: req.file
    });

    res.status(201).json({
      success: true,
      message: 'Proof of delivery uploaded successfully',
      data
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAssignedShipments,
  getAssignedShipmentDetails,
  markPickup,
  markInTransit,
  markOutForDelivery,
  markDelivered,
  markFailed,
  uploadProof
};