
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import EnhancedLoginPage from '../components/auth/EnhancedLoginPage';
import AdminDashboard from '../components/admin/AdminDashboard';
import EmployeeDashboard from '../components/employee/EmployeeDashboard';
import { useAuth } from '../hooks/useAuth';

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <EnhancedLoginPage /> : <Navigate to={user.role === 'admin' ? '/admin' : '/employee'} />} />
      <Route path="/admin/*" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/login" />} />
      <Route path="/employee/*" element={user?.role === 'employee' ? <EmployeeDashboard /> : <Navigate to="/login" />} />
      <Route path="/" element={<Navigate to="/login" />} />
    </Routes>
  );
};

export default Index;
