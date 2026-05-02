// src/types/user.ts

export type UserRole = 'admin' | 'employee' | 'team_manager' | 'team_leader' | 'client';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department: string;
  designation: string;
  employeeId: string;
  isActive: boolean;
  phone?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  joinDate?: string;
  workMode?: string;
  reportingManager?: string;
  updatedAt?: string;
  password?: string;
  profileImage?: string;
  hashedPassword?: string;
  lastActive?: number;
  adminUid?: string;
  createdAt?: string;
}

export interface AuthContextType {
  user: User | null;
  login: (identifier: string, password: string, role: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  loading: boolean;
  resetPassword: (email: string, newPassword?: string, otp?: string) => Promise<{ success: boolean; message?: string }>;
  changePassword: (newPassword: string) => Promise<{ success: boolean; message?: string }>;
  updateUserStatus?: (status: 'active' | 'inactive') => Promise<void>;
}

export interface RolePermissions {
  canViewAllEmployees: boolean;
  canApproveLeaves: boolean;
  canAssignProjects: boolean;
  canViewReports: boolean;
  canManageTeam: boolean;
  canViewOwnDataOnly: boolean;
  canApproveTimesheets: boolean;
}

export const rolePermissions: Record<UserRole, RolePermissions> = {
  admin: {
    canViewAllEmployees: true,
    canApproveLeaves: true,
    canAssignProjects: true,
    canViewReports: true,
    canManageTeam: true,
    canViewOwnDataOnly: false,
    canApproveTimesheets: true,
  },
  team_manager: {
    canViewAllEmployees: true,
    canApproveLeaves: true,
    canAssignProjects: true,
    canViewReports: true,
    canManageTeam: true,
    canViewOwnDataOnly: false,
    canApproveTimesheets: true,
  },
  team_leader: {
    canViewAllEmployees: false,
    canApproveLeaves: false,
    canAssignProjects: false,
    canViewReports: true,
    canManageTeam: false,
    canViewOwnDataOnly: false,
    canApproveTimesheets: false,
  },
  client: {
    canViewAllEmployees: false,
    canApproveLeaves: false,
    canAssignProjects: false,
    canViewReports: true,
    canManageTeam: false,
    canViewOwnDataOnly: true,
    canApproveTimesheets: true,
  },
  employee: {
    canViewAllEmployees: false,
    canApproveLeaves: false,
    canAssignProjects: false,
    canViewReports: false,
    canManageTeam: false,
    canViewOwnDataOnly: true,
    canApproveTimesheets: false,
  },
};