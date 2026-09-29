const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticateToken, requireRoles } = require('../middleware/auth');


router.use(authenticateToken, requireRoles('CUSTOMER'));

// Customer Profile
router.get('/customers/me', customerController.getProfile);
router.put('/customers/me', customerController.updateProfile);

// Shipments
router.post('/shipments', customerController.createShipment);
router.get('/shipments', customerController.getMyShipments);
router.get('/shipments/:id', customerController.getShipmentById);
router.post('/shipments/:id/cancel', customerController.cancelShipment);

module.exports = router;