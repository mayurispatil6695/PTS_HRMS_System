import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  Calendar,
  MessageSquare,
  FileText,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface ClientSidebarProps {
  onClose?: () => void;
}

const ClientSidebar: React.FC<ClientSidebarProps> = ({ onClose }) => {
  const { logout } = useAuth();

  const menuItems = [
    { path: '/client', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/client/projects', icon: FolderKanban, label: 'My Projects' },
    { path: '/client/timeline', icon: Calendar, label: 'Project Timeline' },
    { path: '/client/feedback', icon: MessageSquare, label: 'Feedback' },
    { path: '/client/reports', icon: FileText, label: 'Reports' },
    { path: '/client/settings', icon: Settings, label: 'Settings' },
  ];

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  return (
    <aside className="w-64 bg-gray-900 text-white h-full flex flex-col">
      <div className="p-4 text-xl font-bold border-b border-gray-700">Client Portal</div>
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

export default ClientSidebar;