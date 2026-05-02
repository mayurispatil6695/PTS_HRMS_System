// src/types/employee.ts

export interface EmergencyContact {
  name?: string;   // made optional
  phone?: string;  // made optional
}

export interface BankDetails {
  accountNumber?: string;  // made optional
  bankName?: string;       // made optional
  ifscCode?: string;       // made optional
}

// Employee remains the same (the fields themselves are already optional)
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
  joiningDate?: string;
  salary?: number;
  emergencyContact?: EmergencyContact;
  address?: string;
  workMode?: string;
  employmentType?: string;
  bankDetails?: BankDetails;
  status?: string;
  managerId?: string;
  reportingManagerName?: string;
  role?: 'employee' | 'team_leader' | 'team_manager' | 'client';
  adminId?: string; 
}