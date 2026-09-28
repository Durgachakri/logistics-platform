const jwt = require('jsonwebtoken');
const db = require('../config/database');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token missing'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_logistics_jwt_key_2026');

    // Retrieve active user from database to ensure account is valid
    const [users] = await db.query(
      'SELECT user_id, name, email, role, status FROM users WHERE user_id = ?',
      [decoded.user_id]
    );

    if (users.length === 0 || users[0].status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        message: 'User account is inactive or not found'
      });
    }

    const user = users[0];
    req.user = user;

    // Attach domain entity IDs for ownership checks
    if (user.role === 'CUSTOMER') {
      const [customers] = await db.query(
        'SELECT customer_id, customer_number, status FROM customers WHERE user_id = ?',
        [user.user_id]
      );
      if (customers.length > 0) {
        req.customer = customers[0];
      }
    } else if (user.role === 'DRIVER') {
      const [drivers] = await db.query(
        'SELECT driver_id, employee_number, status, current_status FROM drivers WHERE user_id = ?',
        [user.user_id]
      );
      if (drivers.length > 0) {
        req.driver = drivers[0];
      }
    }

    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired access token'
    });
  }
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: requires one of the following roles: ${allowedRoles.join(', ')}`
      });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRoles
};