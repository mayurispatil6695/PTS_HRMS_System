// src/components/admin/MeetingManagement.tsx
import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Plus, Users, Video, Clock, Edit, Trash2, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { toast } from '../ui/use-toast';
import { ref, push, set, onValue, remove, off } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { format, addMinutes, isBefore, differenceInMinutes } from 'date-fns';
import { Employee } from '@/types/employee';
import { Meeting, RawMeeting } from '@/types/meeting';

const JitsiMeeting = lazy(() => import('@jitsi/react-sdk').then(mod => ({ default: mod.JitsiMeeting })));

interface MeetingManagementProps {
  role?: 'admin' | 'manager' | 'team_leader' | 'client';
  userId?: string;
  department?: string;
}

interface FirebaseEmployeeRaw {
  name?: string;
  email?: string;
  department?: string;
  designation?: string;
  status?: string;
}

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
  const [isProcessing, setIsProcessing] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(new Date().getTime() + 30 * 60000), 'HH:mm'),
    duration: '30',
    type: 'common' as 'common' | 'department',  // ✅ fixed: allow both
    department: '',
    agenda: ''
  });

  const departments = useMemo(() => [
    'Software Development', 'Digital Marketing', 'Cyber Security', 'Sales',
    'Product Designing', 'Web Development', 'Graphic Designing', 'Artificial Intelligence'
  ], []);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission().then(setNotificationPermission);
    }
  }, []);

  // Fetch employees (filtered by role)
  useEffect(() => {
    if (!authUser) return;

    const usersRef = ref(database, "users");
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const allEmps: Employee[] = [];
      snapshot.forEach((adminSnap) => {
        const adminId = adminSnap.key;
        const employeesData = adminSnap.child("employees").val() as Record<string, FirebaseEmployeeRaw> | null;
        if (employeesData) {
          Object.entries(employeesData).forEach(([key, emp]) => {
            if (emp.status === 'active') {
              allEmps.push({
                id: key,
                name: emp.name || '',
                email: emp.email || '',
                department: emp.department || 'No Department',
                designation: emp.designation || '',
                status: emp.status || 'active',
                adminId: adminId || '',
                isActive: true,
                phone: '',
                employeeId: key,
                createdAt: new Date().toISOString(),
              });
            }
          });
        }
      });

      if (isManager && effectiveDepartment) {
        setEmployees(allEmps.filter(emp => emp.department === effectiveDepartment));
      } else {
        setEmployees(allEmps);
      }
    });
    return () => off(usersRef);
  }, [authUser, isManager, effectiveDepartment]);

  // Fetch meetings
  useEffect(() => {
    if (!authUser) return;

    const meetingsRef = ref(database, 'meetings');
    const unsubscribe = onValue(meetingsRef, (snapshot) => {
      const data = snapshot.val() as Record<string, RawMeeting> | null;
      const list: Meeting[] = [];
      if (data) {
        Object.entries(data).forEach(([id, raw]) => {
          list.push({
            id,
            title: raw.title || '',
            description: raw.description || '',
            date: raw.date || '',
            time: raw.time || '',
            duration: raw.duration || '30',
            meetingLink: raw.meetingLink || '',
            agenda: raw.agenda,
            status: (raw.status as Meeting['status']) || 'scheduled',
            createdAt: raw.createdAt || new Date().toISOString(),
            createdBy: raw.createdBy || '',
            createdByName: raw.createdByName,
            type: (raw.type === 'department' ? 'department' : 'common'),
            department: raw.department || undefined,
            participantCount: raw.participantCount || 0,
          });
        });
      }

      let filtered = list;
      if (isManager && effectiveDepartment) {
        filtered = list.filter(m =>
          m.type === 'common' || (m.type === 'department' && m.department === effectiveDepartment)
        );
      }
      filtered.sort((a, b) =>
        new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime()
      );
      setMeetings(filtered);
      setLoading(false);
    });
    return () => off(meetingsRef);
  }, [authUser, isManager, effectiveDepartment]);

  const showMeetingNotification = useCallback((meeting: Meeting, message: string) => {
    if (notificationPermission === 'granted') {
      new Notification(`Meeting Reminder: ${meeting.title}`, {
        body: `${message}\nTime: ${meeting.time}\nDuration: ${meeting.duration} minutes`,
        icon: '/favicon.ico'
      });
    }
    toast({
      title: meeting.title,
      description: `${message} at ${meeting.time}`,
      duration: 10000,
    });
  }, [notificationPermission]);

  // Check for upcoming meetings (5-min reminder)
  useEffect(() => {
    if (meetings.length === 0) return;
    const interval = setInterval(() => {
      const now = new Date();
      meetings.forEach(meeting => {
        if (meeting.status !== 'scheduled') return;
        const meetingDateTime = new Date(`${meeting.date}T${meeting.time}`);
        const fiveMinutesBefore = addMinutes(meetingDateTime, -5);
        if (isBefore(now, meetingDateTime) && differenceInMinutes(meetingDateTime, now) <= 5) {
          showMeetingNotification(meeting, 'Meeting starts in 5 minutes');
        }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [meetings, showMeetingNotification]);

  const generateMeetingLink = (meetingId: string) => `hrms-meeting-${meetingId}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast({ title: "Access Denied", description: "Only admin can schedule meetings", variant: "destructive" });
      return;
    }
    if (!authUser || isProcessing) return;

    setIsProcessing(true);
    try {
      const meetingId = editingMeeting?.id || push(ref(database, 'meetings')).key;
      if (!meetingId) throw new Error('Failed to generate meeting ID');

      const meetingLink = generateMeetingLink(meetingId);
      let targetEmployees = employees;
      if (formData.type === 'department' && formData.department) {
        targetEmployees = employees.filter(emp => emp.department === formData.department);
      }

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

      // Create participant entries
      const participantPromises = targetEmployees.map(emp => {
        const participantRef = ref(database, `meetingParticipants/${meetingId}/${emp.id}`);
        return set(participantRef, {
          employeeId: emp.id,
          employeeName: emp.name,
          employeeEmail: emp.email,
          employeeDepartment: emp.department,
          adminId: emp.adminId,
          reminded5MinBefore: false,
          notifiedAtStart: false,
        });
      });
      await Promise.all(participantPromises);

      // Send in-app notifications
      const notifPromises = targetEmployees.map(emp => {
        const notifRef = push(ref(database, `notifications/${emp.id}`));
        return set(notifRef, {
          title: 'New Meeting Scheduled',
          body: `${meetingData.createdByName} scheduled a meeting: "${meetingData.title}" on ${format(new Date(meetingData.date), 'MMM dd, yyyy')} at ${meetingData.time}`,
          type: 'meeting_scheduled',
          read: false,
          createdAt: Date.now(),
          meetingId,
        });
      });
      await Promise.all(notifPromises);

      toast({ title: "Success", description: editingMeeting ? 'Meeting updated' : 'Meeting scheduled' });
      resetForm();
      setShowAddForm(false);
      setEditingMeeting(null);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to save meeting", variant: "destructive" });
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
      toast({ title: "Access Denied", description: "Only admin can edit meetings", variant: "destructive" });
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
      toast({ title: "Access Denied", description: "Only admin can delete meetings", variant: "destructive" });
      return;
    }
    if (!window.confirm('Delete this meeting? This action cannot be undone.') || !authUser || isProcessing) return;

    setIsProcessing(true);
    try {
      await remove(ref(database, `meetings/${meeting.id}`));
      await remove(ref(database, `meetingParticipants/${meeting.id}`));
      toast({ title: "Deleted", description: "Meeting deleted successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete meeting", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const startMeeting = (meeting: Meeting) => setActiveMeeting(meeting);
  const handleJitsiClose = () => setActiveMeeting(null);

  const getTypeColor = (type: string) => type === 'common' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700';
  const isMeetingActive = (meeting: Meeting) => {
    const now = new Date();
    const start = new Date(`${meeting.date}T${meeting.time}`);
    const end = new Date(start.getTime() + parseInt(meeting.duration) * 60000);
    return now >= start && now <= end;
  };
  const isMeetingUpcoming = (meeting: Meeting) => new Date() < new Date(`${meeting.date}T${meeting.time}`);

  if (loading && meetings.length === 0) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div></div>;
  }

  return (
    <div className="space-y-6 px-3 pb-20 sm:px-6 sm:pb-0">
      {activeMeeting && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-3 sm:p-4 border-b">
              <h3 className="text-lg font-semibold">{activeMeeting.title}</h3>
              <Button variant="outline" onClick={handleJitsiClose} size="sm">Close Meeting</Button>
            </div>
            <div className="flex-1 min-h-0">
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
                  }}
                  interfaceConfigOverwrite={{
                    DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
                    SHOW_CHROME_EXTENSION_BANNER: false,
                    MOBILE_APP_PROMO: false,
                  }}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Meeting Management</h1>
          <p className="text-gray-600 text-sm">
            {isAdmin ? 'Schedule and manage meetings across all departments' : `View meetings for ${effectiveDepartment} department`}
          </p>
        </div>
        <div className="flex gap-2">
          {notificationPermission !== 'granted' && isAdmin && (
            <Button variant="outline" size="sm" onClick={() => Notification.requestPermission().then(setNotificationPermission)}>
              <Bell className="h-4 w-4 mr-1" /> Enable Notifications
            </Button>
          )}
          {isAdmin && (
            <Button onClick={() => setShowAddForm(true)} disabled={isProcessing} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Schedule Meeting
            </Button>
          )}
        </div>
      </motion.div>

      {/* Add/Edit Form */}
      {isAdmin && showAddForm && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{editingMeeting ? 'Edit Meeting' : 'Schedule New Meeting'}</CardTitle>
              <p className="text-sm text-gray-500">Meeting will be sent to all relevant employees</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input placeholder="Meeting Title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required disabled={isProcessing} />
                  <Select value={formData.type} onValueChange={val => setFormData({...formData, type: val as 'common' | 'department', department: val === 'common' ? '' : formData.department})} required disabled={isProcessing}>
                    <SelectTrigger><SelectValue placeholder="Meeting Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="common">Common Meeting (All Employees)</SelectItem>
                      <SelectItem value="department">Department Meeting</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.type === 'department' && (
                  <Select value={formData.department} onValueChange={val => setFormData({...formData, department: val})} required disabled={isProcessing}>
                    <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                    <SelectContent>
                      {departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <Textarea placeholder="Meeting Description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required disabled={isProcessing} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} min={format(new Date(), 'yyyy-MM-dd')} required disabled={isProcessing} />
                  <Input type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} required disabled={isProcessing} />
                  <Input placeholder="Duration (minutes)" type="number" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} required min="1" disabled={isProcessing} />
                </div>
                <Textarea placeholder="Meeting Agenda (optional)" value={formData.agenda} onChange={e => setFormData({...formData, agenda: e.target.value})} disabled={isProcessing} />
                <div className="flex gap-2">
                  <Button type="submit" disabled={isProcessing}>{isProcessing ? 'Processing...' : editingMeeting ? 'Update Meeting' : 'Schedule Meeting'}</Button>
                  <Button type="button" variant="outline" onClick={() => { setShowAddForm(false); setEditingMeeting(null); resetForm(); }} disabled={isProcessing}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Scheduled Meetings ({meetings.length})</CardTitle>
          <p className="text-sm text-gray-500">
            {isAdmin ? 'All meetings' : `Meetings for ${effectiveDepartment} department (including common meetings)`}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {meetings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No meetings scheduled</div>
            ) : (
              meetings.map(meeting => {
                const isActive = isMeetingActive(meeting);
                const isPast = new Date() > new Date(`${meeting.date}T${meeting.time}`);
                const isUpcoming = !isPast && !isActive;
                return (
                  <motion.div key={meeting.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${isActive ? 'border-blue-500 bg-blue-50' : isUpcoming ? 'border-green-100' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="font-semibold text-base">{meeting.title}</h3>
                          <Badge className={getTypeColor(meeting.type)}>{meeting.type === 'common' ? 'Common' : meeting.department}</Badge>
                          {isActive && <Badge className="bg-green-100 text-green-700">Live Now</Badge>}
                          {isUpcoming && <Badge variant="outline" className="bg-yellow-100 text-yellow-700">Upcoming</Badge>}
                          {isPast && <Badge variant="outline">Completed</Badge>}
                        </div>
                        <p className="text-gray-600 text-sm mb-2">{meeting.description}</p>
                        <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {meeting.participantCount} participants</span>
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(meeting.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {meeting.time} ({meeting.duration}min)</span>
                          <span className="flex items-center gap-1"><Video className="h-3 w-3" /> Online</span>
                        </div>
                        {meeting.agenda && (
                          <div className="mt-2">
                            <p className="text-sm font-medium">Agenda:</p>
                            <p className="text-sm text-gray-600">{meeting.agenda}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {isAdmin && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => editMeeting(meeting)} disabled={isProcessing}><Edit className="h-3 w-3 mr-1" /> Edit</Button>
                            <Button size="sm" variant="outline" onClick={() => deleteMeeting(meeting)} className="text-red-600 hover:bg-red-50" disabled={isProcessing}><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>
                          </>
                        )}
                        {meeting.meetingLink && (isActive || isAdmin) && (
                          <Button size="sm" onClick={() => startMeeting(meeting)} className="bg-blue-600 hover:bg-blue-700">
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
    </div>
  );
};

export default React.memo(MeetingManagement);