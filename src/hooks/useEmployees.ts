import { useState, useEffect } from 'react';
import { ref, onValue, off, DataSnapshot } from 'firebase/database';
import { database } from "../firebase";
import { FirebaseEmployeeRaw } from '@/types/admin';
import { Employee } from '@/types/employee';
import { User } from '@/types/user';

export const useEmployees = (user: User | unknown) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const employeesRef = ref(database, 'users');
    const unsubscribe = onValue(employeesRef, (snapshot: DataSnapshot) => {
      const employeeMap = new Map<string, Employee>();
      snapshot.forEach((adminSnap: DataSnapshot) => {
        const employeesData = adminSnap.child('employees').val() as Record<string, FirebaseEmployeeRaw> | null;
        if (employeesData) {
          Object.entries(employeesData).forEach(([key, value]) => {
            if (!employeeMap.has(key)) {
              employeeMap.set(key, {
                id: key,
                name: value.name || '',
                email: value.email || '',
                phone: value.phone || '',
                department: value.department || '',
                designation: value.designation || '',
                createdAt: value.createdAt || '',
                employeeId: value.employeeId || `EMP-${key.slice(0, 8)}`,
                isActive: value.status === 'active',
                status: value.status || 'active',
                adminId: adminSnap.key || '',
              });
            }
          });
        }
      });
      setEmployees(Array.from(employeeMap.values()));
      setLoading(false);
    }, (error) => {
      console.error('useEmployees error:', error);
      setLoading(false);
    });
    return () => off(employeesRef);
  }, [user]);

  return { employees, loading };
};