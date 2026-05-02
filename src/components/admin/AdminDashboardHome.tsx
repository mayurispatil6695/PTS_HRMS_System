// src/pages/admin/dashboard/AdminDashboardHome.tsx
import React, { useState, useEffect, useMemo, lazy, Suspense, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Users, UserCheck, Calendar, Clock, FolderOpen, Camera, Bell, X, AlertTriangle } from 'lucide-react';
import DashboardCard from './DashboardCard';
import { ref, onValue, off, update, DataSnapshot } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { Badge } from '../ui/badge';
import { useEmployees } from '../../hooks/useEmployees';
import { useProjects } from '../../hooks/useProjects';
import { useAttendanceRecords } from '../../hooks/useAttendanceRecords';
import { useLeaveRequests } from '../../hooks/useLeaveRequests';
import { useMarketingPosts } from '../../hooks/useMarketingPosts';  
import { AttendanceRecord } from '@/types/attendance';
import { IdleUser, ActivityData } from '@/types/attendance';
import { Employee } from '@/types/employee';
import { LeaveRequest, MarketingPost } from '@/types/popup';
import { Project } from '@/types/project';

// Lazy load popups – only loaded when opened
const AttendancePopup = lazy(() => import('./popups/AttendancePopup'));
const LeavePopup = lazy(() => import('./popups/LeavePopup'));
const EmployeesPopup = lazy(() => import('./popups/EmployeesPopup'));
const ProjectsPopup = lazy(() => import('./popups/ProjectsPopup'));
const MarketingPostsPopup = lazy(() => import('./popups/MarketingPostsPopup'));

// Work session interface
interface WorkSession {
  isPunchedIn?: boolean;
  isOnBreak?: boolean;
  punchInTime?: number;
  punchOutTime?: number;
  breakStartTime?: number;
  lastUpdated?: number;
}

// Helper to detect mobile screen
const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  return matches;
};

const AdminDashboardHome = () => {
  const { user } = useAuth();
  const isMobile = useMediaQuery('(max-width: 640px)');

  // Data hooks
  const { employees, loading: empLoading } = useEmployees(user);
  const { projects, loading: projLoading } = useProjects(user);
  const { attendanceRecords } = useAttendanceRecords(user, employees);
  const { leaveRequests } = useLeaveRequests(user, employees);
  const { marketingPosts } = useMarketingPosts(user, employees);

  // Local state
  const [idleUsers, setIdleUsers] = useState<IdleUser[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [activeNotification, setActiveNotification] = useState<{ post: MarketingPost; timer: number } | null>(null);
  const [notificationTimeout, setNotificationTimeout] = useState<NodeJS.Timeout | null>(null);
  const [notifiedIdleIds, setNotifiedIdleIds] = useState<Set<string>>(new Set());
  const prevWorkSessionsRef = React.useRef<Map<string, WorkSession>>(new Map());

  // Popup states
  const [popups, setPopups] = useState({
    attendance: false,
    leave: false,
    employees: false,
    activeEmployees: false,
    projects: false,
    marketing: false,
  });
  const togglePopup = (name: keyof typeof popups) => (value: boolean) =>
    setPopups(prev => ({ ...prev, [name]: value }));

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(setNotificationPermission);
      } else {
        setNotificationPermission(Notification.permission);
      }
    }
  }, []);

  // ========== Work Sessions (Attendance Notifications) ==========
  useEffect(() => {
    if (!employees.length) return;
    let isFirstRun = true;
    const workSessionsRef = ref(database, 'workSessions');
    const unsubscribe = onValue(workSessionsRef, (snapshot) => {
      const data = snapshot.val() as Record<string, WorkSession> | null;
      if (!data) return;
      if (isFirstRun) {
        prevWorkSessionsRef.current = new Map(Object.entries(data));
        isFirstRun = false;
        return;
      }
      for (const [empId, current] of Object.entries(data)) {
        const prev = prevWorkSessionsRef.current.get(empId);
        const employee = employees.find(e => e.id === empId);
        if (!employee) continue;
        if (!prev?.isPunchedIn && current.isPunchedIn) {
          showNotif('Punched In', `${employee.name} punched in.`, 'green');
        }
        if (prev?.isPunchedIn && !current.isPunchedIn) {
          showNotif('Punched Out', `${employee.name} punched out.`, 'blue');
        }
        if (!prev?.isOnBreak && current.isOnBreak) {
          showNotif('Break Started', `${employee.name} started a break.`, 'yellow');
        }
        if (prev?.isOnBreak && !current.isOnBreak) {
          showNotif('Break Ended', `${employee.name} ended break.`, 'purple');
        }
      }
      prevWorkSessionsRef.current = new Map(Object.entries(data));
    });
    return () => off(workSessionsRef);
  }, [employees]);

  const showNotif = (title: string, body: string, _color: string) => {
    toast(body, { icon: '🔔', duration: 4000 });
    if (notificationPermission === 'granted') {
      new Notification(title, { body, icon: '/logo.png' });
    }
  };

  // ========== Idle Users Monitoring ==========
  useEffect(() => {
    const activityRef = ref(database, 'activity');
    const unsubscribe = onValue(activityRef, (snapshot: DataSnapshot) => {
      const data = snapshot.val() as Record<string, ActivityData> | null;
      const newIdleUsers: IdleUser[] = [];
      if (data) {
        Object.entries(data).forEach(([userId, userData]) => {
          if (userData.status === 'idle' || userData.isIdle === true) {
            newIdleUsers.push({
              id: userId,
              idleStartTime: userData.idleStartTime || userData.timestamp || Date.now(),
              idleDuration: userData.idleDuration || 0,
              lastActive: userData.lastActive || Date.now(),
              status: userData.status || 'idle',
            });
          }
        });
      }
      newIdleUsers.sort((a, b) => b.idleDuration - a.idleDuration);
      setIdleUsers(newIdleUsers);

      // Notify only once per idle employee
      const newIds = newIdleUsers.map(u => u.id);
      const justBecameIdle = newIds.filter(id => !notifiedIdleIds.has(id));
      if (justBecameIdle.length && notificationPermission === 'granted') {
        justBecameIdle.forEach(userId => {
          const emp = employees.find(e => e.id === userId);
          if (emp) {
            new Notification(`Idle: ${emp.name}`, {
              body: `${emp.name} (${emp.email}) has been idle >10s`,
              icon: '/notification-icon.png',
              tag: `idle-${userId}`,
            });
          }
        });
        setNotifiedIdleIds(new Set(newIds));
      }
      const noLongerIdle = Array.from(notifiedIdleIds).filter(id => !newIds.includes(id));
      if (noLongerIdle.length) {
        const updated = new Set(notifiedIdleIds);
        noLongerIdle.forEach(id => updated.delete(id));
        setNotifiedIdleIds(updated);
      }
    });
    return () => unsubscribe();
  }, [employees, notificationPermission, notifiedIdleIds]);

  // ========== Marketing Scheduled Notifications ==========
  useEffect(() => {
    if (!marketingPosts.length) return;
    const today = new Date().toISOString().split('T')[0];
    const todayPosts = marketingPosts.filter(p => p.scheduledDate === today && p.status === 'scheduled');
    if (todayPosts.length && notificationPermission === 'granted') {
      new Notification('Scheduled Marketing Posts', {
        body: `${todayPosts.length} post(s) scheduled today.`,
        icon: '/notification-icon.png',
      });
    }
    const interval = setInterval(() => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      todayPosts.forEach(post => {
        const [hours, minutes] = post.scheduledTime.split(':').map(Number);
        if (currentHour === hours && currentMinute === minutes) {
          setActiveNotification({ post, timer: 10 });
        }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [marketingPosts, notificationPermission]);

  // Auto-close marketing notification
  useEffect(() => {
    if (!activeNotification) return;
    const interval = setInterval(() => {
      setActiveNotification(prev => {
        if (prev && prev.timer > 1) return { ...prev, timer: prev.timer - 1 };
        clearInterval(interval);
        return null;
      });
    }, 1000);
    const timeout = setTimeout(() => setActiveNotification(null), 10000);
    setNotificationTimeout(timeout);
    return () => {
      clearInterval(interval);
      if (notificationTimeout) clearTimeout(notificationTimeout);
    };
  }, [activeNotification]);

  // ========== Memoized Stats ==========
  const stats = useMemo(() => {
    const activeCount = employees.filter(e => e.isActive).length;
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendanceRecords.filter(r => new Date(r.date).toISOString().split('T')[0] === today);
    const todayPresent = todayAttendance.filter(a => a.status === 'present').length;
    const todayLate = todayAttendance.filter(a => a.status === 'late').length;
    const todayHalfDay = todayAttendance.filter(a => a.status === 'half-day' || (a.hoursWorked && a.hoursWorked < 4)).length;
    const todayOnLeave = todayAttendance.filter(a => a.status === 'on-leave').length;
    const todayAbsent = activeCount - (todayPresent + todayLate + todayHalfDay + todayOnLeave);
    const pendingLeaves = leaveRequests.filter(r => r.status === 'pending').length;
    const activeProjects = projects.filter(p => p.status === 'in_progress' || p.status === 'active').length;
    const completedProjects = projects.filter(p => p.status === 'completed').length;
    const pausedProjects = projects.filter(p => p.status === 'on_hold').length;
    return {
      totalEmployees: activeCount,
      activeEmployees: activeCount,
      pendingLeaves,
      todayPresent,
      todayLate,
      todayHalfDay,
      todayOnLeave,
      todayAbsent,
      totalProjects: projects.length,
      activeProjects,
      completedProjects,
      pausedProjects,
      digitalMarketingPosts: marketingPosts.length,
    };
  }, [employees, attendanceRecords, leaveRequests, projects, marketingPosts]);

  // ========== Format idle time ==========
  const formatIdleTime = (startTime: number) => {
    const sec = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(sec / 60);
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    if (mins > 0) return `${mins}m ${sec % 60}s`;
    return `${sec}s`;
  };

  // Dashboard cards configuration
  const cards = [
    { title: 'Total Employees', value: stats.totalEmployees, subtitle: 'All registered employees', icon: Users, color: 'blue', onClick: () => togglePopup('employees')(true) },
    { title: 'Active Employees', value: stats.activeEmployees, subtitle: 'Currently active', icon: UserCheck, color: 'green', onClick: () => togglePopup('activeEmployees')(true) },
    { title: 'Pending Leaves', value: stats.pendingLeaves, subtitle: 'Awaiting approval', icon: Calendar, color: 'orange', onClick: () => togglePopup('leave')(true) },
    { title: "Today's Attendance", value: `${stats.todayPresent + stats.todayLate + stats.todayHalfDay}/${stats.activeEmployees}`, subtitle: `P:${stats.todayPresent} L:${stats.todayLate} H:${stats.todayHalfDay} Leave:${stats.todayOnLeave} A:${stats.todayAbsent}`, icon: Clock, color: 'purple', onClick: () => togglePopup('attendance')(true) },
    { title: 'Total Projects', value: stats.totalProjects, subtitle: `Active:${stats.activeProjects} Comp:${stats.completedProjects} Paused:${stats.pausedProjects}`, icon: FolderOpen, color: 'indigo', onClick: () => togglePopup('projects')(true) },
    { title: 'Marketing Posts', value: stats.digitalMarketingPosts, subtitle: 'Scheduled posts', icon: Camera, color: 'pink', onClick: () => togglePopup('marketing')(true) },
  ];

  if (empLoading || projLoading) return <div className="p-4 text-center">Loading dashboard...</div>;

  return (
    <div className="space-y-4 sm:space-y-6 px-3 sm:px-0 relative pb-20 sm:pb-0">
      {/* Idle Employees Alert - Collapsible on mobile? We'll keep as is but with scroll */}
      {idleUsers.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-yellow-50 border border-yellow-400 rounded-lg p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <AlertTriangle className="h-5 w-5 text-yellow-700" />
            <h3 className="font-semibold text-yellow-800 text-sm sm:text-base">Idle Employees Alert</h3>
            <Badge className="bg-yellow-200 text-yellow-800">{idleUsers.length}</Badge>
          </div>
          <div className="space-y-2 max-h-48 sm:max-h-64 overflow-y-auto">
            {idleUsers.map(user => {
              const emp = employees.find(e => e.id === user.id);
              return (
                <div key={user.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 bg-white rounded-lg shadow-sm border border-yellow-200 gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                      <Users className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm sm:text-base">{emp?.name || user.id}</p>
                      <p className="text-xs text-gray-500">{emp?.email}</p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="flex items-center gap-1 text-yellow-700 text-xs sm:text-sm">
                      <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="font-medium">Idle: {formatIdleTime(user.idleStartTime)}</span>
                    </div>
                    <p className="text-xs text-gray-400">Last active: {new Date(user.lastActive).toLocaleTimeString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Marketing popup notification */}
      {activeNotification && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 relative">
            <button onClick={() => setActiveNotification(null)} className="absolute top-3 right-3 text-gray-500"><X size={20} /></button>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-pink-100 text-pink-700"><Camera size={20} /></div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold">{activeNotification.post.platform} Post Due</h3>
                  <span className="bg-gray-100 px-2 py-0.5 rounded-full text-sm">{activeNotification.timer}s</span>
                </div>
                <p className="text-gray-700 text-sm mb-3">{activeNotification.post.content}</p>
                <p className="text-xs text-gray-500">Scheduled for {activeNotification.post.scheduledTime} by {activeNotification.post.createdByName}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-4 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 text-sm sm:text-base">Organisation overview</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
        {cards.map((card, idx) => (
          <DashboardCard key={card.title} {...card} delay={idx * 0.05} />
        ))}
      </div>

      {/* Lazy-loaded popups with mobile bottom-sheet behaviour */}
      <Suspense fallback={null}>
        {popups.attendance && (
          <AttendancePopup
            isOpen={popups.attendance}
            onClose={() => togglePopup('attendance')(false)}
            attendanceData={attendanceRecords.filter(r => new Date(r.date).toISOString().split('T')[0] === new Date().toISOString().split('T')[0])}
          />
        )}
        {popups.leave && (
          <LeavePopup isOpen={popups.leave} onClose={() => togglePopup('leave')(false)} leaveRequests={leaveRequests.filter(r => r.status === 'pending')} />
        )}
        {popups.employees && (
          <EmployeesPopup isOpen={popups.employees} onClose={() => togglePopup('employees')(false)} employees={employees} title="All Employees" />
        )}
        {popups.activeEmployees && (
          <EmployeesPopup isOpen={popups.activeEmployees} onClose={() => togglePopup('activeEmployees')(false)} employees={employees.filter(e => e.isActive)} title="Active Employees" />
        )}
        {popups.projects && (
          <ProjectsPopup isOpen={popups.projects} onClose={() => togglePopup('projects')(false)} projects={projects} />
        )}
        {popups.marketing && (
          <MarketingPostsPopup isOpen={popups.marketing} onClose={() => togglePopup('marketing')(false)} posts={marketingPosts} />
        )}
      </Suspense>
    </div>
  );
};

export default React.memo(AdminDashboardHome);