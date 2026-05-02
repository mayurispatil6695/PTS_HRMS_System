// src/components/manager/ManagerDashboardHome.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Users, Clock, Calendar, AlertTriangle, CheckCircle, XCircle, Camera, Play, StopCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, get, onValue, off, update, push, set } from 'firebase/database';
import IdleMonitoring from '../attendance/IdleMonitoring';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import SelfieCapture from '../attendance/SelfieCapture';

// --- Types ---
interface EmployeeData {
  name: string;
  email?: string;
  department?: string;
  designation?: string;
  [key: string]: unknown;
}

interface AttendanceRecord {
  id: string;
  date: string;
  punchIn: string;
  punchOut: string | null;
  status: string;
  timestamp: number;
  selfie?: string;
  selfieOut?: string;
  breaks?: Record<string, { breakIn: string; breakOut?: string; duration?: string; timestamp: number }>;
}

interface LeaveRequest {
  id: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  status: string;
}

interface RecentAttendance {
  name: string;
  status: string;
  punchIn: string;
}

// Firebase raw leave data
interface FirebaseLeaveData {
  leaveType?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
  status?: string;
  appliedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  approvedBy?: string;
}

// Helper: get current time string (HH:MM AM/PM)
const getCurrentTime = () => {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ManagerDashboardHome = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    pendingLeaves: 0,
    idleCount: 0,
  });
  const [recentAttendance, setRecentAttendance] = useState<RecentAttendance[]>([]);
  const [pendingLeaveRequests, setPendingLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Manager's own attendance
  const [managerTodayAttendance, setManagerTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [showSelfieCapture, setShowSelfieCapture] = useState(false);
  const [pendingPunchType, setPendingPunchType] = useState<'in' | 'out' | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  const managerId = user?.id;
  const adminId = user?.adminUid;

  // Fetch dashboard data (employees, attendance, leaves)
  useEffect(() => {
    if (!adminId) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      const employeesRef = ref(database, `users/${adminId}/employees`);
      const employeesSnap = await get(employeesRef);
      const employees = employeesSnap.val() as Record<string, EmployeeData> || {};
      const employeeIds = Object.keys(employees);
      const totalEmployees = employeeIds.length;

      const today = new Date().toISOString().split('T')[0];
      let presentToday = 0;
      const recentAtt: RecentAttendance[] = [];

      for (const empId of employeeIds) {
        const punchingRef = ref(database, `users/${adminId}/employees/${empId}/punching`);
        const punchSnap = await get(punchingRef);
        const records = punchSnap.val() as Record<string, Omit<AttendanceRecord, 'id'> & { id?: never }> | null;
        if (records) {
          const todayRecord = Object.values(records).find(r => r.date?.startsWith(today));
          if (todayRecord && todayRecord.status === 'present') presentToday++;
          if (todayRecord) {
            recentAtt.push({
              name: employees[empId]?.name || empId,
              status: todayRecord.status || 'present',
              punchIn: todayRecord.punchIn || '--:--',
            });
          }
        }
      }

      // Pending leaves – now using typed data
      let pendingLeaves = 0;
      const leaveReqs: LeaveRequest[] = [];
      for (const empId of employeeIds) {
        const leavesRef = ref(database, `users/${adminId}/employees/${empId}/leaves`);
        const leavesSnap = await get(leavesRef);
        const leaves = leavesSnap.val() as Record<string, FirebaseLeaveData> | null;
        if (leaves) {
          for (const [leaveId, leave] of Object.entries(leaves)) {
            if (leave.status === 'pending') {
              pendingLeaves++;
              leaveReqs.push({
                id: leaveId,
                employeeName: employees[empId]?.name || empId,
                leaveType: leave.leaveType || 'Leave',
                startDate: leave.startDate || '',
                status: 'pending',
              });
            }
          }
        }
      }

      setStats({
        totalEmployees,
        presentToday,
        pendingLeaves,
        idleCount: 0,
      });
      setRecentAttendance(recentAtt.slice(0, 5));
      setPendingLeaveRequests(leaveReqs.slice(0, 5));
      setLoading(false);
    };

    fetchDashboardData().catch(err => {
      console.error(err);
      setLoading(false);
    });

    // Real-time idle count from activity node
    const activityRef = ref(database, 'activity');
    const unsubscribe = onValue(activityRef, (snap) => {
      const activities = snap.val() as Record<string, { isIdle?: boolean }> | null;
      let idleCount = 0;
      if (activities) {
        for (const act of Object.values(activities)) {
          if (act.isIdle === true) idleCount++;
        }
      }
      setStats(prev => ({ ...prev, idleCount }));
    });

    return () => off(activityRef);
  }, [adminId]);

  // Fetch manager's own attendance for today
  useEffect(() => {
    if (!adminId || !managerId) return;
    const today = new Date().toISOString().split('T')[0];
    const punchingRef = ref(database, `users/${adminId}/employees/${managerId}/punching`);
    const unsubscribe = onValue(punchingRef, (snapshot) => {
      const records = snapshot.val() as Record<string, Omit<AttendanceRecord, 'id'> & { id?: never }> | null;
      if (records) {
        const todayRecordEntry = Object.entries(records).find(([, rec]) => rec.date?.startsWith(today));
        if (todayRecordEntry) {
          const [id, rec] = todayRecordEntry;
          setManagerTodayAttendance({ id, ...rec });
        } else {
          setManagerTodayAttendance(null);
        }
      } else {
        setManagerTodayAttendance(null);
      }
    });
    return () => off(punchingRef);
  }, [adminId, managerId]);

  const handleSelfieCapture = async (imageData: string) => {
    if (!adminId || !managerId || !pendingPunchType) return;
    setAttendanceLoading(true);
    try {
      const now = new Date();
      const punchTime = getCurrentTime();
      const todayStr = now.toISOString().split('T')[0];

      if (pendingPunchType === 'in') {
        if (managerTodayAttendance) {
          toast.error('You have already punched in today');
          return;
        }
        const newRecordRef = push(ref(database, `users/${adminId}/employees/${managerId}/punching`));
        await set(newRecordRef, {
          employeeId: managerId,
          employeeName: user?.name || 'Manager',
          date: now.toISOString(),
          punchIn: punchTime,
          punchOut: null,
          status: 'present',
          workMode: 'office',
          timestamp: now.getTime(),
          selfie: imageData,
          location: null,
        });
        toast.success('Punched in successfully!');
      } else if (pendingPunchType === 'out') {
        if (!managerTodayAttendance) {
          toast.error('You have not punched in today');
          return;
        }
        const recordRef = ref(database, `users/${adminId}/employees/${managerId}/punching/${managerTodayAttendance.id}`);
        await update(recordRef, {
          punchOut: punchTime,
          timestamp: now.getTime(),
          selfieOut: imageData,
        });
        toast.success('Punched out successfully!');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to record attendance');
    } finally {
      setAttendanceLoading(false);
      setShowSelfieCapture(false);
      setPendingPunchType(null);
    }
  };

  const handlePunchIn = () => {
    setPendingPunchType('in');
    setShowSelfieCapture(true);
  };

  const handlePunchOut = () => {
    if (!managerTodayAttendance?.punchIn) {
      toast.error('No punch-in record found');
      return;
    }
    setPendingPunchType('out');
    setShowSelfieCapture(true);
  };

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

      {/* Manager's Own Attendance Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-lg">Your Today's Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          {managerTodayAttendance ? (
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <p className="text-sm text-gray-600">Punched In: <span className="font-medium text-green-600">{managerTodayAttendance.punchIn}</span></p>
                {managerTodayAttendance.punchOut && (
                  <p className="text-sm text-gray-600 mt-1">Punched Out: <span className="font-medium text-red-600">{managerTodayAttendance.punchOut}</span></p>
                )}
                <Badge className="mt-1">{managerTodayAttendance.status || 'present'}</Badge>
              </div>
              {!managerTodayAttendance.punchOut ? (
                <Button onClick={handlePunchOut} disabled={attendanceLoading} className="bg-red-600 hover:bg-red-700">
                  <Camera className="h-4 w-4 mr-2" /> Punch Out with Selfie
                </Button>
              ) : (
                <Badge variant="outline" className="text-green-600">Attendance Completed</Badge>
              )}
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <p className="text-gray-600">Not punched in yet today.</p>
              <Button onClick={handlePunchIn} disabled={attendanceLoading} className="bg-green-600 hover:bg-green-700">
                <Camera className="h-4 w-4 mr-2" /> Punch In with Selfie
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* Selfie Capture Modal */}
      <SelfieCapture
        isOpen={showSelfieCapture}
        onClose={() => {
          setShowSelfieCapture(false);
          setPendingPunchType(null);
        }}
        onCapture={handleSelfieCapture}
        employeeName={user?.name || 'Manager'}
        punchType={pendingPunchType === 'in' ? 'Punch In' : 'Punch Out'}
      />
    </div>
  );
};

export default ManagerDashboardHome;