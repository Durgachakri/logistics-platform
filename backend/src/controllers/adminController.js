const db = require('../config/database');
const assignmentService = require('../services/assignmentService');
const deliveryService = require('../services/deliveryService');
const auditService = require('../services/auditService');
const driverService = require('../services/driverService');
const vehicleService = require('../services/vehicleService');

async function createAssignment(req, res, next) {
  try {
    const { shipment_id, driver_id, vehicle_id } = req.body;
    if (!shipment_id || !driver_id || !vehicle_id) {
      return res.status(400).json({ success: false, message: 'shipment_id, driver_id, and vehicle_id are required' });
    }
    const data = await assignmentService.assignDriverAndVehicle({
      shipmentId: shipment_id,
      driverId: driver_id,
      vehicleId: vehicle_id,
      assignedByUserId: req.user.user_id,
      userRole: req.user.role
    });
    res.status(201).json({ success: true, message: 'Driver and vehicle successfully assigned', data });
  } catch (err) {
    next(err);
  }
}

async function reassignDelivery(req, res, next) {
  try {
    const shipmentId = req.params.id;
    const { driver_id, vehicle_id } = req.body;
    if (!driver_id || !vehicle_id) {
      return res.status(400).json({ success: false, message: 'driver_id and vehicle_id are required for reassignment' });
    }
    const data = await deliveryService.reassignShipment({
      shipmentId,
      newDriverId: driver_id,
      newVehicleId: vehicle_id,
      adminUserId: req.user.user_id,
      userRole: req.user.role
    });
    res.json({ success: true, message: 'Shipment successfully reassigned and rescheduled', data });
  } catch (err) {
    next(err);
  }
}

async function getAllCustomers(req, res, next) {
  try {
    const [customers] = await db.query(
      `SELECT customer_id, user_id, customer_number, name, phone, email, address, status, created_at
       FROM customers ORDER BY created_at DESC`
    );
    res.json({ success: true, count: customers.length, data: customers });
  } catch (err) {
    next(err);
  }
}

async function getAllDrivers(req, res, next) {
  try {
    const { available_only } = req.query;
    if (available_only === 'true') {
      const [drivers] = await db.query(
        `SELECT driver_id, employee_number, name, phone, license_number, status, current_status
         FROM drivers
         WHERE status = 'ACTIVE' AND current_status = 'AVAILABLE'
         ORDER BY name ASC`
      );
      return res.json({ success: true, count: drivers.length, data: drivers });
    }
    const data = await driverService.getAllDrivers();
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
}

async function getDriver(req, res, next) {
  try {
    const data = await driverService.getDriverById(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createDriver(req, res, next) {
  try {
    const { name, email, password, phone, employee_number, license_number, license_expiry } = req.body;
    const data = await driverService.createDriver({
      name,
      email,
      password,
      phone,
      employeeNumber: employee_number,
      licenseNumber: license_number,
      licenseExpiry: license_expiry,
      adminUserId: req.user.user_id
    });
    res.status(201).json({ success: true, message: 'Driver and login account successfully created', data });
  } catch (err) {
    next(err);
  }
}

async function updateDriver(req, res, next) {
  try {
    const { name, phone, license_number, license_expiry } = req.body;
    const data = await driverService.updateDriver(req.params.id, {
      name,
      phone,
      licenseNumber: license_number,
      licenseExpiry: license_expiry,
      adminUserId: req.user.user_id
    });
    res.json({ success: true, message: 'Driver profile updated successfully', data });
  } catch (err) {
    next(err);
  }
}

async function setDriverStatus(req, res, next) {
  try {
    const { status } = req.body;
    const data = await driverService.setDriverStatus(req.params.id, status, req.user.user_id);
    res.json({ success: true, message: `Driver marked as ${status}`, data });
  } catch (err) {
    next(err);
  }
}

async function getAllVehicles(req, res, next) {
  try {
    const { available_only } = req.query;
    if (available_only === 'true') {
      const [vehicles] = await db.query(
        `SELECT vehicle_id, registration_number, vehicle_type, capacity_kg, status, current_status
         FROM vehicles
         WHERE status = 'ACTIVE' AND current_status = 'AVAILABLE'
         ORDER BY registration_number ASC`
      );
      return res.json({ success: true, count: vehicles.length, data: vehicles });
    }
    const data = await vehicleService.getAllVehicles();
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
}

async function getVehicle(req, res, next) {
  try {
    const data = await vehicleService.getVehicleById(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createVehicle(req, res, next) {
  try {
    const { registration_number, vehicle_type, capacity_kg, last_service_date } = req.body;
    const data = await vehicleService.createVehicle({
      registrationNumber: registration_number,
      vehicleType: vehicle_type,
      capacityKg: capacity_kg,
      lastServiceDate: last_service_date,
      adminUserId: req.user.user_id
    });
    res.status(201).json({ success: true, message: 'Vehicle created successfully', data });
  } catch (err) {
    next(err);
  }
}

async function updateVehicle(req, res, next) {
  try {
    const { vehicle_type, capacity_kg, last_service_date } = req.body;
    const data = await vehicleService.updateVehicle(req.params.id, {
      vehicleType: vehicle_type,
      capacityKg: capacity_kg,
      lastServiceDate: last_service_date,
      adminUserId: req.user.user_id
    });
    res.json({ success: true, message: 'Vehicle updated successfully', data });
  } catch (err) {
    next(err);
  }
}

async function setVehicleStatus(req, res, next) {
  try {
    const { status } = req.body;
    const data = await vehicleService.setVehicleStatus(req.params.id, status, req.user.user_id);
    res.json({ success: true, message: `Vehicle marked as ${status}`, data });
  } catch (err) {
    next(err);
  }
}

async function setVehicleMaintenance(req, res, next) {
  try {
    const { maintenance } = req.body;
    const data = await vehicleService.setVehicleMaintenance(req.params.id, Boolean(maintenance), req.user.user_id);
    res.json({ success: true, message: maintenance ? 'Vehicle marked as MAINTENANCE' : 'Vehicle marked as AVAILABLE', data });
  } catch (err) {
    next(err);
  }
}

async function getAllShipments(req, res, next) {
  try {
    const { status } = req.query;
    let query = `
      SELECT s.shipment_id, s.shipment_number, s.customer_id, s.pickup_address, s.delivery_address,
             s.package_description, s.package_weight_kg, s.priority, s.status,
             s.payment_method, s.payment_status, s.created_at, s.updated_at,
             c.name AS customer_name, c.customer_number,
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

async function getOperationalReports(req, res, next) {
  try {
    const data = await auditService.getOperationalMetrics();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getAuditLogs(req, res, next) {
  try {
    const { action, entity_type, limit } = req.query;
    const data = await auditService.getAuditTrail({ action, entityType: entity_type, limit });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createAssignment,
  reassignDelivery,
  getAllCustomers,
  getAllDrivers,
  getDriver,
  createDriver,
  updateDriver,
  setDriverStatus,
  getAllVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  setVehicleStatus,
  setVehicleMaintenance,
  getAllShipments,
  getOperationalReports,
  getAuditLogs
};