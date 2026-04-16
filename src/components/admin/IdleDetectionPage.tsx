import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, Play, Coffee } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { ref, onValue, off, get } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';

interface EmployeeProfile {
  name: string;
  email?: string;
  department?: string;
}

interface PunchRecord {
  punchIn?: string;
  punchOut?: string | null;
  date?: string;
  status?: string;
  breaks?: Record<string, { breakIn: string; breakOut?: string }>;
}

interface ActivityData {
  isIdle?: boolean;
  idleStartTime?: number;
  lastActive?: number;
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
  adminId: string; // for debugging
}

const getTodayStr = () => new Date().toISOString().split('T')[0];

// Improved date matching: tries several formats
const isToday = (dateStr?: string): boolean => {
  if (!dateStr) return false;
  const today = getTodayStr();
  // Case 1: "2026-04-16T09:30:00.000Z"
  if (dateStr.startsWith(today)) return true;
  // Case 2: "2026-04-16"
  if (dateStr === today) return true;
  // Case 3: numeric timestamp (milliseconds)
  const timestamp = Number(dateStr);
  if (!isNaN(timestamp) && timestamp > 0) {
    const d = new Date(timestamp);
    return d.toISOString().split('T')[0] === today;
  }
  // Case 4: try to parse as Date object
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0] === today;
    }
  } catch (e) {
    // ignore
  }
  return false;
};

// Fetch today's attendance record for an employee
const getTodayAttendanceRecord = async (
  adminId: string,
  empId: string
): Promise<PunchRecord | null> => {
  const punchingRef = ref(database, `users/${adminId}/employees/${empId}/punching`);
  const snapshot = await get(punchingRef);
  const data = snapshot.val() as Record<string, PunchRecord> | null;
  if (!data) return null;

  // Find the record that matches today's date
  for (const rec of Object.values(data)) {
    if (isToday(rec.date)) {
      return rec;
    }
  }
  return null;
};

const getPunchedInStatus = (record: PunchRecord | null): { isPunchedIn: boolean; isOnBreak: boolean } => {
  if (!record) return { isPunchedIn: false, isOnBreak: false };
  const isPunchedIn = !!record.punchIn && !record.punchOut;
  let isOnBreak = false;
  if (record.breaks) {
    isOnBreak = Object.values(record.breaks).some(brk => brk.breakIn && !brk.breakOut);
  }
  return { isPunchedIn, isOnBreak };
};

const IdleDetectionPage = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<IdleEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    avgIdleMinutes: 0,
    highIdleCount: 0,
    onBreakCount: 0,
  });

  const formatIdleTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  const fetchTotalIdleToday = async (empId: string): Promise<number> => {
    const today = getTodayStr();
    const totalRef = ref(database, `idleLogs/${empId}/${today}/totalIdleMs`);
    const snapshot = await get(totalRef);
    return snapshot.val() || 0;
  };

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const fetchAllEmployees = async () => {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      const allUsers = snapshot.val() as Record<string, any> | null;
      if (!allUsers) {
        setEmployees([]);
        setLoading(false);
        return;
      }

      const allEmployees: IdleEmployee[] = [];

      // Iterate over every user (admin) node
      for (const [adminId, adminData] of Object.entries(allUsers)) {
        const employeesNode = adminData?.employees;
        if (!employeesNode || typeof employeesNode !== 'object') continue;

        for (const [empId, empData] of Object.entries(employeesNode)) {
          const profile = empData as EmployeeProfile;
          // Use name if available, otherwise fallback to ID
          const employeeName = profile.name || empId;
          const employeeDept = profile.department || 'No Department';
          const employeeEmail = profile.email || '';

          // Fetch attendance record for this employee (using the correct adminId)
          const attendanceRecord = await getTodayAttendanceRecord(adminId, empId);
          const status = getPunchedInStatus(attendanceRecord);
          const totalIdleMs = await fetchTotalIdleToday(empId);

          // Log Samina's data for debugging
          if (employeeName.toLowerCase().includes('samina')) {
            console.log(`🔍 Samina Begum found under admin ${adminId}`);
            console.log('  Employee ID:', empId);
            console.log('  Attendance record:', attendanceRecord);
            console.log('  isPunchedIn:', status.isPunchedIn);
            console.log('  isOnBreak:', status.isOnBreak);
            console.log('  totalIdleMs:', totalIdleMs);
          }

          allEmployees.push({
            id: empId,
            name: employeeName,
            email: employeeEmail,
            department: employeeDept,
            isPunchedIn: status.isPunchedIn,
            isOnBreak: status.isOnBreak,
            isIdle: false,
            idleStartTime: null,
            lastActive: Date.now(),
            totalIdleMsToday: totalIdleMs,
            adminId: adminId,
          });
        }
      }

      console.log(`Total employees found across all admins: ${allEmployees.length}`);
      console.log('First 5 employees:', allEmployees.slice(0, 5).map(e => ({ name: e.name, isPunchedIn: e.isPunchedIn })));
      setEmployees(allEmployees);
      setLoading(false);

      // Set up real-time listeners for all employees (optional, but we'll keep it simple)
      // For performance, we only listen to activity for idle status (global)
      const activityRef = ref(database, 'activity');
      const unsubscribeActivity = onValue(activityRef, (snap) => {
        const activity = snap.val() as Record<string, ActivityData> | null;
        setEmployees(prev =>
          prev.map(emp => {
            const act = activity?.[emp.id];
            return {
              ...emp,
              isIdle: act?.isIdle || false,
              idleStartTime: act?.idleStartTime || null,
              lastActive: act?.lastActive || emp.lastActive,
            };
          })
        );
      });

      // We won't set up per‑employee punching listeners to avoid too many listeners,
      // but the page will refresh when the user reloads or we can add a refresh button.
      // For real‑time, we could add them, but it's optional.

      return () => {
        off(activityRef);
      };
    };

    fetchAllEmployees();
  }, [user?.id]);

  // Recalculate stats only for punched‑in employees
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
  console.log(`Punched in employees count: ${punchedInEmployees.length}`, punchedInEmployees.map(e => e.name));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Idle Detection</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Real‑time idle monitoring for employees currently punched in
        </p>
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
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Employee</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Department</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Current Idle</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Total Idle Today</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Alert</th>
              </tr>
            </thead>
            <tbody>
              {punchedInEmployees.map((emp) => {
                const currentIdleMinutes = emp.isIdle && emp.idleStartTime
                  ? Math.floor((Date.now() - emp.idleStartTime) / 60000)
                  : 0;
                const totalIdleMinutes = Math.floor(emp.totalIdleMsToday / 60000);
                const isHighIdle = totalIdleMinutes > 45;
                const status = emp.isOnBreak ? 'break' : (emp.isIdle ? 'idle' : 'active');

                return (
                  <tr key={emp.id} className="border-b last:border-0 hover:bg-gray-50 transition">
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
                      {currentIdleMinutes > 0 ? formatIdleTime(currentIdleMinutes * 60000) : '0m'}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">
                      {formatIdleTime(emp.totalIdleMsToday)}
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