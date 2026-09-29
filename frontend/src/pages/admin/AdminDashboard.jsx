import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../services/api';
import './AdminDashboard.css';


function Breakdown({ rows }) {
  const max = Math.max(...rows.map((r) => Number(r.count)), 1);
  return rows.map((r) => (
    <div key={r.current_status} className="breakdown-row">
      <span>{r.current_status.replace(/_/g, ' ')}</span>
      <div className="breakdown-bar">
        <span style={{ width: `${(Number(r.count) / max) * 100}%` }} />
      </div>
      <b>{r.count}</b>
    </div>
  ));
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReports() {
      try {
        const res = await apiRequest('/admin/reports');
        if (res.success) {
          setMetrics(res.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadReports();
  }, []);

  if (loading) return <div className="page-container">Loading operational dashboard...</div>;
  if (!metrics) return null;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Logistics Dispatch Center</h1>
        <Link to="/admin/dispatch" className="btn-primary">Go to Dispatch Board</Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h4>Total Shipments</h4>
          <span className="stat-number">{metrics.totals.total_shipments}</span>
        </div>
        <div className="stat-card stat-success">
          <h4>Delivered</h4>
          <span className="stat-number">{metrics.totals.total_delivered}</span>
        </div>
        <div className="stat-card stat-warning">
          <h4>In Progress</h4>
          <span className="stat-number">{metrics.totals.total_active}</span>
        </div>
        <div className="stat-card stat-danger">
          <h4>Failed Deliveries</h4>
          <span className="stat-number">{metrics.totals.total_failed}</span>
        </div>
      </div>

      <div className="grid-2col" style={{ marginTop: '2rem' }}>
        <div className="card">
          <h3>Fleet Utilization</h3>
          <Breakdown rows={metrics.vehicle_status_breakdown} />
        </div>
        <div className="card">
          <h3>Driver Availability</h3>
          <Breakdown rows={metrics.driver_status_breakdown} />
        </div>
      </div>
    </div>
  );
}