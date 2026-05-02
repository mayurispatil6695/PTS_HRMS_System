// src/utils/reportUtils.ts

// Minimal user type for reports (matches what useAuth returns)
interface ReportUser {
  id: string;
  name?: string;
 employeeId?: string;
  department?: string;
  adminUid?: string;
  email?: string;
}

// ========== TYPES ==========
export interface AttendanceReportData {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  attendanceRate: number;
  records: AttendanceRecord[];
}

interface AttendanceRecord {
  date: string;
  status: string;
  punchIn?: string;
  punchOut?: string;
}

export interface LeaveReportData {
  totalRequests: number;
  approved: number;
  pending: number;
  rejected: number;
  totalDaysUsed: number;
  recentRequests: LeaveRequest[];
}

interface LeaveRequest {
  startDate: string;
  endDate: string;
  status: string;
}

export interface SalaryReportData {
  totalSlips: number;
  totalEarnings: number;
  avgSalary: number;
  highestSalary: number;
  recentSlips: SalarySlip[];
}

interface SalarySlip {
  netSalary: number;
  month: number;
  year: number;
}

export interface ProjectsReportData {
  totalProjects: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  avgProgress: number;
  recentProjects: Project[];
}

interface Project {
  status: string;
  progress?: number;
  name?: string;
}

export type ReportData = 
  | AttendanceReportData 
  | LeaveReportData 
  | SalaryReportData 
  | ProjectsReportData 
  | Record<string, unknown>;

// ========== HELPERS ==========
const getMockAttendance = (userId: string): AttendanceRecord[] => {
  return [
    { date: new Date().toISOString().split('T')[0], status: 'present', punchIn: '09:30 AM', punchOut: '06:15 PM' },
    { date: new Date(Date.now() - 86400000).toISOString().split('T')[0], status: 'present', punchIn: '09:45 AM', punchOut: '06:00 PM' },
    { date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0], status: 'late', punchIn: '10:15 AM', punchOut: '06:30 PM' },
  ];
};

const getMockLeaves = (userId: string): LeaveRequest[] => {
  return [
    { startDate: '2025-01-10', endDate: '2025-01-12', status: 'approved' },
    { startDate: '2025-02-15', endDate: '2025-02-16', status: 'pending' },
  ];
};

const getMockSalarySlips = (userId: string): SalarySlip[] => {
  return [
    { netSalary: 50000, month: 2, year: 2025 },
    { netSalary: 50000, month: 1, year: 2025 },
    { netSalary: 48000, month: 12, year: 2024 },
  ];
};

const getMockProjects = (user: ReportUser | null): Project[] => {
  return [
    { status: 'in_progress', progress: 70, name: 'HRMS Development' },
    { status: 'completed', progress: 100, name: 'Website Redesign' },
    { status: 'not_started', progress: 0, name: 'Mobile App' },
  ];
};

// ========== GENERATE REPORT DATA ==========
export const generateReportData = (
  reportType: string,
  dateRange: string,
  user: ReportUser | null
): ReportData => {
  if (!user) return {};

  const userId = user.id;

  switch (reportType) {
    case 'attendance': {
      const records = getMockAttendance(userId);
      const presentDays = records.filter(r => r.status === 'present').length;
      const absentDays = records.filter(r => r.status === 'absent').length;
      const lateDays = records.filter(r => r.status === 'late').length;
      return {
        totalDays: records.length,
        presentDays,
        absentDays,
        lateDays,
        attendanceRate: records.length > 0 ? Math.round((presentDays / records.length) * 100) : 0,
        records: records.slice(-10),
      };
    }
    case 'leaves': {
      const leaves = getMockLeaves(userId);
      const totalDaysUsed = leaves
        .filter(l => l.status === 'approved')
        .reduce((total, l) => {
          const start = new Date(l.startDate);
          const end = new Date(l.endDate);
          const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          return total + days;
        }, 0);
      return {
        totalRequests: leaves.length,
        approved: leaves.filter(l => l.status === 'approved').length,
        pending: leaves.filter(l => l.status === 'pending').length,
        rejected: leaves.filter(l => l.status === 'rejected').length,
        totalDaysUsed,
        recentRequests: leaves.slice(-5),
      };
    }
    case 'salary': {
      const slips = getMockSalarySlips(userId);
      const totalEarnings = slips.reduce((sum, s) => sum + s.netSalary, 0);
      return {
        totalSlips: slips.length,
        totalEarnings,
        avgSalary: slips.length > 0 ? totalEarnings / slips.length : 0,
        highestSalary: slips.length > 0 ? Math.max(...slips.map(s => s.netSalary)) : 0,
        recentSlips: slips.slice(-6),
      };
    }
    case 'projects': {
      const projects = getMockProjects(user);
      const completed = projects.filter(p => p.status === 'completed').length;
      const inProgress = projects.filter(p => p.status === 'in_progress').length;
      const notStarted = projects.filter(p => p.status === 'not_started').length;
      const totalProgress = projects.reduce((sum, p) => sum + (p.progress || 0), 0);
      return {
        totalProjects: projects.length,
        completed,
        inProgress,
        notStarted,
        avgProgress: projects.length > 0 ? totalProgress / projects.length : 0,
        recentProjects: projects.slice(-5),
      };
    }
    default:
      return {};
  }
};

// ========== EXPORT REPORT ==========
export const exportReport = (
  reportType: string,
  reportData: ReportData,
  user: ReportUser | null
) => {
  const reportTitle = `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`;
  const timestamp = new Date().toISOString().split('T')[0];

  let csvContent = `${reportTitle} - ${user?.name || 'Employee'}\n`;
  csvContent += `Employee ID: ${user?.employeeId || '-'}\n`;
  csvContent += `Department: ${user?.department || '-'}\n`;
  csvContent += `Generated on: ${new Date().toLocaleDateString()}\n\n`;

  if (reportType === 'attendance') {
    const data = reportData as AttendanceReportData;
    csvContent += `Summary\n`;
    csvContent += `Total Days,${data.totalDays}\n`;
    csvContent += `Present Days,${data.presentDays}\n`;
    csvContent += `Absent Days,${data.absentDays}\n`;
    csvContent += `Late Days,${data.lateDays}\n`;
    csvContent += `Attendance Rate,${data.attendanceRate}%\n\n`;

    if (data.records && data.records.length > 0) {
      csvContent += `Recent Records\n`;
      csvContent += `Date,Status,Punch In,Punch Out\n`;
      data.records.forEach((record) => {
        csvContent += `${new Date(record.date).toLocaleDateString()},${record.status},${record.punchIn || '-'},${record.punchOut || '-'}\n`;
      });
    }
  } else if (reportType === 'leaves') {
    const data = reportData as LeaveReportData;
    csvContent += `Summary\n`;
    csvContent += `Total Requests,${data.totalRequests}\n`;
    csvContent += `Approved,${data.approved}\n`;
    csvContent += `Pending,${data.pending}\n`;
    csvContent += `Rejected,${data.rejected}\n`;
    csvContent += `Total Days Used,${data.totalDaysUsed}\n`;
  } else if (reportType === 'salary') {
    const data = reportData as SalaryReportData;
    csvContent += `Summary\n`;
    csvContent += `Total Slips,${data.totalSlips}\n`;
    csvContent += `Total Earnings,${data.totalEarnings}\n`;
    csvContent += `Average Salary,${data.avgSalary}\n`;
    csvContent += `Highest Salary,${data.highestSalary}\n`;
  } else if (reportType === 'projects') {
    const data = reportData as ProjectsReportData;
    csvContent += `Summary\n`;
    csvContent += `Total Projects,${data.totalProjects}\n`;
    csvContent += `Completed,${data.completed}\n`;
    csvContent += `In Progress,${data.inProgress}\n`;
    csvContent += `Not Started,${data.notStarted}\n`;
    csvContent += `Average Progress,${data.avgProgress}%\n`;
  }

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${reportType}-report-${timestamp}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
};