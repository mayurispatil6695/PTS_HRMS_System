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
import { ref, push, set, onValue, remove, query, orderByChild, update, off } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { format, addMinutes, isBefore, differenceInMinutes } from 'date-fns';

const JitsiMeeting = lazy(() => import('@jitsi/react-sdk').then(mod => ({ default: mod.JitsiMeeting })));

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
  employeeId?: string;
  employeeName?: string;
  employeeEmail?: string;
  employeeDepartment?: string;
  reminded5MinBefore?: boolean;
  notifiedAtStart?: boolean;
  adminId?: string;
}

const MeetingManagement = () => {
  const { user } = useAuth();
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
    type: 'common',
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

  // Fetch ALL meetings from all employees across all admins
  useEffect(() => {
    if (!user || employees.length === 0) {
      setLoading(false);
      return;
    }

    const allMeetings: Meeting[] = [];
    const unsubscribeFunctions: (() => void)[] = [];

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
        const meetingsRef = ref(database, `users/${adminId}/employees/${employee.id}/meetings`);
        const meetingsQuery = query(meetingsRef, orderByChild('date'));

        const unsubscribe = onValue(meetingsQuery, (snapshot) => {
          const data = snapshot.val();
          
          // Remove existing meetings for this employee
          const index = allMeetings.findIndex(m => m.employeeId === employee.id);
          if (index !== -1) {
            allMeetings.splice(index, 1);
          }

          if (data && typeof data === 'object') {
            const meetingsList: Meeting[] = Object.entries(data).map(([key, value]) => {
              const meetingData = value as any;
              return {
                id: key,
                adminId: adminId,
                employeeId: employee.id,
                employeeName: employee.name,
                employeeEmail: employee.email,
                employeeDepartment: employee.department,
                ...meetingData
              };
            });
            
            allMeetings.push(...meetingsList);
          }
          
          const sortedMeetings = [...allMeetings].sort((a, b) => {
            const dateA = new Date(`${a.date} ${a.time}`).getTime();
            const dateB = new Date(`${b.date} ${b.time}`).getTime();
            return dateA - dateB;
          });

          setMeetings(sortedMeetings);
          setLoading(false);
        });

        unsubscribeFunctions.push(unsubscribe);
      });
    });

    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }, [user, employees]);

  // Notification functions
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

  const updateMeetingNotificationStatus = useCallback(async (meetingId: string, employeeId: string, adminId: string, field: 'reminded5MinBefore' | 'notifiedAtStart', value: boolean) => {
    if (!user) return;
    try {
      await update(ref(database, `users/${adminId}/employees/${employeeId}/meetings/${meetingId}`), {
        [field]: value
      });
    } catch (error) {
      console.error('Error updating notification status:', error);
    }
  }, [user]);

  // Meeting time checker with optimizations
  useEffect(() => {
    if (!user || meetings.length === 0) return;

    const checkMeetingTimes = () => {
      const now = new Date();
      
      meetings.forEach((meeting) => {
        if (meeting.status !== 'scheduled' || !meeting.employeeId || !meeting.adminId) return;

        const meetingDateTime = new Date(`${meeting.date}T${meeting.time}`);
        const meetingEndTime = addMinutes(meetingDateTime, parseInt(meeting.duration));
        const fiveMinutesBefore = addMinutes(meetingDateTime, -5);

        // Check if it's exactly the meeting start time
        if (isBefore(now, meetingEndTime) && isBefore(meetingDateTime, now)) {
          if (!meeting.notifiedAtStart) {
            showMeetingNotification(meeting, 'Meeting is starting now!');
            updateMeetingNotificationStatus(meeting.id, meeting.employeeId, meeting.adminId, 'notifiedAtStart', true);
          }
        }
        // Check if it's 5 minutes before the meeting
        else if (isBefore(now, meetingDateTime) && differenceInMinutes(meetingDateTime, now) <= 5) {
          if (!meeting.reminded5MinBefore) {
            showMeetingNotification(meeting, 'Meeting starts in 5 minutes!');
            updateMeetingNotificationStatus(meeting.id, meeting.employeeId, meeting.adminId, 'reminded5MinBefore', true);
          }
        }
      });
    };

    // Check every minute
    const interval = setInterval(checkMeetingTimes, 60000);
    // Initial check
    checkMeetingTimes();

    return () => clearInterval(interval);
  }, [meetings, user, showMeetingNotification, updateMeetingNotificationStatus]);

  const generateMeetingLink = (meetingId: string) => {
    return `hrms-meeting-${meetingId}`;
  };

  // Optimized handleSubmit to prevent freezing
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isProcessing) return;

    setIsProcessing(true);
    try {
      const meetingId = editingMeeting?.id || push(ref(database, 'meetingIds')).key;
      if (!meetingId) throw new Error('Failed to generate meeting ID');

      const meetingLink = generateMeetingLink(meetingId);
      
      const meetingData: Omit<Meeting, 'id' | 'employeeId' | 'employeeName' | 'employeeEmail' | 'employeeDepartment' | 'adminId'> = {
        title: formData.title,
        description: formData.description,
        date: formData.date,
        time: formData.time,
        duration: formData.duration,
        meetingLink,
        agenda: formData.agenda,
        createdBy: user.id,
        createdByName: user.name || 'Admin',
        createdAt: new Date().toISOString(),
        status: 'scheduled',
        type: formData.type as 'common' | 'department',
        department: formData.type === 'department' ? formData.department : undefined,
        reminded5MinBefore: false,
        notifiedAtStart: false
      };

      // Filter employees based on meeting type and department
      let targetEmployees: Employee[] = [];
      
      if (formData.type === 'common') {
        targetEmployees = employees;
      } else if (formData.type === 'department' && formData.department) {
        targetEmployees = employees.filter(emp => emp.department === formData.department);
      }

      const updatePromises: Promise<void>[] = [];
      
      targetEmployees.forEach((employee) => {
        const employeeMeetingRef = ref(database, 
          `users/${employee.adminId}/employees/${employee.id}/meetings/${meetingId}`
        );
        updatePromises.push(set(employeeMeetingRef, {
          ...meetingData,
          employeeId: employee.id,
          employeeName: employee.name,
          employeeEmail: employee.email,
          employeeDepartment: employee.department,
          adminId: employee.adminId
        }));
      });

      await Promise.all(updatePromises);

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
    if (!window.confirm('Are you sure you want to delete this meeting?') || !user || isProcessing) return;

    if (!meeting.adminId || !meeting.employeeId) {
      toast.error('Unable to determine meeting location');
      return;
    }

    setIsProcessing(true);
    try {
      const meetingRef = ref(database, `users/${meeting.adminId}/employees/${meeting.employeeId}/meetings/${meeting.id}`);
      await remove(meetingRef);
      toast.success('Meeting deleted successfully');
    } catch (error) {
      console.error('Error deleting meeting:', error);
      toast.error('Failed to delete meeting');
    } finally {
      setIsProcessing(false);
    }
  };

  const startMeeting = (meeting: Meeting) => {
    setActiveMeeting(meeting);
  };

  const handleJitsiClose = () => {
    setActiveMeeting(null);
  };

  const getTypeColor = (type: string) => {
    return type === 'common' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700';
  };

  const isMeetingActive = (meeting: Meeting) => {
    const now = new Date();
    const meetingDate = new Date(`${meeting.date}T${meeting.time}`);
    const meetingEnd = new Date(meetingDate.getTime() + parseInt(meeting.duration) * 60000);
    return now >= meetingDate && now <= meetingEnd;
  };

  const isMeetingUpcoming = (meeting: Meeting) => {
    const now = new Date();
    const meetingDate = new Date(`${meeting.date}T${meeting.time}`);
    return now < meetingDate;
  };

  if (loading && meetings.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-2 sm:px-4">
      {activeMeeting && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-3 sm:p-4 border-b">
              <h3 className="text-lg font-semibold">{activeMeeting.title}</h3>
              <Button variant="outline" onClick={handleJitsiClose} size="sm" className="text-xs sm:text-sm">
                Close Meeting
              </Button>
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

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Meeting Management</h1>
          <p className="text-sm sm:text-base text-gray-600">Schedule and manage meetings across all departments</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {notificationPermission !== 'granted' && (
            <Button 
              variant="outline" 
              onClick={() => Notification.requestPermission().then(setNotificationPermission)}
              className="flex items-center gap-1 text-xs sm:text-sm"
              disabled={isProcessing}
              size="sm"
            >
              <Bell className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="truncate">Enable Notifications</span>
            </Button>
          )}
          <Button 
            onClick={() => setShowAddForm(true)} 
            disabled={isProcessing}
            size="sm"
            className="text-xs sm:text-sm"
          >
            <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            <span className="truncate">Schedule Meeting</span>
          </Button>
        </div>
      </motion.div>

      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">
                {editingMeeting ? 'Edit Meeting' : 'Schedule New Meeting'}
              </CardTitle>
              <p className="text-sm text-gray-500">
                Meeting will be sent to all relevant employees across the organization
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    placeholder="Meeting Title"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                    disabled={isProcessing}
                    className="text-xs sm:text-sm"
                  />
                  <Select 
                    value={formData.type} 
                    onValueChange={(value) => setFormData({
                      ...formData, 
                      type: value as 'common' | 'department',
                      department: value === 'common' ? '' : formData.department
                    })}
                    required
                    disabled={isProcessing}
                  >
                    <SelectTrigger className="text-xs sm:text-sm">
                      <SelectValue placeholder="Meeting Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="common" className="text-xs sm:text-sm">
                        Common Meeting (All Employees)
                      </SelectItem>
                      <SelectItem value="department" className="text-xs sm:text-sm">
                        Department Meeting
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.type === 'department' && (
                  <Select 
                    value={formData.department} 
                    onValueChange={(value) => setFormData({...formData, department: value})}
                    required
                    disabled={isProcessing}
                  >
                    <SelectTrigger className="text-xs sm:text-sm">
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(dept => (
                        <SelectItem key={dept} value={dept} className="text-xs sm:text-sm">{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Textarea
                  placeholder="Meeting Description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  required
                  disabled={isProcessing}
                  className="text-xs sm:text-sm"
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    required
                    disabled={isProcessing}
                    className="text-xs sm:text-sm"
                  />
                  <Input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    required
                    disabled={isProcessing}
                    className="text-xs sm:text-sm"
                  />
                  <Input
                    placeholder="Duration (minutes)"
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({...formData, duration: e.target.value})}
                    required
                    min="1"
                    disabled={isProcessing}
                    className="text-xs sm:text-sm"
                  />
                </div>

                <Textarea
                  placeholder="Meeting Agenda (optional)"
                  value={formData.agenda}
                  onChange={(e) => setFormData({...formData, agenda: e.target.value})}
                  disabled={isProcessing}
                  className="text-xs sm:text-sm"
                />

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    type="submit" 
                    disabled={isProcessing}
                    className="text-xs sm:text-sm"
                  >
                    {isProcessing ? 'Processing...' : editingMeeting ? 'Update Meeting' : 'Schedule Meeting'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingMeeting(null);
                      resetForm();
                    }}
                    disabled={isProcessing}
                    className="text-xs sm:text-sm"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Calendar className="h-4 w-4" />
              <span className="truncate">Scheduled Meetings ({meetings.length})</span>
            </CardTitle>
            <p className="text-sm text-gray-500">
              Showing meetings from all employees across the organization
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {meetings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No meetings scheduled
                </div>
              ) : (
                meetings.map((meeting) => {
                  const meetingDate = new Date(`${meeting.date}T${meeting.time}`);
                  const isActive = isMeetingActive(meeting);
                  const isPast = new Date() > new Date(meetingDate.getTime() + parseInt(meeting.duration) * 60000);
                  const isUpcoming = isMeetingUpcoming(meeting);

                  return (
                    <motion.div
                      key={`${meeting.id}-${meeting.employeeId}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`border rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow ${
                        isActive ? 'border-blue-500 bg-blue-50' : ''
                      } ${isUpcoming ? 'border-green-100' : ''} ${
                        isPast ? 'border-gray-200 bg-gray-50' : ''
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="font-semibold text-sm sm:text-base truncate">{meeting.title}</h3>
                            <Badge className={`text-xs ${getTypeColor(meeting.type)}`}>
                              {meeting.type === 'common' ? 'Common' : meeting.department}
                            </Badge>
                            {isActive && (
                              <Badge className="bg-green-100 text-green-700 text-xs">Live Now</Badge>
                            )}
                            {isUpcoming && (
                              <Badge className="bg-yellow-100 text-yellow-700 text-xs">Upcoming</Badge>
                            )}
                            {isPast && (
                              <Badge variant="outline" className="text-xs">Completed</Badge>
                            )}
                          </div>
                          <p className="text-gray-600 text-xs sm:text-sm mb-2">{meeting.description}</p>
                          <div className="flex flex-wrap gap-2 text-xs sm:text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {meeting.employeeName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {meetingDate.toLocaleDateString('en-US', { 
                                weekday: 'short', 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {meeting.time} ({meeting.duration}min)
                            </span>
                            <span className="flex items-center gap-1">
                              <Video className="h-3 w-3" />
                              {meeting.meetingLink ? 'Online' : 'In-Person'}
                            </span>
                          </div>
                          {meeting.agenda && (
                            <div className="mt-2">
                              <p className="text-xs sm:text-sm font-medium">Agenda:</p>
                              <p className="text-xs sm:text-sm text-gray-600">{meeting.agenda}</p>
                            </div>
                          )}
                          {(meeting.reminded5MinBefore || meeting.notifiedAtStart) && (
                            <div className="mt-2 flex gap-2 text-xs">
                              {meeting.reminded5MinBefore && (
                                <span className="flex items-center gap-1 text-blue-500">
                                  <Bell className="h-3 w-3" />
                                  5-min reminder sent
                                </span>
                              )}
                              {meeting.notifiedAtStart && (
                                <span className="flex items-center gap-1 text-green-500">
                                  <Bell className="h-3 w-3" />
                                  Start notified
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => editMeeting(meeting)}
                            disabled={isProcessing}
                            className="text-xs"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteMeeting(meeting)}
                            className="text-red-600 hover:bg-red-50 text-xs"
                            disabled={isProcessing}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                          {meeting.meetingLink && (isActive || user?.role === 'admin') && (
                            <Button 
                              size="sm" 
                              onClick={() => startMeeting(meeting)}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                              disabled={isProcessing}
                            >
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