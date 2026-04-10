// AdminDashboardHome.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, UserCheck, Calendar, Clock, FolderOpen, Camera, Bell, X, AlertTriangle } from 'lucide-react';
import DashboardCard from './DashboardCard';
import AttendancePopup from './popups/AttendancePopup';
import LeavePopup from './popups/LeavePopup';
import EmployeesPopup from './popups/EmployeesPopup';
import ProjectsPopup from './popups/ProjectsPopup';
import MarketingPostsPopup from './popups/MarketingPostsPopup';
import { ref, onValue, off, query, orderByChild, DataSnapshot } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { DailyIdleReport } from './DailyIdleReport';
import { AttendanceRecord } from '@/types/attendance';
import { Project, Task, ProjectUpdate } from '@/types/project';
import {
  Employee,
  MarketingPost,
  LeaveRequest,
  IdleUser,
  FirebaseEmployee,
  ActivityData,
  IdleNotification,
} from '@/types/admin';



const AdminDashboardHome = () => {
  const [notifiedIdleIds, setNotifiedIdleIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [idleUsers, setIdleUsers] = useState<IdleUser[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [marketingPosts, setMarketingPosts] = useState<MarketingPost[]>([]);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [stats, setStats] = useState({
    
    totalEmployees: 0,
    activeEmployees: 0,
    pendingLeaves: 0,
    todayPresent: 0,
    todayLate: 0,
    todayHalfDay: 0,
    todayOnLeave: 0,
    todayAbsent: 0,
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    pausedProjects: 0,
    digitalMarketingPosts: 0
  });

  const [showAttendancePopup, setShowAttendancePopup] = useState(false);
  const [showLeavePopup, setShowLeavePopup] = useState(false);
  const [showEmployeesPopup, setShowEmployeesPopup] = useState(false);
  const [showActiveEmployeesPopup, setShowActiveEmployeesPopup] = useState(false);
  const [showProjectsPopup, setShowProjectsPopup] = useState(false);
  const [showMarketingPopup, setShowMarketingPopup] = useState(false);

  // Notification state
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [activeNotification, setActiveNotification] = useState<{
    post: MarketingPost;
    timer: number;
  } | null>(null);
  const [notificationTimeout, setNotificationTimeout] = useState<NodeJS.Timeout | null>(null);

  // Check and request notification permission
  useEffect(() => {
    if (!('Notification' in window)) {
      console.log('This browser does not support desktop notification');
      return;
    }

    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission);
      });
    } else {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Check for posts scheduled for today and upcoming posts
  useEffect(() => {
    if (marketingPosts.length === 0) return;

    const today = new Date();
    const todayDateString = today.toISOString().split('T')[0];

    const todayPosts = marketingPosts.filter(post => {
      return (
        post.scheduledDate === todayDateString && 
        post.status === 'scheduled'
      );
    });

    if (todayPosts.length > 0 && notificationPermission === 'granted') {
      showScheduledPostsNotification(todayPosts);
    }

    const checkInterval = setInterval(() => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      todayPosts.forEach(post => {
        const [hours, minutes] = post.scheduledTime.split(':').map(Number);
        
        if (currentHour === hours && currentMinute === minutes) {
          showCenteredPostNotification(post);
        }
        
        if (
          currentHour === hours && 
          currentMinute === minutes - 15 && 
          notificationPermission === 'granted'
        ) {
          showUpcomingPostNotification(post);
        }
      });
    }, 60000);

    return () => clearInterval(checkInterval);
  }, [marketingPosts, notificationPermission]);

  const showScheduledPostsNotification = (posts: MarketingPost[]) => {
    const notificationOptions: NotificationOptions = {
      body: `There are ${posts.length} marketing post(s) scheduled for today.`,
      icon: '/notification-icon.png',
      tag: 'today-marketing-posts-notification'
    };

    new Notification('Scheduled Marketing Posts', notificationOptions);
  };

  const showUpcomingPostNotification = (post: MarketingPost) => {
    const notificationOptions: NotificationOptions = {
      body: `Marketing post scheduled for ${post.scheduledTime}: ${post.content.substring(0, 50)}...`,
      icon: '/notification-icon.png',
      tag: 'upcoming-marketing-post-notification'
    };

    new Notification(`Upcoming ${post.platform} Post`, notificationOptions);
  };

  const showCenteredPostNotification = (post: MarketingPost) => {
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
      setNotificationTimeout(null);
    }

    setActiveNotification({
      post,
      timer: 10
    });

    const interval = setInterval(() => {
      setActiveNotification(prev => {
        if (prev && prev.timer > 1) {
          return { ...prev, timer: prev.timer - 1 };
        } else {
          clearInterval(interval);
          return null;
        }
      });
    }, 1000);

    const timeout = setTimeout(() => {
      setActiveNotification(null);
    }, 10000);

    setNotificationTimeout(timeout);
  };

  const closeNotification = () => {
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
      setNotificationTimeout(null);
    }
    setActiveNotification(null);
  };

  const getPlatformColor = (platform: string): string => {
    const colors: Record<string, string> = {
      'Facebook': 'bg-blue-100 text-blue-700',
      'Instagram': 'bg-pink-100 text-pink-700',
      'Twitter': 'bg-sky-100 text-sky-700',
      'LinkedIn': 'bg-indigo-100 text-indigo-700',
      'YouTube': 'bg-red-100 text-red-700',
      'TikTok': 'bg-purple-100 text-purple-700'
    };
    return colors[platform] || 'bg-gray-100 text-gray-700';
  };

  const requestNotificationPermission = () => {
    Notification.requestPermission().then(permission => {
      setNotificationPermission(permission);
      if (permission === 'granted') {
        toast.success('Notification permission granted!');
      } else {
        toast.error('You need to allow notifications for this feature');
      }
    });
  };

  // Fetch ALL employees from all admins
  useEffect(() => {
    if (!user) return;

    const employeesRef = ref(database, "users");
    const allEmployees: Employee[] = [];

const unsubscribeEmployees = onValue(employeesRef, (snapshot: DataSnapshot) => {
  const employeeMap = new Map<string, Employee>(); // Use Map to keep unique IDs

  if (snapshot.exists()) {
    snapshot.forEach((adminSnap: DataSnapshot) => {
      const employeesData = adminSnap.child("employees").val() as Record<string, FirebaseEmployee> | null;
      if (employeesData && typeof employeesData === 'object') {
        Object.entries(employeesData).forEach(([key, value]) => {
          // Only add if not already present
          if (!employeeMap.has(key)) {
            employeeMap.set(key, {
              id: key,
              name: value.name || '',
              email: value.email || '',
              phone: value.phone || '',
              department: value.department || '',
              designation: value.designation || '',
              createdAt: value.createdAt || '',
              employeeId: value.employeeId || `EMP-${key.slice(0, 8)}`,
              isActive: value.status === 'active',
              status: value.status || 'active',
              adminId: adminSnap.key || ''
            });
          }
        });
      }
    });
  }

  setEmployees(Array.from(employeeMap.values()));
  setInitialLoadComplete(true);
    }, (error: Error) => {
      console.error('Error fetching employees:', error);
      setInitialLoadComplete(true);
    });

    return () => {
      off(employeesRef);
    };
  }, [user]);

useEffect(() => {
  const activityRef = ref(database, 'activity');

  const unsubscribe = onValue(activityRef, (snapshot: DataSnapshot) => {
    const data = snapshot.val();
    const idleEmployees: IdleUser[] = [];

    if (data && typeof data === 'object') {
      Object.entries(data as Record<string, ActivityData>).forEach(([userId, userData]) => {
        if (userData.status === 'idle' || userData.isIdle === true) {
          idleEmployees.push({
            id: userId,
            idleStartTime: userData.idleStartTime || userData.timestamp || Date.now(),
            idleDuration: userData.idleDuration || 0,
            lastActive: userData.lastActive || Date.now(),
            status: userData.status || 'idle'
          });
        }
      });
    }

    // Sort by idle duration (longest first)
    idleEmployees.sort((a, b) => b.idleDuration - a.idleDuration);
    setIdleUsers(idleEmployees);

    // ✅ Browser notification for newly idle employees
    const newIdleIds = idleEmployees.map(u => u.id);
    const justBecameIdle = newIdleIds.filter(id => !notifiedIdleIds.has(id));

    if (justBecameIdle.length > 0 && notificationPermission === 'granted') {
      justBecameIdle.forEach(userId => {
        const employee = employees.find(e => e.id === userId);
        if (employee) {
          new Notification(`Idle Employee: ${employee.name}`, {
            body: `${employee.name} (${employee.email}) has been idle for more than 10 seconds.`,
            icon: '/notification-icon.png',
            tag: `idle-${userId}`,
          });
        }
      });
      setNotifiedIdleIds(new Set(newIdleIds));
    }

    // If employee is no longer idle, remove from notified set
    const noLongerIdle = Array.from(notifiedIdleIds).filter(id => !newIdleIds.includes(id));
    if (noLongerIdle.length > 0) {
      const updatedSet = new Set(notifiedIdleIds);
      noLongerIdle.forEach(id => updatedSet.delete(id));
      setNotifiedIdleIds(updatedSet);
    }
  });

  return () => unsubscribe();
}, [employees, notificationPermission, notifiedIdleIds]);
  
// Fetch ALL projects from all admins
// Fetch ALL projects from all admins
useEffect(() => {
  if (!user) return;

  const projectsRef = ref(database, "users");
  const allProjects: Project[] = [];

  // Define interface for raw task data from Firebase
  interface RawTaskData {
    id?: string;
    title?: string;
    description?: string;
    assignedTo?: string;
    status?: string;
    priority?: string;
    dueDate?: string;
    createdAt?: number | string;
    completedAt?: number | string;
  }

  // Helper to convert timestamp to ISO string
  const toISOString = (timestamp: number | string | undefined): string => {
    if (!timestamp) return new Date().toISOString();
    if (typeof timestamp === 'string') return timestamp;
    return new Date(timestamp).toISOString();
  };

  // Helper to map status string to union type
  const mapStatus = (status: string): Project['status'] => {
    switch (status) {
      case 'active': return 'in_progress';
      case 'paused': return 'on_hold';
      case 'completed': return 'completed';
      default: return 'not_started';
    }
  };

  // Helper to map priority string to union type
  const mapPriority = (priority: string): Project['priority'] => {
    switch (priority?.toLowerCase()) {
      case 'low': return 'low';
      case 'medium': return 'medium';
      case 'high': return 'high';
      case 'urgent': return 'urgent';
      default: return 'medium';
    }
  };

  const unsubscribeProjects = onValue(projectsRef, (snapshot: DataSnapshot) => {
    allProjects.length = 0;

    if (snapshot.exists()) {
      snapshot.forEach((adminSnap: DataSnapshot) => {
        const projectsData = adminSnap.child("projects").val() as Record<string, unknown> | null;

        if (projectsData && typeof projectsData === 'object') {
          Object.entries(projectsData).forEach(([key, value]) => {
            const projectRaw = value as Record<string, unknown>;

            // Extract tasks
           // Convert tasks from object (key-value) to array
const rawTasksObj = projectRaw.tasks as Record<string, RawTaskData> | undefined;
const mappedTasks: Task[] = rawTasksObj
  ? Object.values(rawTasksObj).map((task) => ({
      id: task.id || crypto.randomUUID(),
      title: task.title || '',
      description: task.description || '',
      assignedTo: task.assignedTo || '',
      status: (task.status as Task['status']) || 'pending',
      priority: (task.priority as Task['priority']) || 'medium',
      dueDate: task.dueDate || '',
      createdAt: toISOString(task.createdAt),
      completedAt: task.completedAt ? toISOString(task.completedAt) : undefined
    }))
  : [];

            const project: Project = {
              id: key,
              name: (projectRaw.name as string) || '',
              description: (projectRaw.description as string) || '',
              department: (projectRaw.department as string) || '',
              assignedTeamLeader: (projectRaw.assignedTeamLeader as string) || '',
              assignedEmployees: (projectRaw.assignedEmployees as string[]) || (projectRaw.assignedTo as string[]) || [],
              tasks: mappedTasks,
              startDate: (projectRaw.startDate as string) || '',
              endDate: (projectRaw.endDate as string) || '',
              priority: mapPriority(projectRaw.priority as string),
              status: mapStatus(projectRaw.status as string),
              progress: (projectRaw.progress as number) || 0,
              createdAt: toISOString(projectRaw.createdAt as number | string | undefined),
              createdBy: (projectRaw.createdBy as string) || '',
              lastUpdated: projectRaw.lastUpdated ? toISOString(projectRaw.lastUpdated as number | string) : undefined,
              updates: (projectRaw.updates as ProjectUpdate[]) || []
            };

            allProjects.push(project);
          });
        }
      });
    }

    setProjects([...allProjects]);
  }, (error: Error) => {
    console.error('Error fetching projects:', error);
  });

  return () => {
    off(projectsRef);
  };
}, [user]);

  // Fetch ALL leave requests from all employees across all admins
  useEffect(() => {
    if (!user || employees.length === 0) return;

    const allLeaveRequests: LeaveRequest[] = [];
    const leaveUnsubscribes: (() => void)[] = [];

    const employeesByAdmin = employees.reduce((acc, emp) => {
      if (emp.adminId) {
        if (!acc[emp.adminId]) acc[emp.adminId] = [];
        acc[emp.adminId].push(emp);
      }
      return acc;
    }, {} as Record<string, Employee[]>);

    Object.entries(employeesByAdmin).forEach(([adminId, adminEmployees]) => {
      adminEmployees.forEach(employee => {
        const leavesRef = ref(database, `users/${adminId}/employees/${employee.id}/leaves`);
        const leavesQuery = query(leavesRef, orderByChild('appliedAt'));
        
        const unsubscribe = onValue(leavesQuery, (snapshot: DataSnapshot) => {
          const data = snapshot.val();
          
          const index = allLeaveRequests.findIndex(r => r.employeeId === employee.id);
          if (index !== -1) {
            allLeaveRequests.splice(index, 1);
          }

          if (data && typeof data === 'object') {
            const requests: LeaveRequest[] = Object.entries(data as Record<string, Omit<LeaveRequest, 'id' | 'employeeId' | 'employeeName' | 'employeeEmail' | 'department' | 'adminId'>>).map(([key, value]) => ({
              id: key,
              employeeId: employee.id,
              employeeName: employee.name,
              employeeEmail: employee.email,
              department: employee.department || 'No Department',
              adminId: adminId,
              leaveType: value.leaveType,
              startDate: value.startDate,
              endDate: value.endDate,
              reason: value.reason,
              status: value.status,
              appliedAt: value.appliedAt
            }));
            
            allLeaveRequests.push(...requests);
          }
          
          setLeaveRequests([...allLeaveRequests].sort((a, b) => 
            new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
          ));
        });

        leaveUnsubscribes.push(unsubscribe);
      });
    });

    return () => {
      leaveUnsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [user, employees]);

  // Fetch ALL attendance records from all employees across all admins
  useEffect(() => {
    if (!user || employees.length === 0) return;

    const allAttendanceRecords: AttendanceRecord[] = [];
    const attendanceUnsubscribes: (() => void)[] = [];

    const employeesByAdmin = employees.reduce((acc, emp) => {
      if (emp.adminId) {
        if (!acc[emp.adminId]) acc[emp.adminId] = [];
        acc[emp.adminId].push(emp);
      }
      return acc;
    }, {} as Record<string, Employee[]>);

    Object.entries(employeesByAdmin).forEach(([adminId, adminEmployees]) => {
      adminEmployees.forEach(employee => {
        const attendanceRef = ref(database, `users/${adminId}/employees/${employee.id}/punching`);
        const attendanceQuery = query(attendanceRef, orderByChild('timestamp'));
        
        const unsubscribe = onValue(attendanceQuery, (snapshot: DataSnapshot) => {
          const data = snapshot.val();
          
          const index = allAttendanceRecords.findIndex(r => r.employeeId === employee.id);
          if (index !== -1) {
            allAttendanceRecords.splice(index, 1);
          }

          if (data && typeof data === 'object') {
            const records: AttendanceRecord[] = Object.entries(data as Record<string, Partial<AttendanceRecord>>).map(([key, value]) => {
              let hoursWorked = 0;
              if (value.punchIn && value.punchOut) {
                const punchInTime = new Date(`1970-01-01T${value.punchIn}`);
                const punchOutTime = new Date(`1970-01-01T${value.punchOut}`);
                hoursWorked = (punchOutTime.getTime() - punchInTime.getTime()) / (1000 * 60 * 60);
              }

              return {
                id: key,
                employeeId: employee.id,
                employeeName: employee.name,
                department: employee.department,
                adminId: adminId,
                date: value.date || '',
                punchIn: value.punchIn || '',
                punchOut: value.punchOut || null,
                status: value.status || 'absent',
                workMode: value.workMode || 'office',
                timestamp: value.timestamp || Date.now(),
                hoursWorked,
                breaks: value.breaks || {}
              };
            });
            
            allAttendanceRecords.push(...records);
          }
          
          setAttendanceRecords([...allAttendanceRecords].sort((a, b) => b.timestamp - a.timestamp));
        });

        attendanceUnsubscribes.push(unsubscribe);
      });
    });

    return () => {
      attendanceUnsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [user, employees]);

  // Fetch ALL marketing posts from digital marketing employees across all admins
  useEffect(() => {
    if (!user || employees.length === 0) return;

    const digitalMarketingEmployees = employees.filter(emp => emp.department === 'Digital Marketing');
    const allMarketingPosts: MarketingPost[] = [];
    const marketingUnsubscribes: (() => void)[] = [];

    const dmEmployeesByAdmin = digitalMarketingEmployees.reduce((acc, emp) => {
      if (emp.adminId) {
        if (!acc[emp.adminId]) acc[emp.adminId] = [];
        acc[emp.adminId].push(emp);
      }
      return acc;
    }, {} as Record<string, Employee[]>);

    Object.entries(dmEmployeesByAdmin).forEach(([adminId, adminEmployees]) => {
      adminEmployees.forEach(employee => {
        const postsRef = ref(database, `users/${adminId}/employees/${employee.id}/socialmedia`);
        const postsQuery = query(postsRef, orderByChild('createdAt'));
        
        const unsubscribe = onValue(postsQuery, (snapshot: DataSnapshot) => {
          const data = snapshot.val();
          
          const index = allMarketingPosts.findIndex(p => p.createdBy === employee.id);
          if (index !== -1) {
            allMarketingPosts.splice(index, 1);
          }

          if (data && typeof data === 'object') {
            const posts: MarketingPost[] = Object.entries(data as Record<string, Omit<MarketingPost, 'id' | 'adminId'>>).map(([key, value]) => ({
              id: key,
              adminId: adminId,
              platform: value.platform,
              content: value.content,
              scheduledDate: value.scheduledDate,
              scheduledTime: value.scheduledTime,
              postUrl: value.postUrl,
              imageUrl: value.imageUrl,
              status: value.status,
              createdBy: value.createdBy,
              createdByName: value.createdByName,
              department: value.department,
              createdAt: value.createdAt,
              updatedAt: value.updatedAt
            }));
            
            allMarketingPosts.push(...posts);
          }
          
          setMarketingPosts([...allMarketingPosts].sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ));
        });

        marketingUnsubscribes.push(unsubscribe);
      });
    });

    return () => {
      marketingUnsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [user, employees]);

  // Calculate stats
  useEffect(() => {
    if (employees.length > 0 || projects.length > 0 || marketingPosts.length > 0) {
      const activeCount = employees.filter(emp => emp.isActive).length;
      const today = new Date().toISOString().split('T')[0];
      
      const todayAttendance = attendanceRecords.filter(record => {
        const recordDate = new Date(record.date).toISOString().split('T')[0];
        return recordDate === today;
      });

      const todayPresent = todayAttendance.filter(a => a.status === 'present').length;
      const todayLate = todayAttendance.filter(a => a.status === 'late').length;
      const todayHalfDay = todayAttendance.filter(a => a.status === 'half-day' || 
        (a.hoursWorked && a.hoursWorked < 4)).length;
      const todayOnLeave = todayAttendance.filter(a => a.status === 'on-leave').length;
      const todayAbsent = activeCount - (todayPresent + todayLate + todayHalfDay + todayOnLeave);

      const pendingLeaves = leaveRequests.filter(request => 
        request.status === 'pending'
      ).length;

      const activeProjects = projects.filter(project => 
        project.status === 'in_progress'
      ).length;

      const completedProjects = projects.filter(project => 
        project.status === 'completed'
      ).length;

      const pausedProjects = projects.filter(project => 
        project.status === 'on_hold'
      ).length;

      setStats({
        totalEmployees: employees.length,
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
        digitalMarketingPosts: marketingPosts.length
      });
    }
  }, [employees, leaveRequests, attendanceRecords, projects, marketingPosts]);

  const formatIdleTime = (startTime: number): string => {
    const idleSeconds = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(idleSeconds / 60);
    const seconds = idleSeconds % 60;
    
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const dashboardCards = [
    {
      title: 'Total Employees',
      value: stats.totalEmployees,
      subtitle: 'All registered employees',
      icon: Users,
      color: 'from-blue-50 to-blue-100 text-blue-700',
      onClick: () => setShowEmployeesPopup(true)
    },
    {
      title: 'Active Employees',
      value: stats.activeEmployees,
      subtitle: 'Currently active workforce',
      icon: UserCheck,
      color: 'from-green-50 to-green-100 text-green-700',
      onClick: () => setShowActiveEmployeesPopup(true)
    },
    {
      title: 'Pending Leaves',
      value: stats.pendingLeaves,
      subtitle: 'Awaiting approval',
      icon: Calendar,
      color: 'from-orange-50 to-orange-100 text-orange-700',
      onClick: () => setShowLeavePopup(true)
    },
    {
      title: 'Today\'s Attendance',
      value: `${stats.todayPresent + stats.todayLate + stats.todayHalfDay}/${stats.activeEmployees}`,
      subtitle: `Present: ${stats.todayPresent} | Late: ${stats.todayLate} | Half-day: ${stats.todayHalfDay} | On Leave: ${stats.todayOnLeave} | Absent: ${stats.todayAbsent}`,
      icon: Clock,
      color: 'from-purple-50 to-purple-100 text-purple-700',
      onClick: () => setShowAttendancePopup(true)
    },
    {
      title: 'Total Projects',
      value: stats.totalProjects,
      subtitle: `Active: ${stats.activeProjects} | Completed: ${stats.completedProjects} | Paused: ${stats.pausedProjects}`,
      icon: FolderOpen,
      color: 'from-indigo-50 to-indigo-100 text-indigo-700',
      onClick: () => setShowProjectsPopup(true)
    },
    {
      title: 'Marketing Posts',
      value: stats.digitalMarketingPosts,
      subtitle: 'Scheduled posts',
      icon: Camera,
      color: 'from-pink-50 to-pink-100 text-pink-700',
      onClick: () => setShowMarketingPopup(true)
    }
  ];

  return (
    <div className="space-y-6 relative">
      {/* Idle Employees Alert Section - Enhanced */}
      {idleUsers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-50 border border-yellow-400 rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-yellow-700" />
            <h3 className="font-semibold text-yellow-800">Idle Employees Alert</h3>
            <Badge className="bg-yellow-200 text-yellow-800">{idleUsers.length} Employee(s)</Badge>
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {idleUsers.map((idleUser) => {
              const employee = employees.find(e => e.id === idleUser.id);
              const idleTimeFormatted = formatIdleTime(idleUser.idleStartTime);
              
              return (
                <div key={idleUser.id} className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border border-yellow-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{employee?.name || idleUser.id}</p>
                      <p className="text-sm text-gray-500">{employee?.email}</p>
                      {employee?.department && (
                        <p className="text-xs text-gray-400">{employee.department} • {employee.designation}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-yellow-700">
                      <Clock className="h-4 w-4" />
                      <span className="font-medium">Idle: {idleTimeFormatted}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Last active: {new Date(idleUser.lastActive).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-3 pt-2 border-t border-yellow-200">
            <p className="text-xs text-yellow-600">
              These employees have been inactive for more than 10 seconds. Consider checking in with them.
            </p>
          </div>
        </motion.div>
      )}
      
      {/* Centered Notification Popup */}
      {activeNotification && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50"
        >
          <motion.div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative"
            initial={{ y: -50 }}
            animate={{ y: 0 }}
          >
            <button
              onClick={closeNotification}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-full ${getPlatformColor(activeNotification.post.platform)}`}>
                <Camera className="h-6 w-6" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-lg">
                    {activeNotification.post.platform} Post Due Now
                  </h3>
                  <div className="bg-gray-100 px-2 py-1 rounded-full text-sm font-medium">
                    {activeNotification.timer}s
                  </div>
                </div>
                
                <p className="text-gray-700 mb-4">{activeNotification.post.content}</p>
                
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Scheduled for {activeNotification.post.scheduledTime} by {activeNotification.post.createdByName}
                  </span>
                </div>
                
                {activeNotification.post.postUrl && (
                  <div className="mt-3">
                    <a
                      href={activeNotification.post.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                    >
                      <Bell className="h-4 w-4" />
                      View Post Link
                    </a>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Interactive overview of your organization's workforce and activities</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dashboardCards.map((card, index) => (
          <DashboardCard
            key={card.title}
            title={card.title}
            value={card.value}
            subtitle={card.subtitle}
            icon={card.icon}
            color={card.color}
            onClick={card.onClick}
            delay={index * 0.1}
          />
        ))}
        
      </div>
      <div className="mt-6">
  <DailyIdleReport />
</div>
     

      <AttendancePopup
        isOpen={showAttendancePopup}
        onClose={() => setShowAttendancePopup(false)}
        attendanceData={attendanceRecords.filter(record => {
          const today = new Date().toISOString().split('T')[0];
          const recordDate = new Date(record.date).toISOString().split('T')[0];
          return recordDate === today;
        })}
      />

      <LeavePopup
        isOpen={showLeavePopup}
        onClose={() => setShowLeavePopup(false)}
        leaveRequests={leaveRequests.filter(request => request.status === 'pending')}
      />

      <EmployeesPopup
        isOpen={showEmployeesPopup}
        onClose={() => setShowEmployeesPopup(false)}
        employees={employees}
        title="All Employees"
      />

      <EmployeesPopup
        isOpen={showActiveEmployeesPopup}
        onClose={() => setShowActiveEmployeesPopup(false)}
        employees={employees.filter(emp => emp.isActive)}
        title="Active Employees"
      />

      <ProjectsPopup
        isOpen={showProjectsPopup}
        onClose={() => setShowProjectsPopup(false)}
        projects={projects}
      />

      <MarketingPostsPopup
        isOpen={showMarketingPopup}
        onClose={() => setShowMarketingPopup(false)}
        posts={marketingPosts}
      />
    </div>
  );
};

export default AdminDashboardHome;