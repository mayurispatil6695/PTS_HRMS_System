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
import { ref, query, orderByChild, get, orderByKey } from 'firebase/database';
import { toast } from '../ui/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

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

const ReportsManagement = () => {
  const { user } = useAuth();
  const userRole = user?.role;
  
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
  const [showAllDataModal, setShowAllDataModal] = useState(false);
  const [modalDateFilter, setModalDateFilter] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<DailyTask | null>(null);
  const [showTaskDetails, setShowTaskDetails] = useState(false);

  /* ================= CHECK IF USER IS ADMIN ================= */
  const isAdmin = userRole === 'admin' || userRole === 'super_admin' || userRole === 'Administrator';

  /* ================= FETCH ALL EMPLOYEES (FOR ADMIN) ================= */
  useEffect(() => {
    if (!user?.id) return;

    const fetchEmployees = async () => {
      try {
        if (isAdmin) {
          // ADMIN: Fetch ALL employees from the entire database
          const usersRef = ref(database, `users`);
          const snapshot = await get(usersRef);
          
          if (snapshot.exists()) {
            const usersData = snapshot.val();
            const employeesList: Employee[] = [];
            
            // Loop through all users and collect employees (skip admins if needed)
            Object.entries(usersData).forEach(([uid, userData]: [string, any]) => {
              // Only add users who are employees (not admins)
              if (userData.role !== 'admin' && userData.role !== 'super_admin') {
                employeesList.push({
                  id: uid,
                  name: userData.name || userData.email || `Employee ${uid.slice(0, 6)}`,
                  email: userData.email || '',
                  department: userData.department,
                  designation: userData.designation,
                  status: userData.status || 'active'
                });
              }
            });
            
            setEmployees(employeesList);
            console.log(`✅ Loaded ${employeesList.length} employees from all users`);
          } else {
            setEmployees([]);
          }
        } else {
          // REGULAR USER: Fetch only their employees
          const employeesRef = ref(database, `users/${user.id}/employees`);
          const snapshot = await get(employeesRef);
          
          if (snapshot.exists()) {
            const employeesData = snapshot.val();
            const employeesList: Employee[] = Object.entries(employeesData).map(([key, value]) => ({
              id: key,
              ...(value as Omit<Employee, 'id'>)
            }));
            setEmployees(employeesList);
          } else {
            setEmployees([]);
          }
        }
      } catch (error) {
        console.error('Error fetching employees:', error);
        toast({
          title: 'Error',
          description: 'Failed to load employee data',
          variant: 'destructive'
        });
      } finally {
        setDataLoaded(prev => ({ ...prev, employees: true }));
      }
    };

    fetchEmployees();
  }, [user, isAdmin]);

  /* ================= FETCH ATTENDANCE DATA ================= */
  useEffect(() => {
    if (!user?.id || employees.length === 0 || reportType !== 'attendance') return;

    const fetchAttendanceData = async () => {
      setLoading(true);
      try {
        const allRecords: AttendanceRecord[] = [];
        
        if (isAdmin) {
          // ADMIN: Fetch attendance for ALL employees from the entire database
          const usersRef = ref(database, `users`);
          const snapshot = await get(usersRef);
          
          if (snapshot.exists()) {
            const usersData = snapshot.val();
            
            // Loop through all users
            for (const [uid, userData] of Object.entries(usersData)) {
              const employee = employees.find(emp => emp.id === uid);
              if (!employee) continue; // Skip if not in our employee list
              
              const attendanceRef = ref(database, `users/${uid}/punching`);
              const attendanceSnapshot = await get(attendanceRef);
              
              if (attendanceSnapshot.exists()) {
                const data = attendanceSnapshot.val();
                const records: AttendanceRecord[] = Object.entries(data).map(([key, value]) => ({
                  id: key,
                  employeeId: uid,
                  employeeName: employee.name,
                  ...(value as Omit<AttendanceRecord, 'id' | 'employeeId' | 'employeeName'>)
                }));
                allRecords.push(...records);
              }
            }
          }
        } else {
          // REGULAR USER: Fetch attendance for their employees
          for (const employee of employees) {
            const attendanceRef = ref(database, `users/${user.id}/employees/${employee.id}/punching`);
            let attendanceQuery;
            
            try {
              attendanceQuery = query(attendanceRef, orderByChild('timestamp'));
              const snapshot = await get(attendanceQuery);
              
              if (snapshot.exists()) {
                const data = snapshot.val();
                const records: AttendanceRecord[] = Object.entries(data).map(([key, value]) => ({
                  id: key,
                  employeeId: employee.id,
                  employeeName: employee.name,
                  ...(value as Omit<AttendanceRecord, 'id' | 'employeeId' | 'employeeName'>)
                }));
                allRecords.push(...records);
              }
            } catch (error) {
              console.warn('Timestamp index not available, falling back to key ordering:', error);
              const snapshot = await get(query(attendanceRef, orderByKey()));
              if (snapshot.exists()) {
                const data = snapshot.val();
                const records: AttendanceRecord[] = Object.entries(data).map(([key, value]) => ({
                  id: key,
                  employeeId: employee.id,
                  employeeName: employee.name,
                  ...(value as Omit<AttendanceRecord, 'id' | 'employeeId' | 'employeeName'>)
                }));
                if (records[0]?.timestamp) {
                  records.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                }
                allRecords.push(...records);
              }
            }
          }
        }
        
        setAttendanceRecords(allRecords);
        console.log(`✅ Loaded ${allRecords.length} attendance records`);
      } catch (error) {
        console.error('Error fetching attendance records:', error);
        toast({
          title: 'Error',
          description: 'Failed to load attendance data',
          variant: 'destructive'
        });
      } finally {
        setDataLoaded(prev => ({ ...prev, attendance: true }));
        setLoading(false);
      }
    };

    fetchAttendanceData();
  }, [user, employees, reportType, isAdmin]);

  /* ================= FETCH LEAVE DATA ================= */
  useEffect(() => {
    if (!user?.id || employees.length === 0 || reportType !== 'leaves') return;

    const fetchLeaveData = async () => {
      setLoading(true);
      try {
        const allRequests: LeaveRequest[] = [];
        
        if (isAdmin) {
          // ADMIN: Fetch leaves for ALL employees from the entire database
          const usersRef = ref(database, `users`);
          const snapshot = await get(usersRef);
          
          if (snapshot.exists()) {
            const usersData = snapshot.val();
            
            // Loop through all users
            for (const [uid, userData] of Object.entries(usersData)) {
              const employee = employees.find(emp => emp.id === uid);
              if (!employee) continue;
              
              const leavesRef = ref(database, `users/${uid}/leaves`);
              const leavesSnapshot = await get(leavesRef);
              
              if (leavesSnapshot.exists()) {
                const data = leavesSnapshot.val();
                const requests: LeaveRequest[] = Object.entries(data).map(([key, value]) => ({
                  id: key,
                  employeeId: uid,
                  employeeName: employee.name,
                  department: employee.department || 'No Department',
                  ...(value as Omit<LeaveRequest, 'id' | 'employeeId' | 'employeeName' | 'department'>)
                }));
                allRequests.push(...requests);
              }
            }
          }
        } else {
          // REGULAR USER: Fetch leaves for their employees
          for (const employee of employees) {
            const leavesRef = ref(database, `users/${user.id}/employees/${employee.id}/leaves`);
            let leavesQuery;
            
            try {
              leavesQuery = query(leavesRef, orderByChild('appliedAt'));
              const snapshot = await get(leavesQuery);
              
              if (snapshot.exists()) {
                const data = snapshot.val();
                const requests: LeaveRequest[] = Object.entries(data).map(([key, value]) => ({
                  id: key,
                  employeeId: employee.id,
                  employeeName: employee.name,
                  department: employee.department || 'No Department',
                  ...(value as Omit<LeaveRequest, 'id' | 'employeeId' | 'employeeName' | 'department'>)
                }));
                allRequests.push(...requests);
              }
            } catch (error) {
              console.warn('appliedAt index not available, falling back to key ordering:', error);
              const snapshot = await get(query(leavesRef, orderByKey()));
              if (snapshot.exists()) {
                const data = snapshot.val();
                const requests: LeaveRequest[] = Object.entries(data).map(([key, value]) => ({
                  id: key,
                  employeeId: employee.id,
                  employeeName: employee.name,
                  department: employee.department || 'No Department',
                  ...(value as Omit<LeaveRequest, 'id' | 'employeeId' | 'employeeName' | 'department'>)
                }));
                if (requests[0]?.appliedAt) {
                  requests.sort((a, b) => 
                    new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
                  );
                }
                allRequests.push(...requests);
              }
            }
          }
        }
        
        setLeaveRequests(allRequests);
        console.log(`✅ Loaded ${allRequests.length} leave requests`);
      } catch (error) {
        console.error('Error fetching leave requests:', error);
        toast({
          title: 'Error',
          description: 'Failed to load leave data',
          variant: 'destructive'
        });
      } finally {
        setDataLoaded(prev => ({ ...prev, leaves: true }));
        setLoading(false);
      }
    };

    fetchLeaveData();
  }, [user, employees, reportType, isAdmin]);

  /* ================= FETCH DAILY TASKS DATA ================= */
  useEffect(() => {
    if (!user?.id || employees.length === 0 || reportType !== 'dailyTasks') return;

    const fetchDailyTasks = async () => {
      setLoading(true);
      try {
        const allTasks: DailyTask[] = [];
        
        if (isAdmin) {
          // ADMIN: Fetch daily tasks for ALL employees from the entire database
          const usersRef = ref(database, `users`);
          const snapshot = await get(usersRef);
          
          if (snapshot.exists()) {
            const usersData = snapshot.val();
            
            // Loop through all users
            for (const [uid, userData] of Object.entries(usersData)) {
              const employee = employees.find(emp => emp.id === uid);
              if (!employee) continue;
              
              const tasksRef = ref(database, `users/${uid}/dailytask`);
              const tasksSnapshot = await get(tasksRef);
              
              if (tasksSnapshot.exists()) {
                const data = tasksSnapshot.val();
                const tasks: DailyTask[] = Object.entries(data).map(([key, value]) => ({
                  id: key,
                  employeeId: uid,
                  employeeName: employee.name,
                  department: employee.department || 'No Department',
                  designation: employee.designation || 'No Designation',
                  ...(value as Omit<DailyTask, 'id' | 'employeeId' | 'employeeName' | 'department' | 'designation'>)
                }));
                allTasks.push(...tasks);
              }
            }
          }
        } else {
          // REGULAR USER: Fetch daily tasks for their employees
          for (const employee of employees) {
            const tasksRef = ref(database, `users/${user.id}/employees/${employee.id}/dailytask`);
            let tasksQuery;
            
            try {
              tasksQuery = query(tasksRef, orderByChild('date'));
              const snapshot = await get(tasksQuery);
              
              if (snapshot.exists()) {
                const data = snapshot.val();
                const tasks: DailyTask[] = Object.entries(data).map(([key, value]) => ({
                  id: key,
                  employeeId: employee.id,
                  employeeName: employee.name,
                  department: employee.department || 'No Department',
                  designation: employee.designation || 'No Designation',
                  ...(value as Omit<DailyTask, 'id' | 'employeeId' | 'employeeName' | 'department' | 'designation'>)
                }));
                allTasks.push(...tasks);
              }
            } catch (error) {
              console.warn('date index not available, falling back to key ordering:', error);
              const snapshot = await get(query(tasksRef, orderByKey()));
              if (snapshot.exists()) {
                const data = snapshot.val();
                const tasks: DailyTask[] = Object.entries(data).map(([key, value]) => ({
                  id: key,
                  employeeId: employee.id,
                  employeeName: employee.name,
                  department: employee.department || 'No Department',
                  designation: employee.designation || 'No Designation',
                  ...(value as Omit<DailyTask, 'id' | 'employeeId' | 'employeeName' | 'department' | 'designation'>)
                }));
                if (tasks[0]?.date) {
                  tasks.sort((a, b) => 
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                  );
                }
                allTasks.push(...tasks);
              }
            }
          }
        }
        
        setDailyTasks(allTasks);
        console.log(`✅ Loaded ${allTasks.length} daily tasks`);
      } catch (error) {
        console.error('Error fetching daily tasks:', error);
        toast({
          title: 'Error',
          description: 'Failed to load daily tasks data',
          variant: 'destructive'
        });
      } finally {
        setDataLoaded(prev => ({ ...prev, dailyTasks: true }));
        setLoading(false);
      }
    };

    fetchDailyTasks();
  }, [user, employees, reportType, isAdmin]);

  // Get filtered data based on date range and department
  const getFilteredData = () => {
    let filteredAttendance: AttendanceRecord[] = [];
    let filteredLeaves: LeaveRequest[] = [];
    let filteredDailyTasks: DailyTask[] = [];
    
    const now = new Date();
    let startDate: Date, endDate: Date;
    
    // Set date range based on selection
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
    
    // Filter attendance records
    if (reportType === 'attendance' && dataLoaded.attendance) {
      filteredAttendance = attendanceRecords.filter(record => {
        try {
          const recordDate = new Date(record.date);
          const employee = employees.find(emp => emp.id === record.employeeId);
          const matchesDepartment = departmentFilter === 'all' || 
            (employee?.department === departmentFilter) ||
            (departmentFilter === 'No Department' && !employee?.department);
          
          return recordDate >= startDate && recordDate <= endDate && matchesDepartment;
        } catch {
          return false;
        }
      });
    }
    
    // Filter leave requests
    if (reportType === 'leaves' && dataLoaded.leaves) {
      filteredLeaves = leaveRequests.filter(request => {
        try {
          const appliedDate = new Date(request.appliedAt);
          const employee = employees.find(emp => emp.id === request.employeeId);
          const matchesDepartment = departmentFilter === 'all' || 
            (employee?.department === departmentFilter) ||
            (departmentFilter === 'No Department' && !employee?.department);
          
          return appliedDate >= startDate && appliedDate <= endDate && matchesDepartment;
        } catch {
          return false;
        }
      });
    }
    
    // Filter daily tasks
    if (reportType === 'dailyTasks' && dataLoaded.dailyTasks) {
      filteredDailyTasks = dailyTasks.filter(task => {
        try {
          const taskDate = new Date(task.date);
          const employee = employees.find(emp => emp.id === task.employeeId);
          const matchesDepartment = departmentFilter === 'all' || 
            (employee?.department === departmentFilter) ||
            (departmentFilter === 'No Department' && !employee?.department);
          
          return taskDate >= startDate && taskDate <= endDate && matchesDepartment;
        } catch {
          return false;
        }
      });
    }
    
    return { filteredAttendance, filteredLeaves, filteredDailyTasks };
  };

  const { filteredAttendance, filteredLeaves, filteredDailyTasks } = getFilteredData();

  // Get department-wise data for the report
  const getDepartmentWiseData = () => {
    const departments = Array.from(
      new Set(employees.map(emp => emp.department || 'No Department'))
    );
    
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
            ? Math.round(
                (deptRecords.filter(record => record.status === 'present').length / 
                deptRecords.length * 100
              ))
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

  // Export report to CSV
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
      
      toast({
        title: 'Report Exported',
        description: `The ${reportType} report has been downloaded successfully.`
      });
    } catch (error) {
      console.error('Error exporting report:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export the report',
        variant: 'destructive'
      });
    }
  };

  // Calculate duration between two dates
  const calculateDays = (startDate: string, endDate: string) => {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    } catch {
      return 0;
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  // Get status badge for tasks
  const getTaskStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-100 text-green-700">Completed</Badge>;
      case 'in-progress': return <Badge className="bg-blue-100 text-blue-700">In Progress</Badge>;
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
      case 'cancelled': return <Badge className="bg-red-100 text-red-700">Cancelled</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  // Get priority badge for tasks
  const getTaskPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <Badge variant="destructive">High</Badge>;
      case 'medium': return <Badge className="bg-yellow-100 text-yellow-700">Medium</Badge>;
      case 'low': return <Badge className="bg-green-100 text-green-700">Low</Badge>;
      default: return <Badge>{priority}</Badge>;
    }
  };

  // Get departments for filter dropdown
  const getDepartments = () => {
    const departments = Array.from(
      new Set(employees.map(emp => emp.department || 'No Department'))
    );
    return ['all', ...departments];
  };

  // Filter daily tasks for modal based on date filter
  const getFilteredDailyTasksForModal = () => {
    if (!modalDateFilter) return filteredDailyTasks;
    
    return filteredDailyTasks.filter(task => {
      try {
        const taskDate = new Date(task.date).toISOString().split('T')[0];
        return taskDate === modalDateFilter;
      } catch {
        return false;
      }
    });
  };

  const filteredModalTasks = getFilteredDailyTasksForModal();

  // View task details
  const handleViewTask = (task: DailyTask) => {
    setSelectedTask(task);
    setShowTaskDetails(true);
  };

  // Loading state
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
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reports Management</h1>
          <p className="text-gray-600">
            {isAdmin 
              ? `Viewing all data across the organization (${employees.length} total employees)` 
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
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
                <Select 
                  value={reportType} 
                  onValueChange={(value: 'attendance' | 'leaves' | 'dailyTasks') => {
                    setReportType(value);
                    setLoading(true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attendance">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Attendance
                      </div>
                    </SelectItem>
                    <SelectItem value="leaves">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Leave
                      </div>
                    </SelectItem>
                    <SelectItem value="dailyTasks">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Daily Tasks
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Date Range</label>
                <Select 
                  value={dateRange} 
                  onValueChange={setDateRange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select date range" />
                  </SelectTrigger>
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
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      placeholder="Select start date"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">End Date</label>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      placeholder="Select end date"
                    />
                  </div>
                </>
              )}
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Department</label>
                <Select 
                  value={departmentFilter} 
                  onValueChange={setDepartmentFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {getDepartments().filter(dept => dept !== 'all').map((dept, index) => (
                      <SelectItem key={index} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-end">
                <Button 
                  onClick={exportReport}
                  disabled={loading || 
                    (reportType === 'attendance' && filteredAttendance.length === 0) ||
                    (reportType === 'leaves' && filteredLeaves.length === 0) ||
                    (reportType === 'dailyTasks' && filteredDailyTasks.length === 0)}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Rest of the component remains exactly the same */}
      {/* ... (all the summary cards, department wise data, data preview, modals remain unchanged) ... */}
    </div>
  );
};

export default ReportsManagement;