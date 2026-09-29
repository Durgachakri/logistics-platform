const fs = require('fs');
const path = require('path');

const backendModules = path.join(__dirname, '../backend/node_modules');
const bcrypt = require(path.join(backendModules, 'bcryptjs'));
const mysql = require(path.join(backendModules, 'mysql2/promise'));
const dotenv = require(path.join(backendModules, 'dotenv'));

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

function formatDate(isoString) {
  if (!isoString) return null;
  return new Date(isoString).toISOString().slice(0, 19).replace('T', ' ');
}

async function runSeed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'logistics',
    port: Number(process.env.DB_PORT) || 3306
  });

  console.log(`Connected to MySQL database: ${process.env.DB_NAME || 'logistics'}`);

  const mockDataPath = path.join(__dirname, '../mock_data.json');
  const rawData = fs.readFileSync(mockDataPath, 'utf8');
  const data = JSON.parse(rawData);



  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

  console.log('Seeding users...');
  for (const u of data.users) {
    await connection.query(
      `INSERT INTO users (user_id, name, email, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         role = VALUES(role),
         status = VALUES(status)`,
      [u.user_id, u.name, u.email, defaultPasswordHash, u.role, u.status]
    );
  }

  console.log('Seeding customers...');
  for (const c of data.customers) {
    await connection.query(
      `INSERT INTO customers (customer_id, user_id, customer_number, name, phone, email, address, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         phone = VALUES(phone),
         address = VALUES(address),
         status = VALUES(status)`,
      [
        c.customer_id,
        c.user_id,
        c.customer_number,
        c.name,
        c.phone,
        c.email,
        c.address,
        c.status,
        formatDate(c.created_at)
      ]
    );
  }

  console.log('Seeding drivers...');
  for (const d of data.drivers) {
    await connection.query(
      `INSERT INTO drivers (driver_id, user_id, employee_number, name, phone, license_number, license_expiry, status, current_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         phone = VALUES(phone),
         current_status = VALUES(current_status),
         status = VALUES(status)`,
      [
        d.driver_id,
        d.user_id,
        d.employee_number,
        d.name,
        d.phone,
        d.license_number,
        formatDate(d.license_expiry),
        d.status,
        d.current_status
      ]
    );
  }

  console.log('Seeding vehicles...');
  for (const v of data.vehicles) {
    await connection.query(
      `INSERT INTO vehicles (vehicle_id, registration_number, vehicle_type, capacity_kg, status, current_status, driver_id, last_service_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         current_status = VALUES(current_status),
         driver_id = VALUES(driver_id),
         status = VALUES(status)`,
      [
        v.vehicle_id,
        v.registration_number,
        v.vehicle_type,
        v.capacity_kg,
        v.status,
        v.current_status,
        v.driver_id,
        formatDate(v.last_service_date)
      ]
    );
  }

  console.log('Seeding shipments...');
  for (const s of data.shipments) {
    await connection.query(
      `INSERT INTO shipments (shipment_id, shipment_number, customer_id, pickup_address, delivery_address, package_description, package_weight_kg, priority, scheduled_pickup_date, scheduled_delivery_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         updated_at = VALUES(updated_at)`,
      [
        s.shipment_id,
        s.shipment_number,
        s.customer_id,
        s.pickup_address,
        s.delivery_address,
        s.package_description,
        s.package_weight_kg,
        s.priority,
        formatDate(s.scheduled_pickup_date),
        formatDate(s.scheduled_delivery_date),
        s.status,
        formatDate(s.created_at),
        formatDate(s.updated_at)
      ]
    );
  }

  console.log('Seeding driver assignments...');
  for (const a of data.driver_assignments) {
    await connection.query(
      `INSERT INTO driver_assignments (assignment_id, shipment_id, driver_id, vehicle_id, assigned_by, assigned_at, started_at, ended_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         ended_at = VALUES(ended_at)`,
      [
        a.assignment_id,
        a.shipment_id,
        a.driver_id,
        a.vehicle_id,
        a.assigned_by,
        formatDate(a.assigned_at),
        formatDate(a.started_at),
        formatDate(a.ended_at),
        a.status
      ]
    );
  }

  console.log('Seeding delivery events...');
  for (const e of data.delivery_events) {
    await connection.query(
      `INSERT INTO delivery_events (event_id, shipment_id, driver_id, event_type, location, notes, created_at, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         notes = VALUES(notes)`,
      [
        e.event_id,
        e.shipment_id,
        e.driver_id,
        e.event_type,
        e.location,
        e.notes,
        formatDate(e.created_at),
        e.idempotency_key
      ]
    );
  }

  console.log('Seeding proof of delivery...');
  for (const p of data.proof_of_delivery) {
    await connection.query(
      `INSERT INTO proof_of_delivery (proof_id, shipment_id, driver_id, file_name, file_url, file_type, uploaded_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status)`,
      [
        p.proof_id,
        p.shipment_id,
        p.driver_id,
        p.file_name,
        p.file_url,
        p.file_type,
        formatDate(p.uploaded_at),
        p.status
      ]
    );
  }

  console.log('Seeding audit logs...');
  for (const l of data.audit_logs) {
    await connection.query(
      `INSERT INTO audit_logs (audit_id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         action = VALUES(action)`,
      [
        l.audit_id,
        l.user_id,
        l.action,
        l.entity_type,
        l.entity_id,
        JSON.stringify(l.metadata),
        formatDate(l.created_at)
      ]
    );
  }

  console.log('Database successfully seeded with mock_data.json!');
  await connection.end();
}

runSeed().catch((err) => {
  console.error('Seed execution failed:', err);
  process.exit(1);
});