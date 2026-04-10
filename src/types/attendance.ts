export interface BreakRecord {
  breakIn: string;
  breakOut?: string;
  duration?: string;
  timestamp: number;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;

  date: string;
  punchIn: string;
  punchOut?: string;

 status: "present" | "late" | "half-day" | "on-leave" | "absent";
  workMode?: string;

  timestamp: number;

  markedLateBy?: string;
  markedLateAt?: string;

  markedHalfDayBy?: string;
  markedHalfDayAt?: string;

  // ✅ ADD THIS
  breaks?: Record<string, BreakRecord>;
  hoursWorked?: number;
   location?: { lat: number; lng: number; name: string };
  locationOut?: { lat: number; lng: number; name: string };
}