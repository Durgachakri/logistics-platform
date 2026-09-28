import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './layouts/Navbar';
import Footer from './layouts/Footer';
import ProtectedRoute from './layouts/ProtectedRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/customer/Register';
import CustomerDashboard from './pages/customer/CustomerDashboard';
import CreateShipment from './pages/customer/CreateShipment';
import ShipmentDetails from './pages/customer/ShipmentDetails';
import CustomerProfile from './pages/customer/CustomerProfile';

import DriverDashboard from './pages/driver/DriverDashboard';

import AdminDashboard from './pages/admin/AdminDashboard';
import DispatchBoard from './pages/admin/DispatchBoard';
import Reports from './pages/admin/Reports';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Customer Routes */}
            <Route
              path="/customer"
              element={
                <ProtectedRoute allowedRoles={['CUSTOMER']}>
                  <CustomerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customer/create"
              element={
                <ProtectedRoute allowedRoles={['CUSTOMER']}>
                  <CreateShipment />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customer/shipments/:id"
              element={
                <ProtectedRoute allowedRoles={['CUSTOMER']}>
                  <ShipmentDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customer/profile"
              element={
                <ProtectedRoute allowedRoles={['CUSTOMER']}>
                  <CustomerProfile />
                </ProtectedRoute>
              }
            />

            {/* Driver Routes */}
            <Route
              path="/driver"
              element={
                <ProtectedRoute allowedRoles={['DRIVER']}>
                  <DriverDashboard />
                </ProtectedRoute>
              }
            />

            {/* Admin & Dispatcher Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'DISPATCHER']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/dispatch"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'DISPATCHER']}>
                  <DispatchBoard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'DISPATCHER']}>
                  <Reports />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </BrowserRouter>
    </AuthProvider>
  );
}