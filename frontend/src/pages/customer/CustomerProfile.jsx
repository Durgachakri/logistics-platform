import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import './CustomerProfile.css';

export default function CustomerProfile() {
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/customers/me');
      if (res.success && res.data) {
        setProfile(res.data);
        setFormData({
          name: res.data.name || '',
          phone: res.data.phone || '',
          address: res.data.address || ''
        });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to load profile' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await apiRequest('/customers/me', {
        method: 'PUT',
        body: formData
      });

      if (res.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        fetchProfile();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="page-container loading-state">Loading your profile...</div>;
  }

  return (
    <div className="page-container" style={{ maxWidth: '720px' }}>
      <div className="page-header">
        <div>
          <h1>Customer Profile</h1>
          <p>View and manage your account details and default delivery address</p>
        </div>
      </div>

      {message.text && (
        <div className={message.type === 'error' ? 'error-alert' : 'success-alert'}>
          {message.text}
        </div>
      )}

      {profile && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Customer ID</p>
              <h3 style={{ margin: '0.2rem 0' }}>{profile.customer_number}</h3>
            </div>
            <div>
              <span className={`status-pill status-${profile.status}`}>{profile.status}</span>
            </div>
          </div>
          <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            <strong>Account Email:</strong> {profile.email} (Email cannot be changed)
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <strong>Member Since:</strong> {new Date(profile.created_at).toLocaleDateString()}
          </p>
        </div>
      )}

      <div className="card">
        <h3>Edit Personal Information</h3>
        <form onSubmit={handleSubmit} className="standard-form" style={{ marginTop: '1rem' }}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Phone Number</label>
            <input
              type="text"
              name="phone"
              required
              value={formData.phone}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Default Pickup / Delivery Address</label>
            <textarea
              name="address"
              required
              value={formData.address}
              onChange={handleChange}
              rows="3"
            />
          </div>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving Changes...' : 'Save Profile Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}