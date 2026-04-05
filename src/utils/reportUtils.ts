
export const generateReportData = (reportType: string, user: any) => {
  if (!user) return {};

  const attendance = JSON.parse(localStorage.getItem('attendance_records') || '[]');
  const leaves = JSON.parse(localStorage.getItem('leave_requests') || '[]');
  const salarySlips = JSON.parse(localStorage.getItem('salary_slips') || '[]');
  const projects = JSON.parse(localStorage.getItem('projects') || '[]');

  // Filter data for current user
  const userAttendance = attendance.filter((record: any) => record.employeeId === user.id);
  const userLeaves = leaves.filter((leave: any) => leave.employeeId === user.employeeId);
  const userSalarySlips = salarySlips.filter((slip: any) => slip.employeeId === user.employeeId);
  const userProjects = projects.filter((project: any) => 
    project.assignedTo === user.email || project.department === user.department
  );

  let data: any = {};

  switch (reportType) {
    case 'attendance':
      const presentDays = userAttendance.filter((record: any) => record.status === 'present').length;
      const absentDays = userAttendance.filter((record: any) => record.status === 'absent').length;
      const lateDays = userAttendance.filter((record: any) => record.status === 'late').length;
      
      data = {
        totalDays: userAttendance.length,
        presentDays,
        absentDays,
        lateDays,
        attendanceRate: userAttendance.length > 0 ? Math.round((presentDays / userAttendance.length) * 100) : 0,
        records: userAttendance.slice(-10) // Last 10 records
      };
      break;
    
    case 'leaves':
      data = {
        totalRequests: userLeaves.length,
        approved: userLeaves.filter((leave: any) => leave.status === 'approved').length,
        pending: userLeaves.filter((leave: any) => leave.status === 'pending').length,
        rejected: userLeaves.filter((leave: any) => leave.status === 'rejected').length,
        totalDaysUsed: userLeaves
          .filter((leave: any) => leave.status === 'approved')
          .reduce((total: number, leave: any) => {
            const start = new Date(leave.startDate);
            const end = new Date(leave.endDate);
            const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            return total + days;
          }, 0),
        recentRequests: userLeaves.slice(-5)
      };
      break;
    
    case 'salary':
      const totalEarnings = userSalarySlips.reduce((sum: number, slip: any) => sum + slip.netSalary, 0);
      data = {
        totalSlips: userSalarySlips.length,
        totalEarnings,
        avgSalary: userSalarySlips.length > 0 ? totalEarnings / userSalarySlips.length : 0,
        highestSalary: userSalarySlips.length > 0 ? Math.max(...userSalarySlips.map((slip: any) => slip.netSalary)) : 0,
        recentSlips: userSalarySlips.slice(-6)
      };
      break;
    
    case 'projects':
      data = {
        totalProjects: userProjects.length,
        completed: userProjects.filter((project: any) => project.status === 'completed').length,
        inProgress: userProjects.filter((project: any) => project.status === 'in_progress').length,
        notStarted: userProjects.filter((project: any) => project.status === 'not_started').length,
        avgProgress: userProjects.length > 0 
          ? userProjects.reduce((sum: number, project: any) => sum + (project.progress || 0), 0) / userProjects.length 
          : 0,
        recentProjects: userProjects.slice(-5)
      };
      break;
  }

  return data;
};

export const exportReport = (reportType: string, reportData: any, user: any) => {
  const reportTitle = `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`;
  const timestamp = new Date().toISOString().split('T')[0];
  
  let csvContent = `${reportTitle} - ${user?.name}\n`;
  csvContent += `Employee ID: ${user?.employeeId}\n`;
  csvContent += `Department: ${user?.department}\n`;
  csvContent += `Generated on: ${new Date().toLocaleDateString()}\n\n`;
  
  if (reportType === 'attendance') {
    csvContent += `Summary\n`;
    csvContent += `Total Days,${reportData.totalDays}\n`;
    csvContent += `Present Days,${reportData.presentDays}\n`;
    csvContent += `Absent Days,${reportData.absentDays}\n`;
    csvContent += `Late Days,${reportData.lateDays}\n`;
    csvContent += `Attendance Rate,${reportData.attendanceRate}%\n\n`;
    
    if (reportData.records && reportData.records.length > 0) {
      csvContent += `Recent Records\n`;
      csvContent += `Date,Status,Punch In,Punch Out\n`;
      reportData.records.forEach((record: any) => {
        csvContent += `${new Date(record.date).toLocaleDateString()},${record.status},${record.punchIn || '-'},${record.punchOut || '-'}\n`;
      });
    }
  }
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${reportType}-report-${timestamp}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(amount);
};
