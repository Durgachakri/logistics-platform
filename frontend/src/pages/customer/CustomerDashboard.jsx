import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../services/api';
import './CustomerDashboard.css';

const ACTIVE = ['CREATED', 'ASSIGNED', 'PICKUP_CONFIRMED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'];

const formatStatus = (status) =>
  status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export default function CustomerDashboard() {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');

  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');

  useEffect(() => {
    async function fetchShipments() {
      try {
        const res = await apiRequest('/shipments');
        if (res.success) setShipments(res.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchShipments();
  }, []);

  const counts = {
    total: shipments.length,
    active: shipments.filter((s) => ACTIVE.includes(s.status)).length,
    delivered: shipments.filter((s) => s.status === 'DELIVERED').length,
    issues: shipments.filter((s) => s.status === 'DELIVERY_FAILED').length,
  };

  const visible = shipments.filter((s) => {
    if (filter === 'ACTIVE' && !ACTIVE.includes(s.status)) return false;
    if (filter === 'DELIVERED' && s.status !== 'DELIVERED') return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.shipment_number.toLowerCase().includes(q) ||
        s.pickup_address.toLowerCase().includes(q) ||
        s.delivery_address.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>My Shipments</h1>
          <p>Track packages and view delivery statuses in real time</p>
        </div>
        <Link to="/customer/create" className="btn-primary">
          + Book New Shipment
        </Link>
      </div>

      {error && <div className="error-alert">{error}</div>}

      <div className="kpi-row">
        <div className="kpi">
          <span>Total</span>
          <strong>{counts.total}</strong>
        </div>
        <div className="kpi kpi-active">
          <span>In progress</span>
          <strong>{counts.active}</strong>
        </div>
        <div className="kpi kpi-done">
          <span>Delivered</span>
          <strong>{counts.delivered}</strong>
        </div>
        <div className="kpi kpi-issue">
          <span>Failed</span>
          <strong>{counts.issues}</strong>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="search-input"
          type="search"
          placeholder="Search by shipment number or address"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filter-tabs">
          {['ALL', 'ACTIVE', 'DELIVERED'].map((f) => (
            <button
              key={f}
              className={filter === f ? 'tab active' : 'tab'}
              onClick={() => setFilter(f)}
            >
              {f === 'ALL' ? 'All' : f === 'ACTIVE' ? 'In progress' : 'Delivered'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading your shipments...</div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          {shipments.length === 0
            ? 'No shipments yet. Book your first delivery above.'
            : 'No shipments match your search.'}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Shipment #</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Pickup Location</th>
                <th>Delivery Address</th>
                <th>Weight</th>
                <th>Scheduled Pickup</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.shipment_id}>
                  <td><strong>{s.shipment_number}</strong></td>
                  <td>
                    <span className={`status-pill status-${s.status}`}>{formatStatus(s.status)}</span>
                  </td>
                  <td>
                    <span className="status-pill" style={{ backgroundColor: '#f1f5f9', color: '#334155', marginRight: '0.35rem' }}>
                      {s.payment_method || 'COD'}
                    </span>
                    <span
                      className="status-pill"
                      style={{
                        backgroundColor: s.payment_status === 'PAID' ? '#dcfce7' : '#fef3c7',
                        color: s.payment_status === 'PAID' ? '#166534' : '#92400e'
                      }}
                    >
                      {s.payment_status || 'PENDING'}
                    </span>
                  </td>
                  <td className="route-cell">
                    <span>{s.pickup_address}</span>
                    <span className="route-arrow">↓</span>
                    <span>{s.delivery_address}</span>
                  </td>
                  <td>{s.package_weight_kg} kg</td>
                  <td>{s.scheduled_pickup_date ? s.scheduled_pickup_date.replace('T', ' ').slice(0, 16) : 'N/A'}</td>
                  <td>
                    <Link to={`/customer/shipments/${s.shipment_id}`} className="btn-secondary">
                      Track
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
