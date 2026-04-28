import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, Download, Filter, Search, Users, AlertTriangle, Trash2, Sun, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from '../ui/use-toast';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, onValue, query, orderByChild, update, remove, off, get } from 'firebase/database';
import { AttendanceRecord } from '@/types/attendance';

// ==================== TYPES ====================

interface AttendanceManagementProps {
  role?: 'admin' | 'manager' | 'team_leader' | 'client';
}

interface Employee {
  id: string;
  name: string;
  email: string;
  department?: string;
  designation?: string;
  status: string;
  adminId?: string;
  employeeId?: string;   // custom employee ID (e.g., EMP-00002)
}

interface BreakRecord {
  breakIn: string;
  breakOut?: string;
  duration?: string;
  timestamp: number;
}

interface AttendanceRecordWithAdmin {
  id: string;
  employeeId: string;          // displayable employee ID (custom)
  employeeName: string;
  date: string;
  punchIn: string;
  punchOut: string | null;
  status: string;
  workMode: string;
  timestamp: number;
  adminId?: string;
  selfie?: string;
  selfieOut?: string;
  breaks?: Record<string, BreakRecord>;
  markedLateBy?: string;
  markedLateAt?: string;
  markedHalfDayBy?: string;
  markedHalfDayAt?: string;
  location?: { lat: number; lng: number; name: string };
  locationOut?: { lat: number; lng: number; name: string };
  employeeUid?: string;        // actual Firebase UID of the employee (for updates)
}

interface Notification {
  id: string;
  type: 'punch-in' | 'punch-out' | 'break-in' | 'break-out';
  employeeName: string;
  employeeId: string;
  department?: string;
  email?: string;
  time: string;
  timestamp: number;
  read: boolean;
  adminId?: string;
}

interface FirebaseEmployeeRaw {
  name?: string;
  email?: string;
  department?: string;
  designation?: string;
  status?: string;
  employeeId?: string;
}

interface FirebaseAttendanceRaw {
  selfie?: string;
  selfieOut?: string;
  breaks?: Record<string, BreakRecord>;
  punchIn?: string;
  punchOut?: string;
  date?: string;
  status?: string;
  workMode?: string;
  timestamp?: number;
  markedLateBy?: string;
  markedLateAt?: string;
  markedHalfDayBy?: string;
  markedHalfDayAt?: string;
  location?: { lat: number; lng: number; name: string };
  locationOut?: { lat: number; lng: number; name: string };
  [key: string]: unknown;
}

interface FirebaseEmployeeData {
  name?: string;
  department?: string;
  email?: string;
  designation?: string;
  status?: string;
  [key: string]: unknown;
}

// ✅ Added 'breaks' property
interface FirebaseAttendanceData {
  punchIn?: string;
  punchOut?: string;
  date?: string;
  status?: string;
  workMode?: string;
  breaks?: Record<string, BreakRecord>;
  [key: string]: unknown;
}

interface PresentEmployee {
  name: string;
  department: string;
  punchIn: string;
  punchOut: string;
  totalHours: string;
  workMode: string;
  status: string;
}

interface AbsentEmployee {
  name: string;
  department: string;
  status: string;
}

// ==================== HELPER FUNCTIONS ====================
const convertTimeToMinutes = (timeStr: string): number => {
  try {
    let hours = 0, minutes = 0;
    const trimmed = timeStr.trim().toUpperCase();
    if (!trimmed.includes('AM') && !trimmed.includes('PM')) {
      const parts = trimmed.split(':');
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10);
    } else {
      const [time, period] = trimmed.split(' ');
      const [h, m] = time.split(':').map(Number);
      hours = h;
      minutes = m;
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
    }
    return hours * 60 + minutes;
  } catch {
    return 0;
  }
};

const parseDurationToMinutes = (durationStr: string): number => {
  if (!durationStr) return 0;
  const colonMatch = durationStr.match(/^(\d+):(\d+)$/);
  if (colonMatch) return parseInt(colonMatch[1], 10) * 60 + parseInt(colonMatch[2], 10);
  const hoursMatch = durationStr.match(/(\d+(?:\.\d+)?)\s*h/i);
  const minutesMatch = durationStr.match(/(\d+(?:\.\d+)?)\s*m/i);
  let total = 0;
  if (hoursMatch) total += parseFloat(hoursMatch[1]) * 60;
  if (minutesMatch) total += parseFloat(minutesMatch[1]);
  return Math.round(total);
};

// ✅ Calculates net worked hours (gross − breaks)
const calculateNetWorkDuration = (
  punchIn: string,
  punchOut: string | null,
  breaks?: Record<string, BreakRecord>
): string => {
  if (!punchOut) return 'N/A';
  const startMin = convertTimeToMinutes(punchIn);
  const endMin = convertTimeToMinutes(punchOut);
  let totalMin = endMin - startMin;
  if (totalMin < 0) totalMin += 24 * 60;
  if (totalMin > 12 * 60) totalMin -= 24 * 60;
  if (totalMin < 0) totalMin = 0;

  let breakMin = 0;
  if (breaks) {
    Object.values(breaks).forEach(b => {
      if (b.duration) breakMin += parseDurationToMinutes(b.duration);
    });
  }
  const netMin = totalMin - breakMin;
  const hours = Math.floor(netMin / 60);
  const minutes = netMin % 60;
  return `${hours}h ${minutes}m`;
};

// ==================== COMPONENT ====================
const AttendanceManagement: React.FC<AttendanceManagementProps> = ({ role = 'admin' }) => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allRecords, setAllRecords] = useState<AttendanceRecordWithAdmin[]>([]);
  const [displayedRecords, setDisplayedRecords] = useState<AttendanceRecordWithAdmin[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecordWithAdmin[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [imageModal, setImageModal] = useState<{ src: string; title: string } | null>(null);
  const PAGE_SIZE = 50;

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => setNotificationPermission(permission));
    }
  }, []);

  // Fetch ALL employees from all admins (including custom employeeId)
  useEffect(() => {
    if (!user) return;
    const employeesRef = ref(database, "users");
    const allEmployees: Employee[] = [];
    const unsubscribe = onValue(employeesRef, (snapshot) => {
      allEmployees.length = 0;
      if (snapshot.exists()) {
        snapshot.forEach((adminSnap) => {
          const adminId = adminSnap.key;
          const employeesData = adminSnap.child("employees").val();
          if (employeesData && typeof employeesData === 'object') {
            Object.entries(employeesData).forEach(([key, value]) => {
              const emp = value as FirebaseEmployeeRaw;
              allEmployees.push({
                id: key,
                name: emp.name || '',
                email: emp.email || '',
                department: emp.department || '',
                designation: emp.designation || '',
                status: emp.status || 'active',
                adminId: adminId || '',
                employeeId: emp.employeeId || '',
              });
            });
          }
        });
      }
      setEmployees([...allEmployees]);
    });
    return () => off(employeesRef);
  }, [user]);

  // Load all attendance records from all employees
  useEffect(() => {
    if (!employees.length) return;
    const loadAllRecords = async () => {
      setLoading(true);
      const recordsMap = new Map<string, AttendanceRecordWithAdmin>();
      for (const employee of employees) {
        if (!employee.adminId) continue;
        const attendanceRef = ref(database, `users/${employee.adminId}/employees/${employee.id}/punching`);
        const snapshot = await get(attendanceRef);
        const data = snapshot.val() as Record<string, FirebaseAttendanceRaw> | null;
        if (data) {
          Object.entries(data).forEach(([key, value]) => {
            const recordId = `${employee.id}-${key}`;
            recordsMap.set(recordId, {
              id: key,
              employeeId: employee.employeeId || employee.id,
              employeeName: employee.name,
              adminId: employee.adminId,
              employeeUid: employee.id,        // store the original Firebase UID
              date: value.date || '',
              punchIn: value.punchIn || '',
              punchOut: value.punchOut || null,
              status: value.status || 'present',
              workMode: value.workMode || 'office',
              timestamp: value.timestamp || 0,
              selfie: value.selfie,
              selfieOut: value.selfieOut,
              breaks: value.breaks || {},
              markedLateBy: value.markedLateBy,
              markedLateAt: value.markedLateAt,
              markedHalfDayBy: value.markedHalfDayBy,
              markedHalfDayAt: value.markedHalfDayAt,
              location: value.location,
              locationOut: value.locationOut,
            });
          });
        }
      }
      const sorted = Array.from(recordsMap.values()).sort((a, b) => b.timestamp - a.timestamp);
      setAllRecords(sorted);
      setDisplayedRecords(sorted.slice(0, PAGE_SIZE));
      setHasMore(sorted.length > PAGE_SIZE);
      setLoading(false);
    };
    loadAllRecords();
  }, [employees]);

  // Apply filters and paginate
  useEffect(() => {
    let filtered = allRecords;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(record =>
        record.employeeName?.toLowerCase().includes(term) ||
        record.employeeId?.toLowerCase().includes(term)
      );
    }
    if (filterDate) {
      filtered = filtered.filter(record => record.date?.split('T')[0] === filterDate);
    }
    if (filterStatus !== 'all') {
      filtered = filtered.filter(record => record.status === filterStatus);
    }
    setFilteredRecords(filtered);
    setDisplayedRecords(filtered.slice(0, PAGE_SIZE));
    setHasMore(filtered.length > PAGE_SIZE);
  }, [searchTerm, filterDate, filterStatus, allRecords]);

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const currentLength = displayedRecords.length;
    const nextBatch = filteredRecords.slice(currentLength, currentLength + PAGE_SIZE);
    setDisplayedRecords(prev => [...prev, ...nextBatch]);
    setHasMore(filteredRecords.length > currentLength + PAGE_SIZE);
    setLoadingMore(false);
  };

  // ✅ UPDATED: use employeeUid (real Firebase UID) instead of custom employeeId
  const markAsLate = async (recordId: string, employeeUid: string, adminId?: string) => {
    if (!adminId) {
      toast({ title: "Error", description: "Unable to determine admin", variant: "destructive" });
      return;
    }
    try {
      const recordRef = ref(database, `users/${adminId}/employees/${employeeUid}/punching/${recordId}`);
      await update(recordRef, {
        status: 'late',
        markedLateBy: user?.name || 'admin',
        markedLateAt: new Date().toISOString(),
        markedHalfDayBy: null,
        markedHalfDayAt: null
      });
      toast({ title: "Success", description: "Marked as late" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to mark as late", variant: "destructive" });
    }
  };

  const markAsHalfDay = async (recordId: string, employeeUid: string, adminId?: string) => {
    if (!adminId) {
      toast({ title: "Error", description: "Unable to determine admin", variant: "destructive" });
      return;
    }
    try {
      const recordRef = ref(database, `users/${adminId}/employees/${employeeUid}/punching/${recordId}`);
      await update(recordRef, {
        status: 'half-day',
        markedHalfDayBy: user?.name || 'admin',
        markedHalfDayAt: new Date().toISOString(),
        markedLateBy: null,
        markedLateAt: null
      });
      toast({ title: "Success", description: "Marked as half day" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to mark as half day", variant: "destructive" });
    }
  };

  const resetStatus = async (recordId: string, employeeUid: string, adminId?: string) => {
    if (!adminId) {
      toast({ title: "Error", description: "Unable to determine admin", variant: "destructive" });
      return;
    }
    try {
      const recordRef = ref(database, `users/${adminId}/employees/${employeeUid}/punching/${recordId}`);
      await update(recordRef, {
        status: 'present',
        markedLateBy: null,
        markedLateAt: null,
        markedHalfDayBy: null,
        markedHalfDayAt: null
      });
      toast({ title: "Success", description: "Status reset to present" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to reset status", variant: "destructive" });
    }
  };

  const deleteAttendanceRecord = async (recordId: string, employeeUid: string, adminId?: string) => {
    if (!window.confirm('Delete this record?')) return;
    if (!adminId) {
      toast({ title: "Error", description: "Unable to determine admin", variant: "destructive" });
      return;
    }
    try {
      const recordRef = ref(database, `users/${adminId}/employees/${employeeUid}/punching/${recordId}`);
      await remove(recordRef);
      toast({ title: "Success", description: "Record deleted" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const showSystemNotification = (notification: Omit<Notification, 'id' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `${notification.employeeId}-${notification.timestamp}`,
      read: false
    };
    setNotifications(prev => [newNotification, ...prev]);
    setCurrentNotification(newNotification);
    setShowNotification(true);
    if (notificationPermission === 'granted') {
      const details = getNotificationDetails(notification.type);
      try {
        new Notification(`${details.title}: ${notification.employeeName}`, {
          body: `${details.title} at ${notification.time}` + (notification.department ? ` (${notification.department})` : ''),
          icon: '/logo.png',
          tag: `attendance-${notification.type}-${notification.timestamp}`
        });
      } catch (error) { console.error(error); }
    }
    const timeoutId = setTimeout(() => {
      setShowNotification(false);
      setTimeout(() => setCurrentNotification(null), 500);
    }, 5000);
    return () => clearTimeout(timeoutId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-700';
      case 'absent': return 'bg-red-100 text-red-700';
      case 'late': return 'bg-yellow-100 text-yellow-700';
      case 'half-day': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const calculateTotalBreakTime = (breaks: Record<string, BreakRecord> | undefined) => {
    if (!breaks) return 'N/A';
    let totalBreakMinutes = 0;
    Object.values(breaks).forEach(breakRecord => {
      if (breakRecord.breakOut && breakRecord.duration) {
        const durationStr = breakRecord.duration;
        const colonMatch = durationStr.match(/^(\d+):(\d+)$/);
        if (colonMatch) totalBreakMinutes += parseInt(colonMatch[1], 10) * 60 + parseInt(colonMatch[2], 10);
        else {
          const hoursMatch = durationStr.match(/(\d+(?:\.\d+)?)\s*h/i);
          const minutesMatch = durationStr.match(/(\d+(?:\.\d+)?)\s*m/i);
          if (hoursMatch) totalBreakMinutes += parseFloat(hoursMatch[1]) * 60;
          if (minutesMatch) totalBreakMinutes += parseFloat(minutesMatch[1]);
        }
      }
    });
    const hours = Math.floor(totalBreakMinutes / 60);
    const minutes = totalBreakMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  const exportAttendance = async () => {
    if (filteredRecords.length === 0) {
      toast({ title: "No Data", description: "No records to export", variant: "destructive" });
      return;
    }
    setExportLoading(true);
    try {
      const headers = ['Employee Name', 'Employee ID', 'Date', 'Punch In', 'Punch Out', 'Total Hours', 'Total Break Time', 'Status', 'Work Mode', 'Marked Late By', 'Marked Late At', 'Marked Half Day By', 'Marked Half Day At', 'Admin ID', 'Breaks'];
      const rows = filteredRecords.map(record => [
        record.employeeName,
        record.employeeId,
        new Date(record.date).toLocaleDateString(),
        record.punchIn || '-',
        record.punchOut || '-',
        calculateNetWorkDuration(record.punchIn, record.punchOut, record.breaks),
        calculateTotalBreakTime(record.breaks),
        record.status,
        record.workMode || 'office',
        record.markedLateBy || '-',
        record.markedLateAt ? new Date(record.markedLateAt).toLocaleString() : '-',
        record.markedHalfDayBy || '-',
        record.markedHalfDayAt ? new Date(record.markedHalfDayAt).toLocaleString() : '-',
        record.adminId || '-',
        record.breaks ? Object.entries(record.breaks).map(([breakId, breakData]) => `Break ${breakId}: ${breakData.breakIn} to ${breakData.breakOut || 'ongoing'} (${breakData.duration || 'N/A'})`).join('; ') : 'No breaks'
      ]);
      const csvContent = [headers, ...rows].map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_report_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export Successful", description: "Attendance data exported" });
    } catch (error) {
      toast({ title: "Export Failed", description: "Failed to export", variant: "destructive" });
    } finally {
      setExportLoading(false);
    }
  };

  const generateFullDailyReport = async () => {
    if (!filterDate) {
      toast({ title: "No Date Selected", description: "Please select a date", variant: "destructive" });
      return;
    }
    setExportLoading(true);
    try {
      const adminId = user?.id;
      if (!adminId) {
        toast({ title: "Error", description: "Admin ID not found", variant: "destructive" });
        return;
      }
      const employeesRef = ref(database, `users/${adminId}/employees`);
      const employeesSnap = await get(employeesRef);
      const employeesData = employeesSnap.val() as Record<string, FirebaseEmployeeData> | null;
      if (!employeesData) {
        toast({ title: "No Employees", description: "No employees found", variant: "destructive" });
        return;
      }
      const presentList: PresentEmployee[] = [];
      const absentList: AbsentEmployee[] = [];
      for (const [empId, empData] of Object.entries(employeesData)) {
        const employeeName = empData.name || 'Unknown';
        const employeeDepartment = empData.department || 'No Department';
        const attendanceRef = ref(database, `users/${adminId}/employees/${empId}/punching`);
        const attendanceSnap = await get(attendanceRef);
        const records = attendanceSnap.val() as Record<string, FirebaseAttendanceData> | null;
        let foundRecord: FirebaseAttendanceData | null = null;
        if (records) {
          for (const rec of Object.values(records)) {
            const recordDate = rec.date ? new Date(rec.date).toISOString().split('T')[0] : '';
            if (recordDate === filterDate) { foundRecord = rec; break; }
          }
        }
        if (foundRecord) {
          const punchIn = foundRecord.punchIn || '—';
          const punchOut = foundRecord.punchOut || '—';
          const totalHours = (foundRecord.punchOut && foundRecord.punchOut !== '—') 
            ? calculateNetWorkDuration(punchIn, punchOut, foundRecord.breaks) 
            : '—';
          const workMode = foundRecord.workMode || 'office';
          const status = foundRecord.status || 'present';
          presentList.push({ name: employeeName, department: employeeDepartment, punchIn, punchOut, totalHours, workMode, status });
        } else {
          absentList.push({ name: employeeName, department: employeeDepartment, status: 'Absent' });
        }
      }
      const csvRows: string[] = [];
      csvRows.push('"===== PRESENT EMPLOYEES ====="');
      csvRows.push('"Employee Name","Department","Punch In","Punch Out","Total Hours","Work Mode","Status"');
      for (const emp of presentList) csvRows.push(`"${emp.name}","${emp.department}","${emp.punchIn}","${emp.punchOut}","${emp.totalHours}","${emp.workMode}","${emp.status}"`);
      csvRows.push('');
      csvRows.push('"===== ABSENT EMPLOYEES ====="');
      csvRows.push('"Employee Name","Department","Status"');
      for (const emp of absentList) csvRows.push(`"${emp.name}","${emp.department}","${emp.status}"`);
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily_attendance_report_${filterDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Report Generated", description: `Present: ${presentList.length}, Absent: ${absentList.length}` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate report", variant: "destructive" });
    } finally {
      setExportLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterDate('');
    setFilterStatus('all');
  };

  const renderBreaksTooltip = (breaks: Record<string, BreakRecord> | undefined) => {
    if (!breaks || Object.keys(breaks).length === 0) return <span className="text-gray-400">No breaks</span>;
    return (
      <div className="max-w-xs">
        {Object.entries(breaks).map(([breakId, breakData]) => (
          <div key={breakId} className="mb-1 last:mb-0">
            <div className="font-medium">Break {breakId}</div>
            <div className="text-sm">
              <span className="text-green-600">{breakData.breakIn}</span> to{' '}
              {breakData.breakOut ? <span className="text-red-600">{breakData.breakOut}</span> : <span className="text-yellow-600">ongoing</span>}
              {breakData.duration && <span className="block text-gray-500">Duration: {breakData.duration}</span>}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const getNotificationDetails = (type: string) => {
    switch (type) {
      case 'punch-in': return { title: 'Punched In', color: 'bg-green-100 text-green-800' };
      case 'punch-out': return { title: 'Punched Out', color: 'bg-blue-100 text-blue-800' };
      case 'break-in': return { title: 'Break Started', color: 'bg-yellow-100 text-yellow-800' };
      case 'break-out': return { title: 'Break Ended', color: 'bg-purple-100 text-purple-800' };
      default: return { title: 'Notification', color: 'bg-gray-100 text-gray-800' };
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-40"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div></div>;
  }

  return (
    <div className="space-y-6 relative">
      {showNotification && currentNotification && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm w-full ${getNotificationDetails(currentNotification.type).color} border-l-4 ${
            currentNotification.type === 'punch-in' ? 'border-green-500' :
            currentNotification.type === 'punch-out' ? 'border-blue-500' :
            currentNotification.type === 'break-in' ? 'border-yellow-500' :
            'border-purple-500'
          }`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0"><Bell className="h-5 w-5" /></div>
            <div className="ml-3 w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium">{getNotificationDetails(currentNotification.type).title}</p>
              <p className="mt-1 text-sm"><span className="font-semibold">{currentNotification.employeeName}</span>{currentNotification.department && <span> ({currentNotification.department})</span>}</p>
              <p className="mt-1 text-sm">{currentNotification.type.includes('punch') ? 'Punch' : 'Break'} time: {currentNotification.time}</p>
              {currentNotification.email && <p className="mt-1 text-xs text-gray-600">{currentNotification.email}</p>}
            </div>
            <div className="ml-4 flex-shrink-0 flex"><button onClick={() => setShowNotification(false)} className="rounded-md inline-flex text-gray-400 hover:text-gray-500"><svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button></div>
          </div>
        </motion.div>
      )}

      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-800">Attendance Management</h1><p className="text-gray-600">Track and manage employee attendance across all departments</p></div>
        <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Filter className="h-4 w-4" /> Filters</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><Input placeholder="Search employee..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" /></div>
            <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
            <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="present">Present</SelectItem><SelectItem value="absent">Absent</SelectItem><SelectItem value="late">Late</SelectItem><SelectItem value="half-day">Half Day</SelectItem></SelectContent></Select>
            <Button onClick={exportAttendance} disabled={exportLoading || filteredRecords.length === 0} className="w-full">{exportLoading ? <><Clock className="h-4 w-4 mr-2 animate-spin" /> Exporting...</> : <><Download className="h-4 w-4 mr-2" /> Export ({filteredRecords.length})</>}</Button>
            <Button onClick={generateFullDailyReport} disabled={exportLoading || !filterDate} variant="outline" className="w-full">{exportLoading ? <Clock className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />} Full Report</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Attendance Records ({filteredRecords.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Punch In</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Punch Out</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Hours</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Break Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Work Mode</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Punch In Selfie</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Punch Out Selfie</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayedRecords.map((record, idx) => (
                  <tr key={`${record.id}-${idx}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{record.employeeName}</div><div className="text-xs text-gray-500">{record.employeeId}</div></td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{new Date(record.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1 text-sm text-green-600"><Clock className="h-3 w-3" /> {record.punchIn || '-'}</span></td>
                    <td className="px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1 text-sm text-red-600"><Clock className="h-3 w-3" /> {record.punchOut || '-'}</span></td>
                    {/* ✅ Total Hours now uses net work duration */}
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{calculateNetWorkDuration(record.punchIn, record.punchOut, record.breaks)}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><div className="group relative"><span className="cursor-help text-sm text-gray-700 underline decoration-dotted">{calculateTotalBreakTime(record.breaks)}</span><div className="absolute z-10 hidden group-hover:block bg-white p-3 border rounded-lg shadow-lg w-64">{renderBreaksTooltip(record.breaks)}</div></div></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge className={`${getStatusColor(record.status)} text-xs font-medium`}>{record.status}</Badge>
                      {record.markedLateBy && <p className="text-xs text-gray-500 mt-1">Marked late by {record.markedLateBy}</p>}
                      {record.markedHalfDayBy && <p className="text-xs text-gray-500 mt-1">Marked half day by {record.markedHalfDayBy}</p>}
                      {record.status === 'half-day' && (
                        <p className="text-xs text-purple-600 mt-1 italic">Net hours &lt; 8 after breaks</p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><Badge variant="outline" className="text-xs font-medium">{record.workMode || 'office'}</Badge></td>
                    <td className="px-4 py-3 text-sm text-gray-600">{record.location || record.locationOut ? (<div className="text-xs space-y-1">{record.location && <div>📍 In: {record.location.name?.slice(0, 40) || `${record.location.lat}, ${record.location.lng}`}</div>}{record.locationOut && <div>📍 Out: {record.locationOut.name?.slice(0, 40) || `${record.locationOut.lat}, ${record.locationOut.lng}`}</div>}</div>) : <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{record.selfie ? <img src={record.selfie} alt="Punch In Selfie" className="w-8 h-8 rounded-full object-cover cursor-pointer border border-gray-300 hover:opacity-80" onClick={() => setImageModal({ src: record.selfie!, title: `Punch In Selfie - ${record.employeeName}` })} /> : <span className="text-gray-400 text-sm">—</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{record.selfieOut ? <img src={record.selfieOut} alt="Punch Out Selfie" className="w-8 h-8 rounded-full object-cover cursor-pointer border border-gray-300 hover:opacity-80" onClick={() => setImageModal({ src: record.selfieOut!, title: `Punch Out Selfie - ${record.employeeName}` })} /> : <span className="text-gray-400 text-sm">—</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><div className="flex gap-1">
                      {record.status === 'late' ? (
                        <><Button size="sm" variant="outline" onClick={() => markAsHalfDay(record.id, record.employeeUid!, record.adminId)} className="text-purple-600 h-8 px-2 text-xs"><Sun className="h-3 w-3 mr-1" /> Half Day</Button><Button size="sm" variant="outline" onClick={() => resetStatus(record.id, record.employeeUid!, record.adminId)} className="text-green-600 h-8 px-2 text-xs">Reset</Button></>
                      ) : record.status === 'half-day' ? (
                        <><Button size="sm" variant="outline" onClick={() => markAsLate(record.id, record.employeeUid!, record.adminId)} className="text-yellow-600 h-8 px-2 text-xs"><AlertTriangle className="h-3 w-3 mr-1" /> Late</Button><Button size="sm" variant="outline" onClick={() => resetStatus(record.id, record.employeeUid!, record.adminId)} className="text-green-600 h-8 px-2 text-xs">Reset</Button></>
                      ) : record.status === 'present' ? (
                        <><Button size="sm" variant="outline" onClick={() => markAsLate(record.id, record.employeeUid!, record.adminId)} className="text-yellow-600 h-8 px-2 text-xs"><AlertTriangle className="h-3 w-3 mr-1" /> Late</Button><Button size="sm" variant="outline" onClick={() => markAsHalfDay(record.id, record.employeeUid!, record.adminId)} className="text-purple-600 h-8 px-2 text-xs"><Sun className="h-3 w-3 mr-1" /> Half Day</Button></>
                      ) : null}
                      <Button size="sm" variant="outline" onClick={() => deleteAttendanceRecord(record.id, record.employeeUid!, record.adminId)} className="text-red-600 h-8 px-2"><Trash2 className="h-3 w-3" /></Button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {displayedRecords.length === 0 && <div className="text-center py-12 text-gray-500">No attendance records found matching your filters</div>}
          </div>
          {hasMore && (
            <div className="flex justify-center mt-4">
              <Button onClick={loadMore} disabled={loadingMore} variant="outline">{loadingMore ? 'Loading...' : 'Load More'}</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {imageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setImageModal(null)}>
          <div className="relative max-w-3xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
            <img src={imageModal.src} alt={imageModal.title} className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" />
            <div className="mt-4 flex justify-between items-center"><p className="text-white font-medium">{imageModal.title}</p><button onClick={() => setImageModal(null)} className="px-4 py-2 bg-white rounded-md text-gray-800 hover:bg-gray-100">Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceManagement;