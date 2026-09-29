const db = require('../config/database');
const { generateId } = require('../utils/idGenerator');


async function logAudit(connectionOrPool, { userId, action, entityType, entityId, metadata }) {
  const auditId = generateId('AUD');
  await connectionOrPool.query(
    `INSERT INTO audit_logs (audit_id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [
      auditId,
      userId,
      action,
      entityType,
      entityId,
      metadata ? JSON.stringify(metadata) : null
    ]
  );
  return auditId;
}

async function getOperationalMetrics() {
  // 1. Shipment Status Distribution
  const [statusCounts] = await db.query(`
    SELECT status, COUNT(*) AS count
    FROM shipments
    GROUP BY status
  `);

  // 2. Driver Availability Breakdown
  const [driverStats] = await db.query(`
    SELECT current_status, COUNT(*) AS count
    FROM drivers
    GROUP BY current_status
  `);

  // 3. Vehicle Fleet Utilization
  const [vehicleStats] = await db.query(`
    SELECT current_status, COUNT(*) AS count
    FROM vehicles
    GROUP BY current_status
  `);

  // 4. Overall Totals
  const [[totals]] = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM shipments) AS total_shipments,
      (SELECT COUNT(*) FROM shipments WHERE status = 'DELIVERED') AS total_delivered,
      (SELECT COUNT(*) FROM shipments WHERE status = 'DELIVERY_FAILED') AS total_failed,
      (SELECT COUNT(*) FROM shipments WHERE status IN ('ASSIGNED', 'PICKUP_CONFIRMED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY')) AS total_active,
      (SELECT COUNT(*) FROM drivers WHERE status = 'ACTIVE') AS total_active_drivers,
      (SELECT COUNT(*) FROM vehicles WHERE status = 'ACTIVE') AS total_active_vehicles
  `);

  return {
    totals,
    shipment_status_breakdown: statusCounts,
    driver_status_breakdown: driverStats,
    vehicle_status_breakdown: vehicleStats
  };
}


async function getAuditTrail({ action, entityType, limit = 50 }) {
  let query = `
    SELECT a.*, u.name AS user_name, u.email AS user_email, u.role AS user_role
    FROM audit_logs a
    JOIN users u ON a.user_id = u.user_id
  `;
  const params = [];
  const conditions = [];

  if (action) {
    conditions.push('a.action = ?');
    params.push(action);
  }

  if (entityType) {
    conditions.push('a.entity_type = ?');
    params.push(entityType);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY a.created_at DESC LIMIT ?';
  params.push(Number(limit));

  const [logs] = await db.query(query, params);
  return logs;
}

module.exports = {
  logAudit,
  getOperationalMetrics,
  getAuditTrail
};