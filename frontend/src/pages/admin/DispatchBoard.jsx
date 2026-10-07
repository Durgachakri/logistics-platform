import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import './DispatchBoard.css';

export default function DispatchBoard() {
  const [shipments, setShipments] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedShipment, setSelectedShipment] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const loadAll = async () => {
    try {
      const [sRes, dRes, vRes] = await Promise.all([
        apiRequest('/admin/shipments'),
        apiRequest('/admin/drivers?available_only=true'),
        apiRequest('/admin/vehicles?available_only=true')
      ]);

      if (sRes.success) setShipments(sRes.data);
      if (dRes.success) setDrivers(dRes.data);
      if (vRes.success) setVehicles(vRes.data);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!selectedShipment || !selectedDriver || !selectedVehicle) {
      setFeedback({ type: 'error', message: 'Please select a shipment, driver, and vehicle.' });
      return;
    }

    setLoading(true);
    setFeedback({ type: '', message: '' });

    try {
      const targetShipment = shipments.find((s) => s.shipment_id === selectedShipment);
      const isReassign = targetShipment && (targetShipment.status === 'DELIVERY_FAILED' || targetShipment.status === 'RESCHEDULED');

      const url = isReassign
        ? `/admin/assignments/${selectedShipment}/reassign`
        : `/admin/assignments`;

      const res = await apiRequest(url, {
        method: 'POST',
        body: {
          shipment_id: selectedShipment,
          driver_id: selectedDriver,
          vehicle_id: selectedVehicle
        }
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setSelectedShipment('');
        setSelectedDriver('');
        setSelectedVehicle('');
        loadAll();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const assignableShipments = shipments.filter(
    (s) => s.status === 'CREATED' || s.status === 'DELIVERY_FAILED' || s.status === 'RESCHEDULED'
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Dispatch & Assignment Board</h1>
          <p>Allocate drivers and vehicles with concurrency-safe database locking</p>
        </div>
      </div>

      {feedback.message && (
        <div className={feedback.type === 'error' ? 'error-alert' : 'success-alert'}>
          {feedback.message}
        </div>
      )}

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3>Create or Reassign Assignment</h3>
        <form onSubmit={handleAssign} className="standard-form">
          <div className="form-group">
            <label>Select Unassigned / Failed Shipment</label>
            <select
              value={selectedShipment}
              onChange={(e) => setSelectedShipment(e.target.value)}
              required
            >
              <option value="">-- Choose Shipment --</option>
              {assignableShipments.map((s) => (
                <option key={s.shipment_id} value={s.shipment_id}>
                  {s.shipment_number} ({s.status}) - {s.customer_name} ({s.package_weight_kg} kg)
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Select Available Driver</label>
              <select
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value)}
                required
              >
                <option value="">-- Choose Driver --</option>
                {drivers.map((d) => (
                  <option key={d.driver_id} value={d.driver_id}>
                    {d.name} ({d.employee_number})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Select Available Vehicle</label>
              <select
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
                required
              >
                <option value="">-- Choose Vehicle --</option>
                {vehicles.map((v) => (
                  <option key={v.vehicle_id} value={v.vehicle_id}>
                    {v.registration_number} - {v.vehicle_type} ({v.capacity_kg} kg)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Executing Row Locks & Assigning...' : 'Dispatch Assignment'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Live Operational Shipments</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Shipment #</th>
              <th>Status</th>
              <th>Customer</th>
              <th>Driver</th>
              <th>Vehicle</th>
              <th>Pickup</th>
              <th>Destination</th>
            </tr>
          </thead>
          <tbody>
            {shipments.map((s) => (
              <tr key={s.shipment_id}>
                <td><strong>{s.shipment_number}</strong></td>
                <td><span className={`status-pill status-${s.status}`}>{s.status}</span></td>
                <td>{s.customer_name}</td>
                <td>{s.driver_name || 'Unassigned'}</td>
                <td>{s.registration_number || 'Unassigned'}</td>
                <td>{s.pickup_address}</td>
                <td>{s.delivery_address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}