import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Calendar, Users, TrendingUp, BarChart3, Clock, AlertTriangle, X, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, get } from 'firebase/database';
import { toast } from '../ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

// ========== TYPES ==========
interface Employee {
  id: string;
  name: string;
  email: string;
  department?: string;
  designation?: string;
  status: string;
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  punchIn: string;
  punchOut: string | null;
  status: string;
  workMode: string;
  timestamp: number;
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  approvedBy?: string;
}

interface DailyTask {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  taskTitle: string;
  taskType: string;
  priority: string;
  assignedBy: string;
  assignedDate: string;
  startTime: string;
  endTime: string;
  totalDuration: string;
  status: string;
  workSummary: string;
  pendingWork: string;
  challenges: string;
  verifiedBy: string;
  managerRemarks: string;
  employeeRemarks: string;
  attachments: string[];
  date: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  department: string;
  startDate: string;
  endDate: string;
  priority: string;
  status: string;
  progress: number;
  createdAt: string;
  createdBy: string;
  assignedTeamLeader?: string;
  assignedEmployees?: string[];
}

// Firebase raw structures
interface RawUserData {
  role?: string;
  name?: string;
  email?: string;
  department?: string;
  designation?: string;
  status?: string;
  employees?: Record<string, RawEmployeeData>;
  [key: string]: unknown;
}

interface RawEmployeeData {
  name?: string;
  email?: string;
  department?: string;
  designation?: string;
  status?: string;
  [key: string]: unknown;
}

interface RawAttendance {
  date?: string;
  punchIn?: string;
  punchOut?: string | null;
  status?: string;
  workMode?: string;
  timestamp?: number;
  [key: string]: unknown;
}

interface RawLeave {
  leaveType?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
  status?: string;
  appliedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  approvedBy?: string;
  [key: string]: unknown;
}

interface RawDailyTask {
  taskTitle?: string;
  taskType?: string;
  priority?: string;
  assignedBy?: string;
  assignedDate?: string;
  startTime?: string;
  endTime?: string;
  totalDuration?: string;
  status?: string;
  workSummary?: string;
  pendingWork?: string;
  challenges?: string;
  verifiedBy?: string;
  managerRemarks?: string;
  employeeRemarks?: string;
  attachments?: string[];
  date?: string;
  [key: string]: unknown;
}

interface RawProject {
  name?: string;
  description?: string;
  department?: string;
  startDate?: string;
  endDate?: string;
  priority?: string;
  status?: string;
  progress?: number;
  createdAt?: string;
  createdBy?: string;
  assignedTeamLeader?: string;
  assignedEmployees?: string[];
  [key: string]: unknown;
}
interface ReportsManagementProps {
  role?: 'admin' | 'manager' | 'team_leader' | 'client';
  department?: string;
}
// Helper: safe string
const safeString = (obj: Record<string, unknown>, key: string, defaultValue = ''): string => {
  const val = obj[key];
  return typeof val === 'string' ? val : defaultValue;
};

// Helper: safe number
const safeNumber = (obj: Record<string, unknown>, key: string, defaultValue = 0): number => {
  const val = obj[key];
  return typeof val === 'number' ? val : defaultValue;
};

// Helper: safe date
const safeDate = (val: unknown): string => {
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return new Date(val).toISOString().split('T')[0];
  return '';
};

const ReportsManagement: React.FC<ReportsManagementProps> = ({ 
  role = 'admin', 
  department: propDepartment 
}) => {
  const { user } = useAuth();
  const effectiveRole = role;
  const effectiveDepartment = propDepartment || user?.department || '';
  const isAdmin = effectiveRole === 'admin';
  const isManager = effectiveRole === 'manager';

  const [reportType, setReportType] = useState<'attendance' | 'leaves' | 'dailyTasks' | 'projects'>('attendance');
  const [dateRange, setDateRange] = useState('thisMonth');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState({
    employees: false,
    attendance: false,
    leaves: false,
    dailyTasks: false,
    projects: false
  });
  const [showAllData, setShowAllData] = useState(false);
  const [modalDateFilter, setModalDateFilter] = useState('');
  const [selectedTask, setSelectedTask] = useState<DailyTask | null>(null);
  const [showTaskDetails, setShowTaskDetails] = useState(false);

  useEffect(() => {
    if (isManager && effectiveDepartment) {
      setDepartmentFilter(effectiveDepartment);
    }
  }, [isManager, effectiveDepartment]);

  // ================= FETCH ALL EMPLOYEES =================
  useEffect(() => {
    if (!user?.id) return;

    const fetchEmployees = async () => {
      try {
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);
        const usersData = snapshot.val() as Record<string, RawUserData> | null;
        const employeesList: Employee[] = [];
        if (usersData) {
          for (const [uid, userData] of Object.entries(usersData)) {
            if (userData.role === 'admin' || userData.role === 'super_admin') continue;
           const profile = (userData.profile || userData.employee) as RawEmployeeData | undefined;
// ✅ Only include active employees
if (profile?.status !== 'active') continue;
const department = profile?.department || '';
employeesList.push({
  id: uid,
  name: profile?.name || userData.name || `Employee ${uid.slice(0, 6)}`,
  email: profile?.email || userData.email || '',
  department: department,
  designation: profile?.designation || '',
  status: profile?.status || 'active'
});
          }
        }
        setEmployees(employeesList);
        console.log(`✅ Loaded ${employeesList.length} employees for reports`);
      } catch (error) {
        console.error('Error fetching employees:', error);
        toast({ title: 'Error', description: 'Failed to load employee data', variant: 'destructive' });
      } finally {
        setDataLoaded(prev => ({ ...prev, employees: true }));
      }
    };

    fetchEmployees();
  }, [user, isManager, effectiveDepartment]);

  // ================= FETCH ATTENDANCE DATA =================
  useEffect(() => {
    if (!user?.id || reportType !== 'attendance') return;

    const fetchAttendanceData = async () => {
      setLoading(true);
      try {
        const usersSnap = await get(ref(database, 'users'));
        const usersData = usersSnap.val() as Record<string, RawUserData> | null;
        if (!usersData) {
          setAttendanceRecords([]);
          setDataLoaded(prev => ({ ...prev, attendance: true }));
          setLoading(false);
          return;
        }

        const allRecords: AttendanceRecord[] = [];

        for (const [adminId, adminData] of Object.entries(usersData)) {
          if (adminData.role !== 'admin') continue;
          const employeesNode = adminData.employees;
          if (!employeesNode) continue;

          for (const [empId, empData] of Object.entries(employeesNode)) {
            const attendanceRef = ref(database, `users/${adminId}/employees/${empId}/punching`);
            const attendanceSnap = await get(attendanceRef);
            const records = attendanceSnap.val() as Record<string, RawAttendance> | null;
            if (!records) continue;

            for (const [recId, rec] of Object.entries(records)) {
              allRecords.push({
                id: recId,
                employeeId: empId,
                employeeName: safeString(empData, 'name', 'Unknown'),
                date: safeDate(rec.date),
                punchIn: safeString(rec, 'punchIn'),
                punchOut: rec.punchOut !== undefined ? (typeof rec.punchOut === 'string' ? rec.punchOut : null) : null,
                status: safeString(rec, 'status', 'present'),
                workMode: safeString(rec, 'workMode', 'office'),
                timestamp: safeNumber(rec, 'timestamp', Date.now()),
              });
            }
          }
        }

        setAttendanceRecords(allRecords);
        console.log(`✅ Loaded ${allRecords.length} attendance records`);
      } catch (error) {
        console.error('Error fetching attendance records:', error);
        toast({ title: 'Error', description: 'Failed to load attendance data', variant: 'destructive' });
      } finally {
        setDataLoaded(prev => ({ ...prev, attendance: true }));
        setLoading(false);
      }
    };

    fetchAttendanceData();
  }, [user, reportType]);

  // ================= FETCH LEAVE DATA =================
  useEffect(() => {
    if (!user?.id || reportType !== 'leaves') return;

    const fetchLeaveData = async () => {
      setLoading(true);
      try {
        const usersSnap = await get(ref(database, 'users'));
        const usersData = usersSnap.val() as Record<string, RawUserData> | null;
        if (!usersData) {
          setLeaveRequests([]);
          setDataLoaded(prev => ({ ...prev, leaves: true }));
          setLoading(false);
          return;
        }

        const allLeaves: LeaveRequest[] = [];

        for (const [adminId, adminData] of Object.entries(usersData)) {
          if (adminData.role !== 'admin') continue;
          const employeesNode = adminData.employees;
          if (!employeesNode) continue;

          for (const [empId, empData] of Object.entries(employeesNode)) {
            const leavesRef = ref(database, `users/${adminId}/employees/${empId}/leaves`);
            const leavesSnap = await get(leavesRef);
            const leaves = leavesSnap.val() as Record<string, RawLeave> | null;
            if (!leaves) continue;

            for (const [leaveId, leave] of Object.entries(leaves)) {
              allLeaves.push({
                id: leaveId,
                employeeId: empId,
                employeeName: safeString(empData, 'name', 'Unknown'),
                department: safeString(empData, 'department', 'No Department'),
                leaveType: safeString(leave, 'leaveType'),
                startDate: safeDate(leave.startDate),
                endDate: safeDate(leave.endDate),
                reason: safeString(leave, 'reason'),
                status: (leave.status as 'pending' | 'approved' | 'rejected') || 'pending',
                appliedAt: safeDate(leave.appliedAt) || new Date().toISOString(),
                approvedAt: leave.approvedAt ? safeDate(leave.approvedAt) : undefined,
                rejectedAt: leave.rejectedAt ? safeDate(leave.rejectedAt) : undefined,
                approvedBy: safeString(leave, 'approvedBy'),
              });
            }
          }
        }

        setLeaveRequests(allLeaves);
        console.log(`✅ Loaded ${allLeaves.length} leave requests`);
      } catch (error) {
        console.error('Error fetching leave requests:', error);
        toast({ title: 'Error', description: 'Failed to load leave data', variant: 'destructive' });
      } finally {
        setDataLoaded(prev => ({ ...prev, leaves: true }));
        setLoading(false);
      }
    };

    fetchLeaveData();
  }, [user, reportType]);

  // ================= FETCH DAILY TASKS DATA =================
  useEffect(() => {
    if (!user?.id || reportType !== 'dailyTasks') return;

    const fetchDailyTasks = async () => {
      setLoading(true);
      try {
        const usersSnap = await get(ref(database, 'users'));
        const usersData = usersSnap.val() as Record<string, RawUserData> | null;
        if (!usersData) {
          setDailyTasks([]);
          setDataLoaded(prev => ({ ...prev, dailyTasks: true }));
          setLoading(false);
          return;
        }

        const allTasks: DailyTask[] = [];

        for (const [adminId, adminData] of Object.entries(usersData)) {
          if (adminData.role !== 'admin') continue;
          const employeesNode = adminData.employees;
          if (!employeesNode) continue;

          for (const [empId, empData] of Object.entries(employeesNode)) {
            const tasksRef = ref(database, `users/${adminId}/employees/${empId}/dailyTasks`);
            const tasksSnap = await get(tasksRef);
            const tasks = tasksSnap.val() as Record<string, RawDailyTask> | null;
            if (!tasks) continue;

            for (const [taskId, task] of Object.entries(tasks)) {
              allTasks.push({
                id: taskId,
                employeeId: empId,
                employeeName: safeString(empData, 'name', 'Unknown'),
                department: safeString(empData, 'department', 'No Department'),
                designation: safeString(empData, 'designation', 'No Designation'),
                taskTitle: safeString(task, 'taskTitle'),
                taskType: safeString(task, 'taskType'),
                priority: safeString(task, 'priority'),
                assignedBy: safeString(task, 'assignedBy'),
                assignedDate: safeDate(task.assignedDate),
                startTime: safeString(task, 'startTime'),
                endTime: safeString(task, 'endTime'),
                totalDuration: safeString(task, 'totalDuration'),
                status: safeString(task, 'status'),
                workSummary: safeString(task, 'workSummary'),
                pendingWork: safeString(task, 'pendingWork'),
                challenges: safeString(task, 'challenges'),
                verifiedBy: safeString(task, 'verifiedBy'),
                managerRemarks: safeString(task, 'managerRemarks'),
                employeeRemarks: safeString(task, 'employeeRemarks'),
                attachments: Array.isArray(task.attachments) ? task.attachments : [],
                date: safeDate(task.date),
              });
            }
          }
        }

        setDailyTasks(allTasks);
        console.log(`✅ Loaded ${allTasks.length} daily tasks`);
      } catch (error) {
        console.error('Error fetching daily tasks:', error);
        toast({ title: 'Error', description: 'Failed to load daily tasks data', variant: 'destructive' });
      } finally {
        setDataLoaded(prev => ({ ...prev, dailyTasks: true }));
        setLoading(false);
      }
    };

    fetchDailyTasks();
  }, [user, reportType]);

  // ================= FETCH PROJECTS DATA (new) =================
  useEffect(() => {
    if (!user?.id || reportType !== 'projects') return;

    const fetchProjects = async () => {
      setLoading(true);
      try {
        const projectsRef = ref(database, 'projects');
        const snapshot = await get(projectsRef);
        const data = snapshot.val() as Record<string, RawProject> | null;
        const projectsList: Project[] = [];
        if (data) {
          for (const [projId, proj] of Object.entries(data)) {
            projectsList.push({
              id: projId,
              name: proj.name || '',
              description: proj.description || '',
              department: proj.department || '',
              startDate: proj.startDate || '',
              endDate: proj.endDate || '',
              priority: proj.priority || 'medium',
              status: proj.status || 'not_started',
              progress: proj.progress || 0,
              createdAt: proj.createdAt || new Date().toISOString(),
              createdBy: proj.createdBy || '',
              assignedTeamLeader: proj.assignedTeamLeader,
              assignedEmployees: proj.assignedEmployees || []
            });
          }
        }
        setProjects(projectsList);
        console.log(`✅ Loaded ${projectsList.length} projects`);
      } catch (error) {
        console.error('Error fetching projects:', error);
        toast({ title: 'Error', description: 'Failed to load project data', variant: 'destructive' });
      } finally {
        setDataLoaded(prev => ({ ...prev, projects: true }));
        setLoading(false);
      }
    };

    fetchProjects();
  }, [user, reportType]);

  // ================= FILTERING LOGIC =================
  const getFilteredData = () => {
    let filteredAttendance: AttendanceRecord[] = [];
    let filteredLeaves: LeaveRequest[] = [];
    let filteredDailyTasks: DailyTask[] = [];
    let filteredProjects: Project[] = [];
    
    const now = new Date();
    let startDate: Date, endDate: Date;
    
    switch (dateRange) {
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'thisYear':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      case 'custom':
        if (!customStartDate || !customEndDate) {
          startDate = new Date(0);
          endDate = new Date();
        } else {
          startDate = new Date(customStartDate);
          endDate = new Date(customEndDate);
        }
        break;
      default:
        startDate = new Date(0);
        endDate = new Date();
    }
    
    if (reportType === 'attendance' && dataLoaded.attendance) {
      filteredAttendance = attendanceRecords.filter(record => {
        try {
          const recordDate = new Date(record.date);
          const employee = employees.find(e => e.id === record.employeeId);
          const deptOk = departmentFilter === 'all' || 
            (employee?.department === departmentFilter) ||
            (departmentFilter === 'No Department' && !employee?.department);
          return recordDate >= startDate && recordDate <= endDate && deptOk;
        } catch { return false; }
      });
    }
    
    if (reportType === 'leaves' && dataLoaded.leaves) {
      filteredLeaves = leaveRequests.filter(request => {
        try {
          const appliedDate = new Date(request.appliedAt);
          const employee = employees.find(e => e.id === request.employeeId);
          const deptOk = departmentFilter === 'all' || 
            (employee?.department === departmentFilter) ||
            (departmentFilter === 'No Department' && !employee?.department);
          return appliedDate >= startDate && appliedDate <= endDate && deptOk;
        } catch { return false; }
      });
    }
    
    if (reportType === 'dailyTasks' && dataLoaded.dailyTasks) {
      filteredDailyTasks = dailyTasks.filter(task => {
        try {
          const taskDate = new Date(task.date);
          const employee = employees.find(e => e.id === task.employeeId);
          const deptOk = departmentFilter === 'all' || 
            (employee?.department === departmentFilter) ||
            (departmentFilter === 'No Department' && !employee?.department);
          return taskDate >= startDate && taskDate <= endDate && deptOk;
        } catch { return false; }
      });
    }
    
    if (reportType === 'projects' && dataLoaded.projects) {
      filteredProjects = projects.filter(proj => {
        try {
          const createdDate = new Date(proj.createdAt);
          const deptOk = departmentFilter === 'all' || 
            (proj.department === departmentFilter) ||
            (departmentFilter === 'No Department' && !proj.department);
          return createdDate >= startDate && createdDate <= endDate && deptOk;
        } catch { return false; }
      });
    }
    
    return { filteredAttendance, filteredLeaves, filteredDailyTasks, filteredProjects };
  };

  const { filteredAttendance, filteredLeaves, filteredDailyTasks, filteredProjects } = getFilteredData();

  // ================= DEPARTMENT-WISE DATA =================
const getDepartmentWiseData = () => {
  let departments = Array.from(new Set(employees.map(emp => emp.department || 'No Department')));
  if (isManager && effectiveDepartment) departments = [effectiveDepartment];

  if (reportType === 'attendance') {
    return departments
      .map(dept => {
        const deptEmployees = dept === 'No Department' ? employees.filter(emp => !emp.department) : employees.filter(emp => emp.department === dept);
        const deptRecords = filteredAttendance.filter(r => deptEmployees.some(e => e.id === r.employeeId));
        return {
          department: dept,
          present: deptRecords.filter(r => r.status === 'present').length,
          absent: deptRecords.filter(r => r.status === 'absent').length,
          late: deptRecords.filter(r => r.status === 'late').length,
          total: deptRecords.length,
          percentage: deptRecords.length ? Math.round((deptRecords.filter(r => r.status === 'present').length / deptRecords.length) * 100) : 0,
        };
      })
      .filter(deptData => deptData.total > 0); // ✅ hide departments with no records
  } else if (reportType === 'leaves') {
    return departments
      .map(dept => {
        const deptEmployees = dept === 'No Department' ? employees.filter(emp => !emp.department) : employees.filter(emp => emp.department === dept);
        const deptLeaves = filteredLeaves.filter(l => deptEmployees.some(e => e.id === l.employeeId));
        return {
          department: dept,
          approved: deptLeaves.filter(l => l.status === 'approved').length,
          pending: deptLeaves.filter(l => l.status === 'pending').length,
          rejected: deptLeaves.filter(l => l.status === 'rejected').length,
          total: deptLeaves.length,
        };
      })
      .filter(deptData => deptData.total > 0);
  } else if (reportType === 'dailyTasks') {
    return departments
      .map(dept => {
        const deptEmployees = dept === 'No Department' ? employees.filter(emp => !emp.department) : employees.filter(emp => emp.department === dept);
        const deptTasks = filteredDailyTasks.filter(t => deptEmployees.some(e => e.id === t.employeeId));
        return {
          department: dept,
          completed: deptTasks.filter(t => t.status === 'completed').length,
          inProgress: deptTasks.filter(t => t.status === 'in-progress').length,
          pending: deptTasks.filter(t => t.status === 'pending').length,
          total: deptTasks.length,
        };
      })
      .filter(deptData => deptData.total > 0);
  } else {
    // Projects
    return departments
      .map(dept => {
        const deptProjects = filteredProjects.filter(p => {
          if (dept === 'No Department') return !p.department;
          return p.department === dept;
        });
        return {
          department: dept,
          total: deptProjects.length,
          completed: deptProjects.filter(p => p.status === 'completed').length,
          inProgress: deptProjects.filter(p => p.status === 'in_progress' || p.status === 'active').length,
          pending: deptProjects.filter(p => p.status === 'not_started' || p.status === 'pending').length,
          onHold: deptProjects.filter(p => p.status === 'on_hold').length,
          averageProgress: deptProjects.length ? Math.round(deptProjects.reduce((sum, p) => sum + (p.progress || 0), 0) / deptProjects.length) : 0,
        };
      })
      .filter(deptData => deptData.total > 0);
  }
};
  const departmentData = getDepartmentWiseData();

  // ================= EXPORT REPORT =================
  const exportReport = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const currentDate = new Date().toLocaleDateString();
    let csvContent = '';

    if (reportType === 'attendance') {
      csvContent = [
        [`Attendance Report - Generated on ${currentDate}`],
        [''],
        ['Employee Name', 'Employee ID', 'Department', 'Date', 'Punch In', 'Punch Out', 'Status', 'Work Mode'],
        ...filteredAttendance.map(record => {
          const employee = employees.find(e => e.id === record.employeeId);
          return [
            `"${record.employeeName}"`,
            record.employeeId,
            employee?.department || 'No Department',
            new Date(record.date).toLocaleDateString(),
            record.punchIn || '-',
            record.punchOut || '-',
            record.status,
            record.workMode || 'office'
          ];
        })
      ].map(row => row.join(',')).join('\n');
    } else if (reportType === 'leaves') {
      csvContent = [
        [`Leave Report - Generated on ${currentDate}`],
        [''],
        ['Employee Name', 'Employee ID', 'Department', 'Leave Type', 'Start Date', 'End Date', 'Duration', 'Status', 'Reason', 'Applied At'],
        ...filteredLeaves.map(request => [
          `"${request.employeeName}"`,
          request.employeeId,
          request.department,
          request.leaveType,
          new Date(request.startDate).toLocaleDateString(),
          new Date(request.endDate).toLocaleDateString(),
          `${calculateDays(request.startDate, request.endDate)} days`,
          request.status,
          `"${request.reason}"`,
          new Date(request.appliedAt).toLocaleString()
        ])
      ].map(row => row.join(',')).join('\n');
    } else if (reportType === 'dailyTasks') {
      csvContent = [
        [`Daily Tasks Report - Generated on ${currentDate}`],
        [''],
        ['Employee Name', 'Employee ID', 'Department', 'Task Title', 'Task Type', 'Priority', 'Status', 'Date', 'Duration', 'Assigned By'],
        ...filteredDailyTasks.map(task => [
          `"${task.employeeName}"`,
          task.employeeId,
          task.department,
          `"${task.taskTitle}"`,
          task.taskType,
          task.priority,
          task.status,
          new Date(task.date).toLocaleDateString(),
          task.totalDuration,
          task.assignedBy
        ])
      ].map(row => row.join(',')).join('\n');
    } else if (reportType === 'projects') {
      csvContent = [
        [`Project Report - Generated on ${currentDate}`],
        [''],
        ['Project Name', 'Department', 'Start Date', 'End Date', 'Status', 'Progress (%)', 'Created At', 'Team Leader', 'Team Size', 'Priority'],
        ...filteredProjects.map(p => [
          `"${p.name}"`,
          p.department || 'No Department',
          p.startDate ? new Date(p.startDate).toLocaleDateString() : '',
          p.endDate ? new Date(p.endDate).toLocaleDateString() : '',
          p.status,
          p.progress,
          new Date(p.createdAt).toLocaleDateString(),
          p.assignedTeamLeader || '-',
          p.assignedEmployees?.length || 0,
          p.priority
        ])
      ].map(row => row.join(',')).join('\n');
    }

    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportType}-report-${timestamp}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Report Exported', description: `The ${reportType} report has been downloaded successfully.` });
    } catch (error) {
      console.error('Error exporting report:', error);
      toast({ title: 'Export Failed', description: 'Failed to export the report', variant: 'destructive' });
    }
  };

  const calculateDays = (start: string, end: string) => {
    try {
      return Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    } catch { return 0; }
  };

  const formatDate = (dateString: string) => {
    try { return new Date(dateString).toLocaleDateString(); } catch { return dateString; }
  };

  const getTaskStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-100 text-green-700">Completed</Badge>;
      case 'in-progress': return <Badge className="bg-blue-100 text-blue-700">In Progress</Badge>;
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
      case 'cancelled': return <Badge className="bg-red-100 text-red-700">Cancelled</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getTaskPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <Badge variant="destructive">High</Badge>;
      case 'medium': return <Badge className="bg-yellow-100 text-yellow-700">Medium</Badge>;
      case 'low': return <Badge className="bg-green-100 text-green-700">Low</Badge>;
      default: return <Badge>{priority}</Badge>;
    }
  };

  const getDepartments = () => {
    if (isManager && effectiveDepartment) return ['all', effectiveDepartment];
    const depts = Array.from(new Set(employees.map(emp => emp.department || 'No Department')));
    return ['all', ...depts];
  };

  const getFilteredDailyTasksForModal = () => {
    if (!modalDateFilter) return filteredDailyTasks;
    return filteredDailyTasks.filter(task => {
      try {
        const taskDate = new Date(task.date).toISOString().split('T')[0];
        return taskDate === modalDateFilter;
      } catch { return false; }
    });
  };

  const filteredModalTasks = getFilteredDailyTasksForModal();

  const handleViewTask = (task: DailyTask) => {
    setSelectedTask(task);
    setShowTaskDetails(true);
  };

  if (loading || !dataLoaded.employees || 
      (reportType === 'attendance' && !dataLoaded.attendance) || 
      (reportType === 'leaves' && !dataLoaded.leaves) ||
      (reportType === 'dailyTasks' && !dataLoaded.dailyTasks) ||
      (reportType === 'projects' && !dataLoaded.projects)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        <p className="text-gray-600">Loading report data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reports Management</h1>
          <p className="text-gray-600">Generate and export detailed reports across the organization</p>
        </div>
        <Badge variant="outline" className="px-3 py-1">{employees.length} Employees</Badge>
      </motion.div>

      {/* Report Configuration */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Report Configuration</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Report Type</label>
                <Select value={reportType} onValueChange={(value: string) => { setReportType(value as typeof reportType); setLoading(true); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attendance">Attendance</SelectItem>
                    <SelectItem value="leaves">Leave</SelectItem>
                    <SelectItem value="dailyTasks">Daily Tasks</SelectItem>
                    <SelectItem value="projects">Projects</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Date Range</label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thisMonth">This Month</SelectItem>
                    <SelectItem value="lastMonth">Last Month</SelectItem>
                    <SelectItem value="thisYear">This Year</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {dateRange === 'custom' && (
                <>
                  <div><label className="text-sm font-medium">Start Date</label><Input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} /></div>
                  <div><label className="text-sm font-medium">End Date</label><Input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} /></div>
                </>
              )}
              <div className="space-y-1">
                <label className="text-sm font-medium">Department</label>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter} disabled={isManager}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {getDepartments().filter(d => d !== 'all').map((dept, idx) => <SelectItem key={idx} value={dept}>{dept}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={exportReport} className="w-full" disabled={loading || 
                  (reportType === 'attendance' && filteredAttendance.length === 0) ||
                  (reportType === 'leaves' && filteredLeaves.length === 0) ||
                  (reportType === 'dailyTasks' && filteredDailyTasks.length === 0) ||
                  (reportType === 'projects' && filteredProjects.length === 0)}>
                  <Download className="h-4 w-4 mr-2" /> Export Report
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Summary Cards */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="p-4"><div className="flex justify-between"><div><p className="text-sm text-gray-500">Total {reportType === 'attendance' ? 'Records' : reportType === 'leaves' ? 'Requests' : reportType === 'dailyTasks' ? 'Tasks' : 'Projects'}</p><p className="text-2xl font-bold">{reportType === 'attendance' ? filteredAttendance.length : reportType === 'leaves' ? filteredLeaves.length : reportType === 'dailyTasks' ? filteredDailyTasks.length : filteredProjects.length}</p></div><div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center"><FileText className="h-5 w-5 text-blue-600" /></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex justify-between"><div><p className="text-sm text-gray-500">Items Covered</p><p className="text-2xl font-bold">{reportType === 'attendance' ? new Set(filteredAttendance.map(r => r.employeeId)).size : reportType === 'leaves' ? new Set(filteredLeaves.map(r => r.employeeId)).size : reportType === 'dailyTasks' ? new Set(filteredDailyTasks.map(r => r.employeeId)).size : filteredProjects.length}</p></div><div className="w-10 h-10 bg-green-100 rounded-full"><Users className="h-5 w-5 text-green-600" /></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex justify-between"><div><p className="text-sm text-gray-500">Departments</p><p className="text-2xl font-bold">{new Set(departmentData.map(d => d.department)).size}</p></div><div className="w-10 h-10 bg-purple-100"><BarChart3 className="h-5 w-5 text-purple-600" /></div></div></CardContent></Card>
        </div>
      </motion.div>

      {/* Department-wise Data */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Department-wise {reportType === 'attendance' ? 'Attendance' : reportType === 'leaves' ? 'Leave Summary' : reportType === 'dailyTasks' ? 'Task Summary' : 'Project Summary'}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departmentData.map((dept, idx) => (
                <Card key={idx} className="border">
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg mb-2">{dept.department}</h3>
                    {/* Attendance */}
                    {reportType === 'attendance' && (
                      <div className="space-y-1 text-sm">
                        <p>Present: {dept.present} / {dept.total}</p>
                        <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-green-500 h-2 rounded-full" style={{ width: `${dept.percentage}%` }} /></div>
                        <p>Attendance Rate: {dept.percentage}%</p>
                        <p>Late: {dept.late} | Absent: {dept.absent}</p>
                      </div>
                    )}
                    {/* Leaves */}
                    {reportType === 'leaves' && (
                      <div className="space-y-1 text-sm">
                        <p>Approved: {dept.approved}</p><p>Pending: {dept.pending}</p><p>Rejected: {dept.rejected}</p><p>Total Requests: {dept.total}</p>
                      </div>
                    )}
                    {/* Daily Tasks */}
                    {reportType === 'dailyTasks' && (
                      <div className="space-y-1 text-sm">
                        <p>Completed: {dept.completed}</p><p>In Progress: {dept.inProgress}</p><p>Pending: {dept.pending}</p><p>Total Tasks: {dept.total}</p>
                      </div>
                    )}
                    {/* Projects */}
                    {reportType === 'projects' && (
                      <div className="space-y-1 text-sm">
                        <p>Total Projects: {dept.total}</p>
                        <p>Completed: {dept.completed}</p>
                        <p>In Progress: {dept.inProgress}</p>
                        <p>Pending: {dept.pending}</p>
                        <p>On Hold: {dept.onHold}</p>
                        <p>Avg Progress: {dept.averageProgress}%</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Data Preview Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>Data Preview</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowAllData(true)}>View All Data</Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {reportType === 'attendance' && (<><TableHead>Employee ID</TableHead><TableHead>Employee</TableHead><TableHead>Date</TableHead><TableHead>Punch In</TableHead><TableHead>Punch Out</TableHead><TableHead>Status</TableHead></>)}
                    {reportType === 'leaves' && (<><TableHead>Employee ID</TableHead><TableHead>Employee</TableHead><TableHead>Leave Type</TableHead><TableHead>Start Date</TableHead><TableHead>End Date</TableHead><TableHead>Status</TableHead></>)}
                    {reportType === 'dailyTasks' && (<><TableHead>Employee ID</TableHead><TableHead>Employee</TableHead><TableHead>Task Title</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead><TableHead>Actions</TableHead></>)}
                    {reportType === 'projects' && (<><TableHead>Project Name</TableHead><TableHead>Department</TableHead><TableHead>Status</TableHead><TableHead>Progress</TableHead><TableHead>Start Date</TableHead><TableHead>End Date</TableHead></>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportType === 'attendance' && filteredAttendance.slice(0,5).map(record => (
                    <TableRow key={record.id}>
                      <TableCell>{record.employeeId}</TableCell>
                      <TableCell>{record.employeeName}</TableCell>
                      <TableCell>{formatDate(record.date)}</TableCell>
                      <TableCell>{record.punchIn || '-'}</TableCell>
                      <TableCell>{record.punchOut || '-'}</TableCell>
                      <TableCell><Badge className={record.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>{record.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {reportType === 'leaves' && filteredLeaves.slice(0,5).map(request => (
                    <TableRow key={request.id}>
                      <TableCell>{request.employeeId}</TableCell>
                      <TableCell>{request.employeeName}</TableCell>
                      <TableCell>{request.leaveType}</TableCell>
                      <TableCell>{formatDate(request.startDate)}</TableCell>
                      <TableCell>{formatDate(request.endDate)}</TableCell>
                      <TableCell><Badge className={request.status === 'approved' ? 'bg-green-100 text-green-700' : request.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>{request.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {reportType === 'dailyTasks' && filteredDailyTasks.slice(0,5).map(task => (
                    <TableRow key={task.id}>
                      <TableCell>{task.employeeId}</TableCell>
                      <TableCell>{task.employeeName}</TableCell>
                      <TableCell className="max-w-xs truncate">{task.taskTitle}</TableCell>
                      <TableCell>{formatDate(task.date)}</TableCell>
                      <TableCell>{getTaskStatusBadge(task.status)}</TableCell>
                      <TableCell>{getTaskPriorityBadge(task.priority)}</TableCell>
                      <TableCell><Button variant="ghost" size="sm" onClick={() => handleViewTask(task)}><Eye className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {reportType === 'projects' && filteredProjects.slice(0,5).map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.department || 'No Department'}</TableCell>
                      <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                      <TableCell>{p.progress}%</TableCell>
                      <TableCell>{p.startDate ? formatDate(p.startDate) : '-'}</TableCell>
                      <TableCell>{p.endDate ? formatDate(p.endDate) : '-'}</TableCell>
                    </TableRow>
                  ))}
                  {filteredAttendance.length === 0 && filteredLeaves.length === 0 && filteredDailyTasks.length === 0 && filteredProjects.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-4 text-gray-500">No data available for the selected filters</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* View All Data Modal – keep existing logic, unchanged for brevity */}
      {showAllData && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold">All Data - {reportType.charAt(0).toUpperCase() + reportType.slice(1)}</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowAllData(false)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="p-4 border-b">
              <Input type="date" value={modalDateFilter} onChange={(e) => setModalDateFilter(e.target.value)} placeholder="Filter by date" className="w-64" />
            </div>
            <div className="flex-1 overflow-auto p-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    {reportType === 'attendance' && (<><TableHead>Employee ID</TableHead><TableHead>Employee</TableHead><TableHead>Date</TableHead><TableHead>Punch In</TableHead><TableHead>Punch Out</TableHead><TableHead>Status</TableHead></>)}
                    {reportType === 'leaves' && (<><TableHead>Employee ID</TableHead><TableHead>Employee</TableHead><TableHead>Leave Type</TableHead><TableHead>Start Date</TableHead><TableHead>End Date</TableHead><TableHead>Status</TableHead></>)}
                    {reportType === 'dailyTasks' && (<><TableHead>Employee ID</TableHead><TableHead>Employee</TableHead><TableHead>Task Title</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead><TableHead>Actions</TableHead></>)}
                    {reportType === 'projects' && (<><TableHead>Project Name</TableHead><TableHead>Department</TableHead><TableHead>Status</TableHead><TableHead>Progress</TableHead><TableHead>Start Date</TableHead><TableHead>End Date</TableHead></>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportType === 'attendance' && (modalDateFilter ? filteredAttendance.filter(r => r.date === modalDateFilter) : filteredAttendance).map(record => (
                    <TableRow key={record.id}>
                      <TableCell>{record.employeeId}</TableCell>
                      <TableCell>{record.employeeName}</TableCell>
                      <TableCell>{formatDate(record.date)}</TableCell>
                      <TableCell>{record.punchIn || '-'}</TableCell>
                      <TableCell>{record.punchOut || '-'}</TableCell>
                      <TableCell><Badge className={record.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>{record.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {reportType === 'leaves' && (modalDateFilter ? filteredLeaves.filter(r => r.startDate === modalDateFilter || r.endDate === modalDateFilter) : filteredLeaves).map(request => (
                    <TableRow key={request.id}>
                      <TableCell>{request.employeeId}</TableCell>
                      <TableCell>{request.employeeName}</TableCell>
                      <TableCell>{request.leaveType}</TableCell>
                      <TableCell>{formatDate(request.startDate)}</TableCell>
                      <TableCell>{formatDate(request.endDate)}</TableCell>
                      <TableCell><Badge className={request.status === 'approved' ? 'bg-green-100 text-green-700' : request.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>{request.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {reportType === 'dailyTasks' && filteredModalTasks.map(task => (
                    <TableRow key={task.id}>
                      <TableCell>{task.employeeId}</TableCell>
                      <TableCell>{task.employeeName}</TableCell>
                      <TableCell className="max-w-xs truncate">{task.taskTitle}</TableCell>
                      <TableCell>{formatDate(task.date)}</TableCell>
                      <TableCell>{getTaskStatusBadge(task.status)}</TableCell>
                      <TableCell>{getTaskPriorityBadge(task.priority)}</TableCell>
                      <TableCell><Button variant="ghost" size="sm" onClick={() => handleViewTask(task)}><Eye className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {reportType === 'projects' && (modalDateFilter ? filteredProjects.filter(p => p.createdAt?.split('T')[0] === modalDateFilter) : filteredProjects).map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.department || 'No Department'}</TableCell>
                      <TableCell>{p.status}</TableCell>
                      <TableCell>{p.progress}%</TableCell>
                      <TableCell>{p.startDate ? formatDate(p.startDate) : '-'}</TableCell>
                      <TableCell>{p.endDate ? formatDate(p.endDate) : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* Task Details Modal – unchanged */}
      {showTaskDetails && selectedTask && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-semibold">Task Details</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowTaskDetails(false)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="p-4 space-y-4">
              <div><h3 className="font-medium text-gray-500">Task Title</h3><p>{selectedTask.taskTitle}</p></div>
              <div><h3 className="font-medium text-gray-500">Description</h3><p>{selectedTask.workSummary || 'No description'}</p></div>
              <div><h3 className="font-medium text-gray-500">Employee</h3><p>{selectedTask.employeeName} ({selectedTask.department})</p></div>
              <div><h3 className="font-medium text-gray-500">Status</h3>{getTaskStatusBadge(selectedTask.status)}</div>
              <div><h3 className="font-medium text-gray-500">Priority</h3>{getTaskPriorityBadge(selectedTask.priority)}</div>
              <div><h3 className="font-medium text-gray-500">Date</h3><p>{formatDate(selectedTask.date)}</p></div>
              <div><h3 className="font-medium text-gray-500">Duration</h3><p>{selectedTask.totalDuration}</p></div>
              {selectedTask.pendingWork && <div><h3 className="font-medium text-gray-500">Pending Work</h3><p>{selectedTask.pendingWork}</p></div>}
              {selectedTask.challenges && <div><h3 className="font-medium text-gray-500">Challenges</h3><p>{selectedTask.challenges}</p></div>}
              {selectedTask.managerRemarks && <div><h3 className="font-medium text-gray-500">Manager Remarks</h3><p>{selectedTask.managerRemarks}</p></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsManagement;