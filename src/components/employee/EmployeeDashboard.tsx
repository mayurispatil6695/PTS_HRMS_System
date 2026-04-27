import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import EmployeeSidebar from './EmployeeSidebar';
import EmployeeDashboardHome from './EmployeeDashboardHome';
import EmployeeInfo from './EmployeeInfo';
import EmployeeAttendance from './EmployeeAttendance';
import EmployeeMeetings from './EmployeeMeetings';
import SocialMediaCalendar from './SocialMediaCalendar';
import EmployeeLeaves from './EmployeeLeaves';
import EmployeeSalarySlips from './EmployeeSalarySlips';
import EmployeeReports from './EmployeeReports';
import EmployeeChat from './EmployeeChat';
import MyTask from './MyTask';            // This is "My Work"
import MyProjects from './MyProjects';   // ✅ NEW
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/button';
import { Menu, X } from 'lucide-react';
import { WorkSessionProvider } from '../../contexts/WorkSessionContext';
import NotificationSystem from '../ui/NotificationSystem';
import EmployeeReview from './EmployeeReview';
import EmployeeGoalSetting from './EmployeeGoalSetting';
import { DarkModeToggle } from '../ui/DarkModeToggle';
import { useAutoLogout } from '../../hooks/useAutoLogout';
const EmployeeDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
useAutoLogout('18:30'); // 6:30 PM
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
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-800">Employee Portal</h1>
                <p className="text-sm text-gray-600">Welcome back, {user?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <DarkModeToggle />
              <NotificationSystem />
              <Button variant="outline" onClick={handleLogout} className="hover:bg-red-50 hover:text-red-600">
                Logout
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <WorkSessionProvider>
              <Routes>
                <Route path="/" element={<EmployeeDashboardHome />} />
                <Route path="/info" element={<EmployeeInfo />} />
                <Route path="/attendance" element={<EmployeeAttendance />} />
                <Route path="/meetings" element={<EmployeeMeetings />} />
                <Route path="/social-calendar" element={<SocialMediaCalendar />} />
                <Route path="/leaves" element={<EmployeeLeaves />} />
                <Route path="/salary" element={<EmployeeSalarySlips />} />
                <Route path="/reports" element={<EmployeeReports />} />
                <Route path="/chat" element={<EmployeeChat />} />
                {/* My Work – main task dashboard */}
                <Route path="/my-work" element={<MyTask />} />
                <Route path="/mytask" element={<MyTask />} /> {/* backwards compatibility */}
                {/* My Projects – read‑only project list */}
                <Route path="/my-projects" element={<MyProjects />} />
                <Route path="/review" element={<EmployeeReview />} />
                <Route path="employee/goals" element={<EmployeeGoalSetting />} />
              </Routes>
            </WorkSessionProvider>
          </div>
        </main>
      </div>
    </div>
  );
};

export default EmployeeDashboard;