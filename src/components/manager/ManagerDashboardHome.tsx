import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Users, Clock, Calendar, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, get, onValue, off } from 'firebase/database';
import IdleMonitoring from '../attendance/IdleMonitoring';
import { Link } from 'react-router-dom';

const ManagerDashboardHome = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    pendingLeaves: 0,
    idleCount: 0,
  });
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [pendingLeaveRequests, setPendingLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.adminUid) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      const adminId = user.adminUid;
      const employeesRef = ref(database, `users/${adminId}/employees`);
      const employeesSnap = await get(employeesRef);
      const employees = employeesSnap.val() as Record<string, any> || {};
      const employeeIds = Object.keys(employees);
      const totalEmployees = employeeIds.length;

      const today = new Date().toISOString().split('T')[0];
      let presentToday = 0;
      const recentAtt: any[] = [];

      // Get today's attendance for each employee
      for (const empId of employeeIds) {
        const punchingRef = ref(database, `users/${adminId}/employees/${empId}/punching`);
        const punchSnap = await get(punchingRef);
        const records = punchSnap.val() as Record<string, any> || {};
        const todayRecord = Object.values(records).find((r: any) => r.date?.startsWith(today));
        if (todayRecord && todayRecord.status === 'present') presentToday++;
        if (todayRecord) {
          recentAtt.push({
            name: employees[empId]?.name || empId,
            status: todayRecord.status,
            punchIn: todayRecord.punchIn,
          });
        }
      }

      // Pending leaves
      let pendingLeaves = 0;
      const leaveRequests: any[] = [];
      for (const empId of employeeIds) {
        const leavesRef = ref(database, `users/${adminId}/employees/${empId}/leaves`);
        const leavesSnap = await get(leavesRef);
        const leaves = leavesSnap.val() as Record<string, any> || {};
        for (const [leaveId, leave] of Object.entries(leaves)) {
          if (leave.status === 'pending') {
            pendingLeaves++;
            leaveRequests.push({
              id: leaveId,
              employeeName: employees[empId]?.name || empId,
              leaveType: leave.leaveType,
              startDate: leave.startDate,
            });
          }
        }
      }

      setStats({
        totalEmployees,
        presentToday,
        pendingLeaves,
        idleCount: 0, // will be updated via realtime listener
      });
      setRecentAttendance(recentAtt.slice(0, 5));
      setPendingLeaveRequests(leaveRequests.slice(0, 5));
      setLoading(false);
    };

    fetchDashboardData();

    // Real-time idle count from activity node
    const activityRef = ref(database, 'activity');
    const unsubscribe = onValue(activityRef, (snap) => {
      const activities = snap.val() as Record<string, any> || {};
      let idleCount = 0;
      for (const [uid, act] of Object.entries(activities)) {
        if (act.isIdle === true) idleCount++;
      }
      setStats(prev => ({ ...prev, idleCount }));
    });

    return () => off(activityRef);
  }, [user]);

  if (loading) return <div className="flex justify-center p-8">Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      {/* Idle Alerts Card */}
      <IdleMonitoring />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Users className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-500">Total Employees</p>
              <p className="text-2xl font-bold">{stats.totalEmployees}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-500">Present Today</p>
              <p className="text-2xl font-bold">{stats.presentToday}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Calendar className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-sm text-gray-500">Pending Leaves</p>
              <p className="text-2xl font-bold">{stats.pendingLeaves}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Clock className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-sm text-gray-500">Currently Idle</p>
              <p className="text-2xl font-bold">{stats.idleCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Attendance & Pending Leaves */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Recent Attendance</CardTitle></CardHeader>
          <CardContent>
            {recentAttendance.length === 0 ? (
              <p className="text-gray-500">No attendance records today</p>
            ) : (
              <div className="space-y-2">
                {recentAttendance.map((att, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b pb-2">
                    <span>{att.name}</span>
                    <Badge className={att.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                      {att.status || 'present'}
                    </Badge>
                    <span className="text-sm text-gray-500">{att.punchIn || '--:--'}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4">
              <Link to="/manager/attendance" className="text-blue-600 text-sm">View all →</Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pending Leave Requests</CardTitle></CardHeader>
          <CardContent>
            {pendingLeaveRequests.length === 0 ? (
              <p className="text-gray-500">No pending leave requests</p>
            ) : (
              <div className="space-y-2">
                {pendingLeaveRequests.map((req) => (
                  <div key={req.id} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <p className="font-medium">{req.employeeName}</p>
                      <p className="text-xs text-gray-500">{req.leaveType} • from {req.startDate}</p>
                    </div>
                    <Link to="/manager/leaves">
                      <Button size="sm" variant="outline">Review</Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ManagerDashboardHome;