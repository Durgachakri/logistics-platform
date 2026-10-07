import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../services/api';
import './CreateShipment.css';

export default function CreateShipment() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    pickup_address: '',
    delivery_address: '',
    package_description: '',
    package_weight_kg: '',
    priority: 'NORMAL',
    payment_method: 'COD',
    scheduled_pickup_date: '',
    scheduled_delivery_date: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await apiRequest('/shipments', {
        method: 'POST',
        body: {
          ...form,
          package_weight_kg: parseFloat(form.package_weight_kg)
        }
      });
      if (res.success) {
        navigate('/customer');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container form-page">
      <div className="page-header">
        <h1>Book a Shipment</h1>
      </div>

      {error && <div className="error-alert">{error}</div>}

      <form onSubmit={handleSubmit} className="standard-form">
        <div className="form-group">
          <label>Pickup Address *</label>
          <input
            name="pickup_address"
            required
            value={form.pickup_address}
            onChange={handleChange}
            placeholder="Warehouse or pickup location"
          />
        </div>

        <div className="form-group">
          <label>Delivery Address *</label>
          <input
            name="delivery_address"
            required
            value={form.delivery_address}
            onChange={handleChange}
            placeholder="Destination address"
          />
        </div>

        <div className="form-group">
          <label>Package Description *</label>
          <input
            name="package_description"
            required
            value={form.package_description}
            onChange={handleChange}
            placeholder="e.g., Electronics, Spare Parts"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Weight (kg) *</label>
            <input
              type="number"
              step="0.1"
              required
              name="package_weight_kg"
              value={form.package_weight_kg}
              onChange={handleChange}
              placeholder="e.g. 5.0"
            />
          </div>

          <div className="form-group">
            <label>Priority</label>
            <select name="priority" value={form.priority} onChange={handleChange}>
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>

        <div className="form-group payment-method-section">
          <label>Payment Method *</label>
          <div className="cod-selector-box">
            <label className="cod-radio-label">
              <input
                type="radio"
                name="payment_method"
                value="COD"
                checked={form.payment_method === 'COD'}
                onChange={handleChange}
              />
              <span><strong>Cash on Delivery (COD)</strong></span>
            </label>
            <small className="cod-hint">Pay with cash upon package receipt.</small>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Scheduled Pickup Date</label>
            <input
              type="datetime-local"
              name="scheduled_pickup_date"
              value={form.scheduled_pickup_date}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Scheduled Delivery Date</label>
            <input
              type="datetime-local"
              name="scheduled_delivery_date"
              value={form.scheduled_delivery_date}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={() => navigate('/customer')} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Creating...' : 'Submit Shipment'}
          </button>
        </div>
      </form>
    </div>
  );
}