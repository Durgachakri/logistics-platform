const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireRoles } = require('../middleware/auth');

router.use(authenticateToken);

const allowStaff = requireRoles('ADMIN', 'DISPATCHER');
const allowAdminOnly = requireRoles('ADMIN');

router.get('/customers', allowStaff, adminController.getAllCustomers);
router.get('/shipments', allowStaff, adminController.getAllShipments);
router.post('/assignments', allowStaff, adminController.createAssignment);
router.post('/assignments/:id/reassign', allowStaff, adminController.reassignDelivery);
router.get('/reports', allowStaff, adminController.getOperationalReports);
router.get('/audit-logs', allowStaff, adminController.getAuditLogs);

router.get('/drivers', allowStaff, adminController.getAllDrivers);
router.get('/vehicles', allowStaff, adminController.getAllVehicles);

router.post('/drivers', allowAdminOnly, adminController.createDriver);
router.get('/drivers/:id', allowAdminOnly, adminController.getDriver);
router.put('/drivers/:id', allowAdminOnly, adminController.updateDriver);
router.patch('/drivers/:id/status', allowAdminOnly, adminController.setDriverStatus);

router.post('/vehicles', allowAdminOnly, adminController.createVehicle);
router.get('/vehicles/:id', allowAdminOnly, adminController.getVehicle);
router.put('/vehicles/:id', allowAdminOnly, adminController.updateVehicle);
router.patch('/vehicles/:id/status', allowAdminOnly, adminController.setVehicleStatus);
router.patch('/vehicles/:id/maintenance', allowAdminOnly, adminController.setVehicleMaintenance);

module.exports = router;