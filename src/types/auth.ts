
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'employee' | 'team_leader';
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
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, role: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  loading: boolean;
  resetPassword: (email: string, newPassword: string, otp: string) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
}

export interface OtpData {
  email: string;
  otp: string;
  timestamp: number;
  expiresAt: number;
}

export interface PredefinedAdmin {
  id: string;
  email: string;
  password: string;
  name: string;
  designation: string;
  phone?: string;
}
