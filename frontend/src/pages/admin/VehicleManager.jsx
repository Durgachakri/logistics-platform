import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import './VehicleManager.css';

export default function VehicleManager() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);

  const [formData, setFormData] = useState({
    registration_number: '',
    vehicle_type: 'VAN',
    capacity_kg: '',
    last_service_date: ''
  });

  const loadVehicles = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest('/admin/vehicles');
      if (res.success) setVehicles(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const openAddModal = () => {
    setEditingVehicle(null);
    setFormData({
      registration_number: '',
      vehicle_type: 'VAN',
      capacity_kg: '',
      last_service_date: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      registration_number: vehicle.registration_number || '',
      vehicle_type: vehicle.vehicle_type || 'VAN',
      capacity_kg: vehicle.capacity_kg || '',
      last_service_date: vehicle.last_service_date ? vehicle.last_service_date.split('T')[0] : ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingVehicle(null);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingVehicle) {
        await apiRequest(`/admin/vehicles/${editingVehicle.vehicle_id}`, {
          method: 'PUT',
          body: {
            vehicle_type: formData.vehicle_type,
            capacity_kg: formData.capacity_kg,
            last_service_date: formData.last_service_date || null
          }
        });
        setSuccess('Vehicle updated successfully');
      } else {
        await apiRequest('/admin/vehicles', {
          method: 'POST',
          body: formData
        });
        setSuccess('Vehicle added to fleet successfully');
      }
      closeModal();
      loadVehicles();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleStatus = async (vehicle) => {
    const targetStatus = vehicle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (!window.confirm(`Are you sure you want to mark vehicle ${vehicle.registration_number} as ${targetStatus}?`)) return;

    setError('');
    setSuccess('');
    try {
      await apiRequest(`/admin/vehicles/${vehicle.vehicle_id}/status`, {
        method: 'PATCH',
        body: { status: targetStatus }
      });
      setSuccess(`Vehicle ${vehicle.registration_number} is now ${targetStatus}`);
      loadVehicles();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleMaintenance = async (vehicle) => {
    const setMaint = vehicle.current_status !== 'MAINTENANCE';
    if (!window.confirm(`Set maintenance status for ${vehicle.registration_number} to ${setMaint ? 'MAINTENANCE' : 'AVAILABLE'}?`)) return;

    setError('');
    setSuccess('');
    try {
      await apiRequest(`/admin/vehicles/${vehicle.vehicle_id}/maintenance`, {
        method: 'PATCH',
        body: { maintenance: setMaint }
      });
      setSuccess(`Vehicle status updated successfully`);
      loadVehicles();
    } catch (err) {
      setError(err.message);
    }
  };

  const filtered = vehicles.filter(v =>
    v.registration_number?.toLowerCase().includes(search.toLowerCase()) ||
    v.vehicle_type?.toLowerCase().includes(search.toLowerCase()) ||
    v.assigned_driver_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container vehicle-manager-container">
      <div className="page-header">
        <div>
          <h1>Vehicle Management</h1>
          <p>Manage fleet units, payload capacities, duty states, and service logs</p>
        </div>
        <button className="btn-primary" onClick={openAddModal}>+ Add Vehicle</button>
      </div>

      {error && <div className="error-alert">{error}</div>}
      {success && <div className="success-alert">{success}</div>}

      <div className="card manager-card">
        <div className="filter-bar">
          <input
            type="text"
            placeholder="Search by license plate, vehicle type, driver..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="loading-state">Loading vehicle fleet...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">No vehicles match your criteria.</div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Plate / Registration</th>
                  <th>Type</th>
                  <th>Capacity</th>
                  <th>Status</th>
                  <th>Current State</th>
                  <th>Assigned Driver</th>
                  <th>Last Serviced</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(vehicle => (
                  <tr key={vehicle.vehicle_id}>
                    <td><strong>{vehicle.registration_number}</strong></td>
                    <td>{vehicle.vehicle_type}</td>
                    <td>{vehicle.capacity_kg} kg</td>
                    <td>
                      <span className={`status-pill status-${vehicle.status}`}>{vehicle.status}</span>
                    </td>
                    <td>
                      <span className={`status-pill status-${vehicle.current_status}`}>{vehicle.current_status}</span>
                    </td>
                    <td>{vehicle.assigned_driver_name || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}</td>
                    <td>{vehicle.last_service_date ? vehicle.last_service_date.split('T')[0] : 'N/A'}</td>
                    <td className="action-buttons">
                      <button className="btn-secondary" onClick={() => openEditModal(vehicle)}>Edit</button>
                      {vehicle.status === 'ACTIVE' && (
                        vehicle.current_status === 'MAINTENANCE' ? (
                          <button className="btn-success" onClick={() => handleToggleMaintenance(vehicle)}>Clear Maint</button>
                        ) : (
                          <button className="btn-warning" onClick={() => handleToggleMaintenance(vehicle)} disabled={vehicle.current_status !== 'AVAILABLE'}>Maint</button>
                        )
                      )}
                      {vehicle.status === 'ACTIVE' ? (
                        <button className="btn-danger" onClick={() => handleToggleStatus(vehicle)}>Deactivate</button>
                      ) : (
                        <button className="btn-success" onClick={() => handleToggleStatus(vehicle)}>Activate</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingVehicle ? 'Edit Vehicle Specifications' : 'Add Vehicle to Fleet'}</h3>
            <form onSubmit={handleSubmit} className="standard-form modal-form">
              <div className="form-group">
                <label>Plate / Registration Number *</label>
                <input required disabled={Boolean(editingVehicle)} name="registration_number" value={formData.registration_number} onChange={handleChange} placeholder="e.g. ABC-1234" />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Vehicle Type *</label>
                  <select name="vehicle_type" value={formData.vehicle_type} onChange={handleChange}>
                    <option value="VAN">Van</option>
                    <option value="TRUCK">Truck</option>
                    <option value="MOTORCYCLE">Motorcycle</option>
                    <option value="ELECTRIC_VAN">Electric Van</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Max Payload (kg) *</label>
                  <input required type="number" step="0.1" name="capacity_kg" value={formData.capacity_kg} onChange={handleChange} placeholder="500.0" />
                </div>
              </div>

              <div className="form-group">
                <label>Last Serviced Date</label>
                <input type="date" name="last_service_date" value={formData.last_service_date} onChange={handleChange} />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary">{editingVehicle ? 'Save Changes' : 'Create Vehicle'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}