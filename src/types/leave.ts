// src/types/leave.ts
export interface LeaveBalance {
  casual: number;
  sick: number;
  annual: number;
  compOff: number;
  updatedAt?: string;
}

export interface CarryForwardRule {
  max: number;
  percentage: number;
}

export interface LeaveSettings {
  carryForward: Record<string, CarryForwardRule>;
  financialYearStart: string;
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected';