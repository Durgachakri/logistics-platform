const authService = require('../services/authService');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const data = await authService.loginUser(email, password);
    res.json({
      success: true,
      message: 'Login successful',
      data
    });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res) {
  res.json({
    success: true,
    user: {
      ...req.user,
      customer: req.customer || null,
      driver: req.driver || null
    }
  });
}

async function register(req, res, next) {
  try {
    const { name, email, password, phone, address } = req.body;
    if (!name || !email || !password || !phone || !address) {
      return res.status(400).json({
        success: false,
        message: 'All fields (name, email, password, phone, address) are required'
      });
    }

    const data = await authService.registerCustomer({ name, email, password, phone, address });
    res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      data
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  getMe,
  register
};