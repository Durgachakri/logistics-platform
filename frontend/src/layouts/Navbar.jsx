import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header className="navbar">
      <div className="nav-container">
        <Link to="/" className="brand-logo">
          FleetFlow Logistics
        </Link>

        <nav className="nav-links">
          {user.role === 'CUSTOMER' && (
            <>
              <Link to="/customer">My Shipments</Link>
              <Link to="/customer/create">Book Shipment</Link>
              <Link to="/customer/profile">My Profile</Link>
            </>
          )}

          {user.role === 'DRIVER' && (
            <>
              <Link to="/driver">Assigned Deliveries</Link>
            </>
          )}

          {(user.role === 'ADMIN' || user.role === 'DISPATCHER') && (
            <>
              <Link to="/admin">Dashboard</Link>
              <Link to="/admin/dispatch">Dispatch Board</Link>
              <Link to="/admin/reports">Reports & Audit</Link>
            </>
          )}

          {user.role === 'ADMIN' && (
            <>
              <Link to="/admin/drivers">Drivers</Link>
              <Link to="/admin/vehicles">Vehicles</Link>
            </>
          )}
        </nav>

        <div className="nav-user-meta">
          <span className="user-badge">{user.role}</span>
          <span className="user-name">{user.name}</span>
          <button onClick={logout} className="btn-logout">Logout</button>
        </div>
      </div>
    </header>
  );
}