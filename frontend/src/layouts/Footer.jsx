import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';


export default function Footer() {
  return (
    <footer className="footer" id="contact">
      <div className="footer-inner">
        <div className="footer-brand">
          <>
          <h3><span className="brand-accent">Shipora</span>
          <span className="brand-text"> Logistics</span></h3>
          </>
          <p>Reliable pickup, transit and last-mile delivery, tracked from the first scan to the signature.</p>
        </div>

        <div className="footer-col">
          <h4>Company</h4>
          <a href="/#services">Services</a>
          <a href="/#how-it-works">How it works</a>
          <Link to="/register">Create account</Link>
        </div>

        <div className="footer-col">
          <h4>Support</h4>
          <a href="mailto:support@shipora.com">support@shipora.com</a>
          <a href="tel:+918328524244">+91 8328524244</a>
          <span>Mon to Sat, 8am to 8pm</span>
        </div>
      </div>

      <div className="footer-bottom">
        &copy; {new Date().getFullYear()} Shipora Logistics. All rights reserved.
      </div>
    </footer>
  );
}
