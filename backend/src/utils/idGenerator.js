const crypto = require('crypto');

function generateId(prefix) {
  const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${randomSuffix}`;
}

module.exports = {
  generateId
};