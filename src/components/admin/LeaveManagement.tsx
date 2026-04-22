import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, Download, Filter, Search, AlertTriangle, Check, X, RotateCcw, Trash2, Bell, Settings, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from '../ui/use-toast';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, onValue, query, orderByChild, update, remove, off, push, set, get } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Label } from '../ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';

interface LeaveManagementProps {
  role?: 'admin' | 'manager' | 'team_leader' | 'client';
}

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

interface RawEmployeeData {
  name?: string;
  email?: string;
  department?: string;
  designation?: string;
  status?: string;
  employeeId?: string;
  createdAt?: string;
  [key: string]: unknown;
}

interface LeaveBalance {
  casual: number;
  sick: number;
  annual: number;
  compOff: number;
  updatedAt?: string;
}

interface CarryForwardRule {
  max: number;
  percentage: number;
}

// ✅ Helper to map leave type to balance field (excluding 'updatedAt')
type BalanceField = 'casual' | 'sick' | 'annual' | 'compOff';

const getBalanceField = (leaveType: string): BalanceField | null => {
  const mapping: Record<string, BalanceField> = {
    'Casual Leave': 'casual',
    'Sick Leave': 'sick',
    'Annual Leave': 'annual',
    'Comp-off Leave': 'compOff'
  };
  return mapping[leaveType] || null;
};

const LeaveManagement: React.FC<LeaveManagementProps> = ({ role = 'admin' }) => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allLeaveRequests, setAllLeaveRequests] = useState<LeaveRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<LeaveRequest[]>([]);
  const [displayedRequests, setDisplayedRequests] = useState<LeaveRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  
  const [leaveBalances, setLeaveBalances] = useState<Record<string, LeaveBalance>>({});
  const [leaveSettings, setLeaveSettings] = useState<{ carryForward: Record<string, CarryForwardRule>; financialYearStart: string }>({
    carryForward: { casual: { max: 10, percentage: 100 }, sick: { max: 15, percentage: 80 }, annual: { max: 30, percentage: 100 }, compOff: { max: 10, percentage: 0 } },
    financialYearStart: '2026-01-01'
  });
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [balanceForm, setBalanceForm] = useState<LeaveBalance>({ casual: 0, sick: 0, annual: 0, compOff: 0 });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [carryForwardForm, setCarryForwardForm] = useState(leaveSettings.carryForward);
  
  const PAGE_SIZE = 50;

  useEffect(() => {
    if ('Notification' in window) Notification.requestPermission().then(p => setNotificationPermission(p));
  }, []);

  useEffect(() => {
    if (!user) return;
    const usersRef = ref(database, "users");
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const empList: Employee[] = [];
      snapshot.forEach((adminSnap) => {
        const adminId = adminSnap.key;
        const employeesData = adminSnap.child("employees").val() as Record<string, RawEmployeeData> | null;
        if (employeesData && typeof employeesData === 'object') {
          Object.entries(employeesData).forEach(([key, value]) => {
            const emp = value;
            if (emp.status === 'active') {
              empList.push({
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
      setEmployees(empList);
    });
    return () => off(usersRef);
  }, [user]);

  useEffect(() => {
    const balancesRef = ref(database, 'leaveBalances');
    const unsubscribe = onValue(balancesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setLeaveBalances(data);
    });
    return () => off(balancesRef);
  }, []);

  useEffect(() => {
    const settingsRef = ref(database, 'leaveSettings');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLeaveSettings(data);
        setCarryForwardForm(data.carryForward || leaveSettings.carryForward);
      }
    });
    return () => off(settingsRef);
  }, []);

  useEffect(() => {
    if (!user || employees.length === 0) {
      setLoading(false);
      return;
    }

    const allRequests: LeaveRequest[] = [];
    const unsubscribes: (() => void)[] = [];
    const processed = new Set<string>();

    const employeesByAdmin = employees.reduce((acc, emp) => {
      if (emp.adminId) { if (!acc[emp.adminId]) acc[emp.adminId] = []; acc[emp.adminId].push(emp); }
      return acc;
    }, {} as Record<string, Employee[]>);

    Object.entries(employeesByAdmin).forEach(([adminId, adminEmployees]) => {
      adminEmployees.forEach(employee => {
        const leavesRef = ref(database, `users/${adminId}/employees/${employee.id}/leaves`);
        const leavesQuery = query(leavesRef, orderByChild('appliedAt'));
        const unsubscribe = onValue(leavesQuery, (snapshot) => {
          const data = snapshot.val() as Record<string, Omit<LeaveRequest, 'id' | 'employeeId' | 'employeeName' | 'employeeEmail' | 'department' | 'adminId'>> | null;
          const idx = allRequests.findIndex(r => r.employeeId === employee.id);
          if (idx !== -1) allRequests.splice(idx, 1);
          if (data && typeof data === 'object') {
            const requests: LeaveRequest[] = Object.entries(data).map(([key, value]) => ({
              id: key,
              employeeId: employee.id,
              employeeName: employee.name,
              employeeEmail: employee.email,
              department: employee.department || 'No Department',
              adminId,
              ...value
            }));
            allRequests.push(...requests);
            requests.forEach(req => {
              const key = `${req.employeeId}-${req.id}`;
              if (new Date(req.appliedAt).getTime() > Date.now() - 300000 && !processed.has(key)) {
                processed.add(key);
                showSystemNotification({
                  type: 'new-leave',
                  employeeName: req.employeeName,
                  employeeId: req.employeeId,
                  leaveType: req.leaveType,
                  startDate: req.startDate,
                  endDate: req.endDate,
                  status: req.status,
                  timestamp: new Date(req.appliedAt).getTime(),
                  adminId
                });
              }
            });
          }
          const sorted = [...allRequests].sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
          setAllLeaveRequests(sorted);
          setLoading(false);
        });
        unsubscribes.push(unsubscribe);
      });
    });
    return () => unsubscribes.forEach(u => u());
  }, [user, employees]);

  useEffect(() => {
    let filtered = allLeaveRequests;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r => r.employeeName?.toLowerCase().includes(term) || r.employeeId?.toLowerCase().includes(term));
    }
    if (filterDate) {
      filtered = filtered.filter(r => new Date(r.appliedAt).toDateString() === new Date(filterDate).toDateString());
    }
    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }
    setFilteredRequests(filtered);
    setDisplayedRequests(filtered.slice(0, PAGE_SIZE));
    setHasMore(filtered.length > PAGE_SIZE);
  }, [searchTerm, filterDate, filterStatus, allLeaveRequests]);

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const currentLen = displayedRequests.length;
    const next = filteredRequests.slice(currentLen, currentLen + PAGE_SIZE);
    setDisplayedRequests(prev => [...prev, ...next]);
    setHasMore(filteredRequests.length > currentLen + PAGE_SIZE);
    setLoadingMore(false);
  };

  const showSystemNotification = (notification: Omit<Notification, 'id' | 'read'>) => {
    const newNotif: Notification = { ...notification, id: `${notification.type}-${notification.timestamp}`, read: false };
    setNotifications(prev => [newNotif, ...prev]);
    setCurrentNotification(newNotif);
    setShowNotification(true);
    if (notificationPermission === 'granted') {
      const details = getNotificationDetails(notification.type);
      try {
        new Notification(details.title, {
          body: details.description
            .replace('{employee}', notification.employeeName)
            .replace('{leaveType}', notification.leaveType)
            .replace('{startDate}', new Date(notification.startDate).toLocaleDateString())
            .replace('{endDate}', new Date(notification.endDate).toLocaleDateString()),
          icon: '/logo.png',
          tag: `leave-${notification.type}-${notification.timestamp}`
        });
      } catch (error) { console.error(error); }
    }
    setTimeout(() => { setShowNotification(false); setTimeout(() => setCurrentNotification(null), 500); }, 5000);
  };

  const getNotificationDetails = (type: string) => {
    switch (type) {
      case 'new-leave': return { title: 'New Leave Request', description: '{employee} applied for {leaveType} leave from {startDate} to {endDate}', color: 'bg-blue-100 text-blue-800 border-blue-500' };
      case 'approved': return { title: 'Leave Approved', description: '{employee}\'s {leaveType} leave has been approved', color: 'bg-green-100 text-green-800 border-green-500' };
      case 'rejected': return { title: 'Leave Rejected', description: '{employee}\'s {leaveType} leave has been rejected', color: 'bg-red-100 text-red-800 border-red-500' };
      case 'reopened': return { title: 'Leave Reopened', description: '{employee}\'s {leaveType} leave request has been reopened', color: 'bg-yellow-100 text-yellow-800 border-yellow-500' };
      default: return { title: 'Leave Update', description: 'There has been an update to a leave request', color: 'bg-gray-100 text-gray-800 border-gray-500' };
    }
  };

  const calculateDays = (start: string, end: string) => Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // ✅ CORRECTED updateLeaveStatus with proper mapping and type safety
  const updateLeaveStatus = async (request: LeaveRequest, newStatus: 'approved' | 'rejected' | 'pending') => {
    if (!user || !request.adminId) { toast({ title: "Error", description: "Cannot process request", variant: "destructive" }); return; }
    try {
      setLoading(true);
      const updates: Partial<LeaveRequest> = { status: newStatus };
      if (newStatus === 'approved') { updates.approvedAt = new Date().toISOString(); updates.approvedBy = user.name || 'Admin'; }
      else if (newStatus === 'rejected') { updates.rejectedAt = new Date().toISOString(); }
      else if (newStatus === 'pending') { updates.rejectedAt = ''; updates.approvedAt = ''; updates.approvedBy = ''; }

      const days = calculateDays(request.startDate, request.endDate);
      const balanceField = getBalanceField(request.leaveType);
      if (!balanceField) {
        // Leave type that doesn't consume balance (e.g., Maternity, Paternity) – skip deduction
        // Proceed without touching balance
      } else {
        const currentBalanceObj = leaveBalances[request.employeeId] || { casual: 0, sick: 0, annual: 0, compOff: 0 };
        const available = currentBalanceObj[balanceField]; // already a number
        if (newStatus === 'approved' && request.status !== 'approved') {
          if (available < days) {
            toast.error(`Insufficient ${request.leaveType} balance. Available: ${available} days`);
            setLoading(false);
            return;
          }
          const newBalance = { ...currentBalanceObj, [balanceField]: available - days };
          await set(ref(database, `leaveBalances/${request.employeeId}`), { ...newBalance, updatedAt: new Date().toISOString() });
        } else if (newStatus === 'rejected' && request.status === 'approved') {
          const newBalance = { ...currentBalanceObj, [balanceField]: available + days };
          await set(ref(database, `leaveBalances/${request.employeeId}`), { ...newBalance, updatedAt: new Date().toISOString() });
        } else if (newStatus === 'pending' && request.status === 'approved') {
          const newBalance = { ...currentBalanceObj, [balanceField]: available + days };
          await set(ref(database, `leaveBalances/${request.employeeId}`), { ...newBalance, updatedAt: new Date().toISOString() });
        }
      }

      const leaveRef = ref(database, `users/${request.adminId}/employees/${request.employeeId}/leaves/${request.id}`);
      await update(leaveRef, updates);
      
      const notifRef = push(ref(database, `notifications/${request.employeeId}`));
      await set(notifRef, {
        title: newStatus === 'approved' ? 'Leave Approved' : 'Leave Rejected',
        body: `Your ${request.leaveType} leave from ${new Date(request.startDate).toLocaleDateString()} to ${new Date(request.endDate).toLocaleDateString()} has been ${newStatus}.`,
        type: newStatus === 'approved' ? 'leave_approved' : 'leave_rejected',
        read: false,
        createdAt: Date.now(),
        leaveId: request.id,
      });
      
      const notifType = newStatus === 'approved' ? 'approved' : (newStatus === 'rejected' ? 'rejected' : 'reopened');
      showSystemNotification({
        type: notifType,
        employeeName: request.employeeName,
        employeeId: request.employeeId,
        leaveType: request.leaveType,
        startDate: request.startDate,
        endDate: request.endDate,
        status: newStatus,
        timestamp: Date.now(),
        adminId: request.adminId
      });
      toast({ title: `Leave ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`, description: `Leave request has been ${newStatus}.` });
    } catch (error) { toast({ title: "Error", description: `Failed to ${newStatus} leave request`, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const openBalanceModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    const balances = leaveBalances[employee.id] || { casual: 0, sick: 0, annual: 0, compOff: 0 };
    setBalanceForm(balances);
    setShowBalanceModal(true);
  };

  const saveBalance = async () => {
    if (!selectedEmployee) return;
    await set(ref(database, `leaveBalances/${selectedEmployee.id}`), {
      ...balanceForm,
      updatedAt: new Date().toISOString()
    });
    toast.success(`Leave balance updated for ${selectedEmployee.name}`);
    setShowBalanceModal(false);
  };

  const saveCarryForwardSettings = async () => {
    await set(ref(database, 'leaveSettings/carryForward'), carryForwardForm);
    toast.success('Carry‑forward rules saved');
    setShowSettingsModal(false);
  };

  const runCarryForward = async () => {
    if (!confirm('Run year-end carry-forward? This will reset balances based on current rules.')) return;
    const currentYearBalances = { ...leaveBalances };
    const rules = leaveSettings.carryForward;
    for (const [empId, balance] of Object.entries(currentYearBalances)) {
      const newBalance: LeaveBalance = { casual: 0, sick: 0, annual: 0, compOff: 0 };
      for (const type of ['casual', 'sick', 'annual', 'compOff'] as const) {
        const rule = rules[type];
        if (rule && rule.percentage > 0) {
          let carried = (balance[type] || 0) * (rule.percentage / 100);
          if (rule.max && carried > rule.max) carried = rule.max;
          newBalance[type] = carried;
        } else {
          newBalance[type] = 0;
        }
      }
      await set(ref(database, `leaveBalances/${empId}`), { ...newBalance, updatedAt: new Date().toISOString() });
    }
    toast.success('Carry-forward completed');
  };

  const handleApprove = (req: LeaveRequest) => updateLeaveStatus(req, 'approved');
  const handleReject = (req: LeaveRequest) => updateLeaveStatus(req, 'rejected');
  const handleReapprove = (req: LeaveRequest) => updateLeaveStatus(req, 'pending');

  const handleDelete = async (request: LeaveRequest) => {
    if (!user || !request.adminId) return;
    if (!window.confirm('Delete this leave request?')) return;
    try {
      setLoading(true);
      if (request.status === 'approved') {
        const days = calculateDays(request.startDate, request.endDate);
        const balanceField = getBalanceField(request.leaveType);
        if (balanceField) {
          const currentBalanceObj = leaveBalances[request.employeeId] || { casual: 0, sick: 0, annual: 0, compOff: 0 };
          const newBalance = { ...currentBalanceObj, [balanceField]: currentBalanceObj[balanceField] + days };
          await set(ref(database, `leaveBalances/${request.employeeId}`), { ...newBalance, updatedAt: new Date().toISOString() });
        }
      }
      const leaveRef = ref(database, `users/${request.adminId}/employees/${request.employeeId}/leaves/${request.id}`);
      await remove(leaveRef);
      toast({ title: "Deleted", description: "Leave request deleted" });
    } catch (error) { toast({ title: "Error", description: "Failed to delete", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'approved': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const exportLeaves = () => {
    const csv = [
      ['Employee Name', 'Employee ID', 'Department', 'Leave Type', 'Start Date', 'End Date', 'Duration', 'Status', 'Reason', 'Applied At'],
      ...filteredRequests.map(r => [r.employeeName, r.employeeId, r.department, r.leaveType, new Date(r.startDate).toLocaleDateString(), new Date(r.endDate).toLocaleDateString(), calculateDays(r.startDate, r.endDate), r.status, r.reason, new Date(r.appliedAt).toLocaleString()])
    ].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leave-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pendingCount = allLeaveRequests.filter(r => r.status === 'pending').length;
  const approvedCount = allLeaveRequests.filter(r => r.status === 'approved').length;
  const rejectedCount = allLeaveRequests.filter(r => r.status === 'rejected').length;

  if (loading && allLeaveRequests.length === 0) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div></div>;

  return (
    <div className="space-y-6 relative">
      {/* Notification toast – same as before, omitted for brevity but keep your existing JSX */}
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
                  .replace('{employee}', currentNotification.employeeName)
                  .replace('{leaveType}', currentNotification.leaveType)
                  .replace('{startDate}', new Date(currentNotification.startDate).toLocaleDateString())
                  .replace('{endDate}', new Date(currentNotification.endDate).toLocaleDateString())}
              </p>
              <p className="mt-1 text-xs text-gray-600">{new Date(currentNotification.timestamp).toLocaleTimeString()}</p>
            </div>
            <div className="ml-4 flex-shrink-0 flex">
              <button onClick={() => setShowNotification(false)} className="rounded-md inline-flex text-gray-400 hover:text-gray-500">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Leave Management</h1>
          <p className="text-gray-600">Manage all employee leave requests across the organization</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-yellow-50">Pending: {pendingCount}</Badge>
          <Badge variant="outline" className="bg-green-50">Approved: {approvedCount}</Badge>
          <Badge variant="outline" className="bg-red-50">Rejected: {rejectedCount}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Filter className="h-4 w-4" /> Filters</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><Input placeholder="Search employee..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" /></div>
            <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button onClick={exportLeaves} className="flex-1"><Download className="h-4 w-4 mr-2" /> Export</Button>
              <Button variant="outline" onClick={() => setShowSettingsModal(true)}><Settings className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Leave Requests ({filteredRequests.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Employee</th><th className="text-left p-3">Leave Type</th><th className="text-left p-3">Dates</th>
                  <th className="text-left p-3">Duration</th><th className="text-left p-3">Status</th><th className="text-left p-3">Applied On</th>
                  <th className="text-left p-3">Balance</th><th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedRequests.map((req, idx) => {
                  const balanceField = getBalanceField(req.leaveType);
                  const currentBalance = balanceField ? (leaveBalances[req.employeeId]?.[balanceField] || 0) : 0;
                  return (
                    <tr key={`${req.id}-${idx}`} className="border-b hover:bg-gray-50">
                      <td className="p-3"><div><p className="font-medium">{req.employeeName}</p><p className="text-sm text-gray-500">{req.employeeId}</p><p className="text-sm text-gray-500">{req.department}</p></div></td>
                      <td className="p-3">{req.leaveType}</td>
                      <td className="p-3"><div><p>{new Date(req.startDate).toLocaleDateString()}</p><p>to</p><p>{new Date(req.endDate).toLocaleDateString()}</p></div></td>
                      <td className="p-3">{calculateDays(req.startDate, req.endDate)} days</td>
                      <td className="p-3"><Badge className={getStatusColor(req.status)}>{req.status}</Badge>{req.approvedBy && <p className="text-xs text-gray-500 mt-1">Approved by {req.approvedBy}</p>}</td>
                      <td className="p-3">{new Date(req.appliedAt).toLocaleString()}</td>
                      <td className="p-3">
                        <span className={`font-medium ${currentBalance < calculateDays(req.startDate, req.endDate) && req.status === 'pending' ? 'text-red-500' : 'text-green-600'}`}>
                          {currentBalance} left
                        </span>
                        <Button variant="ghost" size="sm" className="ml-2" onClick={() => openBalanceModal(employees.find(e => e.id === req.employeeId)!)}>
                          <Settings className="h-3 w-3" />
                        </Button>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-2">
                          {req.status === 'pending' && (
                            <>
                              <Button size="sm" onClick={() => handleApprove(req)} className="bg-green-600 hover:bg-green-700" disabled={loading}><Check className="h-3 w-3 mr-1" /> Approve</Button>
                              <Button size="sm" variant="outline" onClick={() => handleReject(req)} className="border-red-200 text-red-600 hover:bg-red-50" disabled={loading}><X className="h-3 w-3 mr-1" /> Reject</Button>
                            </>
                          )}
                          {(req.status === 'approved' || req.status === 'rejected') && role === 'admin' && (
                            <Button size="sm" variant="outline" onClick={() => handleReapprove(req)} className="text-blue-600 hover:bg-blue-50" disabled={loading}><RotateCcw className="h-3 w-3 mr-1" /> Re-open</Button>
                          )}
                          {role === 'admin' && (
                            <Button size="sm" variant="outline" onClick={() => handleDelete(req)} className="text-red-600 hover:bg-red-50" disabled={loading}><Trash2 className="h-3 w-3" /> Delete</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {displayedRequests.length === 0 && <div className="text-center py-8 text-gray-500">{allLeaveRequests.length === 0 ? "No leave requests found" : "No leave requests match the current filter"}</div>}
          </div>
          {hasMore && <div className="flex justify-center mt-4"><Button onClick={loadMore} disabled={loadingMore} variant="outline">{loadingMore ? 'Loading...' : 'Load More'}</Button></div>}
        </CardContent>
      </Card>

      {/* Balance Modal */}
      <Dialog open={showBalanceModal} onOpenChange={setShowBalanceModal}>
        <DialogContent><DialogHeader><DialogTitle>Set Leave Balance – {selectedEmployee?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Casual Leave</Label><Input type="number" value={balanceForm.casual} onChange={e => setBalanceForm({...balanceForm, casual: parseInt(e.target.value) || 0})} /></div>
              <div><Label>Sick Leave</Label><Input type="number" value={balanceForm.sick} onChange={e => setBalanceForm({...balanceForm, sick: parseInt(e.target.value) || 0})} /></div>
              <div><Label>Annual Leave</Label><Input type="number" value={balanceForm.annual} onChange={e => setBalanceForm({...balanceForm, annual: parseInt(e.target.value) || 0})} /></div>
              <div><Label>Comp‑Off</Label><Input type="number" value={balanceForm.compOff} onChange={e => setBalanceForm({...balanceForm, compOff: parseInt(e.target.value) || 0})} /></div>
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowBalanceModal(false)}>Cancel</Button><Button onClick={saveBalance}>Save</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Leave Settings</DialogTitle></DialogHeader>
          <Tabs defaultValue="carryForward"><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="carryForward">Carry‑Forward Rules</TabsTrigger><TabsTrigger value="yearEnd">Year‑End Action</TabsTrigger></TabsList>
            <TabsContent value="carryForward" className="space-y-4 pt-4">
              {['casual', 'sick', 'annual', 'compOff'].map(type => (
                <div key={type} className="grid grid-cols-2 gap-3 border-b pb-3">
                  <div><Label className="capitalize">{type}</Label></div>
                  <div><Label>Percentage to carry</Label><Input type="number" value={carryForwardForm[type]?.percentage || 0} onChange={e => setCarryForwardForm({...carryForwardForm, [type]: {...carryForwardForm[type], percentage: parseInt(e.target.value) || 0}})} /></div>
                  <div><Label>Max carry‑over</Label><Input type="number" value={carryForwardForm[type]?.max || 0} onChange={e => setCarryForwardForm({...carryForwardForm, [type]: {...carryForwardForm[type], max: parseInt(e.target.value) || 0}})} /></div>
                </div>
              ))}
              <Button onClick={saveCarryForwardSettings} className="w-full">Save Rules</Button>
            </TabsContent>
            <TabsContent value="yearEnd" className="pt-4 space-y-4">
              <p className="text-sm text-gray-600">Run this at the end of the financial year. Unused leave will be carried forward according to the rules above, and the remaining balance will be reset.</p>
              <Button onClick={runCarryForward} className="w-full bg-orange-600 hover:bg-orange-700">Run Year‑End Carry‑Forward</Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveManagement;