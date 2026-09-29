# DropyHub Logistics

> A full-stack logistics and fleet management platform for shipment booking, dispatch operations, delivery tracking, proof of delivery, and operational reporting.

[![Live Frontend](https://dropyhub-logistics.vercel.app)
[![Backend API](https://logistics-platform-tr98.vercel.app)
[![GitHub](https://github.com/Durgachakri/logistics-platform)

---

## Overview

**DropyHub Logistics** is a full-stack logistics and fleet management application designed to manage the complete shipment lifecycle — from customer booking and driver assignment to delivery, proof of delivery, failed deliveries, rescheduling, and operational reporting.

The platform provides separate workflows for:

- Customers
- Drivers
- Dispatchers
- Administrators

The system uses a React frontend, Node.js/Express REST API, MySQL database, JWT authentication, role-based authorization, transactional assignment logic, and delivery event tracking.

---

### Run the app

# Terminal 1 — backend (http://localhost:5000)
cd backend
npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd frontend
npm run dev

Open `http://localhost:5173` and sign in with one of the seeded accounts above.

---


## Live Application

### Frontend

**https://dropyhub-logistics.vercel.app**

### GitHub Repository

**https://github.com/Durgachakri/logistics-platform**

---


## Key Features

### Customer

- Customer registration and login
- JWT-based authentication
- Customer profile management
- Create shipments
- View personal shipments
- View shipment details
- Cancel eligible shipments
- Track shipment status

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
- Driver assignment verification

### Dispatcher / Admin

- View customers
- View drivers
- View vehicles
- View all shipments
- Assign drivers and vehicles
- Reassign failed shipments
- Reschedule deliveries
- View operational reports
- View audit logs

### Security

- JWT authentication
- bcrypt password hashing
- Role-based access control
- Protected API routes
- Driver-to-shipment authorization checks
- Controlled file uploads
- Audit logging

### Reliability

- Transaction-safe driver assignment
- Row-level locking with `SELECT ... FOR UPDATE`
- Driver availability validation
- Vehicle availability validation
- Idempotent delivery events
- Shipment state-machine validation
- Transaction rollback on failures

---

# Shipment Lifecycle

The application uses a controlled shipment state machine.

```text
CREATED
   │
   ▼
ASSIGNED
   │
   ▼
PICKUP_CONFIRMED
   │
   ▼
IN_TRANSIT
   │
   ▼
OUT_FOR_DELIVERY
   │
   ├──────────────► DELIVERED
   │
   ▼
DELIVERY_FAILED
   │
   ▼
RESCHEDULED
   │
   ▼
ASSIGNED
