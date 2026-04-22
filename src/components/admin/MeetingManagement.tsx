import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Plus, Users, Video, Clock, Edit, Trash2, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { toast } from 'react-hot-toast';
import { ref, push, set, onValue, remove, update, off } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { format, addMinutes, isBefore, differenceInMinutes } from 'date-fns';

const JitsiMeeting = lazy(() => import('@jitsi/react-sdk').then(mod => ({ default: mod.JitsiMeeting })));

// ==================== TYPES ====================

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  status: string;
  adminId?: string;
}

interface Meeting {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  duration: string;
  type: 'common' | 'department';
  department?: string;
  meetingLink: string;
  agenda?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: string;
  createdBy: string;
  createdByName?: string;
  participantCount?: number;
}

interface MeetingParticipant {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeDepartment: string;
  adminId: string;
  reminded5MinBefore: boolean;
  notifiedAtStart: boolean;
}

// Firebase data structures
interface FirebaseMeetingData {
  title: string;
  description: string;
  date: string;
  time: string;
  duration: string;
  meetingLink: string;
  agenda?: string;
  status: string;
  createdAt: string;
  createdBy: string;
  createdByName?: string;
  type: string;
  department?: string | null;
  participantCount?: number;
}

interface FirebaseEmployeeData {
  name?: string;
  email?: string;
  department?: string;
  status?: string;
  adminUid?: string;
}

interface MeetingManagementProps {
  role?: 'admin' | 'manager' | 'team_leader' | 'client';
  userId?: string;
  department?: string;
}

// ==================== COMPONENT ====================

const MeetingManagement: React.FC<MeetingManagementProps> = ({
  role: propRole,
  userId: propUserId,
  department: propDepartment,
}) => {
  const { user: authUser } = useAuth();
  const effectiveRole = propRole || authUser?.role || 'admin';
  const effectiveUserId = propUserId || authUser?.id || '';
  const effectiveDepartment = propDepartment || authUser?.department || '';

  const isAdmin = effectiveRole === 'admin';
  const isManager = effectiveRole === 'manager';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(new Date().getTime() + 30 * 60000), 'HH:mm'),
    duration: '30',
    type: 'common' as 'common' | 'department',
    department: '',
    agenda: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const departments = ['Software Development', 'Digital Marketing', 'Cyber Security', 'Sales', 'Product Designing', 'Web Development', 'Graphic Designing', 'Artificial Intelligence'];

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission);
      });
    }
  }, []);

  // Fetch ALL employees (for admin) or only department employees (for manager) – needed for creating meetings
  useEffect(() => {
    if (!authUser) return;

    const usersRef = ref(database, "users");
    const allEmployees: Employee[] = [];

    const unsubscribeEmployees = onValue(usersRef, (snapshot) => {
      allEmployees.length = 0;

      if (snapshot.exists()) {
        snapshot.forEach((adminSnap) => {
          const adminId = adminSnap.key;
          const employeesData = adminSnap.child("employees").val() as Record<string, FirebaseEmployeeData> | null;

          if (employeesData && typeof employeesData === 'object') {
            Object.entries(employeesData).forEach(([key, emp]) => {
              if (emp.status === 'active') {
                allEmployees.push({
                  id: key,
                  name: emp.name || '',
                  email: emp.email || '',
                  department: emp.department || 'No Department',
                  status: emp.status || 'active',
                  adminId: adminId || ''
                });
              }
            });
          }
        });
      }

      // For manager, filter only employees in their department
      if (isManager && effectiveDepartment) {
        setEmployees(allEmployees.filter(emp => emp.department === effectiveDepartment));
      } else {
        setEmployees(allEmployees);
      }
    }, (error) => {
      console.error('Error fetching employees:', error);
    });

    return () => off(usersRef);
  }, [authUser, isManager, effectiveDepartment]);

  // Fetch meetings and filter by role
  useEffect(() => {
    if (!authUser) return;

    const meetingsRef = ref(database, 'meetings');
    const unsubscribe = onValue(meetingsRef, (snapshot) => {
      const data = snapshot.val() as Record<string, FirebaseMeetingData> | null;
      const meetingsList: Meeting[] = [];
      if (data) {
        Object.entries(data).forEach(([id, meeting]) => {
          meetingsList.push({
            id,
            title: meeting.title,
            description: meeting.description,
            date: meeting.date,
            time: meeting.time,
            duration: meeting.duration,
            meetingLink: meeting.meetingLink,
            agenda: meeting.agenda,
            status: meeting.status as 'scheduled' | 'completed' | 'cancelled',
            createdAt: meeting.createdAt,
            createdBy: meeting.createdBy,
            createdByName: meeting.createdByName,
            type: meeting.type as 'common' | 'department',
            department: meeting.department || undefined,
            participantCount: meeting.participantCount || 0,
          });
        });
      }

      // ✅ Filter meetings based on role
      let filteredMeetings = meetingsList;
      if (isManager && effectiveDepartment) {
        filteredMeetings = meetingsList.filter(meeting =>
          meeting.type === 'common' ||
          (meeting.type === 'department' && meeting.department === effectiveDepartment)
        );
      }

      // Sort by date (soonest first)
      filteredMeetings.sort((a, b) =>
        new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime()
      );
      setMeetings(filteredMeetings);
      setLoading(false);
    });
    return () => off(meetingsRef);
  }, [authUser, isManager, effectiveDepartment]);

  // Meeting notification helper (unchanged)
  const showMeetingNotification = useCallback((meeting: Meeting, message: string) => {
    if (notificationPermission === 'granted') {
      new Notification(`Meeting Reminder: ${meeting.title}`, {
        body: `${message}\nTime: ${meeting.time}\nDuration: ${meeting.duration} minutes`,
        icon: '/favicon.ico'
      });
    }

    toast(
      <div className="flex items-start gap-3">
        <Bell className="h-5 w-5 text-blue-500 mt-0.5" />
        <div>
          <p className="font-medium">{meeting.title}</p>
          <p className="text-sm">{message}</p>
          <p className="text-xs text-gray-500 mt-1">
            {format(new Date(`${meeting.date}T${meeting.time}`), 'MMM d, yyyy h:mm a')} • {meeting.duration} mins
          </p>
        </div>
      </div>,
      { duration: 10000 }
    );
  }, [notificationPermission]);

  // Meeting time checker (simplified – no per‑employee reminders for admin/manager)
  useEffect(() => {
    if (!authUser || meetings.length === 0) return;

    const checkMeetingTimes = () => {
      const now = new Date();
      meetings.forEach((meeting) => {
        if (meeting.status !== 'scheduled') return;

        const meetingDateTime = new Date(`${meeting.date}T${meeting.time}`);
        const fiveMinutesBefore = addMinutes(meetingDateTime, -5);

        if (isBefore(now, meetingDateTime) && differenceInMinutes(meetingDateTime, now) <= 5) {
          // 5‑min reminder – for simplicity, notify the current user (admin/manager)
          if (notificationPermission === 'granted') {
            showMeetingNotification(meeting, 'Meeting starts in 5 minutes');
          }
        }
      });
    };
    const interval = setInterval(checkMeetingTimes, 60000);
    checkMeetingTimes();
    return () => clearInterval(interval);
  }, [meetings, notificationPermission, showMeetingNotification]);

  const generateMeetingLink = (meetingId: string) => `hrms-meeting-${meetingId}`;

  // Submit meeting (only admin)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Only admin can schedule meetings');
      return;
    }
    if (!authUser || isProcessing) return;

    setIsProcessing(true);
    try {
      const meetingId = editingMeeting?.id || push(ref(database, 'meetings')).key;
      if (!meetingId) throw new Error('Failed to generate meeting ID');

      const meetingLink = generateMeetingLink(meetingId);

      // Filter target employees
      let targetEmployees: Employee[] = [];
      if (formData.type === 'common') {
        targetEmployees = employees;
      } else if (formData.type === 'department' && formData.department) {
        targetEmployees = employees.filter(emp => emp.department === formData.department);
      }

      // 1. Create single meeting record
      const meetingData = {
        title: formData.title,
        description: formData.description,
        date: formData.date,
        time: formData.time,
        duration: formData.duration,
        meetingLink,
        agenda: formData.agenda,
        createdBy: authUser.id,
        createdByName: authUser.name || 'Admin',
        createdAt: new Date().toISOString(),
        status: 'scheduled',
        type: formData.type,
        department: formData.type === 'department' ? formData.department : null,
        participantCount: targetEmployees.length,
      };

      const meetingRef = ref(database, `meetings/${meetingId}`);
      await set(meetingRef, meetingData);

      // 2. Create participant records (for per‑employee notification flags)
      const participantUpdates: Promise<void>[] = [];
      targetEmployees.forEach(employee => {
        const participantRef = ref(database, `meetingParticipants/${meetingId}/${employee.id}`);
        participantUpdates.push(set(participantRef, {
          employeeId: employee.id,
          employeeName: employee.name,
          employeeEmail: employee.email,
          employeeDepartment: employee.department,
          adminId: employee.adminId,
          reminded5MinBefore: false,
          notifiedAtStart: false,
        }));
      });
      await Promise.all(participantUpdates);

      // Send in‑app notifications to all invited employees
      const notificationPromises = targetEmployees.map(async (employee) => {
        const notifRef = push(ref(database, `notifications/${employee.id}`));
        await set(notifRef, {
          title: 'New Meeting Scheduled',
          body: `${meetingData.createdByName} scheduled a meeting: "${meetingData.title}" on ${format(new Date(meetingData.date), 'MMM dd, yyyy')} at ${meetingData.time}`,
          type: 'meeting_scheduled',
          read: false,
          createdAt: Date.now(),
          meetingId: meetingId,
        });
      });
      await Promise.all(notificationPromises);

      toast.success(editingMeeting ? 'Meeting updated successfully' : 'Meeting scheduled successfully');
      resetForm();
      setShowAddForm(false);
      setEditingMeeting(null);
    } catch (error) {
      console.error('Error saving meeting:', error);
      toast.error('Failed to save meeting');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(new Date().getTime() + 30 * 60000), 'HH:mm'),
      duration: '30',
      type: 'common',
      department: '',
      agenda: ''
    });
  };

  const editMeeting = (meeting: Meeting) => {
    if (!isAdmin) {
      toast.error('Only admin can edit meetings');
      return;
    }
    setEditingMeeting(meeting);
    setFormData({
      title: meeting.title,
      description: meeting.description,
      date: meeting.date,
      time: meeting.time,
      duration: meeting.duration,
      type: meeting.type,
      department: meeting.department || '',
      agenda: meeting.agenda || ''
    });
    setShowAddForm(true);
  };

  const deleteMeeting = async (meeting: Meeting) => {
    if (!isAdmin) {
      toast.error('Only admin can delete meetings');
      return;
    }
    if (!window.confirm('Delete this meeting? This action cannot be undone.') || !authUser || isProcessing) return;

    setIsProcessing(true);
    try {
      await remove(ref(database, `meetings/${meeting.id}`));
      await remove(ref(database, `meetingParticipants/${meeting.id}`));
      toast.success('Meeting deleted successfully');
    } catch (error) {
      console.error('Error deleting meeting:', error);
      toast.error('Failed to delete meeting');
    } finally {
      setIsProcessing(false);
    }
  };

  const startMeeting = (meeting: Meeting) => setActiveMeeting(meeting);
  const handleJitsiClose = () => setActiveMeeting(null);
  const getTypeColor = (type: string) => type === 'common' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700';
  const isMeetingActive = (meeting: Meeting) => {
    const now = new Date();
    const meetingDate = new Date(`${meeting.date}T${meeting.time}`);
    const meetingEnd = new Date(meetingDate.getTime() + parseInt(meeting.duration) * 60000);
    return now >= meetingDate && now <= meetingEnd;
  };
  const isMeetingUpcoming = (meeting: Meeting) => new Date() < new Date(`${meeting.date}T${meeting.time}`);

  if (loading && meetings.length === 0) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div></div>;
  }

  return (
    <div className="space-y-6 px-2 sm:px-4">
      {activeMeeting && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-3 sm:p-4 border-b">
              <h3 className="text-lg font-semibold">{activeMeeting.title}</h3>
              <Button variant="outline" onClick={handleJitsiClose} size="sm" className="text-xs sm:text-sm">Close Meeting</Button>
            </div>
            <div className="h-[calc(90vh-60px)]">
              <Suspense fallback={<div className="flex items-center justify-center h-full">Loading meeting...</div>}>
                <JitsiMeeting
                  roomName={`hrms-meeting-${activeMeeting.id}`}
                  getIFrameRef={(iframeRef: HTMLIFrameElement) => {
                    iframeRef.style.height = '100%';
                    iframeRef.style.width = '100%';
                  }}
                  configOverwrite={{
                    startWithAudioMuted: true,
                    startWithVideoMuted: true,
                    enableWelcomePage: false,
                    disableModeratorIndicator: true,
                    enableNoisyMicDetection: false,
                    enableClosePage: false,
                  }}
                  interfaceConfigOverwrite={{
                    DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
                    SHOW_CHROME_EXTENSION_BANNER: false,
                    MOBILE_APP_PROMO: false,
                    HIDE_INVITE_MORE_HEADER: true,
                  }}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Meeting Management</h1>
          <p className="text-sm sm:text-base text-gray-600">
            {isAdmin ? 'Schedule and manage meetings across all departments' : `View meetings for ${effectiveDepartment} department`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {notificationPermission !== 'granted' && (
            <Button variant="outline" onClick={() => Notification.requestPermission().then(setNotificationPermission)} className="flex items-center gap-1 text-xs sm:text-sm" disabled={isProcessing} size="sm">
              <Bell className="h-3 w-3 sm:h-4 sm:w-4" /> Enable Notifications
            </Button>
          )}
          {/* ✅ Schedule button only for admin */}
          {isAdmin && (
            <Button onClick={() => setShowAddForm(true)} disabled={isProcessing} size="sm" className="text-xs sm:text-sm">
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> Schedule Meeting
            </Button>
          )}
        </div>
      </motion.div>

      {/* Add/Edit Form – only admin can see */}
      {isAdmin && showAddForm && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader><CardTitle className="text-lg sm:text-xl">{editingMeeting ? 'Edit Meeting' : 'Schedule New Meeting'}</CardTitle><p className="text-sm text-gray-500">Meeting will be sent to all relevant employees across the organization</p></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input placeholder="Meeting Title" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required disabled={isProcessing} className="text-xs sm:text-sm" />
                  <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value as 'common' | 'department', department: value === 'common' ? '' : formData.department})} required disabled={isProcessing}>
                    <SelectTrigger className="text-xs sm:text-sm"><SelectValue placeholder="Meeting Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="common" className="text-xs sm:text-sm">Common Meeting (All Employees)</SelectItem>
                      <SelectItem value="department" className="text-xs sm:text-sm">Department Meeting</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.type === 'department' && (
                  <Select value={formData.department} onValueChange={(value) => setFormData({...formData, department: value})} required disabled={isProcessing}>
                    <SelectTrigger className="text-xs sm:text-sm"><SelectValue placeholder="Select Department" /></SelectTrigger>
                    <SelectContent>
                      {departments.map(dept => <SelectItem key={dept} value={dept} className="text-xs sm:text-sm">{dept}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <Textarea placeholder="Meeting Description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} required disabled={isProcessing} className="text-xs sm:text-sm" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} min={format(new Date(), 'yyyy-MM-dd')} required disabled={isProcessing} className="text-xs sm:text-sm" />
                  <Input type="time" value={formData.time} onChange={(e) => setFormData({...formData, time: e.target.value})} required disabled={isProcessing} className="text-xs sm:text-sm" />
                  <Input placeholder="Duration (minutes)" type="number" value={formData.duration} onChange={(e) => setFormData({...formData, duration: e.target.value})} required min="1" disabled={isProcessing} className="text-xs sm:text-sm" />
                </div>
                <Textarea placeholder="Meeting Agenda (optional)" value={formData.agenda} onChange={(e) => setFormData({...formData, agenda: e.target.value})} disabled={isProcessing} className="text-xs sm:text-sm" />
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button type="submit" disabled={isProcessing} className="text-xs sm:text-sm">{isProcessing ? 'Processing...' : editingMeeting ? 'Update Meeting' : 'Schedule Meeting'}</Button>
                  <Button type="button" variant="outline" onClick={() => { setShowAddForm(false); setEditingMeeting(null); resetForm(); }} disabled={isProcessing} className="text-xs sm:text-sm">Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Meetings List – filtered for manager */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl"><Calendar className="h-4 w-4" /> Scheduled Meetings ({meetings.length})</CardTitle>
            <p className="text-sm text-gray-500">
              {isAdmin ? 'Showing meetings from across the organization' : `Showing meetings for ${effectiveDepartment} department (including common meetings)`}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {meetings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No meetings scheduled</div>
              ) : (
                meetings.map((meeting) => {
                  const meetingDate = new Date(`${meeting.date}T${meeting.time}`);
                  const isActive = isMeetingActive(meeting);
                  const isPast = new Date() > new Date(meetingDate.getTime() + parseInt(meeting.duration) * 60000);
                  const isUpcoming = isMeetingUpcoming(meeting);
                  return (
                    <motion.div key={meeting.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                      className={`border rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow ${isActive ? 'border-blue-500 bg-blue-50' : ''} ${isUpcoming ? 'border-green-100' : ''} ${isPast ? 'border-gray-200 bg-gray-50' : ''}`}>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="font-semibold text-sm sm:text-base truncate">{meeting.title}</h3>
                            <Badge className={`text-xs ${getTypeColor(meeting.type)}`}>{meeting.type === 'common' ? 'Common' : meeting.department}</Badge>
                            {isActive && <Badge className="bg-green-100 text-green-700 text-xs">Live Now</Badge>}
                            {isUpcoming && <Badge className="bg-yellow-100 text-yellow-700 text-xs">Upcoming</Badge>}
                            {isPast && <Badge variant="outline" className="text-xs">Completed</Badge>}
                          </div>
                          <p className="text-gray-600 text-xs sm:text-sm mb-2">{meeting.description}</p>
                          <div className="flex flex-wrap gap-2 text-xs sm:text-sm text-gray-500">
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {meeting.participantCount} participants</span>
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {meetingDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {meeting.time} ({meeting.duration}min)</span>
                            <span className="flex items-center gap-1"><Video className="h-3 w-3" /> Online</span>
                          </div>
                          {meeting.agenda && (
                            <div className="mt-2"><p className="text-xs sm:text-sm font-medium">Agenda:</p><p className="text-xs sm:text-sm text-gray-600">{meeting.agenda}</p></div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                          {/* ✅ Edit/Delete only for admin */}
                          {isAdmin && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => editMeeting(meeting)} disabled={isProcessing} className="text-xs"><Edit className="h-3 w-3 mr-1" /> Edit</Button>
                              <Button size="sm" variant="outline" onClick={() => deleteMeeting(meeting)} className="text-red-600 hover:bg-red-50 text-xs" disabled={isProcessing}><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>
                            </>
                          )}
                          {meeting.meetingLink && (isActive || isAdmin) && (
                            <Button size="sm" onClick={() => startMeeting(meeting)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs" disabled={isProcessing}>
                              {isActive ? 'Join' : 'Start'} Meeting
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default MeetingManagement;