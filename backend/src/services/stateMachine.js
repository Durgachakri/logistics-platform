// State transitions mapping with authorized roles
const ALLOWED_TRANSITIONS = {
  CREATED: {
    ASSIGNED: ['ADMIN', 'DISPATCHER'],
    CANCELLED: ['CUSTOMER', 'ADMIN', 'DISPATCHER']
  },
  ASSIGNED: {
    PICKUP_CONFIRMED: ['DRIVER'],
    CANCELLED: ['CUSTOMER', 'ADMIN', 'DISPATCHER']
  },
  PICKUP_CONFIRMED: {
    IN_TRANSIT: ['DRIVER']
  },
  IN_TRANSIT: {
    OUT_FOR_DELIVERY: ['DRIVER']
  },
  OUT_FOR_DELIVERY: {
    DELIVERED: ['DRIVER'],
    DELIVERY_FAILED: ['DRIVER']
  },
  DELIVERY_FAILED: {
    RESCHEDULED: ['ADMIN', 'DISPATCHER']
  },
  RESCHEDULED: {
    ASSIGNED: ['ADMIN', 'DISPATCHER'],
    OUT_FOR_DELIVERY: ['ADMIN', 'DISPATCHER']
  },
  DELIVERED: {},
  CANCELLED: {}
};

/**
 * Validates whether moving from currentStatus to nextStatus is allowed for userRole.
 * Throws a formatted error with statusCode if invalid.
 */
function validateTransition(currentStatus, nextStatus, userRole) {
  if (currentStatus === nextStatus) {
    return true; // No-op / Idempotent state assertion
  }

  const allowedNext = ALLOWED_TRANSITIONS[currentStatus];

  if (!allowedNext || !allowedNext[nextStatus]) {
    const error = new Error(`Illegal state transition from ${currentStatus} to ${nextStatus}`);
    error.statusCode = 400;
    throw error;
  }

  const allowedRoles = allowedNext[nextStatus];
  if (!allowedRoles.includes(userRole)) {
    const error = new Error(`User with role '${userRole}' is not authorized to transition status from ${currentStatus} to ${nextStatus}`);
    error.statusCode = 403;
    throw error;
  }

  return true;
}

/**
 * Checks if a shipment is in a state where a customer can cancel it.
 */
function canCancelShipment(status) {
  return status === 'CREATED' || status === 'ASSIGNED';
}

module.exports = {
  ALLOWED_TRANSITIONS,
  validateTransition,
  canCancelShipment
};