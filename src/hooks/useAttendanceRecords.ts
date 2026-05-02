import { useState, useEffect } from 'react';
import { ref, onValue, off, query, orderByChild, DataSnapshot } from 'firebase/database';
import { database } from '../firebase';
import { Employee } from '@/types/employee';
import { AttendanceRecord } from '@/types/attendance';

export const useAttendanceRecords = (user: unknown, employees: Employee[]) => {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || employees.length === 0) {
      setLoading(false);
      return;
    }

    const allRecords: AttendanceRecord[] = [];
    const unsubscribes: (() => void)[] = [];

    const employeesByAdmin = employees.reduce((acc, emp) => {
      if (emp.adminId) {
        if (!acc[emp.adminId]) acc[emp.adminId] = [];
        acc[emp.adminId].push(emp);
      }
      return acc;
    }, {} as Record<string, Employee[]>);

    Object.entries(employeesByAdmin).forEach(([adminId, adminEmployees]) => {
      adminEmployees.forEach(employee => {
        const attendanceRef = ref(database, `users/${adminId}/employees/${employee.id}/punching`);
        const attendanceQuery = query(attendanceRef, orderByChild('timestamp'));

        const unsubscribe = onValue(attendanceQuery, (snapshot: DataSnapshot) => {
          const data = snapshot.val() as Record<string, Partial<AttendanceRecord>> | null;

          const index = allRecords.findIndex(r => r.employeeId === employee.id);
          if (index !== -1) allRecords.splice(index, 1);

          if (data && typeof data === 'object') {
            const records: AttendanceRecord[] = Object.entries(data).map(([key, value]) => {
              let hoursWorked = 0;
              if (value.punchIn && value.punchOut) {
                const punchInTime = new Date(`1970-01-01T${value.punchIn}`);
                const punchOutTime = new Date(`1970-01-01T${value.punchOut}`);
                hoursWorked = (punchOutTime.getTime() - punchInTime.getTime()) / (1000 * 60 * 60);
              }

              return {
                id: key,
                employeeId: employee.id,
                employeeName: employee.name,
                department: employee.department,
                adminId: adminId,
                date: value.date || '',
                punchIn: value.punchIn || '',
                punchOut: value.punchOut || null,
                status: (value.status as AttendanceRecord['status']) || 'absent',
                workMode: value.workMode || 'office',
                timestamp: value.timestamp || Date.now(),
                hoursWorked,
                breaks: value.breaks || {}
              };
            });
            allRecords.push(...records);
          }

          setAttendanceRecords([...allRecords].sort((a, b) => b.timestamp - a.timestamp));
          setLoading(false);
        });

        unsubscribes.push(unsubscribe);
      });
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user, employees]);

  return { attendanceRecords, loading };
};