import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, Play, Coffee } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { ref, onValue, off, get } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';

// --- Type definitions ---
interface EmployeeProfile {
  name: string;
  email?: string;
  department?: string;
}

interface WorkSession {
  isPunchedIn: boolean;
  isOnBreak: boolean;
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
}

// --- Component ---
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
    const today = new Date().toISOString().split('T')[0];
    const totalRef = ref(database, `idleLogs/${empId}/${today}/totalIdleMs`);
    const snapshot = await get(totalRef);
    return snapshot.val() || 0;
  };

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const adminId = user.id;
    const employeesRef = ref(database, `users/${adminId}/employees`);

    const unsubscribeEmployees = onValue(employeesRef, async (snapshot) => {
      const employeesData = snapshot.val() as Record<string, EmployeeProfile> | null;
      if (!employeesData) {
        setEmployees([]);
        setLoading(false);
        return;
      }

      // Get all employee IDs that have a name (valid employees)
      const validEntries = Object.entries(employeesData).filter(([_, data]) => data?.name);
      const empIds = validEntries.map(([id]) => id);
      const empNames = validEntries.map(([_, data]) => data.name);
      const empDepartments = validEntries.map(([_, data]) => data.department || '');
      const empEmails = validEntries.map(([_, data]) => data.email || '');

      // Fetch total idle time for each employee
      const idleTotals = await Promise.all(empIds.map(id => fetchTotalIdleToday(id)));

      // Build initial list (without punch‑in/break status yet)
      const initialEmployees: IdleEmployee[] = empIds.map((id, idx) => ({
        id,
        name: empNames[idx],
        email: empEmails[idx],
        department: empDepartments[idx],
        isPunchedIn: false,      // will be updated by listeners
        isOnBreak: false,
        isIdle: false,
        idleStartTime: null,
        lastActive: Date.now(),
        totalIdleMsToday: idleTotals[idx],
      }));

      // --- Real‑time listeners for each employee ---
      const unsubscribeFunctions: (() => void)[] = [];

      // 1. Listen to work sessions (punch‑in/out and break)
      empIds.forEach(id => {
        const workRef = ref(database, `workSessions/${id}`);
        const unsubscribe = onValue(workRef, (snap) => {
          const data = snap.val() as WorkSession | null;
          setEmployees(prev =>
            prev.map(emp =>
              emp.id === id
                ? {
                    ...emp,
                    isPunchedIn: data?.isPunchedIn || false,
                    isOnBreak: data?.isOnBreak || false,
                  }
                : emp
            )
          );
        });
        unsubscribeFunctions.push(() => off(workRef));
      });

      // 2. Listen to activity (idle status)
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
      unsubscribeFunctions.push(() => off(activityRef));

      setEmployees(initialEmployees);
      setLoading(false);

      return () => {
        unsubscribeFunctions.forEach(fn => fn());
      };
    });

    return () => off(employeesRef);
  }, [user?.id]);

  // Recalculate stats only for punched‑in employees
  useEffect(() => {
    const punchedInEmployees = employees.filter(e => e.isPunchedIn);
    const totalIdleMinutes = punchedInEmployees.reduce((sum, e) => sum + (e.totalIdleMsToday / 60000), 0);
    const avgIdleMinutes = punchedInEmployees.length ? Math.round(totalIdleMinutes / punchedInEmployees.length) : 0;
    const highIdleCount = punchedInEmployees.filter(e => e.totalIdleMsToday > 45 * 60000).length;
    const onBreakCount = punchedInEmployees.filter(e => e.isOnBreak).length;
    setStats({ avgIdleMinutes, highIdleCount, onBreakCount });
  }, [employees]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Only show employees who are punched in
  const punchedInEmployees = employees.filter(e => e.isPunchedIn);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Idle Detection</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Real‑time idle monitoring for employees currently punched in
        </p>
      </div>

      {/* Stats Cards */}
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

      {/* Employee Table */}
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