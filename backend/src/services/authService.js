const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { generateId } = require('../utils/idGenerator');

async function loginUser(email, password) {
  const [users] = await db.query(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );

  if (users.length === 0) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const user = users[0];

  if (user.status !== 'ACTIVE') {
    const error = new Error('Your account is inactive');
    error.statusCode = 403;
    throw error;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // Token payload contains primary user context
  const token = jwt.sign(
    { user_id: user.user_id, role: user.role, email: user.email },
    process.env.JWT_SECRET || 'super_secret_logistics_jwt_key_2026',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  let profileDetails = null;

  if (user.role === 'CUSTOMER') {
    const [customers] = await db.query(
      'SELECT customer_id, customer_number, phone, address FROM customers WHERE user_id = ?',
      [user.user_id]
    );
    profileDetails = customers[0] || null;
  } else if (user.role === 'DRIVER') {
    const [drivers] = await db.query(
      'SELECT driver_id, employee_number, license_number, current_status FROM drivers WHERE user_id = ?',
      [user.user_id]
    );
    profileDetails = drivers[0] || null;
  }

  return {
    token,
    user: {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      profile: profileDetails
    }
  };
}

async function registerCustomer({ name, email, password, phone, address }) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [existing] = await connection.query(
      'SELECT user_id FROM users WHERE email = ?',
      [email]
    );
    if (existing.length > 0) {
      const error = new Error('An account with this email already exists');
      error.statusCode = 409;
      throw error;
    }

    const userId = generateId('USR');
    const customerId = generateId('CUS');
    const customerNumber = `CUST-${Math.floor(1000 + Math.random() * 9000)}`;
    const passwordHash = await bcrypt.hash(password, 10);

    await connection.query(
      `INSERT INTO users (user_id, name, email, password_hash, role, status)
       VALUES (?, ?, ?, ?, 'CUSTOMER', 'ACTIVE')`,
      [userId, name, email, passwordHash]
    );

    await connection.query(
      `INSERT INTO customers (customer_id, user_id, customer_number, name, phone, email, address, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [customerId, userId, customerNumber, name, phone, email, address]
    );

    await connection.commit();
    return { userId, customerId, customerNumber, name, email };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  loginUser,
  registerCustomer
};