export interface SalaryStructure {
  basic: number;
  hra: number;
  allowances: number;
  fixedDeductions: number;
  pfApplicable: boolean;
  pfPercentage: number;
}

export interface AttendanceData {
  presentDays: number;
  totalWorkingDays: number;
  lateDays?: number;
  halfDays?: number;
}

export interface SalarySlip {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  month: number;
  year: number;
  grossEarnings: number;
  totalDeductions: number;
  netSalary: number;
  breakdown: Record<string, number>;
  pdfUrl?: string;
  generatedAt: string;
  status: 'generated' | 'sent';
  sentAt?: string;
}