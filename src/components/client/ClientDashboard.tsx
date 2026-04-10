import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Menu } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import ClientSidebar from './ClientSidebar';
import ClientHome from './ClientHome';
import ClientProjects from './ClientProjects';
import ClientTimeline from './ClientTimeline';
import ClientFeedback from './ClientFeedback';
import ClientReports from './ClientReports';
import ClientSettings from './ClientSettings';

const ClientDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <ClientSidebar onClose={() => setSidebarOpen(false)} />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-800">Client Portal</h1>
                <p className="text-sm text-gray-600">Welcome, {user?.name}</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="hover:bg-red-50 hover:text-red-600"
            >
              Logout
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <Routes>
              <Route path="/" element={<ClientHome />} />
              <Route path="/projects" element={<ClientProjects />} />
              <Route path="/timeline" element={<ClientTimeline />} />
              <Route path="/feedback" element={<ClientFeedback />} />
              <Route path="/reports" element={<ClientReports />} />
              <Route path="/settings" element={<ClientSettings />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ClientDashboard;