import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Home.css';

import { FiPackage, FiTruck, FiZap, FiBriefcase } from 'react-icons/fi';

const services = [
  { icon: FiPackage, title: 'Parcel Delivery', text: 'Door to door for packages of any size, with pickup windows you choose.' },
  { icon: FiTruck, title: 'Road Freight', text: 'Full and partial loads moved by our own fleet and vetted carriers.' },
  { icon: FiZap, title: 'Express & Urgent', text: "Same-day and priority handling when the deadline can't move." },
  { icon: FiBriefcase, title: 'Business Logistics', text: 'Recurring routes, bulk booking and reports for growing teams.' },
];

const steps = [
  { title: 'Book online', text: 'Enter pickup, drop-off and package details. It takes about two minutes.' },
  { title: 'We assign a driver', text: 'Our dispatchers match your shipment to the nearest available vehicle.' },
  { title: 'Track every stage', text: 'Follow it from pickup to out for delivery with a live status timeline.' },
  { title: 'Proof of delivery', text: 'Get a photo or document confirming the handover, saved to your account.' },
];

const stats = [
  { value: '48K+', label: 'Shipments delivered' },
  { value: '99.2%', label: 'On-time rate' },
  { value: '320', label: 'Vehicles on the road' },
  { value: '24/7', label: 'Dispatch support' },
];

export default function Home() {
  const [trackingNo, setTrackingNo] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();


  const handleTrack = (e) => {
    e.preventDefault();
    const q = trackingNo.trim();
    if (user?.role === 'CUSTOMER') {
      navigate(q ? `/customer?q=${encodeURIComponent(q)}` : '/customer');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="home">
      {/* Hero */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="hero-tag">Logistics made simple</span>
            <h1>Move it fast.<br />Track it all the way.</h1>
            <p>
              Book pickups, follow every shipment in real time and get proof of delivery,
              all from one place.
            </p>
            <div className="hero-cta">
              <Link to="/register" className="btn-primary hero-btn">Ship with us</Link>
              <Link to="/login" className="hero-link">Sign in →</Link>
            </div>
          </div>

          <form className="track-card" onSubmit={handleTrack}>
            <h3>Track your shipment</h3>
            <p>Enter your shipment number, e.g. SHP-001</p>
            <div className="track-row">
              <input
                value={trackingNo}
                onChange={(e) => setTrackingNo(e.target.value)}
                placeholder="Shipment number"
                aria-label="Shipment number"
              />
              <button type="submit" className="btn-primary">Track</button>
            </div>
            <div className="track-links">
              <Link to="/customer/create">Book a shipment</Link>
              <Link to="/login">Manage my account</Link>
            </div>
          </form>
        </div>
      </section>

      {/* Stats strip */}
      <section className="stats-strip">
        {stats.map((s) => (
          <div key={s.label} className="strip-item">
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </section>

      {/* Services */}
      <section className="section" id="services">
        <div className="section-head">
          <h2>What we deliver</h2>
          <p>From a single parcel to a weekly freight run.</p>
        </div>
        <div className="service-grid">
          {services.map((s) => (
            <div key={s.title} className="service-card">
              <span className="service-icon"><s.icon /></span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="section section-alt" id="how-it-works">
        <div className="section-head">
          <h2>How it works</h2>
          <p>Four steps from booking to doorstep.</p>
        </div>
        <ol className="step-grid">
          {steps.map((s, i) => (
            <li key={s.title} className="step">
              <span className="step-num">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className="cta-band">
        <h2>Ready to send your first shipment?</h2>
        <p>Create a free account and book in minutes.</p>
        <Link to="/register" className="btn-primary hero-btn">Create account</Link>
      </section>
    </div>
  );
}
