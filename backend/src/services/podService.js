const db = require('../config/database');
const { generateId } = require('../utils/idGenerator');
const { verifyDriverAssignment } = require('./deliveryService');

async function uploadProofOfDelivery({ shipmentId, driverId, userId, file }) {
  if (!file) {
    const error = new Error('No proof file uploaded');
    error.statusCode = 400;
    throw error;
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Lock shipment row
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

    // Must be in OUT_FOR_DELIVERY or DELIVERED to attach proof
    if (shipment.status !== 'OUT_FOR_DELIVERY' && shipment.status !== 'DELIVERED') {
      const error = new Error(`Cannot upload proof for shipment in status '${shipment.status}'. Must be OUT_FOR_DELIVERY or DELIVERED.`);
      error.statusCode = 400;
      throw error;
    }

    // 2. Verify caller is the assigned driver
    await verifyDriverAssignment(connection, shipmentId, driverId);

    // 3. Create proof record
    const proofId = generateId('PRD');
    const fileUrl = `/uploads/${file.filename}`;

    await connection.query(
      `INSERT INTO proof_of_delivery (
        proof_id, shipment_id, driver_id, file_name, file_url, file_type, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'VERIFIED')`,
      [proofId, shipmentId, driverId, file.originalname, fileUrl, file.mimetype]
    );

    // 4. Audit log
    const auditId = generateId('AUD');
    await connection.query(
      `INSERT INTO audit_logs (audit_id, user_id, action, entity_type, entity_id, metadata)
       VALUES (?, ?, 'PROOF_UPLOADED', 'PROOF_OF_DELIVERY', ?, ?)`,
      [auditId, userId, proofId, JSON.stringify({ shipment_id: shipmentId, file_name: file.originalname })]
    );

    await connection.commit();

    return {
      proof_id: proofId,
      shipment_id: shipmentId,
      file_url: fileUrl,
      file_name: file.originalname,
      status: 'VERIFIED'
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  uploadProofOfDelivery
};