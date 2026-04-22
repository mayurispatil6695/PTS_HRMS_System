import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plane, Plus, Calendar, Clock, Bell, AlertCircle, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, onValue, off, push, set, get } from 'firebase/database';
import { toast } from '../ui/use-toast';

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
}

interface Notification {
  id: string;
  type: 'approved' | 'rejected';
  leaveType: string;
  startDate: string;
  endDate: string;
  status: string;
  timestamp: number;
  read: boolean;
}

interface LeaveBalance {
  casual: number;
  sick: number;
  annual: number;
  compOff: number;
}

interface FirebaseUserData {
  role?: string;
  name?: string;
  email?: string;
  [key: string]: unknown;
}

const EmployeeLeaves = () => {
  const { user } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [formData, setFormData] = useState({
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: ''
  });
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance>({
    casual: 0,
    sick: 0,
    annual: 0,
    compOff: 0
  });
  
  const previousRequestsRef = useRef<LeaveRequest[]>([]);
  const notificationTimeoutRef = useRef<NodeJS.Timeout>();

  const leaveTypes = [
    'Casual Leave',
    'Sick Leave',
    'Annual Leave',
    'Comp-off Leave',
    'Maternity Leave',
    'Paternity Leave',
    'Emergency Leave'
  ];

  const getBalanceKey = (leaveType: string): keyof LeaveBalance | null => {
    const mapping: Record<string, keyof LeaveBalance> = {
      'Casual Leave': 'casual',
      'Sick Leave': 'sick',
      'Annual Leave': 'annual',
      'Comp-off Leave': 'compOff'
    };
    return mapping[leaveType] || null;
  };

  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission);
      });
    }
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  const showSystemNotification = useCallback((notification: Omit<Notification, 'id' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `${notification.type}-${notification.timestamp}`,
      read: false
    };
    setNotifications(prev => [newNotification, ...prev]);
    setCurrentNotification(newNotification);
    setShowNotification(true);

    if (notificationPermission === 'granted') {
      const notificationDetails = getNotificationDetails(notification.type);
      try {
        new Notification(notificationDetails.title, {
          body: notificationDetails.description
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

    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = setTimeout(() => {
      setShowNotification(false);
      setTimeout(() => setCurrentNotification(null), 500);
    }, 5000);
  }, [notificationPermission]);

  const getNotificationDetails = (type: string) => {
    switch (type) {
      case 'approved':
        return { 
          title: 'Leave Approved', 
          description: 'Your {leaveType} leave from {startDate} to {endDate} has been approved',
          color: 'bg-green-100 text-green-800 border-green-500'
        };
      case 'rejected':
        return { 
          title: 'Leave Rejected', 
          description: 'Your {leaveType} leave from {startDate} to {endDate} has been rejected',
          color: 'bg-red-100 text-red-800 border-red-500'
        };
      default:
        return { 
          title: 'Leave Update', 
          description: 'There has been an update to your leave request',
          color: 'bg-gray-100 text-gray-800 border-gray-500'
        };
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    const balanceRef = ref(database, `leaveBalances/${user.id}`);
    const unsubscribe = onValue(balanceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLeaveBalances({
          casual: data.casual || 0,
          sick: data.sick || 0,
          annual: data.annual || 0,
          compOff: data.compOff || 0
        });
      }
    });
    return () => off(balanceRef);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !user?.adminUid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const leavesRef = ref(database, `users/${user.adminUid}/employees/${user.id}/leaves`);
    
    const unsubscribe = onValue(leavesRef, (snapshot) => {
      try {
        const data = snapshot.val();
        let requests: LeaveRequest[] = [];
        if (data) {
          requests = Object.entries(data).map(([key, value]) => ({
            id: key,
            ...(value as Omit<LeaveRequest, 'id'>)
          }));
          requests.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
          
          const previousRequests = previousRequestsRef.current;
          requests.forEach(request => {
            const previousRequest = previousRequests.find(r => r.id === request.id);
            if (previousRequest && previousRequest.status === 'pending' && request.status === 'approved') {
              showSystemNotification({
                type: 'approved',
                leaveType: request.leaveType,
                startDate: request.startDate,
                endDate: request.endDate,
                status: request.status,
                timestamp: new Date(request.approvedAt || Date.now()).getTime()
              });
            }
            if (previousRequest && previousRequest.status === 'pending' && request.status === 'rejected') {
              showSystemNotification({
                type: 'rejected',
                leaveType: request.leaveType,
                startDate: request.startDate,
                endDate: request.endDate,
                status: request.status,
                timestamp: new Date(request.rejectedAt || Date.now()).getTime()
              });
            }
          });
          previousRequestsRef.current = requests;
        }
        setLeaveRequests(requests);
      } catch (error) {
        console.error("Error fetching leave requests:", error);
        toast({ title: "Error", description: "Failed to load leave requests", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error("Firebase error:", error);
      setLoading(false);
      toast({ title: "Error", description: "Failed to connect to database", variant: "destructive" });
    });

    return () => {
      off(leavesRef);
      unsubscribe();
    };
  }, [user?.id, user?.adminUid, showSystemNotification]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !user?.adminUid) {
      toast({ title: "Error", description: "User information not available", variant: "destructive" });
      return;
    }

    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      toast({ title: "Error", description: "Start date cannot be after end date", variant: "destructive" });
      return;
    }

    const balanceKey = getBalanceKey(formData.leaveType);
    if (balanceKey) {
      const days = calculateDays(formData.startDate, formData.endDate);
      const currentBalance = leaveBalances[balanceKey];
      if (currentBalance < days) {
        // ✅ FIXED: replaced toast.error with proper toast call
        toast({ 
          title: "Insufficient Balance", 
          description: `Insufficient balance for ${formData.leaveType}. Available: ${currentBalance} days`, 
          variant: "destructive" 
        });
        return;
      }
    }

    try {
      setLoading(true);
      const newRequest: Omit<LeaveRequest, 'id'> = {
        employeeId: user.id,
        employeeName: user.name || user.email?.split('@')[0] || 'Employee',
        employeeEmail: user.email || '',
        department: user.department || 'General',
        leaveType: formData.leaveType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason,
        status: 'pending',
        appliedAt: new Date().toISOString()
      };

      const leavesRef = ref(database, `users/${user.adminUid}/employees/${user.id}/leaves`);
      const newLeaveRef = push(leavesRef);
      await set(newLeaveRef, newRequest);

      const usersSnapshot = await get(ref(database, 'users'));
      const adminNotifications: Promise<void>[] = [];

      usersSnapshot.forEach((childSnap) => {
        const userData = childSnap.val() as FirebaseUserData;
        if (userData.role === 'admin') {
          const notifRef = push(ref(database, `notifications/${childSnap.key}`));
          adminNotifications.push(set(notifRef, {
            title: 'New Leave Request',
            body: `${user.name || 'Employee'} applied for ${formData.leaveType} leave from ${new Date(formData.startDate).toLocaleDateString()} to ${new Date(formData.endDate).toLocaleDateString()}`,
            type: 'leave_request',
            read: false,
            createdAt: Date.now(),
            employeeId: user.id,
            leaveId: newLeaveRef.key,
          }));
        }
      });
      await Promise.all(adminNotifications);

      toast({ title: "Leave Applied", description: "Your leave request has been submitted successfully." });
      setFormData({ leaveType: '', startDate: '', endDate: '', reason: '' });
      setShowApplyForm(false);
    } catch (error) {
      console.error("Error submitting leave request:", error);
      toast({ title: "Error", description: "Failed to submit leave request", variant: "destructive" });
    } finally {
      setLoading(false);
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

  const getLeaveStats = () => {
    const total = leaveRequests.length;
    const pending = leaveRequests.filter(req => req.status === 'pending').length;
    const approved = leaveRequests.filter(req => req.status === 'approved').length;
    const rejected = leaveRequests.filter(req => req.status === 'rejected').length;
    const approvedDays = leaveRequests.filter(req => req.status === 'approved').reduce((total, req) => total + calculateDays(req.startDate, req.endDate), 0);
    return { total, pending, approved, rejected, approvedDays };
  };

  const stats = getLeaveStats();

  if (loading && leaveRequests.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {showNotification && currentNotification && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm w-full ${getNotificationDetails(currentNotification.type).color} border-l-4`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0"><Bell className="h-5 w-5" /></div>
            <div className="ml-3 w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium">{getNotificationDetails(currentNotification.type).title}</p>
              <p className="mt-1 text-sm">
                {getNotificationDetails(currentNotification.type).description
                  .replace('{leaveType}', currentNotification.leaveType)
                  .replace('{startDate}', new Date(currentNotification.startDate).toLocaleDateString())
                  .replace('{endDate}', new Date(currentNotification.endDate).toLocaleDateString())}
              </p>
              <p className="mt-1 text-xs text-gray-600">{new Date(currentNotification.timestamp).toLocaleTimeString()}</p>
            </div>
            <div className="ml-4 flex-shrink-0 flex">
              <button onClick={() => setShowNotification(false)} className="rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none">
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-800">My Leaves</h1><p className="text-gray-600">Apply for leave and track your requests</p></div>
        <Button onClick={() => setShowApplyForm(true)}><Plus className="h-4 w-4 mr-2" /> Apply Leave</Button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> My Leave Balances</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-2 bg-blue-50 rounded-lg text-center">
                <p className="text-xs text-gray-600">Casual</p>
                <p className="text-xl font-bold text-blue-700">{leaveBalances.casual}</p>
              </div>
              <div className="p-2 bg-green-50 rounded-lg text-center">
                <p className="text-xs text-gray-600">Sick</p>
                <p className="text-xl font-bold text-green-700">{leaveBalances.sick}</p>
              </div>
              <div className="p-2 bg-purple-50 rounded-lg text-center">
                <p className="text-xs text-gray-600">Annual</p>
                <p className="text-xl font-bold text-purple-700">{leaveBalances.annual}</p>
              </div>
              <div className="p-2 bg-orange-50 rounded-lg text-center">
                <p className="text-xs text-gray-600">Comp‑off</p>
                <p className="text-xl font-bold text-orange-700">{leaveBalances.compOff}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { icon: Plane, label: 'Total Requests', value: stats.total, color: 'text-blue-600', delay: 0.1 },
          { icon: Clock, label: 'Pending', value: stats.pending, color: 'text-yellow-600', delay: 0.2 },
          { icon: Calendar, label: 'Approved', value: stats.approved, color: 'text-green-600', delay: 0.3 },
          { icon: Plane, label: 'Rejected', value: stats.rejected, color: 'text-red-600', delay: 0.4 },
          { icon: Calendar, label: 'Days Used', value: stats.approvedDays, color: 'text-purple-600', delay: 0.5 }
        ].map((item, idx) => (
          <motion.div key={idx} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: item.delay }}>
            <Card><CardContent className="p-4"><div className="flex items-center gap-2"><item.icon className={`h-4 w-4 ${item.color}`} /><div><p className="text-sm text-gray-600">{item.label}</p><p className={`text-xl font-bold ${item.color}`}>{item.value}</p></div></div></CardContent></Card>
          </motion.div>
        ))}
      </div>

      {showApplyForm && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card><CardHeader><CardTitle>Apply for Leave</CardTitle></CardHeader><CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Select value={formData.leaveType} onValueChange={(value) => setFormData({...formData, leaveType: value})} required>
                <SelectTrigger><SelectValue placeholder="Select Leave Type" /></SelectTrigger>
                <SelectContent>
                  {leaveTypes.map(type => {
                    const balanceKey = getBalanceKey(type);
                    const balance = balanceKey ? leaveBalances[balanceKey] : null;
                    return (
                      <SelectItem key={type} value={type}>
                        {type} {balance !== null && `(Available: ${balance})`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-sm font-medium mb-1 block">Start Date</label><Input type="date" value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} required min={new Date().toISOString().split('T')[0]} /></div>
                <div><label className="text-sm font-medium mb-1 block">End Date</label><Input type="date" value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} required min={formData.startDate || new Date().toISOString().split('T')[0]} /></div>
              </div>
              {formData.startDate && formData.endDate && (
                <div className="p-3 bg-blue-50 rounded-lg flex justify-between items-center">
                  <p className="text-sm text-blue-700">Duration: {calculateDays(formData.startDate, formData.endDate)} day(s)</p>
                  {(() => {
                    const balanceKey = getBalanceKey(formData.leaveType);
                    if (balanceKey) {
                      const days = calculateDays(formData.startDate, formData.endDate);
                      const available = leaveBalances[balanceKey];
                      if (available < days) {
                        return <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Insufficient balance</p>;
                      }
                    }
                    return null;
                  })()}
                </div>
              )}
              <Textarea placeholder="Reason for leave..." value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} required minLength={10} />
              <div className="flex gap-2"><Button type="submit" disabled={loading}>{loading ? "Submitting..." : "Apply Leave"}</Button><Button type="button" variant="outline" onClick={() => setShowApplyForm(false)} disabled={loading}>Cancel</Button></div>
            </form>
          </CardContent></Card>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plane className="h-4 w-4" /> My Leave Requests ({leaveRequests.length})</CardTitle></CardHeader><CardContent>
          <div className="space-y-4">
            {leaveRequests.map((request, index) => (
              <motion.div key={request.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2"><h3 className="font-semibold">{request.leaveType}</h3><Badge className={getStatusColor(request.status)}>{request.status}</Badge>{request.approvedBy && <Badge variant="outline" className="ml-2">Approved by: {request.approvedBy}</Badge>}</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3 text-sm text-gray-600"><div><p className="font-medium">Duration</p><p>{calculateDays(request.startDate, request.endDate)} day(s)</p></div><div><p className="font-medium">Start Date</p><p>{new Date(request.startDate).toLocaleDateString()}</p></div><div><p className="font-medium">End Date</p><p>{new Date(request.endDate).toLocaleDateString()}</p></div></div>
                    <div className="mb-3"><p className="text-sm font-medium text-gray-700">Reason:</p><p className="text-sm text-gray-600">{request.reason}</p></div>
                    <p className="text-xs text-gray-500">Applied on: {new Date(request.appliedAt).toLocaleString()}</p>
                    {request.status === 'approved' && request.approvedAt && <p className="text-xs text-green-600">Approved on: {new Date(request.approvedAt).toLocaleString()}</p>}
                    {request.status === 'rejected' && request.rejectedAt && <p className="text-xs text-red-600">Rejected on: {new Date(request.rejectedAt).toLocaleString()}</p>}
                  </div>
                </div>
              </motion.div>
            ))}
            {leaveRequests.length === 0 && <div className="text-center py-8 text-gray-500">No leave requests found</div>}
          </div>
        </CardContent></Card>
      </motion.div>
    </div>
  );
};

export default EmployeeLeaves;