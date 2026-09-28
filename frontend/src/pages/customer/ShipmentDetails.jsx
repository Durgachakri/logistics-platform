import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../services/api';
import './ShipmentDetails.css';

const STAGES = [
  { key: 'CREATED', label: 'Booked' },
  { key: 'ASSIGNED', label: 'Driver assigned' },
  { key: 'PICKUP_CONFIRMED', label: 'Picked up' },
  { key: 'IN_TRANSIT', label: 'In transit' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { key: 'DELIVERED', label: 'Delivered' },
];

export default function ShipmentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const res = await apiRequest(`/shipments/${id}`);
      if (res.success) {
        setShipment(res.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this shipment?')) return;
    setCancelLoading(true);
    try {
      const res = await apiRequest(`/shipments/${id}/cancel`, { method: 'POST' });
      if (res.success) {
        alert(res.message);
        fetchDetails();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setCancelLoading(false);
    }
  };

  if (loading) return <div className="page-container">Loading shipment details...</div>;
  if (error) return <div className="page-container error-alert">{error}</div>;
  if (!shipment) return null;

  const stageIndex = STAGES.findIndex((st) => st.key === shipment.status);
  const isStopped = shipment.status === 'CANCELLED' || shipment.status === 'DELIVERY_FAILED';

  const canCancel = shipment.status === 'CREATED' || shipment.status === 'ASSIGNED';

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Shipment #{shipment.shipment_number}</h1>
          <span className={`status-pill status-${shipment.status}`}>{shipment.status.replace(/_/g, ' ')}</span>
        </div>
        {canCancel && (
          <button onClick={handleCancel} disabled={cancelLoading} className="btn-danger">
            {cancelLoading ? 'Cancelling...' : 'Cancel Shipment'}
          </button>
        )}
      </div>

      {isStopped ? (
        <div className="error-alert">
          {shipment.status === 'CANCELLED'
            ? 'This shipment was cancelled.'
            : 'The delivery attempt failed. Our team will be in touch about next steps.'}
        </div>
      ) : (
        <div className="card progress-card">
          <ol className="progress">
            {STAGES.map((st, i) => (
              <li key={st.key} className={i < stageIndex ? 'done' : i === stageIndex ? 'current' : ''}>
                <span className="dot">{i < stageIndex ? '✓' : i + 1}</span>
                <span className="label">{st.label}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="grid-2col">
        <div className="card">
          <h3>Routing & Details</h3>
          <p><strong>Package:</strong> {shipment.package_description} ({shipment.package_weight_kg} kg)</p>
          <p><strong>Priority:</strong> {shipment.priority}</p>
          <p><strong>Pickup Address:</strong> {shipment.pickup_address}</p>
          <p><strong>Delivery Address:</strong> {shipment.delivery_address}</p>
          <p><strong>Scheduled Delivery:</strong> {shipment.scheduled_delivery_date || 'N/A'}</p>
        </div>

        <div className="card">
          <h3>Delivery Timeline</h3>
          {shipment.events && shipment.events.length > 0 ? (
            <ul className="timeline">
              {shipment.events.map((evt) => (
                <li key={evt.event_id} className="timeline-item">
                  <div className="timeline-badge">{evt.event_type}</div>
                  <div className="timeline-content">
                    <p className="timeline-notes">{evt.notes || 'Status updated'}</p>
                    <small>{evt.location} • {new Date(evt.created_at).toLocaleString()}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>No timeline events recorded yet.</p>
          )}

          {shipment.proof_of_delivery && (
            <div className="pod-section">
              <h4>Proof of Delivery</h4>
              <p>Uploaded: {new Date(shipment.proof_of_delivery.uploaded_at).toLocaleString()}</p>
              <a
                href={`http://localhost:5000${shipment.proof_of_delivery.file_url}`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
              >
                View Proof Document ({shipment.proof_of_delivery.file_name})
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}