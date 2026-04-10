import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Clock,
  FolderKanban,
  FileText,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface ManagerSidebarProps {
  onClose?: () => void;
}

const TeamManagerSidebar: React.FC<ManagerSidebarProps> = ({ onClose }) => {
  const { logout } = useAuth();

  const menuItems = [
    { path: '/manager', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/manager/team', icon: Users, label: 'My Team' },
    { path: '/manager/leaves', icon: CalendarCheck, label: 'Leave Approvals' },
    { path: '/manager/attendance', icon: Clock, label: 'Team Attendance' },
    { path: '/manager/projects', icon: FolderKanban, label: 'Projects' },
    { path: '/manager/reports', icon: FileText, label: 'Reports' },
    { path: '/manager/settings', icon: Settings, label: 'Settings' },
  ];

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  return (
    <aside className="w-64 bg-gray-900 text-white h-full flex flex-col">
      <div className="p-4 text-xl font-bold border-b border-gray-700">Manager Portal</div>
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-gray-300 hover:bg-gray-800 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default TeamManagerSidebar;