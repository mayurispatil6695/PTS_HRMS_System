import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import ManagerSidebar from './TeamManagerSidebar';

// Import all required components
import ManagerDashboardHome from './ManagerDashboardHome';
import AttendanceManagement from '../admin/AttendanceManagement';
import LeaveManagement from '../admin/LeaveManagement';
import ProjectManagement from '../admin/ProjectManagement';
import PerformanceReviews from '../admin/PerformanceReviews';
import MeetingManagement from '../admin/MeetingManagement';
import IdleDetectionPage from '../admin/IdleDetectionPage';
import ReportsManagement from '../admin/ReportsManagement';
import ChatManagement from '../admin/ChatManagement';
import ManagerReviews from './ManagerReviews';
import TeamDashboard from './TeamDashboard';
import LeaveCalendar from './LeaveCalendar';

const TeamManagerDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <ManagerSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-800">Manager Dashboard</h1>
                <p className="text-sm text-gray-600">Welcome back, {user?.name}</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout} className="hover:bg-red-50 hover:text-red-600">
              Logout
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <Routes>
              <Route path="/" element={<ManagerDashboardHome />} />

              {/* These components already use useAuth to determine role – no role prop needed */}
              <Route path="/attendance" element={<AttendanceManagement />} />
              <Route path="/leaves" element={<LeaveManagement />} />
              <Route path="/reviews" element={<PerformanceReviews role="manager" />} />
              <Route path="/meetings" element={<MeetingManagement role="manager" />} />
              <Route path="/idle-detection" element={<IdleDetectionPage role="manager" />} />
              <Route path="/reports" element={<ReportsManagement role="manager" />} />
              <Route path="/projects" element={<ProjectManagement role="team_manager" />} />
              <Route path="/chat" element={<ChatManagement role="team_manager" />} />

              {/* Manager‑specific components */}
              <Route path="/team-dashboard" element={<TeamDashboard />} />
              <Route path="/leave-calendar" element={<LeaveCalendar />} />
              <Route path="/manager-reviews" element={<ManagerReviews />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TeamManagerDashboard;