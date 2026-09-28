import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import './Reports.css';

export default function Reports() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAudit() {
      try {
        const res = await apiRequest('/admin/audit-logs');
        if (res.success) {
          setLogs(res.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchAudit();
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Operational Audit & Compliance Logs</h1>
        <p>Immutable history of shipment creation, driver assignments, state transitions, and proof uploads</p>
      </div>

      {loading ? (
        <div className="loading-state">Fetching audit logs...</div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Audit ID</th>
                <th>Action</th>
                <th>Entity Type</th>
                <th>Entity ID</th>
                <th>Performed By</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.audit_id}>
                  <td><code>{log.audit_id}</code></td>
                  <td><strong>{log.action}</strong></td>
                  <td>{log.entity_type}</td>
                  <td><code>{log.entity_id}</code></td>
                  <td>{log.user_name} ({log.user_role})</td>
                  <td>{new Date(log.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}