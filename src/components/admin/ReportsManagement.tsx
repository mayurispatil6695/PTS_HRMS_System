import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Calendar, Users, TrendingUp, BarChart3, Clock, AlertTriangle, ChevronDown, ChevronUp, X, Eye } from 'lucide-react';
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

// ========== PROPS ==========
interface ReportsManagementProps {
  role?: 'admin' | 'manager' | 'team_leader' | 'client';
  department?: string;
}

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

// Firebase user structure (from global `users` node)
interface FirebaseUserRecord {
  role?: string;
  name?: string;
  email?: string;
  department?: string;
  designation?: string;
  status?: string;
  [key: string]: unknown;
}

// Raw attendance record from DB
interface RawAttendanceRecord {
  date: string;
  punchIn: string;
  punchOut?: string | null;
  status?: string;
  workMode?: string;
  timestamp?: number;
  [key: string]: unknown;
}

// Raw leave request from DB
interface RawLeaveRequest {
  employeeId?: string;
  employeeName?: string;
  department?: string;
  leaveType?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
  status?: 'pending' | 'approved' | 'rejected';
  appliedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  approvedBy?: string;
  [key: string]: unknown;
}

// Raw daily task from DB
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

// Helper to safely extract a string field
const safeString = (obj: Record<string, unknown>, key: string, defaultValue = ''): string => {
  const val = obj[key];
  return typeof val === 'string' ? val : defaultValue;
};

// Helper to safely extract a number
const safeNumber = (obj: Record<string, unknown>, key: string, defaultValue = 0): number => {
  const val = obj[key];
  return typeof val === 'number' ? val : defaultValue;
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

  const [reportType, setReportType] = useState<'attendance' | 'leaves' | 'dailyTasks'>('attendance');
  const [dateRange, setDateRange] = useState('thisMonth');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState({
    employees: false,
    attendance: false,
    leaves: false,
    dailyTasks: false
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
        const usersRef = ref(database, `users`);
        const snapshot = await get(usersRef);
        
        if (snapshot.exists()) {
          const usersData = snapshot.val() as Record<string, FirebaseUserRecord>;
          const employeesList: Employee[] = [];
          
          for (const [uid, userData] of Object.entries(usersData)) {
            const roleField = userData.role;
            if (roleField !== 'admin' && roleField !== 'super_admin') {
              const isInDepartment = !isManager || (userData.department === effectiveDepartment);
              if (isManager && !isInDepartment) continue;
              
              employeesList.push({
                id: uid,
                name: safeString(userData, 'name', userData.email || `Employee ${uid.slice(0, 6)}`),
                email: safeString(userData, 'email'),
                department: safeString(userData, 'department'),
                designation: safeString(userData, 'designation'),
                status: safeString(userData, 'status', 'active')
              });
            }
          }
          setEmployees(employeesList);
          console.log(`✅ Loaded ${employeesList.length} employees`);
        } else {
          setEmployees([]);
        }
      } catch (error) {
        console.error('Error fetching employees:', error);
        toast({ title: 'Error', description: 'Failed to load employee data', variant: 'destructive' });
      } finally {
        setDataLoaded(prev => ({ ...prev, employees: true }));
      }
    };

    fetchEmployees();
  }, [user, isAdmin, isManager, effectiveDepartment]);

  // ================= FETCH ATTENDANCE DATA =================
  useEffect(() => {
    if (!user?.id || employees.length === 0 || reportType !== 'attendance') return;

    const fetchAttendanceData = async () => {
      setLoading(true);
      try {
        const allRecords: AttendanceRecord[] = [];
        
        for (const employee of employees) {
          const attendanceRef = ref(database, `users/${employee.id}/punching`);
          const attendanceSnapshot = await get(attendanceRef);
          if (attendanceSnapshot.exists()) {
            const data = attendanceSnapshot.val() as Record<string, RawAttendanceRecord>;
            for (const [key, value] of Object.entries(data)) {
              allRecords.push({
                id: key,
                employeeId: employee.id,
                employeeName: employee.name,
                date: safeString(value, 'date'),
                punchIn: safeString(value, 'punchIn'),
                punchOut: value.punchOut !== undefined ? (typeof value.punchOut === 'string' ? value.punchOut : null) : null,
                status: safeString(value, 'status', 'present'),
                workMode: safeString(value, 'workMode', 'office'),
                timestamp: safeNumber(value, 'timestamp'),
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
  }, [user, employees, reportType, isAdmin, isManager, effectiveDepartment]);

  // ================= FETCH LEAVE DATA =================
  useEffect(() => {
    if (!user?.id || employees.length === 0 || reportType !== 'leaves') return;

    const fetchLeaveData = async () => {
      setLoading(true);
      try {
        const allRequests: LeaveRequest[] = [];
        
        for (const employee of employees) {
          const leavesRef = ref(database, `users/${employee.id}/leaves`);
          const leavesSnapshot = await get(leavesRef);
          if (leavesSnapshot.exists()) {
            const data = leavesSnapshot.val() as Record<string, RawLeaveRequest>;
            for (const [key, value] of Object.entries(data)) {
              allRequests.push({
                id: key,
                employeeId: employee.id,
                employeeName: employee.name,
                department: employee.department || 'No Department',
                leaveType: safeString(value, 'leaveType'),
                startDate: safeString(value, 'startDate'),
                endDate: safeString(value, 'endDate'),
                reason: safeString(value, 'reason'),
                status: (value.status as 'pending' | 'approved' | 'rejected') || 'pending',
                appliedAt: safeString(value, 'appliedAt'),
                approvedAt: safeString(value, 'approvedAt'),
                rejectedAt: safeString(value, 'rejectedAt'),
                approvedBy: safeString(value, 'approvedBy'),
              });
            }
          }
        }
        
        setLeaveRequests(allRequests);
        console.log(`✅ Loaded ${allRequests.length} leave requests`);
      } catch (error) {
        console.error('Error fetching leave requests:', error);
        toast({ title: 'Error', description: 'Failed to load leave data', variant: 'destructive' });
      } finally {
        setDataLoaded(prev => ({ ...prev, leaves: true }));
        setLoading(false);
      }
    };

    fetchLeaveData();
  }, [user, employees, reportType, isAdmin, isManager, effectiveDepartment]);

  // ================= FETCH DAILY TASKS DATA =================
  useEffect(() => {
    if (!user?.id || employees.length === 0 || reportType !== 'dailyTasks') return;

    const fetchDailyTasks = async () => {
      setLoading(true);
      try {
        const allTasks: DailyTask[] = [];
        
        for (const employee of employees) {
          const tasksRef = ref(database, `users/${employee.id}/dailytask`);
          const tasksSnapshot = await get(tasksRef);
          if (tasksSnapshot.exists()) {
            const data = tasksSnapshot.val() as Record<string, RawDailyTask>;
            for (const [key, value] of Object.entries(data)) {
              allTasks.push({
                id: key,
                employeeId: employee.id,
                employeeName: employee.name,
                department: employee.department || 'No Department',
                designation: employee.designation || 'No Designation',
                taskTitle: safeString(value, 'taskTitle'),
                taskType: safeString(value, 'taskType'),
                priority: safeString(value, 'priority'),
                assignedBy: safeString(value, 'assignedBy'),
                assignedDate: safeString(value, 'assignedDate'),
                startTime: safeString(value, 'startTime'),
                endTime: safeString(value, 'endTime'),
                totalDuration: safeString(value, 'totalDuration'),
                status: safeString(value, 'status'),
                workSummary: safeString(value, 'workSummary'),
                pendingWork: safeString(value, 'pendingWork'),
                challenges: safeString(value, 'challenges'),
                verifiedBy: safeString(value, 'verifiedBy'),
                managerRemarks: safeString(value, 'managerRemarks'),
                employeeRemarks: safeString(value, 'employeeRemarks'),
                attachments: Array.isArray(value.attachments) ? value.attachments : [],
                date: safeString(value, 'date'),
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
  }, [user, employees, reportType, isAdmin, isManager, effectiveDepartment]);

  // ================= FILTERING LOGIC =================
  const getFilteredData = () => {
    let filteredAttendance: AttendanceRecord[] = [];
    let filteredLeaves: LeaveRequest[] = [];
    let filteredDailyTasks: DailyTask[] = [];
    
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
          const employee = employees.find(emp => emp.id === record.employeeId);
          const matchesDepartment = departmentFilter === 'all' || 
            (employee?.department === departmentFilter) ||
            (departmentFilter === 'No Department' && !employee?.department);
          return recordDate >= startDate && recordDate <= endDate && matchesDepartment;
        } catch { return false; }
      });
    }
    
    if (reportType === 'leaves' && dataLoaded.leaves) {
      filteredLeaves = leaveRequests.filter(request => {
        try {
          const appliedDate = new Date(request.appliedAt);
          const employee = employees.find(emp => emp.id === request.employeeId);
          const matchesDepartment = departmentFilter === 'all' || 
            (employee?.department === departmentFilter) ||
            (departmentFilter === 'No Department' && !employee?.department);
          return appliedDate >= startDate && appliedDate <= endDate && matchesDepartment;
        } catch { return false; }
      });
    }
    
    if (reportType === 'dailyTasks' && dataLoaded.dailyTasks) {
      filteredDailyTasks = dailyTasks.filter(task => {
        try {
          const taskDate = new Date(task.date);
          const employee = employees.find(emp => emp.id === task.employeeId);
          const matchesDepartment = departmentFilter === 'all' || 
            (employee?.department === departmentFilter) ||
            (departmentFilter === 'No Department' && !employee?.department);
          return taskDate >= startDate && taskDate <= endDate && matchesDepartment;
        } catch { return false; }
      });
    }
    
    return { filteredAttendance, filteredLeaves, filteredDailyTasks };
  };

  const { filteredAttendance, filteredLeaves, filteredDailyTasks } = getFilteredData();

  const getDepartmentWiseData = () => {
    let departments = Array.from(new Set(employees.map(emp => emp.department || 'No Department')));
    if (isManager && effectiveDepartment) {
      departments = [effectiveDepartment];
    }
    
    if (reportType === 'attendance') {
      return departments.map(dept => {
        const deptEmployees = employees.filter(emp => emp.department === dept);
        const deptRecords = filteredAttendance.filter(record => 
          deptEmployees.some(emp => emp.id === record.employeeId)
        );
        return {
          department: dept,
          present: deptRecords.filter(record => record.status === 'present').length,
          absent: deptRecords.filter(record => record.status === 'absent').length,
          late: deptRecords.filter(record => record.status === 'late').length,
          total: deptRecords.length,
          percentage: deptRecords.length > 0 
            ? Math.round((deptRecords.filter(record => record.status === 'present').length / deptRecords.length * 100))
            : 0
        };
      });
    } else if (reportType === 'leaves') {
      return departments.map(dept => {
        const deptEmployees = employees.filter(emp => emp.department === dept);
        const deptLeaves = filteredLeaves.filter(leave => 
          deptEmployees.some(emp => emp.id === leave.employeeId)
        );
        return {
          department: dept,
          approved: deptLeaves.filter(leave => leave.status === 'approved').length,
          pending: deptLeaves.filter(leave => leave.status === 'pending').length,
          rejected: deptLeaves.filter(leave => leave.status === 'rejected').length,
          total: deptLeaves.length
        };
      });
    } else {
      return departments.map(dept => {
        const deptEmployees = employees.filter(emp => emp.department === dept);
        const deptTasks = filteredDailyTasks.filter(task => 
          deptEmployees.some(emp => emp.id === task.employeeId)
        );
        return {
          department: dept,
          completed: deptTasks.filter(task => task.status === 'completed').length,
          inProgress: deptTasks.filter(task => task.status === 'in-progress').length,
          pending: deptTasks.filter(task => task.status === 'pending').length,
          total: deptTasks.length
        };
      });
    }
  };

  const departmentData = getDepartmentWiseData();

  // ================= EXPORT REPORT =================
  const exportReport = () => {
    let csvContent = '';
    const timestamp = new Date().toISOString().split('T')[0];
    const currentDate = new Date().toLocaleDateString();
    
    if (reportType === 'attendance') {
      csvContent = [
        [`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report - Generated on ${currentDate}`],
        [''],
        ['Employee Name', 'Employee ID', 'Department', 'Date', 'Punch In', 'Punch Out', 'Status', 'Work Mode'],
        ...filteredAttendance.map(record => {
          const employee = employees.find(emp => emp.id === record.employeeId);
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
        [`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report - Generated on ${currentDate}`],
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
    } else {
      csvContent = [
        [`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report - Generated on ${currentDate}`],
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
    }
    
    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportType}-report-${timestamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: 'Report Exported', description: `The ${reportType} report has been downloaded successfully.` });
    } catch (error) {
      console.error('Error exporting report:', error);
      toast({ title: 'Export Failed', description: 'Failed to export the report', variant: 'destructive' });
    }
  };

  const calculateDays = (startDate: string, endDate: string) => {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
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
    const departments = Array.from(new Set(employees.map(emp => emp.department || 'No Department')));
    return ['all', ...departments];
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
      (reportType === 'dailyTasks' && !dataLoaded.dailyTasks)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        <p className="text-gray-600">Loading report data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reports Management</h1>
          <p className="text-gray-600">
            {isAdmin 
              ? `Viewing all data across the organization (${employees.length} total employees)` 
              : isManager 
                ? `Viewing data for ${effectiveDepartment} department (${employees.length} employees)`
                : "Generate and export detailed reports"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1">
            {employees.length} {isAdmin ? 'Total Employees' : 'Employees'}
          </Badge>
        </div>
      </motion.div>

      {/* Report Configuration */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Report Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Report Type</label>
                <Select value={reportType} onValueChange={(value: 'attendance' | 'leaves' | 'dailyTasks') => {
                  setReportType(value);
                  setLoading(true);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attendance"><div className="flex items-center gap-2"><Clock className="h-4 w-4" />Attendance</div></SelectItem>
                    <SelectItem value="leaves"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Leave</div></SelectItem>
                    <SelectItem value="dailyTasks"><div className="flex items-center gap-2"><FileText className="h-4 w-4" />Daily Tasks</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Date Range</label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger><SelectValue placeholder="Select date range" /></SelectTrigger>
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
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Start Date</label>
                    <Input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">End Date</label>
                    <Input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
                  </div>
                </>
              )}
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Department</label>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter} disabled={isManager}>
                  <SelectTrigger><SelectValue placeholder="Filter by department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {getDepartments().filter(dept => dept !== 'all').map((dept, index) => (
                      <SelectItem key={index} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-end">
                <Button onClick={exportReport} disabled={loading || 
                  (reportType === 'attendance' && filteredAttendance.length === 0) ||
                  (reportType === 'leaves' && filteredLeaves.length === 0) ||
                  (reportType === 'dailyTasks' && filteredDailyTasks.length === 0)} className="w-full">
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
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total {reportType === 'attendance' ? 'Records' : reportType === 'leaves' ? 'Requests' : 'Tasks'}</p>
                  <p className="text-2xl font-bold">{reportType === 'attendance' ? filteredAttendance.length : reportType === 'leaves' ? filteredLeaves.length : filteredDailyTasks.length}</p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Employees Covered</p>
                  <p className="text-2xl font-bold">
                    {reportType === 'attendance' 
                      ? new Set(filteredAttendance.map(r => r.employeeId)).size
                      : reportType === 'leaves'
                        ? new Set(filteredLeaves.map(r => r.employeeId)).size
                        : new Set(filteredDailyTasks.map(r => r.employeeId)).size}
                  </p>
                </div>
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Departments</p>
                  <p className="text-2xl font-bold">
                    {reportType === 'attendance'
                      ? new Set(filteredAttendance.map(r => employees.find(e => e.id === r.employeeId)?.department || 'No Department')).size
                      : reportType === 'leaves'
                        ? new Set(filteredLeaves.map(r => r.department)).size
                        : new Set(filteredDailyTasks.map(r => r.department)).size}
                  </p>
                </div>
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Department-wise Data */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Department-wise {reportType === 'attendance' ? 'Attendance' : reportType === 'leaves' ? 'Leave Summary' : 'Task Summary'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departmentData.map((dept, idx) => (
                <Card key={idx} className="border">
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg mb-2">{dept.department}</h3>
                    {reportType === 'attendance' && (
                      <div className="space-y-1 text-sm">
                        <p>Present: {dept.present} / {dept.total}</p>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: `${dept.percentage}%` }} />
                        </div>
                        <p>Attendance Rate: {dept.percentage}%</p>
                        <p>Late: {dept.late} | Absent: {dept.absent}</p>
                      </div>
                    )}
                    {reportType === 'leaves' && (
                      <div className="space-y-1 text-sm">
                        <p>Approved: {dept.approved}</p>
                        <p>Pending: {dept.pending}</p>
                        <p>Rejected: {dept.rejected}</p>
                        <p>Total Requests: {dept.total}</p>
                      </div>
                    )}
                    {reportType === 'dailyTasks' && (
                      <div className="space-y-1 text-sm">
                        <p>Completed: {dept.completed}</p>
                        <p>In Progress: {dept.inProgress}</p>
                        <p>Pending: {dept.pending}</p>
                        <p>Total Tasks: {dept.total}</p>
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Data Preview
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowAllData(true)}>
              View All Data
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {reportType === 'attendance' && (
                      <>
                        <TableHead>Employee</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Punch In</TableHead>
                        <TableHead>Punch Out</TableHead>
                        <TableHead>Status</TableHead>
                      </>
                    )}
                    {reportType === 'leaves' && (
                      <>
                        <TableHead>Employee</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Status</TableHead>
                      </>
                    )}
                    {reportType === 'dailyTasks' && (
                      <>
                        <TableHead>Employee</TableHead>
                        <TableHead>Task Title</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Actions</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportType === 'attendance' && filteredAttendance.slice(0, 5).map(record => (
                    <TableRow key={record.id}>
                      <TableCell>{record.employeeName}</TableCell>
                      <TableCell>{formatDate(record.date)}</TableCell>
                      <TableCell>{record.punchIn || '-'}</TableCell>
                      <TableCell>{record.punchOut || '-'}</TableCell>
                      <TableCell><Badge className={record.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>{record.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {reportType === 'leaves' && filteredLeaves.slice(0, 5).map(request => (
                    <TableRow key={request.id}>
                      <TableCell>{request.employeeName}</TableCell>
                      <TableCell>{request.leaveType}</TableCell>
                      <TableCell>{formatDate(request.startDate)}</TableCell>
                      <TableCell>{formatDate(request.endDate)}</TableCell>
                      <TableCell><Badge className={request.status === 'approved' ? 'bg-green-100 text-green-700' : request.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>{request.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {reportType === 'dailyTasks' && filteredDailyTasks.slice(0, 5).map(task => (
                    <TableRow key={task.id}>
                      <TableCell>{task.employeeName}</TableCell>
                      <TableCell className="max-w-xs truncate">{task.taskTitle}</TableCell>
                      <TableCell>{formatDate(task.date)}</TableCell>
                      <TableCell>{getTaskStatusBadge(task.status)}</TableCell>
                      <TableCell>{getTaskPriorityBadge(task.priority)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleViewTask(task)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(reportType === 'attendance' && filteredAttendance.length === 0) ||
                   (reportType === 'leaves' && filteredLeaves.length === 0) ||
                   (reportType === 'dailyTasks' && filteredDailyTasks.length === 0) ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-4 text-gray-500">No data available for the selected filters</TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* View All Data Modal */}
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
                    {reportType === 'attendance' && (
                      <>
                        <TableHead>Employee</TableHead><TableHead>Date</TableHead><TableHead>Punch In</TableHead><TableHead>Punch Out</TableHead><TableHead>Status</TableHead>
                      </>
                    )}
                    {reportType === 'leaves' && (
                      <>
                        <TableHead>Employee</TableHead><TableHead>Leave Type</TableHead><TableHead>Start Date</TableHead><TableHead>End Date</TableHead><TableHead>Status</TableHead>
                      </>
                    )}
                    {reportType === 'dailyTasks' && (
                      <>
                        <TableHead>Employee</TableHead><TableHead>Task Title</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead><TableHead>Actions</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportType === 'attendance' && (modalDateFilter ? filteredAttendance.filter(r => r.date === modalDateFilter) : filteredAttendance).map(record => (
                    <TableRow key={record.id}>
                      <TableCell>{record.employeeName}</TableCell><TableCell>{formatDate(record.date)}</TableCell><TableCell>{record.punchIn || '-'}</TableCell><TableCell>{record.punchOut || '-'}</TableCell>
                      <TableCell><Badge className={record.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>{record.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {reportType === 'leaves' && (modalDateFilter ? filteredLeaves.filter(r => r.startDate === modalDateFilter || r.endDate === modalDateFilter) : filteredLeaves).map(request => (
                    <TableRow key={request.id}>
                      <TableCell>{request.employeeName}</TableCell><TableCell>{request.leaveType}</TableCell><TableCell>{formatDate(request.startDate)}</TableCell><TableCell>{formatDate(request.endDate)}</TableCell>
                      <TableCell><Badge className={request.status === 'approved' ? 'bg-green-100 text-green-700' : request.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>{request.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {reportType === 'dailyTasks' && filteredModalTasks.map(task => (
                    <TableRow key={task.id}>
                      <TableCell>{task.employeeName}</TableCell><TableCell className="max-w-xs truncate">{task.taskTitle}</TableCell><TableCell>{formatDate(task.date)}</TableCell>
                      <TableCell>{getTaskStatusBadge(task.status)}</TableCell><TableCell>{getTaskPriorityBadge(task.priority)}</TableCell>
                      <TableCell><Button variant="ghost" size="sm" onClick={() => handleViewTask(task)}><Eye className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* Task Details Modal */}
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