import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useAuth } from '../../hooks/useAuth';
import { generateReportData, exportReport } from '../../utils/reportUtils';
import ReportConfiguration from './reports/ReportConfiguration';
import AttendanceReportSummary from './reports/AttendanceReportSummary';
import SalaryReportSummary from './reports/SalaryReportSummary';
import ProjectsReportSummary from './reports/ProjectsReportSummary';
import LeaveReportSummary from './reports/LeaveReportSummary';
import DailyTask from './reports/DailyTask';

const EmployeeReports = () => {
  const { user } = useAuth();
  const [reportType, setReportType] = useState('attendance');
  const [dateRange, setDateRange] = useState('thisMonth');
  const [reportData, setReportData] = useState<any>({});

  useEffect(() => {
    const data = generateReportData(reportType, user);
    setReportData(data);
  }, [reportType, dateRange, user]);

  const handleExportReport = () => {
    exportReport(reportType, reportData, user);
  };

  const renderReportSummary = () => {
    switch (reportType) {
      case 'attendance':
        return <AttendanceReportSummary reportData={reportData} />;
      case 'salary':
        return <SalaryReportSummary reportData={reportData} />;
      case 'projects':
        return <ProjectsReportSummary reportData={reportData} />;
      case 'leaves':
        return <LeaveReportSummary reportData={reportData} />;
      case 'tasks':
        return <DailyTask />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Reports</h1>
          <p className="text-gray-600">Generate and export your personal reports</p>
        </div>
      </motion.div>

      {/* Report Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <ReportConfiguration
          reportType={reportType}
          dateRange={dateRange}
          onReportTypeChange={setReportType}
          onDateRangeChange={setDateRange}
          onExportReport={handleExportReport}
          showTasksOption={true}
        />
      </motion.div>

      {/* Report Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {reportType === 'tasks' ? 'Daily Tasks' : 
               reportType.charAt(0).toUpperCase() + reportType.slice(1) + ' Summary'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderReportSummary()}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default EmployeeReports;