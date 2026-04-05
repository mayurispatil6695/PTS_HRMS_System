
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import EmployeeSidebar from './EmployeeSidebar';
import EmployeeDashboardHome from './EmployeeDashboardHome';
import EmployeeInfo from './EmployeeInfo';
import EmployeeAttendance from './EmployeeAttendance';
import EmployeeMeetings from './EmployeeMeetings';
import EmployeeProjects from './EmployeeProjects';
import SocialMediaCalendar from './SocialMediaCalendar';
import EmployeeLeaves from './EmployeeLeaves';
import EmployeeSalarySlips from './EmployeeSalarySlips';
import EmployeeReports from './EmployeeReports';
import EmployeeChat from './EmployeeChat';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/button';
import { Menu, X } from 'lucide-react';
import MyTask from './MyTask';
import { ref, update } from 'firebase/database';
import { database } from '../../firebase';

const EmployeeDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  useEffect(() => {
  if (!user) return;

  let lastActivity = Date.now();

  const updateActivity = () => {
    lastActivity = Date.now();
  };

  window.addEventListener('mousemove', updateActivity);
  window.addEventListener('keydown', updateActivity);
  window.addEventListener('click', updateActivity);

  const interval = setInterval(() => {
    const idleTime = Date.now() - lastActivity;

    const status = idleTime > 5 * 60 * 1000 ? 'idle' : 'active';

    update(ref(database, `activity/${user.id}`), {
      status,
      lastActive: new Date().toISOString(),
      idleTime
    });

  }, 10000);

  return () => {
    clearInterval(interval);
    window.removeEventListener('mousemove', updateActivity);
    window.removeEventListener('keydown', updateActivity);
    window.removeEventListener('click', updateActivity);
  };
}, [user]);

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
        <EmployeeSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
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
                <h1 className="text-xl font-semibold text-gray-800">Employee Portal</h1>
                <p className="text-sm text-gray-600">Welcome back, {user?.name}</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              Logout
            </Button>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <Routes>
              <Route path="/" element={<EmployeeDashboardHome />} />
              <Route path="/info" element={<EmployeeInfo />} />
              <Route path="/attendance" element={<EmployeeAttendance />} />
              <Route path="/meetings" element={<EmployeeMeetings />} />
              <Route path="/projects" element={<EmployeeProjects />} />
              <Route path="/social-calendar" element={<SocialMediaCalendar />} />
              <Route path="/leaves" element={<EmployeeLeaves />} />
              <Route path="/salary" element={<EmployeeSalarySlips />} />
              <Route path="/reports" element={<EmployeeReports />} />
              <Route path="/chat" element={<EmployeeChat />} />
              <Route path='/mytask' element={<MyTask />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
