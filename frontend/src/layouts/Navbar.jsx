import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const linksByRole = {
  CUSTOMER: [
    { to: '/customer', label: 'My Shipments', end: true },
    { to: '/customer/create', label: 'Book Shipment' },
    { to: '/customer/profile', label: 'Profile' },
  ],
  DRIVER: [{ to: '/driver', label: 'Deliveries' }],
  ADMIN: [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/dispatch', label: 'Dispatch Board' },
    { to: '/admin/reports', label: 'Reports & Audit' },
  ],
};
linksByRole.DISPATCHER = linksByRole.ADMIN;

const publicLinks = [
  { to: '/#services', label: 'Services' },
  { to: '/#how-it-works', label: 'How it works' },
  { to: '/#contact', label: 'Contact' },
];

function Logo() {
  return (
    <Link to="/" className="brand-logo">
      <span className="brand-mark">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" rx="1" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      </span>
      Fleet<span className="brand-accent">Flow</span>
    </Link>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const links = user ? linksByRole[user.role] || [] : publicLinks;
  const closeMenu = () => setOpen(false);

  return (
    <header className="navbar">
      <div className="nav-container">
        <Logo />

        <button className="nav-toggle" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          <span />
          <span />
          <span />
        </button>

        <div className={`nav-collapse ${open ? 'open' : ''}`}>
          <nav className="nav-links">
            {links.map((l) =>
              user ? (
                <NavLink key={l.to} to={l.to} end={l.end} onClick={closeMenu}>
                  {l.label}
                </NavLink>
              ) : (
                <a key={l.to} href={l.to} onClick={closeMenu}>
                  {l.label}
                </a>
              )
            )}
          </nav>

          <div className="nav-user-meta">
            {user ? (
              <>
                <div className="user-avatar">{user.name?.charAt(0).toUpperCase()}</div>
                <div className="user-info">
                  <span className="user-name">{user.name}</span>
                  <span className="user-badge">{user.role}</span>
                </div>
                <button onClick={logout} className="btn-logout">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-signin" onClick={closeMenu}>Sign in</Link>
                <Link to="/register" className="btn-primary" onClick={closeMenu}>Get started</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
