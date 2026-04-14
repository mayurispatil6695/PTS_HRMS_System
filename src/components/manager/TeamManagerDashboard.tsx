// src/components/manager/TeamManagerDashboard.tsx
import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import ManagerSidebar from './TeamManagerSidebar';
import ProjectManagement from '../admin/ProjectManagement';
import DailyTaskEmployee from '../admin/DailyTaskEmployee';

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
              <Route path="/" element={
                <div className="space-y-6">
                  <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                    <h2 className="text-2xl font-bold">Manager Overview</h2>
                    <p className="text-gray-600">Manage projects and tasks for your department.</p>
                  </motion.div>
                  <ProjectManagement role="team_manager" userId={user?.id} department={user?.department} />
                </div>
              } />
              <Route path="/projects" element={<ProjectManagement role="team_manager" userId={user?.id} department={user?.department} />} />
              <Route path="/tasks" element={<DailyTaskEmployee role="team_manager" userId={user?.id} department={user?.department} />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TeamManagerDashboard;