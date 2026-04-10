// src/components/admin/DailyIdleReport.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Download, Clock, RefreshCw } from 'lucide-react';
import { ref, get } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';

interface IdleSummary {
  employeeId: string;
  employeeName: string;
  totalIdleMs: number;
}

interface EmployeeRecord {
  name?: string;
  email?: string;
  role?: string;
  profile?: { name?: string; email?: string };
  employee?: { name?: string; email?: string };
}

export const DailyIdleReport = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [summaries, setSummaries] = useState<IdleSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      // 1. Get all employees (global)
      const employeesRef = ref(database, 'employees');
      const employeesSnapshot = await get(employeesRef);
      let employeesData = employeesSnapshot.val() as Record<string, EmployeeRecord> | null;

      // Fallback: if global 'employees' node is empty, scan 'users' for non‑admin employees
      if (!employeesData || Object.keys(employeesData).length === 0) {
        const usersRef = ref(database, 'users');
        const usersSnap = await get(usersRef);
        const users = usersSnap.val() as Record<string, EmployeeRecord> | null;
        employeesData = {};
        if (users) {
          for (const [uid, userData] of Object.entries(users)) {
            if (userData.role === 'admin') continue;
            const profile = userData.profile || userData.employee;
            if (profile?.name) {
              employeesData[uid] = { name: profile.name, email: profile.email };
            }
          }
        }
      }

      if (!employeesData || Object.keys(employeesData).length === 0) {
        setSummaries([]);
        setLoading(false);
        return;
      }

      // 2. For each employee, fetch total idle time for the selected date
      const promises = Object.entries(employeesData).map(async ([empId, empData]) => {
        const totalRef = ref(database, `idleLogs/${empId}/${selectedDate}/totalIdleMs`);
        const totalSnap = await get(totalRef);
        const totalIdleMs = (totalSnap.val() as number) || 0;
        return {
          employeeId: empId,
          employeeName: empData.name || empId,
          totalIdleMs,
        };
      });

      const results = await Promise.all(promises);
      setSummaries(
        results
          .filter((s) => s.totalIdleMs > 0)
          .sort((a, b) => b.totalIdleMs - a.totalIdleMs)
      );
    } catch (error) {
      console.error('Error fetching idle report:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedDate]);

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const exportCSV = () => {
    const rows = summaries.map((s) => ({
      Employee: s.employeeName,
      'Total Idle Time': formatDuration(s.totalIdleMs),
      Minutes: Math.round(s.totalIdleMs / 60000),
    }));

    const csv = [
      ['Employee', 'Total Idle Time', 'Minutes'],
      ...rows.map((r) => [r.Employee, r['Total Idle Time'], r.Minutes]),
    ]
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
        <div className="flex gap-2 items-center mb-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
          <Button onClick={fetchReport} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {summaries.length > 0 && (
            <Button onClick={exportCSV} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
        </div>

        {loading && <p>Loading...</p>}

        {!loading && summaries.length === 0 && (
          <p className="text-muted-foreground">
            No idle time recorded on {new Date(selectedDate).toLocaleDateString()}.
          </p>
        )}

        <div className="space-y-2">
          {summaries.map((s) => (
            <div key={s.employeeId} className="flex justify-between p-2 border-b">
              <span>{s.employeeName}</span>
              <span className="text-yellow-600">{formatDuration(s.totalIdleMs)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};