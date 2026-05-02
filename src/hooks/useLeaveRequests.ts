import { useState, useEffect } from 'react';
import { ref, onValue, off, query, orderByChild, DataSnapshot } from 'firebase/database';
import { database } from '../firebase';
import { Employee } from '@/types/employee';
import { LeaveRequest } from '@/types/popup';
import { User } from '@/types/user';

export const useLeaveRequests = (user: User | unknown, employees: Employee[]) => {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || employees.length === 0) {
      setLoading(false);
      return;
    }

    const allRequests: LeaveRequest[] = [];
    const unsubscribes: (() => void)[] = [];

    // Group employees by adminId
    const employeesByAdmin = employees.reduce((acc, emp) => {
      if (emp.adminId) {
        if (!acc[emp.adminId]) acc[emp.adminId] = [];
        acc[emp.adminId].push(emp);
      }
      return acc;
    }, {} as Record<string, Employee[]>);

    Object.entries(employeesByAdmin).forEach(([adminId, adminEmployees]) => {
      adminEmployees.forEach(employee => {
        const leavesRef = ref(database, `users/${adminId}/employees/${employee.id}/leaves`);
        const leavesQuery = query(leavesRef, orderByChild('appliedAt'));

        const unsubscribe = onValue(leavesQuery, (snapshot: DataSnapshot) => {
          const data = snapshot.val() as Record<string, Omit<LeaveRequest, 'id' | 'employeeId' | 'employeeName' | 'employeeEmail' | 'department' | 'adminId'>> | null;

          // Remove existing entry for this employee
          const index = allRequests.findIndex(r => r.employeeId === employee.id);
          if (index !== -1) allRequests.splice(index, 1);

          if (data && typeof data === 'object') {
            const requests: LeaveRequest[] = Object.entries(data).map(([key, value]) => ({
              id: key,
              employeeId: employee.id,
              employeeName: employee.name,
              employeeEmail: employee.email,
              department: employee.department || 'No Department',
              adminId: adminId,
              leaveType: value.leaveType,
              startDate: value.startDate,
              endDate: value.endDate,
              reason: value.reason,
              status: value.status,
              appliedAt: value.appliedAt
            }));
            allRequests.push(...requests);
          }

          setLeaveRequests([...allRequests].sort((a, b) =>
            new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
          ));
          setLoading(false);
        });

        unsubscribes.push(unsubscribe);
      });
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user, employees]);

  return { leaveRequests, loading };
};