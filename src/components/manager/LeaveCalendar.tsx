import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, get } from 'firebase/database';

interface LeaveEvent {
  date: string;
  employeeName: string;
  leaveType: string;
}

const LeaveCalendar: React.FC = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [leaveEvents, setLeaveEvents] = useState<Record<string, LeaveEvent[]>>({});
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);

  useEffect(() => {
    if (!user?.adminUid) return;
    const loadLeaves = async () => {
      setLoading(true);
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0);
      const events: Record<string, LeaveEvent[]> = {};

      const employeesRef = ref(database, `users/${user.adminUid}/employees`);
      const empSnap = await get(employeesRef);
      const employees = empSnap.val() as Record<string, any> | null;
      if (!employees) {
        setLeaveEvents({});
        setLoading(false);
        return;
      }

      for (const [empId, empData] of Object.entries(employees)) {
        const leavesRef = ref(database, `users/${user.adminUid}/employees/${empId}/leaves`);
        const leavesSnap = await get(leavesRef);
        const leaves = leavesSnap.val() as Record<string, any> | null;
        if (leaves) {
          Object.values(leaves).forEach(leave => {
            if (leave.status !== 'approved') return;
            const start = new Date(leave.startDate);
            const end = new Date(leave.endDate);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              const dateStr = d.toISOString().split('T')[0];
              if (d >= startOfMonth && d <= endOfMonth) {
                if (!events[dateStr]) events[dateStr] = [];
                events[dateStr].push({ date: dateStr, employeeName: empData.name || empId, leaveType: leave.leaveType });
              }
            }
          });
        }
      }
      setLeaveEvents(events);
      setLoading(false);
    };
    loadLeaves();
  }, [user, year, month]);

  const getDaysInMonth = () => {
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  if (loading) return <div>Loading calendar...</div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Leave Calendar – {monthNames[month]} {year}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2 text-center font-medium mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day}>{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array(firstDayOfMonth.getDay()).fill(null).map((_, i) => <div key={`empty-${i}`} className="h-24 border rounded p-1 bg-gray-50"></div>)}
          {getDaysInMonth().map(date => {
            const dateStr = date.toISOString().split('T')[0];
            const events = leaveEvents[dateStr] || [];
            return (
              <div key={dateStr} className="h-24 border rounded p-1 overflow-y-auto">
                <div className="font-semibold text-sm">{date.getDate()}</div>
                {events.map((ev, idx) => (
                  <div key={idx} className="text-xs bg-blue-100 rounded mt-1 p-0.5 truncate" title={`${ev.employeeName} (${ev.leaveType})`}>
                    {ev.employeeName}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default LeaveCalendar;