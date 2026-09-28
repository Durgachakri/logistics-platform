const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// All admin endpoints require ADMIN or DISPATCHER role
router.use(authenticateToken, requireRoles('ADMIN', 'DISPATCHER'));

router.post('/assignments', adminController.createAssignment);
router.post('/assignments/:id/reassign', adminController.reassignDelivery);
router.get('/customers', adminController.getAllCustomers);
router.get('/drivers', adminController.getAllDrivers);
router.get('/vehicles', adminController.getAllVehicles);
router.get('/shipments', adminController.getAllShipments);
router.get('/reports', adminController.getOperationalReports);
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;