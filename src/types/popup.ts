// src/types/popup.ts
import type { Employee } from './employee';
import type { Project } from './project';
import type { AttendanceRecord } from './attendance';

// src/types/popup.ts – update LeaveRequest if needed
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
  approvedAt?: string;
  rejectedAt?: string;
  approvedBy?: string;
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

export interface ProjectsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  employees?: Pick<Employee, 'id' | 'name' | 'department' | 'designation' | 'isActive'>[];
}

export interface MarketingPostsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  posts: MarketingPost[];
}

export interface AttendancePopupProps {
  isOpen: boolean;
  onClose: () => void;
  attendanceData: AttendanceRecord[];
}

export interface LeavePopupProps {
  isOpen: boolean;
  onClose: () => void;
  leaveRequests: LeaveRequest[];
}

export interface EmployeesPopupProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  title: string;
}