import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import './DriverManager.css';

export default function DriverManager() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    employee_number: '',
    license_number: '',
    license_expiry: ''
  });

  const loadDrivers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest('/admin/drivers');
      if (res.success) setDrivers(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
  }, []);

  const openAddModal = () => {
    setEditingDriver(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      phone: '',
      employee_number: '',
      license_number: '',
      license_expiry: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (driver) => {
    setEditingDriver(driver);
    setFormData({
      name: driver.name || '',
      email: driver.email || '',
      password: '',
      phone: driver.phone || '',
      employee_number: driver.employee_number || '',
      license_number: driver.license_number || '',
      license_expiry: driver.license_expiry ? driver.license_expiry.split('T')[0] : ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDriver(null);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingDriver) {
        await apiRequest(`/admin/drivers/${editingDriver.driver_id}`, {
          method: 'PUT',
          body: {
            name: formData.name,
            phone: formData.phone,
            license_number: formData.license_number,
            license_expiry: formData.license_expiry
          }
        });
        setSuccess('Driver updated successfully');
      } else {
        await apiRequest('/admin/drivers', {
          method: 'POST',
          body: formData
        });
        setSuccess('Driver and login account created successfully');
      }
      closeModal();
      loadDrivers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleStatus = async (driver) => {
    const targetStatus = driver.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (!window.confirm(`Are you sure you want to change status to ${targetStatus} for ${driver.name}?`)) return;

    setError('');
    setSuccess('');
    try {
      await apiRequest(`/admin/drivers/${driver.driver_id}/status`, {
        method: 'PATCH',
        body: { status: targetStatus }
      });
      setSuccess(`Driver ${driver.name} is now ${targetStatus}`);
      loadDrivers();
    } catch (err) {
      setError(err.message);
    }
  };

  const filtered = drivers.filter(d =>
    d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.employee_number?.toLowerCase().includes(search.toLowerCase()) ||
    d.license_number?.toLowerCase().includes(search.toLowerCase()) ||
    d.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container driver-manager-container">
      <div className="page-header">
        <div>
          <h1>Driver Management</h1>
          <p>Register, update, and manage delivery personnel credentials and status</p>
        </div>
        <button className="btn-primary" onClick={openAddModal}>+ Add Driver</button>
      </div>

      {error && <div className="error-alert">{error}</div>}
      {success && <div className="success-alert">{success}</div>}

      <div className="card manager-card">
        <div className="filter-bar">
          <input
            type="text"
            placeholder="Search by name, employee #, license, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="loading-state">Loading driver fleet...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">No drivers match your criteria.</div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee #</th>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>License #</th>
                  <th>License Expiry</th>
                  <th>Account Status</th>
                  <th>Fleet Duty</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(driver => (
                  <tr key={driver.driver_id}>
                    <td><strong>{driver.employee_number}</strong></td>
                    <td>{driver.name}</td>
                    <td>
                      <div>{driver.phone}</div>
                      <small style={{ color: 'var(--text-muted)' }}>{driver.email}</small>
                    </td>
                    <td><code>{driver.license_number}</code></td>
                    <td>{driver.license_expiry ? driver.license_expiry.split('T')[0] : 'N/A'}</td>
                    <td>
                      <span className={`status-pill status-${driver.status}`}>{driver.status}</span>
                    </td>
                    <td>
                      <span className={`status-pill status-${driver.current_status}`}>{driver.current_status}</span>
                    </td>
                    <td className="action-buttons">
                      <button className="btn-secondary" onClick={() => openEditModal(driver)}>Edit</button>
                      {driver.status === 'ACTIVE' ? (
                        <button className="btn-danger" onClick={() => handleToggleStatus(driver)}>Deactivate</button>
                      ) : (
                        <button className="btn-success" onClick={() => handleToggleStatus(driver)}>Activate</button>
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
            <h3>{editingDriver ? 'Edit Driver Profile' : 'Register New Driver'}</h3>
            <form onSubmit={handleSubmit} className="standard-form modal-form">
              <div className="form-group">
                <label>Full Name *</label>
                <input required name="name" value={formData.name} onChange={handleChange} placeholder="e.g. John Doe" />
              </div>

              {!editingDriver && (
                <>
                  <div className="form-group">
                    <label>Corporate/Login Email *</label>
                    <input required type="email" name="email" value={formData.email} onChange={handleChange} placeholder="john.driver@dropyhub.com" />
                  </div>
                  <div className="form-group">
                    <label>Initial Login Password *</label>
                    <input required type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Minimum 6 characters" />
                  </div>
                </>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Phone *</label>
                  <input required name="phone" value={formData.phone} onChange={handleChange} placeholder="+1-555-0199" />
                </div>
                <div className="form-group">
                  <label>Employee Number *</label>
                  <input required disabled={Boolean(editingDriver)} name="employee_number" value={formData.employee_number} onChange={handleChange} placeholder="DRV-EMP-100" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>License Number *</label>
                  <input required name="license_number" value={formData.license_number} onChange={handleChange} placeholder="DL-XXXX-XXXX" />
                </div>
                <div className="form-group">
                  <label>License Expiry Date *</label>
                  <input required type="date" name="license_expiry" value={formData.license_expiry} onChange={handleChange} />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary">{editingDriver ? 'Save Changes' : 'Create Driver'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}