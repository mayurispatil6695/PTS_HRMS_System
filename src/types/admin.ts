// src/types/admin.ts
import { AttendanceRecord } from './attendance';
import { Project } from './project';

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  employeeId: string;
  isActive: boolean;
  createdAt: string;
  profileImage?: string;
  addedBy?: string;
  status: string;
  adminId?: string;
}

export interface MarketingPost {
  id: string;
  platform: string;
  content: string;
  scheduledDate: string;
  scheduledTime: string;
  postUrl?: string;
  imageUrl?: string;
  status: string;
  createdBy: string;
  createdByName: string;
  department: string;
  createdAt: string;
  updatedAt: string;
  adminId?: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
  adminId?: string;
}



export interface IdleUser {
  id: string;
  idleStartTime: number;
  idleDuration: number;
  lastActive: number;
  status: string;
}

export interface FirebaseEmployee {
  status?: string;
  employeeId?: string;
  name?: string;
  email?: string;
  phone?: string;
  department?: string;
  designation?: string;
  createdAt?: string;
}

export interface ActivityData {
  status?: string;
  idleStartTime?: number;
  idleDuration?: number;
  lastActive?: number;
  isIdle?: boolean;
  timestamp?: number;
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