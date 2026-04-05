import React, { useState, useEffect } from 'react';
import { Calendar, User, Clock, Filter, AlertTriangle, Check, X } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { useAuth } from '../../../hooks/useAuth';
import { database } from '../../../firebase';
import { ref, onValue, query, orderByChild } from 'firebase/database';

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
}

interface LeaveReportSummaryProps {
  employeeId?: string;
}

const LeaveReportSummary: React.FC<LeaveReportSummaryProps> = ({ employeeId }) => {
  const { user } = useAuth();
  const [leaveData, setLeaveData] = useState({
    totalRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    pendingRequests: 0,
    leaveDays: 0,
    records: [] as LeaveRequest[]
  });
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<'month' | 'lastMonth' | 'year' | 'all'>('month');

  useEffect(() => {
    if (!user?.id) return;

    const targetEmployeeId = employeeId || user.id;
    const adminUid = employeeId ? user.id : user.adminUid || user.id;

    const leavesRef = ref(database, `users/${adminUid}/employees/${targetEmployeeId}/leaves`);
    const leavesQuery = query(leavesRef, orderByChild('appliedAt'));

    const unsubscribe = onValue(leavesQuery, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          const allLeaves: LeaveRequest[] = Object.entries(data).map(([key, value]) => ({
            id: key,
            ...(value as Omit<LeaveRequest, 'id'>)
          }));

          // Filter leaves based on selected time period
          const now = new Date();
          let startDate = new Date();

          switch (timePeriod) {
            case 'month':
              startDate = new Date(now.getFullYear(), now.getMonth(), 1);
              break;
            case 'lastMonth':
              startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              break;
            case 'year':
              startDate = new Date(now.getFullYear(), 0, 1);
              break;
            case 'all':
              startDate = new Date(0); // Earliest possible date
              break;
          }

          const filteredLeaves = allLeaves.filter(leave => 
            new Date(leave.appliedAt) >= startDate
          );

          // Sort leaves by date (newest first)
          filteredLeaves.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());

          // Calculate leave statistics
          const approved = filteredLeaves.filter(leave => leave.status === 'approved');
          const rejected = filteredLeaves.filter(leave => leave.status === 'rejected');
          const pending = filteredLeaves.filter(leave => leave.status === 'pending');

          // Calculate total leave days (only approved leaves)
          const leaveDays = approved.reduce((total, leave) => {
            const start = new Date(leave.startDate);
            const end = new Date(leave.endDate);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            return total + diffDays;
          }, 0);

          setLeaveData({
            totalRequests: filteredLeaves.length,
            approvedRequests: approved.length,
            rejectedRequests: rejected.length,
            pendingRequests: pending.length,
            leaveDays,
            records: filteredLeaves.slice(0, 5) // Show only 5 most recent records
          });
        } else {
          setLeaveData({
            totalRequests: 0,
            approvedRequests: 0,
            rejectedRequests: 0,
            pendingRequests: 0,
            leaveDays: 0,
            records: []
          });
        }
      } catch (error) {
        console.error("Error processing leave data:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user, employeeId, timePeriod]);

  const getTimePeriodLabel = () => {
    switch (timePeriod) {
      case 'month': return 'This Month';
      case 'lastMonth': return 'Last Month';
      case 'year': return 'This Year';
      case 'all': return 'All Time';
      default: return '';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const calculateLeaveDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
        <div className="md:col-span-6">
          <Select value={timePeriod} onValueChange={(value: 'month' | 'lastMonth' | 'year' | 'all') => setTimePeriod(value)}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Time Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <Calendar className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-blue-600">{leaveData.totalRequests}</p>
          <p className="text-sm text-gray-600">Total Requests</p>
          <p className="text-xs text-gray-500">{getTimePeriodLabel()}</p>
        </div>

        <div className="text-center p-4 bg-green-50 rounded-lg">
          <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-green-600">{leaveData.approvedRequests}</p>
          <p className="text-sm text-gray-600">Approved</p>
          <p className="text-xs text-gray-500">
            {leaveData.totalRequests > 0 ? Math.round((leaveData.approvedRequests / leaveData.totalRequests) * 100) : 0}%
          </p>
        </div>

        <div className="text-center p-4 bg-red-50 rounded-lg">
          <X className="h-8 w-8 text-red-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-red-600">{leaveData.rejectedRequests}</p>
          <p className="text-sm text-gray-600">Rejected</p>
          <p className="text-xs text-gray-500">
            {leaveData.totalRequests > 0 ? Math.round((leaveData.rejectedRequests / leaveData.totalRequests) * 100) : 0}%
          </p>
        </div>

        <div className="text-center p-4 bg-yellow-50 rounded-lg">
          <AlertTriangle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-yellow-600">{leaveData.pendingRequests}</p>
          <p className="text-sm text-gray-600">Pending</p>
          <p className="text-xs text-gray-500">
            {leaveData.totalRequests > 0 ? Math.round((leaveData.pendingRequests / leaveData.totalRequests) * 100) : 0}%
          </p>
        </div>

        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <Clock className="h-8 w-8 text-purple-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-purple-600">{leaveData.leaveDays}</p>
          <p className="text-sm text-gray-600">Leave Days</p>
          <p className="text-xs text-gray-500">Approved Only</p>
        </div>
      </div>

      {leaveData.records.length > 0 ? (
        <div>
          <h3 className="text-lg font-semibold mb-4">Recent Leave Requests ({getTimePeriodLabel()})</h3>
          <div className="space-y-2">
            {leaveData.records.map((leave, index) => (
              <div key={index} className="flex flex-col md:flex-row items-start md:items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="mb-2 md:mb-0">
                  <p className="font-medium">{leave.employeeName}</p>
                  <Badge className={getStatusColor(leave.status)}>
                    {leave.status.toUpperCase()}
                  </Badge>
                  {leave.approvedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Approved: {new Date(leave.approvedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="text-sm">
                  <p className="font-medium">{leave.leaveType}</p>
                  <p>
                    {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                  </p>
                  <p className="text-gray-500">
                    {calculateLeaveDays(leave.startDate, leave.endDate)} days
                  </p>
                </div>

                <div className="text-sm mt-2 md:mt-0">
                  <p className="text-gray-500">
                    Applied: {new Date(leave.appliedAt).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-400 truncate max-w-[200px]">
                    {leave.reason}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No leave requests found for {getTimePeriodLabel()}
        </div>
      )}
    </>
  );
};

export default LeaveReportSummary;