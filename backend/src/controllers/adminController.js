const db = require('../config/database');
const assignmentService = require('../services/assignmentService');
const auditService = require('../services/auditService');

// POST /api/admin/assignments
async function createAssignment(req, res, next) {
  try {
    const { shipment_id, driver_id, vehicle_id } = req.body;

    if (!shipment_id || !driver_id || !vehicle_id) {
      return res.status(400).json({
        success: false,
        message: 'shipment_id, driver_id, and vehicle_id are required'
      });
    }

    const data = await assignmentService.assignDriverAndVehicle({
      shipmentId: shipment_id,
      driverId: driver_id,
      vehicleId: vehicle_id,
      assignedByUserId: req.user.user_id,
      userRole: req.user.role
    });

    res.status(201).json({
      success: true,
      message: 'Driver and vehicle successfully assigned',
      data
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/customers
async function getAllCustomers(req, res, next) {
  try {
    const [customers] = await db.query(
      `SELECT customer_id, user_id, customer_number, name, phone, email, address, status, created_at
       FROM customers
       ORDER BY created_at DESC`
    );
    res.json({ success: true, count: customers.length, data: customers });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/drivers
async function getAllDrivers(req, res, next) {
  try {
    const [drivers] = await db.query(
      `SELECT driver_id, user_id, employee_number, name, phone, license_number, license_expiry, status, current_status
       FROM drivers
       ORDER BY name ASC`
    );
    res.json({ success: true, count: drivers.length, data: drivers });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/vehicles
async function getAllVehicles(req, res, next) {
  try {
    const [vehicles] = await db.query(
      `SELECT vehicle_id, registration_number, vehicle_type, capacity_kg, status, current_status, driver_id, last_service_date
       FROM vehicles
       ORDER BY registration_number ASC`
    );
    res.json({ success: true, count: vehicles.length, data: vehicles });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/shipments
async function getAllShipments(req, res, next) {
  try {
    const { status } = req.query;
    let query = `
      SELECT s.*, c.name AS customer_name, c.customer_number,
             da.assignment_id, da.driver_id, d.name AS driver_name,
             da.vehicle_id, v.registration_number
      FROM shipments s
      JOIN customers c ON s.customer_id = c.customer_id
      LEFT JOIN driver_assignments da ON s.shipment_id = da.shipment_id AND da.status = 'ACTIVE'
      LEFT JOIN drivers d ON da.driver_id = d.driver_id
      LEFT JOIN vehicles v ON da.vehicle_id = v.vehicle_id
    `;
    const params = [];

    if (status) {
      query += ` WHERE s.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY s.created_at DESC`;

    const [shipments] = await db.query(query, params);
    res.json({ success: true, count: shipments.length, data: shipments });
  } catch (err) {
    next(err);
  }
}

const deliveryService = require('../services/deliveryService');

async function reassignDelivery(req, res, next) {
  try {
    const shipmentId = req.params.id;
    const { driver_id, vehicle_id } = req.body;

    if (!driver_id || !vehicle_id) {
      return res.status(400).json({
        success: false,
        message: 'driver_id and vehicle_id are required for reassignment'
      });
    }

    const data = await deliveryService.reassignShipment({
      shipmentId,
      newDriverId: driver_id,
      newVehicleId: vehicle_id,
      adminUserId: req.user.user_id,
      userRole: req.user.role
    });

    res.json({
      success: true,
      message: 'Shipment successfully reassigned and rescheduled',
      data
    });
  } catch (err) {
    next(err);
  }
}

async function getOperationalReports(req, res, next) {
  try {
    const data = await auditService.getOperationalMetrics();
    res.json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/audit-logs
async function getAuditLogs(req, res, next) {
  try {
    const { action, entity_type, limit } = req.query;
    const data = await auditService.getAuditTrail({
      action,
      entityType: entity_type,
      limit
    });
    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createAssignment,
  getAllCustomers,
  getAllDrivers,
  getAllVehicles,
  getAllShipments,
  reassignDelivery,
  getOperationalReports,
  getAuditLogs
};