
import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import AdminSidebar from './AdminSidebar';
import AdminDashboardHome from './AdminDashboardHome';
import EmployeeManagement from './EmployeeManagement';
import EmployeeApprovalManagement from './EmployeeApprovalManagement';
import AttendanceManagement from './AttendanceManagement';
import MeetingManagement from './MeetingManagement';
import ProjectManagement from './ProjectManagement';
import LeaveManagement from './LeaveManagement';
import ChatManagement from './ChatManagement';
import SalaryManagement from './SalaryManagement';
import ReportsManagement from './ReportsManagement';
import ExpenseManagement from './ExpenseManagement';
import SettingsManagement from './SettingsManagement';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/button';
import { Menu, X } from 'lucide-react';
import ClientManagement from './ClientManagement';
import DailyTaskEmployee from './DailyTaskEmployee';
import NotificationSystem from '../ui/NotificationSystem';
import IdleDetectionPage from './IdleDetectionPage';
import WorkloadHeatmap from './WorkloadHeatmap';





const AdminDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <AdminSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
       <header className="bg-white shadow-sm border-b border-gray-200">
  <div className="flex items-center justify-between px-4 py-3">
    {/* Left side – menu & title */}
    <div className="flex items-center gap-4">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)}>
        <Menu className="h-5 w-5" />
      </Button>
      <div>
        <h1 className="text-xl font-semibold text-gray-800">Admin Dashboard</h1>
        <p className="text-sm text-gray-600">Welcome back, {user?.name}</p>
      </div>
    </div>

    {/* Right side – notifications + logout */}
    <div className="flex items-center gap-4">
      <NotificationSystem />
      <Button
        variant="outline"
        onClick={handleLogout}
        className="hover:bg-red-50 hover:text-red-600 transition-colors"
      >
        Logout
      </Button>
    </div>
  </div>
</header>
        {/* Main content area */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <Routes>
              <Route path="/" element={<AdminDashboardHome />} />
              <Route path="/employees" element={<EmployeeManagement />} />
              <Route path="/clients" element={<ClientManagement />} />
              <Route path="/employee-approval" element={<EmployeeApprovalManagement />} />
              <Route path="/attendance" element={<AttendanceManagement />} />
              <Route path="/meetings" element={<MeetingManagement />} />
              <Route path="/projects" element={<ProjectManagement />} />
              <Route path="/leaves" element={<LeaveManagement />} />
              <Route path="/chat" element={<ChatManagement />} />
              <Route path="/salary" element={<SalaryManagement />} />
              <Route path="/reports" element={<ReportsManagement />} />
              <Route path="/expenses" element={<ExpenseManagement />} />
              <Route path="/settings" element={<SettingsManagement />} />
              
              <Route path="/employeetask" element={<DailyTaskEmployee />}/>
              <Route path="/idle-detection" element={<IdleDetectionPage />} />
             
              <Route path="/workload" element={<WorkloadHeatmap />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
