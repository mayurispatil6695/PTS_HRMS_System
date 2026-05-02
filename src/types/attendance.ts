// src/types/attendance.ts
import type { LocationData } from './common';

// src/types/attendance.ts

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
  punchOut: string | null;
  status: 'present' | 'late' | 'half-day' | 'absent' | 'on-leave';  // ✅ added 'on-leave'
  workMode: string;
  timestamp: number;
  totalHours?: string;
  markedLateBy?: string;
  markedLateAt?: string;
  markedHalfDayBy?: string;
  markedHalfDayAt?: string;
  department?: string;
  designation?: string;
  selfie?: string;
  selfieOut?: string;
  breaks?: Record<string, BreakRecord>;
  location?: LocationData;
  locationOut?: LocationData;
  hoursWorked?: number;
  adminId?: string;   // ✅ add this
}

export interface AttendanceRecordWithAdmin extends AttendanceRecord {
  adminId?: string;
  employeeUid?: string;   // Firebase UID for updates
}

export interface AttendanceData {
  presentDays: number;
  totalWorkingDays: number;
  lateDays?: number;
  halfDays?: number;
}

export interface IdleUser {
  id: string;
  idleStartTime: number;
  idleDuration: number;
  lastActive: number;
  status: string;
}

export interface ActivityData {
  status?: string;
  idleStartTime?: number;
  idleDuration?: number;
  lastActive?: number;
  isIdle?: boolean;
  timestamp?: number;
  employeeName?: string;
  employeeEmail?: string;
  department?: string;
}