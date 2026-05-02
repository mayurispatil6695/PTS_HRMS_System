// src/components/admin/DailyIdleReport.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Download, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { ref, get, onValue, off, DataSnapshot } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { Employee } from '@/types/employee'; // central type

interface IdleSummary {
  employeeId: string;
  employeeName: string;
  totalIdleMs: number;
  isLive?: boolean;
  liveStartTime?: number;
}

interface ActivityData {
  isIdle?: boolean;
  idleStartTime?: number;
  employeeName?: string;
}

export const DailyIdleReport: React.FC = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [summaries, setSummaries] = useState<IdleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Live idle users – updated in real time
  const [liveIdleUsers, setLiveIdleUsers] = useState<IdleSummary[]>([]);
  const isFetchingRef = useRef(false);

  // 1. Real‑time idle monitoring
  useEffect(() => {
    const activityRef = ref(database, 'activity');
    const unsubscribe = onValue(activityRef, (snapshot: DataSnapshot) => {
      const data = snapshot.val() as Record<string, ActivityData> | null;
      if (!data) {
        setLiveIdleUsers([]);
        return;
      }
      const now = Date.now();
      const live: IdleSummary[] = [];
      for (const [uid, userData] of Object.entries(data)) {
        if (userData.isIdle) {
          const start = userData.idleStartTime || now;
          live.push({
            employeeId: uid,
            employeeName: userData.employeeName || uid,
            totalIdleMs: now - start,
            isLive: true,
            liveStartTime: start,
          });
        }
      }
      setLiveIdleUsers(live);
    });
    return () => off(activityRef);
  }, []);

  // 2. Fetch historical idle totals for selected date
  const fetchReport = useCallback(async () => {
    if (!user?.id || isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // Employees under current admin (adjust path if needed)
      const employeesRef = ref(database, `users/${user.id}/employees`);
      const employeesSnap = await get(employeesRef);
      const employees = employeesSnap.val() as Record<string, Partial<Employee>> | null;

      if (!employees) {
        setSummaries([]);
        return;
      }

      // Parallel fetch of idle totals for all employees
      const employeeEntries = Object.entries(employees);
      const idlePromises = employeeEntries.map(async ([empKey, empData]) => {
        // Use employee's Firebase UID (empKey) as the idle log key
        const totalRef = ref(database, `idleLogs/${empKey}/${selectedDate}/totalIdleMs`);
        const totalSnap = await get(totalRef);
        const totalIdleMs = (totalSnap.val() as number) || 0;
        return {
          employeeId: empKey,
          employeeName: empData.name || empKey,
          totalIdleMs,
        };
      });

      const results = await Promise.all(idlePromises);
      const completed = results.filter(r => r.totalIdleMs > 0);
      
      // Merge with live idle for today
      const today = new Date().toISOString().split('T')[0];
      const merged: IdleSummary[] = [...completed];
      if (selectedDate === today) {
        for (const live of liveIdleUsers) {
          const existing = merged.find(m => m.employeeId === live.employeeId);
          if (existing) {
            existing.totalIdleMs += live.totalIdleMs;
            existing.isLive = true;
            existing.liveStartTime = live.liveStartTime;
          } else {
            merged.push(live);
          }
        }
      }

      merged.sort((a, b) => b.totalIdleMs - a.totalIdleMs);
      setSummaries(merged);
    } catch (err) {
      console.error(err);
      setError('Failed to load idle report');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [user, selectedDate, liveIdleUsers]);

  // Re-fetch when date or live idle users change (debounced a bit? not needed)
  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const formatDuration = (ms: number): string => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const exportCSV = () => {
    const rows = summaries.map(s => [
      s.employeeName,
      formatDuration(s.totalIdleMs),
      Math.round(s.totalIdleMs / 60000),
      s.isLive ? 'Currently Idle' : 'Completed',
    ]);
    const csv = [['Employee', 'Total Idle Time', 'Minutes', 'Status'], ...rows]
      .map(row => row.join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `idle_report_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Memoized total idle minutes for display
  const totalIdleMinutes = useMemo(() => {
    return summaries.reduce((sum, s) => sum + s.totalIdleMs, 0);
  }, [summaries]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Clock className="h-5 w-5 text-yellow-600" />
          Daily Idle Time Report
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        {/* Controls */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border px-3 py-2 rounded-md text-sm flex-1 min-w-[140px]"
          />
          <Button onClick={fetchReport} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {summaries.length > 0 && (
            <Button onClick={exportCSV} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex justify-between border p-3 rounded animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                <div className="h-5 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        )}

        {/* No data */}
        {!loading && summaries.length === 0 && !error && (
          <div className="text-center py-10 text-gray-500">
            <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>No idle time recorded for {selectedDate}</p>
          </div>
        )}

        {/* Summary list - mobile friendly */}
        {!loading && summaries.length > 0 && (
          <>
            <div className="mb-4 text-right text-sm text-gray-500">
              Total idle time: <span className="font-semibold">{formatDuration(totalIdleMinutes)}</span>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {summaries.map(s => (
                <div
                  key={s.employeeId}
                  className="flex justify-between items-center border p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{s.employeeName}</p>
                    {s.isLive && (
                      <p className="text-xs text-orange-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        Currently idle
                      </p>
                    )}
                  </div>
                  <div className="font-semibold text-yellow-700 ml-4 whitespace-nowrap">
                    {formatDuration(s.totalIdleMs)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};