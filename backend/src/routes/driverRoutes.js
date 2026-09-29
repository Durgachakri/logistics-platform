const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const upload = require('../middleware/upload');


router.use(authenticateToken, requireRoles('DRIVER'));

router.get('/shipments', driverController.getAssignedShipments);
router.get('/shipments/:id', driverController.getAssignedShipmentDetails);
router.post('/shipments/:id/pickup', driverController.markPickup);
router.post('/shipments/:id/transit', driverController.markInTransit);
router.post('/shipments/:id/out-for-delivery', driverController.markOutForDelivery);
router.post('/shipments/:id/delivery', driverController.markDelivered);
router.post('/shipments/:id/fail', driverController.markFailed);
router.post('/shipments/:id/proof', upload.single('proof'), driverController.uploadProof);

module.exports = router;