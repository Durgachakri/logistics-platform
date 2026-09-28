import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Authenticating session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect user to their corresponding home dashboard if unauthorized
    if (user.role === 'CUSTOMER') return <Navigate to="/customer" replace />;
    if (user.role === 'DRIVER') return <Navigate to="/driver" replace />;
    if (user.role === 'ADMIN' || user.role === 'DISPATCHER') return <Navigate to="/admin" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
}