
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Download } from 'lucide-react';

interface ReportConfigurationProps {
  reportType: string;
  dateRange: string;
  onReportTypeChange: (value: string) => void;
  onDateRangeChange: (value: string) => void;
  onExportReport: () => void;
}

const ReportConfiguration: React.FC<ReportConfigurationProps> = ({
  reportType,
  dateRange,
  onReportTypeChange,
  onDateRangeChange,
  onExportReport
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Report Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select value={reportType} onValueChange={onReportTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Report Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="attendance">My Attendance</SelectItem>
              <SelectItem value="leaves">My Leaves</SelectItem>
              <SelectItem value="salary">My Salary</SelectItem>
              <SelectItem value="projects">My Projects</SelectItem>
              <SelectItem value='tasks'>My Daily Task</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={dateRange} onValueChange={onDateRangeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="thisYear">This Year</SelectItem>
              <SelectItem value="allTime">All Time</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={onExportReport}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReportConfiguration;
