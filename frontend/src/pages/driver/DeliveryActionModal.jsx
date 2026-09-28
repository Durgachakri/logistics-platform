import React, { useState } from 'react';
import { apiRequest } from '../../services/api';
import './DeliveryActionModal.css';

export default function DeliveryActionModal({ shipment, action, onClose }) {
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const idempotencyKey = `driver-${action.toLowerCase()}-${shipment.shipment_id}-${Date.now()}`;

      if (action === 'PICKUP') {
        await apiRequest(`/driver/shipments/${shipment.shipment_id}/pickup`, {
          method: 'POST',
          body: { location: location || shipment.pickup_address, notes, idempotency_key: idempotencyKey }
        });
      } else if (action === 'TRANSIT') {
        await apiRequest(`/driver/shipments/${shipment.shipment_id}/transit`, {
          method: 'POST',
          body: { location: location || 'In Transit', notes, idempotency_key: idempotencyKey }
        });
      } else if (action === 'OUT_FOR_DELIVERY') {
        await apiRequest(`/driver/shipments/${shipment.shipment_id}/out-for-delivery`, {
          method: 'POST',
          body: { location: location || 'Local Delivery Area', notes, idempotency_key: idempotencyKey }
        });
      } else if (action === 'DELIVER') {
        await apiRequest(`/driver/shipments/${shipment.shipment_id}/delivery`, {
          method: 'POST',
          body: { location: location || shipment.delivery_address, notes, idempotency_key: idempotencyKey }
        });
      } else if (action === 'FAIL') {
        if (!notes.trim()) {
          throw new Error('A failure reason is required.');
        }
        await apiRequest(`/driver/shipments/${shipment.shipment_id}/fail`, {
          method: 'POST',
          body: { reason: notes, location: location || shipment.delivery_address, idempotency_key: idempotencyKey }
        });
      } else if (action === 'PROOF') {
        if (!file) {
          throw new Error('Please select a proof file (PNG, JPG, PDF).');
        }
        const formData = new FormData();
        formData.append('proof', file);
        await apiRequest(`/driver/shipments/${shipment.shipment_id}/proof`, {
          method: 'POST',
          body: formData,
          isFormData: true
        });
      }

      onClose(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Action: {action.replace('_', ' ')}</h3>
        <p className="modal-subtitle">Shipment #{shipment.shipment_number}</p>

        {error && <div className="error-alert">{error}</div>}

        <form onSubmit={handleSubmit}>
          {action !== 'PROOF' && (
            <div className="form-group">
              <label>Current Location</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Highway Mile 24 or Warehouse"
              />
            </div>
          )}

          {action === 'FAIL' ? (
            <div className="form-group">
              <label>Failure Reason *</label>
              <textarea
                required
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why could the package not be delivered?"
              />
            </div>
          ) : action !== 'PROOF' ? (
            <div className="form-group">
              <label>Notes (Optional)</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional delivery remarks"
              />
            </div>
          ) : null}

          {action === 'PROOF' && (
            <div className="form-group">
              <label>Select Proof of Delivery Document (JPG, PNG, PDF) *</label>
              <input
                type="file"
                required
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={(e) => setFile(e.target.files[0])}
              />
            </div>
          )}

          <div className="modal-actions">
            <button type="button" onClick={() => onClose(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Submitting...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}