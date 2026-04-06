export type UserRole = 'admin' | 'employee' | 'team_manager' | 'team_leader' | 'client';

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
    canViewAllEmployees: true,      // only his/her team
    canApproveLeaves: true,         // only for team members
    canAssignProjects: true,        // within team
    canViewReports: true,           // team reports
    canManageTeam: true,
    canViewOwnDataOnly: false,
    canApproveTimesheets: true,     // for team
  },
  team_leader: {
    canViewAllEmployees: false,     // only team members
    canApproveLeaves: false,        // can recommend, manager approves
    canAssignProjects: false,
    canViewReports: true,           // limited
    canManageTeam: false,
    canViewOwnDataOnly: false,
    canApproveTimesheets: false,
  },
  client: {
    canViewAllEmployees: false,
    canApproveLeaves: false,
    canAssignProjects: false,
    canViewReports: true,           // project progress only
    canManageTeam: false,
    canViewOwnDataOnly: true,
    canApproveTimesheets: true,     // for their projects
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