// src/types/auth.ts

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
// src/types/auth.ts
export interface LoginCredentials {
  email: string;
  password: string;
  role: 'admin' | 'employee' | 'team_manager' | 'team_leader' | 'client';
}

export interface PasswordResetRequest {
  email: string;
  newPassword: string;
  otp?: string;
}