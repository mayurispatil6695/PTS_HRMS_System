// src/types/admin.ts
import type { Employee } from './employee';
import type { AttendanceRecord } from './attendance';

// Admin-specific Firebase raw shapes (for fetching)
export interface FirebaseEmployeeRaw {
  name?: string;
  email?: string;
  department?: string;
  designation?: string;
  status?: string;
  employeeId?: string;
  phone?: string;        // ✅ add
  createdAt?: string;    // ✅ add
}

export interface FirebaseAttendanceRaw {
  selfie?: string;
  selfieOut?: string;
  breaks?: Record<string, import('./attendance').BreakRecord>;
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
  location?: import('./common').LocationData;
  locationOut?: import('./common').LocationData;
  [key: string]: unknown;
}

export interface FirebaseEmployeeData {
  name?: string;
  department?: string;
  email?: string;
  designation?: string;
  status?: string;
  [key: string]: unknown;
}

export interface FirebaseUserData {
  role?: string;
  name?: string;
  email?: string;
  profile?: { role?: string; name?: string; [key: string]: unknown };
  employee?: { role?: string; name?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface IdleNotification {
  id: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  idleStartTime: number;
  idleDuration: number;
  status: string;
  isIdle: boolean;
}

export interface PredefinedAdmin {
  id: string;
  email: string;
  password: string;
  name: string;
  designation: string;
  phone?: string;
}