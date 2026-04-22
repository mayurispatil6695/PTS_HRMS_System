import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, Play, Coffee, Download, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ref, onValue, off, get } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';

// ========== TYPES ==========
interface EmployeeProfile {
  name: string;
  email?: string;
  department?: string;
}

interface ActivityData {
  isIdle?: boolean;
  idleStartTime?: number;
  lastActive?: number;
  status?: string;
}

interface IdleEmployee {
  id: string;
  name: string;
  email: string;
  department: string;
  isPunchedIn: boolean;
  isOnBreak: boolean;
  isIdle: boolean;
  idleStartTime: number | null;
  lastActive: number;
  totalIdleMsToday: number;
  adminId: string;
}

interface FirebaseUserData {
  employees?: Record<string, EmployeeProfile>;
  [key: string]: unknown;
}

interface BreakData {
  breakIn: string;
  breakOut?: string;
  duration?: string;
}

interface AttendanceRecord {
  date: string;
  punchIn: string;
  punchOut?: string | null;
  breaks?: Record<string, BreakData>;
}

// ========== PROPS ==========
interface IdleDetectionPageProps {
  role?: 'admin' | 'manager' | 'team_leader' | 'client';
  department?: string;
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

// Reads from root‑level idleLogs
const fetchTotalIdleToday = async (firebaseUid: string): Promise<number> => {
  const today = getTodayStr();
  const totalRef = ref(database, `idleLogs/${firebaseUid}/${today}/totalIdleMs`);
  const snapshot = await get(totalRef);
  const value = snapshot.val();
  return typeof value === 'number' ? value : 0;
};

// Cache for email → Firebase UID
let emailToUidCache: Record<string, string> | null = null;

const getFirebaseUidByEmail = async (email: string): Promise<string | null> => {
  if (!email) return null;
  if (!emailToUidCache) {
    const usersSnap = await get(ref(database, 'users'));
    const users = usersSnap.val() as Record<string, { email?: string }> | null;
    emailToUidCache = {};
    if (users) {
      for (const [uid, user] of Object.entries(users)) {
        if (user.email) emailToUidCache[user.email] = uid;
      }
    }
  }
  return emailToUidCache[email] || null;
};

// Get today's punch status from attendance records
const getTodayPunchStatus = async (
  adminId: string,
  empKey: string
): Promise<{ isPunchedIn: boolean; isOnBreak: boolean }> => {
  const today = getTodayStr();
  const punchingRef = ref(database, `users/${adminId}/employees/${empKey}/punching`);
  const snapshot = await get(punchingRef);
  const records = snapshot.val() as Record<string, AttendanceRecord> | null;
  if (!records) return { isPunchedIn: false, isOnBreak: false };

  for (const record of Object.values(records)) {
    if (record.date && record.date.startsWith(today)) {
      const isPunchedIn = !!record.punchIn && !record.punchOut;
      let isOnBreak = false;
      if (record.breaks) {
        isOnBreak = Object.values(record.breaks).some((brk) => brk.breakIn && !brk.breakOut);
      }
      return { isPunchedIn, isOnBreak };
    }
  }
  return { isPunchedIn: false, isOnBreak: false };
};

// ========== MAIN COMPONENT ==========
const IdleDetectionPage: React.FC<IdleDetectionPageProps> = ({ 
  role = 'admin', 
  department: propDepartment 
}) => {
  const { user } = useAuth();
  const effectiveRole = role;
  const effectiveDepartment = propDepartment || user?.department || '';
  const isManager = effectiveRole === 'manager';

  const [employees, setEmployees] = useState<IdleEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [stats, setStats] = useState({ avgIdleMinutes: 0, highIdleCount: 0, onBreakCount: 0 });

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    toast.success('Refreshing idle data...');
  };

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
      const totalIdleMinutes = Math.floor(emp.totalIdleMsToday / 60000);
      const status = emp.isOnBreak ? 'break' : (emp.isIdle ? 'idle' : 'active');
      const alert = totalIdleMinutes > 45 ? 'High Idle' : '';
      return [
        emp.name,
        emp.department,
        status,
        formatIdleDuration(currentIdleMs),
        formatIdleDuration(emp.totalIdleMsToday),
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

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      const usersSnap = await get(ref(database, 'users'));
      const allUsers = usersSnap.val() as Record<string, FirebaseUserData> | null;
      if (!allUsers) {
        setEmployees([]);
        setLoading(false);
        return;
      }

      const employeeMap = new Map<
        string,
        { name: string; department: string; email: string; adminId: string }
      >();

      for (const [adminId, adminData] of Object.entries(allUsers)) {
        const employeesNode = adminData?.employees;
        if (!employeesNode || typeof employeesNode !== 'object') continue;
        for (const [empKey, empData] of Object.entries(employeesNode)) {
          const profile = empData as EmployeeProfile;
          if (!employeeMap.has(empKey)) {
            employeeMap.set(empKey, {
              name: profile.name || empKey,
              department: profile.department || 'No Department',
              email: profile.email || '',
              adminId,
            });
          }
        }
      }

      // ✅ Filter by department if manager
      let filteredEntries = Array.from(employeeMap.entries());
      if (isManager && effectiveDepartment) {
        filteredEntries = filteredEntries.filter(([, info]) => info.department === effectiveDepartment);
      }

      const employeePromises: Promise<IdleEmployee>[] = [];
      for (const [empKey, info] of filteredEntries) {
        employeePromises.push(
          (async () => {
            const punchStatus = await getTodayPunchStatus(info.adminId, empKey);
            const firebaseUid = await getFirebaseUidByEmail(info.email);
            const uidForIdle = firebaseUid || empKey;
            const totalIdleMs = await fetchTotalIdleToday(uidForIdle);
            return {
              id: empKey,
              name: info.name,
              email: info.email,
              department: info.department,
              isPunchedIn: punchStatus.isPunchedIn,
              isOnBreak: punchStatus.isOnBreak,
              isIdle: false,
              idleStartTime: null,
              lastActive: Date.now(),
              totalIdleMsToday: totalIdleMs,
              adminId: info.adminId,
            };
          })()
        );
      }
      const allEmployees = await Promise.all(employeePromises);
      setEmployees(allEmployees);
      setLoading(false);

      const activityRef = ref(database, 'activity');
      const unsubscribeActivity = onValue(activityRef, (snap) => {
        const activity = snap.val() as Record<string, ActivityData> | null;
        if (!activity) return;
        setEmployees(prev =>
          prev.map(emp => {
            const act = activity[emp.id];
            return {
              ...emp,
              isIdle: act?.isIdle || false,
              idleStartTime: act?.idleStartTime || null,
              lastActive: act?.lastActive || emp.lastActive,
            };
          })
        );
      });

      return () => off(activityRef);
    };

    loadData();
  }, [user?.id, refreshKey, isManager, effectiveDepartment]);

  useEffect(() => {
    const punchedIn = employees.filter(e => e.isPunchedIn);
    const totalIdleMinutes = punchedIn.reduce((sum, e) => sum + (e.totalIdleMsToday / 60000), 0);
    const avgIdleMinutes = punchedIn.length ? Math.round(totalIdleMinutes / punchedIn.length) : 0;
    const highIdleCount = punchedIn.filter(e => e.totalIdleMsToday > 45 * 60000).length;
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

  const punchedInEmployees = employees.filter(e => e.isPunchedIn);

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
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <Clock className="w-4 h-4 text-gray-600" />
              </div>
              <span className="text-sm text-gray-500">Avg Idle Time</span>
            </div>
            <p className="text-2xl font-semibold">{stats.avgIdleMinutes}m</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-600" />
              </div>
              <span className="text-sm text-gray-500">High Idle (&gt;45m)</span>
            </div>
            <p className="text-2xl font-semibold">{stats.highIdleCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <Coffee className="w-4 h-4 text-gray-600" />
              </div>
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
              {punchedInEmployees.map(emp => {
                let currentIdleMs = 0;
                if (emp.isIdle && emp.idleStartTime) {
                  currentIdleMs = currentTime - emp.idleStartTime;
                  if (currentIdleMs < 0) currentIdleMs = 0;
                }
                const totalIdleMinutes = Math.floor(emp.totalIdleMsToday / 60000);
                const isHighIdle = totalIdleMinutes > 45;
                const status = emp.isOnBreak ? 'break' : (emp.isIdle ? 'idle' : 'active');

                return (
                  <tr key={emp.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{emp.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{emp.department || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          status === 'active'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : status === 'break'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        }`}
                      >
                        {status === 'active' && <Play className="w-3 h-3 mr-1" />}
                        {status === 'break' && <Coffee className="w-3 h-3 mr-1" />}
                        {status === 'idle' && <Clock className="w-3 h-3 mr-1" />}
                        {status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">
                      {formatIdleDuration(currentIdleMs)}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">
                      {formatIdleDuration(emp.totalIdleMsToday)}
                    </td>
                    <td className="px-4 py-3">
                      {isHighIdle && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          High Idle
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {punchedInEmployees.length === 0 && (
          <div className="text-center py-8 text-gray-500">No employees currently punched in</div>
        )}
      </div>
    </div>
  );
};

export default IdleDetectionPage;