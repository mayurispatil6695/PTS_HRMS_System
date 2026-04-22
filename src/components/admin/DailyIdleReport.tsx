import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Download, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { ref, get, onValue, off } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';

interface IdleSummary {
  employeeId: string;   // employee record key (Firebase UID)
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

interface EmployeeData {
  name?: string;
  email?: string;
  firebaseUid?: string;   // optional override
}

export const DailyIdleReport = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [summaries, setSummaries] = useState<IdleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [liveIdleUsers, setLiveIdleUsers] = useState<IdleSummary[]>([]);

  // Live idle from activity node
  useEffect(() => {
    const activityRef = ref(database, 'activity');
    const unsubscribe = onValue(activityRef, (snapshot) => {
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

  const fetchReport = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Get all employees under the current admin (user.id is the admin UID)
      const employeesRef = ref(database, `users/${user.id}/employees`);
      const snapshot = await get(employeesRef);
      const employees = snapshot.val() as Record<string, EmployeeData> | null;

      if (!employees) {
        setSummaries([]);
        setLoading(false);
        return;
      }

      const results: IdleSummary[] = [];

      for (const [empKey, empData] of Object.entries(employees)) {
        // ✅ CRITICAL FIX: Use the employee key (which is already the Firebase UID) directly.
        // If a `firebaseUid` field exists, use it for backward compatibility.
        const uidForIdle = empData.firebaseUid || empKey;
        const totalRef = ref(database, `idleLogs/${uidForIdle}/${selectedDate}/totalIdleMs`);
        const totalSnap = await get(totalRef);
        const totalIdleMs = (totalSnap.val() as number) || 0;

        results.push({
          employeeId: empKey,
          employeeName: empData.name || empKey,
          totalIdleMs,
        });
      }

      const completed = results.filter((r) => r.totalIdleMs > 0);
      const today = new Date().toISOString().split('T')[0];
      const merged: IdleSummary[] = [...completed];

      if (selectedDate === today) {
        for (const live of liveIdleUsers) {
          const existing = merged.find((m) => m.employeeId === live.employeeId);
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
    } catch (error) {
      console.error('Error fetching idle report:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedDate, liveIdleUsers]);

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const exportCSV = () => {
    const rows = summaries.map((s) => [
      s.employeeName,
      formatDuration(s.totalIdleMs),
      Math.round(s.totalIdleMs / 60000),
      s.isLive ? 'Currently Idle' : 'Completed',
    ]);
    const csv = [['Employee', 'Total Idle Time', 'Minutes', 'Status'], ...rows]
      .map((row) => row.join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `idle_report_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-yellow-600" />
          Daily Idle Time Report
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 mb-6">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border px-3 py-2 rounded"
          />
          <Button onClick={fetchReport} variant="outline">
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          {summaries.length > 0 && (
            <Button onClick={exportCSV} variant="outline">
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          )}
        </div>

        {loading && <p>Loading...</p>}
        {!loading && summaries.length === 0 && (
          <div className="text-center py-10 text-gray-500">
            <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
            No idle time recorded
          </div>
        )}

        <div className="space-y-3">
          {summaries.map((s) => (
            <div key={s.employeeId} className="flex justify-between border p-3 rounded">
              <div>
                <p className="font-medium">{s.employeeName}</p>
                {s.isLive && (
                  <p className="text-xs text-orange-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Currently idle
                  </p>
                )}
              </div>
              <div className="font-semibold text-yellow-700">{formatDuration(s.totalIdleMs)}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};