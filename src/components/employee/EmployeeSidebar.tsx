import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  User, 
  Clock, 
  Calendar, 
  FolderOpen, 
  Share2, 
  Plane, 
  Receipt, 
  FileText,
  X,
  Building2,
  MessageCircle,
  Workflow
} from 'lucide-react';
import { Button } from '../ui/button';
import { useAuth } from '../../hooks/useAuth';

interface EmployeeSidebarProps {
  onClose: () => void;
  isMobile?: boolean;
}

const EmployeeSidebar: React.FC<EmployeeSidebarProps> = ({ onClose, isMobile = false }) => {
  const location = useLocation();
  const { user } = useAuth();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/employee/' },
    { icon: User, label: 'My Info', path: '/employee/info' },
    { icon: Clock, label: 'Attendance', path: '/employee/attendance' },
    { icon: MessageCircle, label: 'Chat', path: '/employee/chat' },
    { icon: Calendar, label: 'Meetings', path: '/employee/meetings' },
    { icon: Workflow, label: 'My Task', path: '/employee/mytask' },
    { icon: FolderOpen, label: 'Projects', path: '/employee/projects' },
    ...(user?.department === 'Digital Marketing' ? [
      { icon: Share2, label: 'Social Media Calendar', path: '/employee/social-calendar' }
    ] : []),
    { icon: Plane, label: 'Leaves', path: '/employee/leaves' },
    { icon: Receipt, label: 'Salary Slips', path: '/employee/salary' },
    { icon: FileText, label: 'Reports', path: '/employee/reports' },
  ];

  const isActive = (path: string) => {
    if (path === '/employee/') {
      return location.pathname === '/employee' || location.pathname === '/employee/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className={`h-full flex flex-col bg-white ${isMobile ? 'w-full' : 'w-64'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">HRMS</h2>
            <p className="text-xs text-gray-500">Employee Panel</p>
          </div>
        </div>
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
            {user?.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-800 truncate">{user?.name}</p>
            <p className="text-sm text-gray-500 truncate">{user?.designation}</p>
            <p className="text-xs text-gray-400 truncate">{user?.employeeId}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
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
                    ? 'bg-green-50 text-green-600 border-r-2 border-green-600'
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

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center truncate">
          © 2024 PTS System
        </div>
      </div>
    </div>
  );
};

export default EmployeeSidebar;