import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  FolderOpen, 
  CheckSquare, 
  Clock, 
  Calendar, 
  Users,
  MessageCircle,
  FileText,
  X,
  Building2
} from 'lucide-react';
import { Button } from '../ui/button';
import { useAuth } from '../../hooks/useAuth';

interface TeamLeaderSidebarProps {
  onClose: () => void;
  isMobile?: boolean;
}

const TeamLeaderSidebar: React.FC<TeamLeaderSidebarProps> = ({ onClose, isMobile = false }) => {
  const location = useLocation();
  const { user } = useAuth();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/leader/' },
    { icon: FolderOpen, label: 'Projects', path: '/leader/projects' },
    { icon: CheckSquare, label: 'Tasks', path: '/leader/tasks' },
    { icon: Clock, label: 'Attendance', path: '/leader/attendance' },
    { icon: Calendar, label: 'Leaves', path: '/leader/leaves' },
    { icon: Calendar, label: 'Meetings', path: '/leader/meetings' },
    { icon: Users, label: 'Team', path: '/leader/team' },
    { icon: MessageCircle, label: 'Chat', path: '/leader/chat' },
    { icon: FileText, label: 'Reports', path: '/leader/reports' },
  ];

  const isActive = (path: string) => {
    if (path === '/leader/') {
      return location.pathname === '/leader' || location.pathname === '/leader/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className={`h-full flex flex-col bg-white ${isMobile ? 'w-full' : 'w-64'}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">HRMS</h2>
            <p className="text-xs text-gray-500">Team Lead Panel</p>
          </div>
        </div>
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-semibold">
            {user?.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-800 truncate">{user?.name}</p>
            <p className="text-sm text-gray-500 truncate">{user?.designation}</p>
            <p className="text-xs text-gray-400 truncate">{user?.employeeId}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {menuItems.map((item, index) => (
            <motion.li
              key={item.path}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <NavLink
                to={item.path}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  isActive(item.path)
                    ? 'bg-purple-50 text-purple-600 border-r-2 border-purple-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium truncate">{item.label}</span>
              </NavLink>
            </motion.li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center truncate">
          © 2025 PTS System
        </div>
      </div>
    </div>
  );
};

export default TeamLeaderSidebar;