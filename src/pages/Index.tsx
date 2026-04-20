import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import EnhancedLoginPage from '../components/auth/EnhancedLoginPage';
import AdminDashboard from '../components/admin/AdminDashboard';
import EmployeeDashboard from '../components/employee/EmployeeDashboard';
import TeamManagerDashboard from '../components/manager/TeamManagerDashboard';
import TeamLeaderDashboard from '../components/teamlead/TeamLeaderDashboard';
import ClientDashboard from '../components/client/ClientDashboard';
import { useAuth } from '../hooks/useAuth';
import { useEffect } from 'react';

const Index = () => {

  const { user, loading } = useAuth();
  useEffect(() => {
  if ('Notification' in window && Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }
  

  // Role‑based redirect mapping
  const getDashboardPath = (role: string) => {
    switch (role) {
      case 'admin': return '/admin';
      case 'team_manager': return '/manager';
      case 'team_leader': return '/leader';
      case 'client': return '/client';
      default: return '/employee';
    }
  };

  return (
    <Routes>
      <Route path="/login" element={!user ? <EnhancedLoginPage /> : <Navigate to={getDashboardPath(user.role)} />} />
      
      <Route path="/admin/*" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/login" />} />
      <Route path="/manager/*" element={user?.role === 'team_manager' ? <TeamManagerDashboard /> : <Navigate to="/login" />} />
      <Route path="/leader/*" element={user?.role === 'team_leader' ? <TeamLeaderDashboard /> : <Navigate to="/login" />} />
      <Route path="/client/*" element={user?.role === 'client' ? <ClientDashboard /> : <Navigate to="/login" />} />
      <Route path="/employee/*" element={user?.role === 'employee' ? <EmployeeDashboard /> : <Navigate to="/login" />} />
      
      <Route path="/" element={<Navigate to="/login" />} />
    </Routes>
  );
};

export default Index;