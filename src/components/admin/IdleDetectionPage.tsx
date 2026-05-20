import React, { useState, useEffect, useRef } from 'react';
import { Clock, AlertTriangle, Play, Coffee, Download, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ref, onValue, off, get, set } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';

// ========== TYPES ==========
interface ActivityData {
  isIdle?: boolean;
  idleStartTime?: number | null;
  lastActive?: number;
  status?: string;
}

interface IdleEmployee {
  id: string;
  employeeKey: string;
  name: string;
  email: string;
  department: string;
  isPunchedIn: boolean;
  isOnBreak: boolean;
  isIdle: boolean;
  idleStartTime: number | null;
  lastActive: number;
  totalIdleMsToday: number;
  ongoingIdleMs?: number;
  adminId: string;
}

interface BreakData {
  breakIn: string;
  breakOut?: string;
  duration?: string;
}

interface AttendanceRecordData {
  date: string;
  punchIn: string;
  punchOut?: string | null;
  breaks?: Record<string, BreakData>;
}

interface RawEmployeeData {
  name?: string;
  email?: string;
  department?: string;
  firebaseUid?: string;
  [key: string]: unknown;
}

interface UsersSnapshot {
  [adminId: string]: {
    employees?: Record<string, RawEmployeeData>;
  };
}

// ========== HELPERS ==========
const getTodayStr = () => new Date().toISOString().split('T')[0];

const formatIdleDuration = (ms: number): string => {
  if (ms <= 0) return '0s';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
};

const fetchTotalIdleToday = async (uid: string): Promise<number> => {
  const today = getTodayStr();
  const totalRef = ref(database, `idleLogs/${uid}/${today}/totalIdleMs`);
  const snapshot = await get(totalRef);
  const value = snapshot.val();
  return typeof value === 'number' ? value : 0;
};

// ========== MAIN COMPONENT ==========
const IdleDetectionPage: React.FC<{ role?: string; department?: string }> = ({
  role = 'admin',
  department: propDepartment
}) => {
  const { user } = useAuth();
  const isManager = role === 'manager';
  const effectiveDepartment = propDepartment || user?.department || '';

  const [employees, setEmployees] = useState<IdleEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [stats, setStats] = useState({ avgIdleMinutes: 0, highIdleCount: 0, onBreakCount: 0 });

  const attendanceUnsubsRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  const exportDailyReport = () => {
    const punchedIn = employees.filter(e => e.isPunchedIn);
    if (punchedIn.length === 0) {
      toast.error('No punched‑in employees to export');
      return;
    }
    const headers = ['Employee', 'Department', 'Status', 'Current Idle', 'Total Idle Today', 'Alert'];
    const rows = punchedIn.map(emp => {
      let currentIdleMs = 0;
      if (emp.isIdle && emp.idleStartTime) {
        currentIdleMs = Math.max(0, currentTime - emp.idleStartTime);
      }
      const totalDisplayMs = emp.totalIdleMsToday + (emp.ongoingIdleMs || 0);
      const totalIdleMinutes = Math.floor(totalDisplayMs / 60000);
      const status = emp.isOnBreak ? 'break' : (emp.isIdle ? 'idle' : 'active');
      const alert = totalIdleMinutes > 45 ? 'High Idle' : '';
      return [
        emp.name,
        emp.department,
        status,
        formatIdleDuration(currentIdleMs),
        formatIdleDuration(totalDisplayMs),
        alert,
      ];
    });
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `idle_report_${getTodayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report downloaded');
  };

  // Load employees (basic info, no attendance status yet)
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const loadEmployees = async () => {
      const usersSnap = await get(ref(database, 'users'));
      const allUsers = usersSnap.val() as UsersSnapshot | null;
      if (!allUsers) {
        setEmployees([]);
        setLoading(false);
        return;
      }

      const employeeMap = new Map<string, {
        employeeKey: string;
        name: string;
        department: string;
        email: string;
        adminId: string;
      }>();

      for (const [adminId, adminData] of Object.entries(allUsers)) {
        const employeesNode = adminData?.employees;
        if (!employeesNode || typeof employeesNode !== 'object') continue;
        for (const [empKey, empData] of Object.entries(employeesNode)) {
          const profile = empData as RawEmployeeData;
          const firebaseUid = typeof profile.firebaseUid === 'string' ? profile.firebaseUid : empKey;
          if (!firebaseUid) continue;

          employeeMap.set(firebaseUid, {
            employeeKey: empKey,
            name: typeof profile.name === 'string' ? profile.name : empKey,
            department: typeof profile.department === 'string' ? profile.department : 'No Department',
            email: typeof profile.email === 'string' ? profile.email : '',
            adminId,
          });
        }
      }

      let filteredEntries = Array.from(employeeMap.entries());
      if (isManager && effectiveDepartment) {
        filteredEntries = filteredEntries.filter(([, info]) => info.department === effectiveDepartment);
      }

      const initialEmployees: IdleEmployee[] = [];
      for (const [firebaseUid, info] of filteredEntries) {
        const totalIdleMs = await fetchTotalIdleToday(firebaseUid);
        initialEmployees.push({
          id: firebaseUid,
          employeeKey: info.employeeKey,
          name: info.name,
          email: info.email,
          department: info.department,
          isPunchedIn: false,
          isOnBreak: false,
          isIdle: false,
          idleStartTime: null,
          lastActive: Date.now(),
          totalIdleMsToday: totalIdleMs,
          adminId: info.adminId,
        });
      }
      setEmployees(initialEmployees);
      setLoading(false);
    };

    loadEmployees();
  }, [user?.id, refreshKey, isManager, effectiveDepartment]);

  // Real‑time attendance listeners (punch status)
  useEffect(() => {
    attendanceUnsubsRef.current.forEach(unsub => unsub());
    attendanceUnsubsRef.current = [];

    if (employees.length === 0) return;

    const today = getTodayStr();
    const unsubs: (() => void)[] = [];

    employees.forEach(emp => {
      const punchingRef = ref(database, `users/${emp.adminId}/employees/${emp.employeeKey}/punching`);
      const unsub = onValue(punchingRef, (snapshot) => {
        const records = snapshot.val() as Record<string, AttendanceRecordData> | null;
        let isPunchedIn = false;
        let isOnBreak = false;

        if (records) {
          for (const rec of Object.values(records)) {
            if (rec.date && rec.date.startsWith(today)) {
              const hasPunchIn = Boolean(rec.punchIn);
              const isPunchedOut =
                rec.punchOut !== undefined &&
                rec.punchOut !== null &&
                rec.punchOut !== '';
              isPunchedIn = hasPunchIn && !isPunchedOut;
              if (rec.breaks) {
                isOnBreak = Object.values(rec.breaks).some(
                  (brk) => brk.breakIn && !brk.breakOut
                );
              }
              break;
            }
          }
        }

        setEmployees(prev =>
          prev.map(e =>
            e.id === emp.id
              ? { ...e, isPunchedIn, isOnBreak }
              : e
          )
        );
      });
      unsubs.push(unsub);
    });

    attendanceUnsubsRef.current = unsubs;
    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [employees.map(e => e.id).join(',')]);

  // Real‑time activity listener (idle status) – adds ongoing idle duration
  useEffect(() => {
    const activityRef = ref(database, 'activity');
    const unsubscribe = onValue(activityRef, (snap) => {
      const activity = snap.val() as Record<string, ActivityData> | null;
      if (!activity) return;
      const now = Date.now();
      setEmployees(prev =>
        prev.map(emp => {
          const act = activity[emp.id];
          const isIdleNow = act?.isIdle === true;
          let ongoingMs = 0;
          if (isIdleNow && act?.idleStartTime) {
            ongoingMs = Math.max(0, now - act.idleStartTime);
          }
          return {
            ...emp,
            isIdle: isIdleNow,
            idleStartTime: isIdleNow ? (act?.idleStartTime ?? null) : null,
            lastActive: act?.lastActive ?? emp.lastActive,
            ongoingIdleMs: ongoingMs,
          };
        })
      );
    });
    return () => off(activityRef);
  }, []);

  // Update stats – only for punched‑in employees
  useEffect(() => {
    const punchedIn = employees.filter(e => e.isPunchedIn);
    const totalIdleMinutes = punchedIn.reduce((sum, e) => sum + ((e.totalIdleMsToday + (e.ongoingIdleMs || 0)) / 60000), 0);
    const avgIdleMinutes = punchedIn.length ? Math.round(totalIdleMinutes / punchedIn.length) : 0;
    const highIdleCount = punchedIn.filter(e => (e.totalIdleMsToday + (e.ongoingIdleMs || 0)) > 45 * 60000).length;
    const onBreakCount = punchedIn.filter(e => e.isOnBreak).length;
    setStats({ avgIdleMinutes, highIdleCount, onBreakCount });
  }, [employees]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // ✅ FIX: Only show employees who are currently punched in (active work session)
  const displayedEmployees = employees.filter(e => e.isPunchedIn);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Idle Detection</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isManager && effectiveDepartment
              ? `Real‑time idle monitoring for ${effectiveDepartment} department`
              : 'Real‑time idle monitoring for employees currently punched in'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportDailyReport}>
            <Download className="w-4 h-4 mr-1" /> Download Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-500">Avg Idle Time</span>
            </div>
            <p className="text-2xl font-semibold">{stats.avgIdleMinutes}m</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-gray-500">High Idle (&gt;45m)</span>
            </div>
            <p className="text-2xl font-semibold">{stats.highIdleCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coffee className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-500">On Break</span>
            </div>
            <p className="text-2xl font-semibold">{stats.onBreakCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="border-b">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Employee</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Department</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Current Idle</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Total Idle Today</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Alert</th>
              </tr>
            </thead>
            <tbody>
              {displayedEmployees.map(emp => {
                let currentIdleMs = 0;
                if (emp.isIdle === true && typeof emp.idleStartTime === 'number') {
                  currentIdleMs = Math.max(0, currentTime - emp.idleStartTime);
                }
                const totalDisplayMs = emp.totalIdleMsToday + (emp.ongoingIdleMs || 0);
                const totalIdleMinutes = Math.floor(totalDisplayMs / 60000);
                const isHighIdle = totalIdleMinutes > 45;
                const status = emp.isOnBreak ? 'break' : (emp.isIdle ? 'idle' : 'active');
                return (
                  <tr key={emp.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{emp.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{emp.department || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs ${
                        status === 'active'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : status === 'break'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                      }`}>
                        {status === 'active' && <Play className="w-3 h-3 mr-1" />}
                        {status === 'break' && <Coffee className="w-3 h-3 mr-1" />}
                        {status === 'idle' && <Clock className="w-3 h-3 mr-1" />}
                        {status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{formatIdleDuration(currentIdleMs)}</td>
                    <td className="px-4 py-3 font-mono text-sm">{formatIdleDuration(totalDisplayMs)}</td>
                    <td className="px-4 py-3">
                      {isHighIdle && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          High Idle
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-2 text-red-600"
                        onClick={async () => {
                          const today = getTodayStr();
                          const totalRef = ref(database, `idleLogs/${emp.id}/${today}/totalIdleMs`);
                          await set(totalRef, 0);
                          toast.success(`Idle time reset for ${emp.name}`);
                          handleRefresh();
                        }}
                      >
                        Reset
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {displayedEmployees.length === 0 && (
          <div className="text-center py-8 text-gray-500">No employees currently punched in</div>
        )}
      </div>
    </div>
  );
};

export default IdleDetectionPage;