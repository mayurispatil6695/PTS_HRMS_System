import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import TeamLeaderSidebar from './TeamLeaderSidebar';

// Reuse admin components with role="team_leader"
import ProjectManagement from '../admin/ProjectManagement';

import AttendanceManagement from '../admin/AttendanceManagement';
import LeaveManagement from '../admin/LeaveManagement';
import MeetingManagement from '../admin/MeetingManagement';
import IdleDetectionPage from '../admin/IdleDetectionPage';
import ReportsManagement from '../admin/ReportsManagement';
import ChatManagement from '../admin/ChatManagement';
import TeamDashboard from '../manager/TeamDashboard'; // reuse manager's team dashboard (or create a simple one)
import TeamLeaderHome from './TeamLeaderHome';

const TeamLeaderDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {sidebarOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <TeamLeaderSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-800">Team Lead Dashboard</h1>
                <p className="text-sm text-gray-600">Welcome back, {user?.name}</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout} className="hover:bg-red-50 hover:text-red-600">Logout</Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <Routes>
              <Route path="/" element={<TeamLeaderHome />} />
              <Route path="/projects" element={<ProjectManagement role="team_leader" userId={user?.id} department={user?.department} />} />
             
              <Route path="/attendance" element={<AttendanceManagement role="team_leader" />} />
              <Route path="/leaves" element={<LeaveManagement role="team_leader" />} />
              <Route path="/meetings" element={<MeetingManagement role="team_leader" />} />
              <Route path="/idle-detection" element={<IdleDetectionPage role="team_leader" />} />
              <Route path="/reports" element={<ReportsManagement role="team_leader" />} />
              <Route path="/chat" element={<ChatManagement role="team_leader" />} />
              <Route path="/team" element={<TeamDashboard />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TeamLeaderDashboard;