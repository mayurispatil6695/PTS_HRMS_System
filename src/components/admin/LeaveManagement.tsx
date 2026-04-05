import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, Download, Filter, Search, AlertTriangle, Check, X, RotateCcw, Trash2, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from '../ui/use-toast';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, onValue, query, orderByChild, update, remove, off } from 'firebase/database';

interface Employee {
  id: string;
  name: string;
  email: string;
  department?: string;
  designation?: string;
  status: string;
  adminId?: string;
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  approvedBy?: string;
  adminId?: string;
}

interface Notification {
  id: string;
  type: 'new-leave' | 'approved' | 'rejected' | 'reopened';
  employeeName: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: string;
  timestamp: number;
  read: boolean;
  adminId?: string;
}

const LeaveManagement = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<LeaveRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission);
      });
    }
  }, []);

  // Fetch ALL employees from all admins
  useEffect(() => {
    if (!user) return;

    const usersRef = ref(database, "users");
    const allEmployees: Employee[] = [];

    const unsubscribeEmployees = onValue(usersRef, (snapshot) => {
      allEmployees.length = 0;

      if (snapshot.exists()) {
        snapshot.forEach((adminSnap) => {
          const adminId = adminSnap.key;
          const employeesData = adminSnap.child("employees").val();

          if (employeesData && typeof employeesData === 'object') {
            Object.entries(employeesData).forEach(([key, value]) => {
              const emp = value as any;
              
              if (emp.status === 'active') {
                allEmployees.push({
                  id: key,
                  name: emp.name || '',
                  email: emp.email || '',
                  department: emp.department || 'No Department',
                  designation: emp.designation || '',
                  status: emp.status || 'active',
                  adminId: adminId || ''
                });
              }
            });
          }
        });
      }

      setEmployees([...allEmployees]);
    }, (error) => {
      console.error('Error fetching employees:', error);
    });

    return () => {
      off(usersRef);
    };
  }, [user]);

  // Fetch ALL leave requests from all employees across all admins
  useEffect(() => {
    if (!user || employees.length === 0) {
      setLoading(false);
      return;
    }

    const allRequests: LeaveRequest[] = [];
    const unsubscribeFunctions: (() => void)[] = [];
    const processedRequests = new Set<string>();

    // Group employees by adminId
    const employeesByAdmin = employees.reduce((acc, emp) => {
      if (emp.adminId) {
        if (!acc[emp.adminId]) acc[emp.adminId] = [];
        acc[emp.adminId].push(emp);
      }
      return acc;
    }, {} as Record<string, Employee[]>);

    Object.entries(employeesByAdmin).forEach(([adminId, adminEmployees]) => {
      adminEmployees.forEach(employee => {
        const leavesRef = ref(database, `users/${adminId}/employees/${employee.id}/leaves`);
        const leavesQuery = query(leavesRef, orderByChild('appliedAt'));
        
        const unsubscribe = onValue(leavesQuery, (snapshot) => {
          const data = snapshot.val();
          
          // Remove existing requests for this employee
          const index = allRequests.findIndex(r => r.employeeId === employee.id);
          if (index !== -1) {
            allRequests.splice(index, 1);
          }

          if (data && typeof data === 'object') {
            const requests: LeaveRequest[] = Object.entries(data).map(([key, value]) => ({
              id: key,
              employeeId: employee.id,
              employeeName: employee.name,
              employeeEmail: employee.email,
              department: employee.department || 'No Department',
              adminId: adminId,
              ...(value as Omit<LeaveRequest, 'id' | 'employeeId' | 'employeeName' | 'employeeEmail' | 'department' | 'adminId'>)
            }));
            
            allRequests.push(...requests);

            // Check for new leave requests
            requests.forEach(request => {
              const requestKey = `${request.employeeId}-${request.id}`;
              
              // Check if this is a new request (applied within last 5 minutes)
              if (new Date(request.appliedAt).getTime() > Date.now() - 300000 && 
                  !processedRequests.has(requestKey)) {
                processedRequests.add(requestKey);
                showSystemNotification({
                  type: 'new-leave',
                  employeeName: request.employeeName,
                  employeeId: request.employeeId,
                  leaveType: request.leaveType,
                  startDate: request.startDate,
                  endDate: request.endDate,
                  status: request.status,
                  timestamp: new Date(request.appliedAt).getTime(),
                  adminId: adminId
                });
              }
            });
          }
          
          setLeaveRequests([...allRequests].sort((a, b) => 
            new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
          ));
          setLoading(false);
        });

        unsubscribeFunctions.push(unsubscribe);
      });
    });

    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }, [user, employees]);

  const showSystemNotification = (notification: Omit<Notification, 'id' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `${notification.type}-${notification.timestamp}`,
      read: false
    };

    // Add to in-app notifications
    setNotifications(prev => [newNotification, ...prev]);
    setCurrentNotification(newNotification);
    setShowNotification(true);

    // Show browser notification if permission is granted
    if (notificationPermission === 'granted') {
      const notificationDetails = getNotificationDetails(notification.type);
      try {
        new Notification(notificationDetails.title, {
          body: notificationDetails.description
            .replace('{employee}', notification.employeeName)
            .replace('{leaveType}', notification.leaveType)
            .replace('{startDate}', new Date(notification.startDate).toLocaleDateString())
            .replace('{endDate}', new Date(notification.endDate).toLocaleDateString()),
          icon: '/logo.png',
          tag: `leave-${notification.type}-${notification.timestamp}`
        });
      } catch (error) {
        console.error('Error showing system notification:', error);
      }
    }

    // Auto-hide after 5 seconds
    const timeoutId = setTimeout(() => {
      setShowNotification(false);
      setTimeout(() => setCurrentNotification(null), 500);
    }, 5000);

    return () => clearTimeout(timeoutId);
  };

  const getNotificationDetails = (type: string) => {
    switch (type) {
      case 'new-leave':
        return { 
          title: 'New Leave Request', 
          description: '{employee} has applied for {leaveType} leave from {startDate} to {endDate}',
          color: 'bg-blue-100 text-blue-800 border-blue-500'
        };
      case 'approved':
        return { 
          title: 'Leave Approved', 
          description: '{employee}\'s {leaveType} leave has been approved',
          color: 'bg-green-100 text-green-800 border-green-500'
        };
      case 'rejected':
        return { 
          title: 'Leave Rejected', 
          description: '{employee}\'s {leaveType} leave has been rejected',
          color: 'bg-red-100 text-red-800 border-red-500'
        };
      case 'reopened':
        return { 
          title: 'Leave Reopened', 
          description: '{employee}\'s {leaveType} leave request has been reopened',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-500'
        };
      default:
        return { 
          title: 'Leave Update', 
          description: 'There has been an update to a leave request',
          color: 'bg-gray-100 text-gray-800 border-gray-500'
        };
    }
  };

  // Apply filters
  useEffect(() => {
    let filtered = leaveRequests;

    if (searchTerm) {
      filtered = filtered.filter(request => 
        request.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.employeeId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterDate) {
      filtered = filtered.filter(request => 
        new Date(request.appliedAt).toDateString() === new Date(filterDate).toDateString()
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(request => request.status === filterStatus);
    }

    setFilteredRequests(filtered);
  }, [searchTerm, filterDate, filterStatus, leaveRequests]);

  const updateLeaveStatus = async (request: LeaveRequest, newStatus: 'approved' | 'rejected' | 'pending') => {
    if (!user) return;
    if (!request.adminId) {
      toast({
        title: "Error",
        description: "Unable to determine admin for this leave request",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const updates: Partial<LeaveRequest> = {
        status: newStatus
      };

      if (newStatus === 'approved') {
        updates.approvedAt = new Date().toISOString();
        updates.approvedBy = user.name || 'Admin';
      } else if (newStatus === 'rejected') {
        updates.rejectedAt = new Date().toISOString();
      } else if (newStatus === 'pending') {
        updates.rejectedAt = '';
        updates.approvedAt = '';
        updates.approvedBy = '';
      }

      const leaveRef = ref(database, `users/${request.adminId}/employees/${request.employeeId}/leaves/${request.id}`);
      await update(leaveRef, updates);

      // Show notification for status change
      if (newStatus === 'approved') {
        showSystemNotification({
          type: 'approved',
          employeeName: request.employeeName,
          employeeId: request.employeeId,
          leaveType: request.leaveType,
          startDate: request.startDate,
          endDate: request.endDate,
          status: newStatus,
          timestamp: Date.now(),
          adminId: request.adminId
        });
      } else if (newStatus === 'rejected') {
        showSystemNotification({
          type: 'rejected',
          employeeName: request.employeeName,
          employeeId: request.employeeId,
          leaveType: request.leaveType,
          startDate: request.startDate,
          endDate: request.endDate,
          status: newStatus,
          timestamp: Date.now(),
          adminId: request.adminId
        });
      } else if (newStatus === 'pending') {
        showSystemNotification({
          type: 'reopened',
          employeeName: request.employeeName,
          employeeId: request.employeeId,
          leaveType: request.leaveType,
          startDate: request.startDate,
          endDate: request.endDate,
          status: newStatus,
          timestamp: Date.now(),
          adminId: request.adminId
        });
      }

      toast({
        title: `Leave ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
        description: `Leave request has been ${newStatus} successfully.`
      });
    } catch (error) {
      console.error("Error updating leave request:", error);
      toast({
        title: "Error",
        description: `Failed to ${newStatus} leave request`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (request: LeaveRequest) => {
    updateLeaveStatus(request, 'approved');
  };

  const handleReject = (request: LeaveRequest) => {
    updateLeaveStatus(request, 'rejected');
  };

  const handleReapprove = (request: LeaveRequest) => {
    updateLeaveStatus(request, 'pending');
  };

  const handleDelete = async (request: LeaveRequest) => {
    if (!user) return;
    if (!request.adminId) {
      toast({
        title: "Error",
        description: "Unable to determine admin for this leave request",
        variant: "destructive"
      });
      return;
    }

    if (window.confirm('Are you sure you want to delete this leave request?')) {
      try {
        setLoading(true);
        const leaveRef = ref(database, `users/${request.adminId}/employees/${request.employeeId}/leaves/${request.id}`);
        await remove(leaveRef);

        toast({
          title: "Leave Request Deleted",
          description: "Leave request has been deleted successfully"
        });
      } catch (error) {
        console.error("Error deleting leave request:", error);
        toast({
          title: "Error",
          description: "Failed to delete leave request",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'approved': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const exportLeaves = () => {
    const csvContent = [
      ['Employee Name', 'Employee ID', 'Department', 'Leave Type', 'Start Date', 'End Date', 'Duration', 'Status', 'Reason', 'Applied At'],
      ...filteredRequests.map(request => [
        request.employeeName,
        request.employeeId,
        request.department,
        request.leaveType,
        new Date(request.startDate).toLocaleDateString(),
        new Date(request.endDate).toLocaleDateString(),
        calculateDays(request.startDate, request.endDate),
        request.status,
        request.reason,
        new Date(request.appliedAt).toLocaleString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leave-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Get summary statistics
  const pendingCount = leaveRequests.filter(r => r.status === 'pending').length;
  const approvedCount = leaveRequests.filter(r => r.status === 'approved').length;
  const rejectedCount = leaveRequests.filter(r => r.status === 'rejected').length;

  if (loading && leaveRequests.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Notification Popup */}
      {showNotification && currentNotification && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm w-full ${getNotificationDetails(currentNotification.type).color} border-l-4`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <Bell className="h-5 w-5" />
            </div>
            <div className="ml-3 w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium">
                {getNotificationDetails(currentNotification.type).title}
              </p>
              <p className="mt-1 text-sm">
                {getNotificationDetails(currentNotification.type).description
                  .replace('{employee}', currentNotification.employeeName)
                  .replace('{leaveType}', currentNotification.leaveType)
                  .replace('{startDate}', new Date(currentNotification.startDate).toLocaleDateString())
                  .replace('{endDate}', new Date(currentNotification.endDate).toLocaleDateString())}
              </p>
              <p className="mt-1 text-xs text-gray-600">
                {new Date(currentNotification.timestamp).toLocaleTimeString()}
              </p>
            </div>
            <div className="ml-4 flex-shrink-0 flex">
              <button
                onClick={() => setShowNotification(false)}
                className="rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Leave Management</h1>
          <p className="text-gray-600">Manage all employee leave requests across the organization</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-yellow-50">
            Pending: {pendingCount}
          </Badge>
          <Badge variant="outline" className="bg-green-50">
            Approved: {approvedCount}
          </Badge>
          <Badge variant="outline" className="bg-red-50">
            Rejected: {rejectedCount}
          </Badge>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search employee..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                placeholder="Filter by date"
              />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={exportLeaves} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Leave Requests ({filteredRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Employee</th>
                    <th className="text-left p-3">Leave Type</th>
                    <th className="text-left p-3">Dates</th>
                    <th className="text-left p-3">Duration</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Applied On</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((request, index) => (
                    <motion.tr
                      key={`${request.id}-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{request.employeeName}</p>
                          <p className="text-sm text-gray-500">{request.employeeId}</p>
                          <p className="text-sm text-gray-500">{request.department}</p>
                        </div>
                      </td>
                      <td className="p-3">
                        {request.leaveType}
                      </td>
                      <td className="p-3">
                        <div>
                          <p>{new Date(request.startDate).toLocaleDateString()}</p>
                          <p>to</p>
                          <p>{new Date(request.endDate).toLocaleDateString()}</p>
                        </div>
                      </td>
                      <td className="p-3">
                        {calculateDays(request.startDate, request.endDate)} days
                      </td>
                      <td className="p-3">
                        <Badge className={getStatusColor(request.status)}>
                          {request.status}
                        </Badge>
                        {request.approvedBy && (
                          <p className="text-xs text-gray-500 mt-1">
                            Approved by {request.approvedBy}
                          </p>
                        )}
                      </td>
                      <td className="p-3">
                        {new Date(request.appliedAt).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-2">
                          {request.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(request)}
                                className="bg-green-600 hover:bg-green-700"
                                disabled={loading}
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReject(request)}
                                className="border-red-200 text-red-600 hover:bg-red-50"
                                disabled={loading}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                          {(request.status === 'approved' || request.status === 'rejected') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReapprove(request)}
                              className="text-blue-600 hover:bg-blue-50"
                              disabled={loading}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Re-open
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(request)}
                            className="text-red-600 hover:bg-red-50"
                            disabled={loading}
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {filteredRequests.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {leaveRequests.length === 0 ? (
                    "No leave requests found in the system"
                  ) : (
                    "No leave requests match the current filter"
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default LeaveManagement;