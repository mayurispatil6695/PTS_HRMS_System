
import React from 'react';
import { FileText, BarChart3, Calendar } from 'lucide-react';
import { formatCurrency } from '../../../utils/reportUtils';

interface SalaryReportSummaryProps {
  reportData: any;
}

const SalaryReportSummary: React.FC<SalaryReportSummaryProps> = ({ reportData }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="text-center p-4 bg-blue-50 rounded-lg">
        <FileText className="h-8 w-8 text-blue-600 mx-auto mb-2" />
        <p className="text-2xl font-bold text-blue-600">{reportData.totalSlips || 0}</p>
        <p className="text-sm text-gray-600">Salary Slips</p>
      </div>
      <div className="text-center p-4 bg-green-50 rounded-lg">
        <BarChart3 className="h-8 w-8 text-green-600 mx-auto mb-2" />
        <p className="text-2xl font-bold text-green-600">{formatCurrency(reportData.totalEarnings || 0)}</p>
        <p className="text-sm text-gray-600">Total Earnings</p>
      </div>
      <div className="text-center p-4 bg-purple-50 rounded-lg">
        <Calendar className="h-8 w-8 text-purple-600 mx-auto mb-2" />
        <p className="text-2xl font-bold text-purple-600">{formatCurrency(reportData.avgSalary || 0)}</p>
        <p className="text-sm text-gray-600">Average Salary</p>
      </div>
    </div>
  );
};

export default SalaryReportSummary;
