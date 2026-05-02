import { useState, useEffect, useRef } from 'react';
import { ref, onValue, off, DataSnapshot } from 'firebase/database';
import { database } from '../firebase';
import { AttendanceRecord, BreakRecord } from '@/types/attendance';
import { Employee } from '@/types/employee';

interface FirebaseAttendanceRaw {
  selfie?: string;
  selfieOut?: string;
  breaks?: Record<string, BreakRecord>;   // ✅ replaced 'any'
  punchIn?: string;
  punchOut?: string;
  date?: string;
  status?: string;
  workMode?: string;
  timestamp?: number;
  markedLateBy?: string;
  markedLateAt?: string;
  markedHalfDayBy?: string;
  markedHalfDayAt?: string;
  location?: { lat: number; lng: number; name: string };
  locationOut?: { lat: number; lng: number; name: string };
}

export const useAttendanceRealtime = (employees: Employee[]) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const prevDataRef = useRef<Map<string, FirebaseAttendanceRaw>>(new Map());

  useEffect(() => {
    if (!employees.length) {
      setLoading(false);
      return;
    }

    const recordsMap = new Map<string, AttendanceRecord>();
    const unsubscribes: (() => void)[] = [];

    employees.forEach(employee => {
      if (!employee.adminId) return;
      const attendanceRef = ref(database, `users/${employee.adminId}/employees/${employee.id}/punching`);
      const unsubscribe = onValue(attendanceRef, (snapshot: DataSnapshot) => {
        const data = snapshot.val() as Record<string, FirebaseAttendanceRaw> | null;
        // Remove old records for this employee
        for (const key of recordsMap.keys()) {
          if (key.startsWith(`${employee.id}-`)) recordsMap.delete(key);
        }
        if (data) {
          Object.entries(data).forEach(([dbKey, raw]) => {
            const recordId = `${employee.id}-${dbKey}`;
            recordsMap.set(recordId, {
              id: dbKey,
              employeeId: employee.id,
              employeeName: employee.name,
              date: raw.date || '',
              punchIn: raw.punchIn || '',
              punchOut: raw.punchOut || null,
              status: (raw.status as AttendanceRecord['status']) || 'absent',
              workMode: raw.workMode || 'office',
              timestamp: raw.timestamp || 0,
              department: employee.department,
              designation: employee.designation,
              selfie: raw.selfie,
              selfieOut: raw.selfieOut,
              breaks: raw.breaks || {},
              markedLateBy: raw.markedLateBy,
              markedLateAt: raw.markedLateAt,
              markedHalfDayBy: raw.markedHalfDayBy,
              markedHalfDayAt: raw.markedHalfDayAt,
              location: raw.location,
              locationOut: raw.locationOut,
              adminId: employee.adminId,   // ✅ add adminId to the record
            } as AttendanceRecord);
          });
        }
        const sorted = Array.from(recordsMap.values()).sort((a, b) => b.timestamp - a.timestamp);
        setRecords(sorted);
        setLoading(false);
      });
      unsubscribes.push(unsubscribe);
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [employees]);

  return { records, loading };
};