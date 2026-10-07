# DropyHub Logistics

> A full-stack logistics and fleet management platform for shipment booking, driver assignment, delivery tracking, proof of delivery, COD payment tracking, and operational management.

[![Live Application](https://img.shields.io/badge/Live%20Application-DropyHub-orange?style=for-the-badge)](https://dropyhub-logistics.vercel.app/)
[![Backend API](https://img.shields.io/badge/Backend%20API-Vercel-black?style=for-the-badge)](https://logistics-platform-tr98.vercel.app/)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github)](https://github.com/Durgachakri/logistics-platform)

---

## Overview

**DropyHub Logistics** is a full-stack logistics and fleet management application designed to manage the shipment lifecycle from customer booking and driver assignment to delivery, proof of delivery, failed deliveries, rescheduling, and COD payment tracking.

The platform provides separate workflows for:

- Customers
- Drivers
- Dispatchers
- Administrators

The application uses React, Node.js, Express.js, MySQL, JWT authentication, role-based authorization, transactional assignment logic, delivery events, and audit logging.

---

## Live Application

**Frontend:** https://dropyhub-logistics.vercel.app/

**Backend API:** https://logistics-platform-tr98.vercel.app/

**GitHub:** https://github.com/Durgachakri/logistics-platform

---

## Key Features

### Customer

- Customer registration and login
- JWT-based authentication
- Customer profile management
- Create shipments
- Enter pickup and delivery addresses
- Add package description and weight
- Select shipment priority
- Schedule pickup and delivery dates
- Cash on Delivery (COD)
- View personal shipments
- View shipment details
- Track shipment status
- View payment method and payment status
- Cancel eligible shipments

### Driver

- Driver authentication
- View assigned shipments
- View shipment details
- Confirm pickup
- Mark shipment as in transit
- Mark shipment as out for delivery
- Mark shipment as delivered
- Report delivery failures
- Upload proof of delivery
- Driver-to-shipment authorization

### Dispatcher

- View customers, drivers, vehicles, and shipments
- Assign drivers and vehicles
- Reassign failed deliveries
- Reschedule deliveries
- Monitor shipment status
- View payment information
- View operational reports
- View audit logs

### Admin

- Create and update drivers
- Activate and deactivate drivers
- Create and update vehicles
- Activate and deactivate vehicles
- Manage vehicle maintenance status
- Assign and reassign deliveries
- View shipments and payment information
- View operational reports
- View audit logs

---

## Cash on Delivery

The application currently supports **Cash on Delivery (COD)** as the shipment payment method.

### Payment Flow

```text
Shipment Created
      ↓
Payment Status: PENDING
      ↓
Shipment Delivered
      ↓
Payment Status: PAID
```

When a COD shipment is successfully delivered, the backend updates its payment status from `PENDING` to `PAID`.

---

## Authentication & Authorization

The application uses **JWT-based authentication** and **role-based access control**.

Supported roles:

```text
CUSTOMER
DRIVER
DISPATCHER
ADMIN
```

Protected API routes verify the authenticated user and required role before allowing access.

Drivers are additionally authorized against their active shipment assignments.

---

## Security

The application includes:

- JWT authentication
- Password hashing with bcrypt
- Role-based access control
- Protected API routes
- Driver-to-shipment authorization
- Backend input validation
- Duplicate record validation
- Shipment state validation
- CORS configuration
- Environment-based configuration
- Controlled file uploads
- Audit logging

---

## Reliability

The project includes:

- MySQL transactions
- Row-level locking with `SELECT ... FOR UPDATE`
- Driver availability validation
- Vehicle availability validation
- Idempotent delivery events
- Shipment state-machine validation
- Transaction rollback on failures

---

## Shipment Lifecycle

The application uses a controlled shipment state machine.

### Normal Delivery Flow

```text
CREATED
   ↓
ASSIGNED
   ↓
PICKUP_CONFIRMED
   ↓
IN_TRANSIT
   ↓
OUT_FOR_DELIVERY
   ↓
DELIVERED
```

### Failed Delivery and Rescheduling

If delivery fails, the shipment follows a recovery flow:

```text
OUT_FOR_DELIVERY
        ↓
DELIVERY_FAILED
        ↓
RESCHEDULED
        ↓
   ┌────┴────┐
   ↓         ↓
ASSIGNED   OUT_FOR_DELIVERY
   ↓         ↓
PICKUP_     DELIVERED
CONFIRMED
   ↓
IN_TRANSIT
   ↓
OUT_FOR_DELIVERY
   ↓
DELIVERED
```

After a failed delivery is marked as `DELIVERY_FAILED`, an Admin or Dispatcher can reschedule it. The rescheduled shipment can then be moved to `ASSIGNED` or directly to `OUT_FOR_DELIVERY`.

### Cancellation

Customers can cancel shipments while they are in:

```text
CREATED ──────► CANCELLED

ASSIGNED ─────► CANCELLED
```

Once a shipment reaches `DELIVERED` or `CANCELLED`, no further delivery status transitions are allowed.
