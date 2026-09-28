import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import DeliveryActionModal from './DeliveryActionModal';
import './DriverDashboard.css';

export default function DriverDashboard() {
  const [shipments, setShipments] = useState([]);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [modalAction, setModalAction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAssigned = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/driver/shipments');
      if (res.success) {
        setShipments(res.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssigned();
  }, []);

  const openAction = (shipment, action) => {
    setSelectedShipment(shipment);
    setModalAction(action);
  };

  const closeModal = (refresh = false) => {
    setSelectedShipment(null);
    setModalAction(null);
    if (refresh) fetchAssigned();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Driver Delivery Console</h1>
        <p>Manage your assigned route, status transitions, and proof of delivery</p>
      </div>

      {error && <div className="error-alert">{error}</div>}

      {loading ? (
        <div className="loading-state">Fetching active assignments...</div>
      ) : shipments.length === 0 ? (
        <div className="empty-state">No active deliveries assigned to you.</div>
      ) : (
        <div className="card-grid">
          {shipments.map((s) => (
            <div key={s.shipment_id} className="shipment-driver-card">
              <div className="card-top">
                <span className="shipment-badge">{s.shipment_number}</span>
                <span className={`status-pill status-${s.status}`}>{s.status}</span>
              </div>
              <div className="card-body">
                <p><strong>Vehicle:</strong> {s.registration_number} ({s.vehicle_type})</p>
                <p><strong>Pickup:</strong> {s.pickup_address}</p>
                <p><strong>Deliver To:</strong> {s.delivery_address}</p>
                <p><strong>Package:</strong> {s.package_description} ({s.package_weight_kg} kg)</p>
              </div>

              <div className="driver-actions">
                {s.status === 'ASSIGNED' && (
                  <button onClick={() => openAction(s, 'PICKUP')} className="btn-primary">
                    Confirm Pickup
                  </button>
                )}

                {s.status === 'PICKUP_CONFIRMED' && (
                  <button onClick={() => openAction(s, 'TRANSIT')} className="btn-primary">
                    Mark In Transit
                  </button>
                )}

                {s.status === 'IN_TRANSIT' && (
                  <button onClick={() => openAction(s, 'OUT_FOR_DELIVERY')} className="btn-primary">
                    Out For Delivery
                  </button>
                )}

                {s.status === 'OUT_FOR_DELIVERY' && (
                  <>
                    <button onClick={() => openAction(s, 'DELIVER')} className="btn-success">
                      Mark Delivered
                    </button>
                    <button onClick={() => openAction(s, 'PROOF')} className="btn-secondary">
                      Upload Proof
                    </button>
                    <button onClick={() => openAction(s, 'FAIL')} className="btn-danger">
                      Mark Failed
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedShipment && (
        <DeliveryActionModal
          shipment={selectedShipment}
          action={modalAction}
          onClose={closeModal}
        />
      )}
    </div>
  );
}