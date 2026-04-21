import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Users, CheckCircle, TrendingUp } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, get } from 'firebase/database';

interface TeamMember {
  id: string;
  name: string;
  department: string;
  email: string;
  todayStatus: 'present' | 'late' | 'absent' | 'on-leave';
  leaveBalance: number;
  taskCompletionRate: number;
  totalTasks: number;
  completedTasks: number;
}

const TeamDashboard: React.FC = () => {
  const { user } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalMembers: 0, presentToday: 0, avgCompletion: 0 });

  useEffect(() => {
    if (!user?.adminUid) return;
    const loadTeamData = async () => {
      setLoading(true);
      const employeesRef = ref(database, `users/${user.adminUid}/employees`);
      const snapshot = await get(employeesRef);
      const allEmployees = snapshot.val() as Record<string, any> | null;
      if (!allEmployees) {
        setTeamMembers([]);
        setLoading(false);
        return;
      }

      // ✅ Filter employees where managerId === current user's id
      const myTeamEntries = Object.entries(allEmployees).filter(([, emp]) => emp.managerId === user.id);

      const today = new Date().toISOString().split('T')[0];
      const members: TeamMember[] = [];

      for (const [empId, empData] of myTeamEntries) {
        if (empData.status !== 'active') continue;

        // Today's attendance
        const attendanceRef = ref(database, `users/${user.adminUid}/employees/${empId}/punching`);
        const attendanceSnap = await get(attendanceRef);
        let todayStatus: TeamMember['todayStatus'] = 'absent';
        if (attendanceSnap.val()) {
          const records = Object.values(attendanceSnap.val()) as any[];
          const todayRecord = records.find(r => r.date?.startsWith(today));
          if (todayRecord) {
            if (todayRecord.status === 'present') todayStatus = 'present';
            else if (todayRecord.status === 'late') todayStatus = 'late';
            else if (todayRecord.status === 'on-leave') todayStatus = 'on-leave';
          }
        }

        // Leave balance (20 days per year – sum approved days this year)
        const leavesRef = ref(database, `users/${user.adminUid}/employees/${empId}/leaves`);
        const leavesSnap = await get(leavesRef);
        let usedDays = 0;
        if (leavesSnap.val()) {
          const leaves = Object.values(leavesSnap.val()) as any[];
          const thisYear = new Date().getFullYear();
          leaves.forEach(leave => {
            if (leave.status === 'approved' && new Date(leave.startDate).getFullYear() === thisYear) {
              const start = new Date(leave.startDate);
              const end = new Date(leave.endDate);
              const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              usedDays += days;
            }
          });
        }
        const leaveBalance = 20 - usedDays;

        // Task completion rate
        const projectsSnap = await get(ref(database, 'projects'));
        let totalTasks = 0;
        let completedTasks = 0;
        if (projectsSnap.val()) {
          const projects = projectsSnap.val() as Record<string, any>;
          for (const proj of Object.values(projects)) {
            if (proj.tasks) {
              for (const task of Object.values(proj.tasks) as any[]) {
                if (task.assignedTo === empId) {
                  totalTasks++;
                  if (task.status === 'completed') completedTasks++;
                }
              }
            }
          }
        }
        const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        members.push({
          id: empId,
          name: empData.name || empId,
          department: empData.department || 'No Department',
          email: empData.email || '',
          todayStatus,
          leaveBalance: leaveBalance > 0 ? leaveBalance : 0,
          taskCompletionRate,
          totalTasks,
          completedTasks,
        });
      }

      setTeamMembers(members);
      setStats({
        totalMembers: members.length,
        presentToday: members.filter(m => m.todayStatus === 'present').length,
        avgCompletion: members.reduce((sum, m) => sum + m.taskCompletionRate, 0) / (members.length || 1),
      });
      setLoading(false);
    };
    loadTeamData();
  }, [user]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present': return <Badge className="bg-green-100 text-green-700">Present</Badge>;
      case 'late': return <Badge className="bg-yellow-100 text-yellow-700">Late</Badge>;
      case 'on-leave': return <Badge className="bg-blue-100 text-blue-700">On Leave</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-700">Absent</Badge>;
    }
  };

  if (loading) return <div className="flex justify-center p-8">Loading team data...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team Dashboard</h1>
        <p className="text-gray-500">Overview of your team's attendance, leaves, and task progress</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2"><Users className="h-5 w-5 text-blue-600" /><div><p className="text-sm text-gray-500">Team Members</p><p className="text-2xl font-bold">{stats.totalMembers}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-600" /><div><p className="text-sm text-gray-500">Present Today</p><p className="text-2xl font-bold">{stats.presentToday}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-purple-600" /><div><p className="text-sm text-gray-500">Avg Task Completion</p><p className="text-2xl font-bold">{Math.round(stats.avgCompletion)}%</p></div></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Team Members</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr><th className="text-left p-2">Employee</th><th className="text-left p-2">Department</th><th className="text-left p-2">Today's Status</th><th className="text-left p-2">Leave Balance</th><th className="text-left p-2">Task Completion</th><th className="text-left p-2">Actions</th></tr>
              </thead>
              <tbody>
                {teamMembers.map(member => (
                  <tr key={member.id} className="border-b hover:bg-gray-50">
                    <td className="p-2"><div className="font-medium">{member.name}</div><div className="text-xs text-gray-500">{member.email}</div></td>
                    <td className="p-2">{member.department}</td>
                    <td className="p-2">{getStatusBadge(member.todayStatus)}</td>
                    <td className="p-2">{member.leaveBalance} days</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{Math.round(member.taskCompletionRate)}%</span>
                        <Progress value={member.taskCompletionRate} className="w-24 h-2" />
                      </div>
                      <div className="text-xs text-gray-400">{member.completedTasks}/{member.totalTasks} tasks</div>
                    </td>
                    <td className="p-2"><Button variant="outline" size="sm">View Details</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamDashboard;