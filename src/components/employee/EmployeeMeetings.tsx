import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, Users, Video, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, onValue, query, orderByChild, update } from 'firebase/database';
import { toast } from 'react-hot-toast';
import { format, isToday, isTomorrow, parseISO, addMinutes, isBefore, differenceInMinutes } from 'date-fns';

const JitsiMeeting = lazy(() => import('@jitsi/react-sdk').then(mod => ({ default: mod.JitsiMeeting })));

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
  reminded5MinBefore?: boolean;
  notifiedAtStart?: boolean;
}

const EmployeeMeetings = () => {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [pastMeetings, setPastMeetings] = useState<Meeting[]>([]);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission);
      });
    }
  }, []);

  // Fetch meetings from Firebase
  useEffect(() => {
    if (!user?.id || !user?.adminUid) {
      console.error("User ID or Admin UID not available");
      setLoading(false);
      return;
    }

    setLoading(true);
    const meetingsRef = ref(database, `users/${user.adminUid}/employees/${user.id}/meetings`);
    const meetingsQuery = query(meetingsRef, orderByChild('date'));

    const unsubscribe = onValue(meetingsQuery, (snapshot) => {
      try {
        const data = snapshot.val();
        const now = new Date();
        const upcoming: Meeting[] = [];
        const past: Meeting[] = [];

        if (data) {
          Object.entries(data).forEach(([key, value]) => {
            const meeting = value as Meeting;
            const meetingDateTime = parseISO(`${meeting.date}T${meeting.time}`);
            const meetingEnd = new Date(meetingDateTime.getTime() + parseInt(meeting.duration) * 60000);
            
            if (now < meetingEnd) {
              upcoming.push({ ...meeting, id: key });
            } else {
              past.push({ ...meeting, id: key });
            }
          });

          // Sort meetings chronologically
          upcoming.sort((a, b) => 
            new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime()
          );
          past.sort((a, b) => 
            new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime()
          );
        }

        setMeetings([...upcoming, ...past]);
        setUpcomingMeetings(upcoming);
        setPastMeetings(past);
      } catch (error) {
        console.error("Error fetching meetings data:", error);
        toast.error("Failed to load meetings");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user]);

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
            {format(parseISO(`${meeting.date}T${meeting.time}`), 'MMM d, yyyy h:mm a')} • {meeting.duration} mins
          </p>
        </div>
      </div>,
      { duration: 10000 }
    );
  }, [notificationPermission]);

  const updateMeetingNotificationStatus = useCallback(async (meetingId: string, field: 'reminded5MinBefore' | 'notifiedAtStart', value: boolean) => {
    if (!user?.id || !user?.adminUid) return;
    try {
      await update(ref(database, `users/${user.adminUid}/employees/${user.id}/meetings/${meetingId}`), {
        [field]: value
      });
    } catch (error) {
      console.error('Error updating notification status:', error);
    }
  }, [user]);

  // Meeting time checker with optimizations
  useEffect(() => {
    if (!user || upcomingMeetings.length === 0) return;

    const checkMeetingTimes = () => {
      const now = new Date();
      
      upcomingMeetings.forEach((meeting) => {
        if (meeting.status !== 'scheduled') return;

        const meetingDateTime = parseISO(`${meeting.date}T${meeting.time}`);
        const meetingEndTime = addMinutes(meetingDateTime, parseInt(meeting.duration));
        const fiveMinutesBefore = addMinutes(meetingDateTime, -5);

        // Check if it's exactly the meeting start time
        if (isBefore(now, meetingEndTime) && isBefore(meetingDateTime, now)) {
          if (!meeting.notifiedAtStart) {
            showMeetingNotification(meeting, 'Meeting is starting now!');
            updateMeetingNotificationStatus(meeting.id, 'notifiedAtStart', true);
          }
        }
        // Check if it's 5 minutes before the meeting
        else if (isBefore(now, meetingDateTime) && differenceInMinutes(meetingDateTime, now) <= 5) {
          if (!meeting.reminded5MinBefore) {
            showMeetingNotification(meeting, 'Meeting starts in 5 minutes!');
            updateMeetingNotificationStatus(meeting.id, 'reminded5MinBefore', true);
          }
        }
      });
    };

    // Check every minute
    const interval = setInterval(checkMeetingTimes, 60000);
    // Initial check
    checkMeetingTimes();

    return () => clearInterval(interval);
  }, [upcomingMeetings, user, showMeetingNotification, updateMeetingNotificationStatus]);

  const handleJitsiClose = () => {
    setActiveMeeting(null);
  };

  const isMeetingActive = (meeting: Meeting) => {
    const now = new Date();
    const meetingDateTime = parseISO(`${meeting.date}T${meeting.time}`);
    const meetingEnd = new Date(meetingDateTime.getTime() + parseInt(meeting.duration) * 60000);
    return now >= meetingDateTime && now <= meetingEnd;
  };

  const getTypeColor = (type: string) => {
    return type === 'common' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700';
  };

  const getMeetingDateTime = (meeting: Meeting) => {
    const date = parseISO(meeting.date);
    const time = meeting.time;
    return {
      date: format(date, 'MMMM d, yyyy'),
      weekday: format(date, 'EEEE'),
      day: format(date, 'd'),
      shortWeekday: format(date, 'EEE'),
      time: format(parseISO(`1970-01-01T${time}`), 'h:mm a')
    };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {activeMeeting && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">{activeMeeting.title}</h3>
              <Button variant="outline" onClick={handleJitsiClose}>
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
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Meetings</h1>
          <p className="text-gray-600">View your scheduled meetings and events</p>
        </div>
        {notificationPermission !== 'granted' && (
          <Button 
            variant="outline" 
            onClick={() => Notification.requestPermission().then(setNotificationPermission)}
            className="flex items-center gap-1"
          >
            <Bell className="h-4 w-4" />
            Enable Notifications
          </Button>
        )}
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Meetings</p>
                <p className="text-xl font-bold">{meetings.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100 text-green-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Upcoming</p>
                <p className="text-xl font-bold text-green-600">{upcomingMeetings.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-100 text-purple-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-600">This Week</p>
                <p className="text-xl font-bold text-purple-600">
                  {upcomingMeetings.filter(meeting => {
                    const meetingDate = parseISO(meeting.date);
                    const today = new Date();
                    const weekFromToday = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
                    return meetingDate >= today && meetingDate <= weekFromToday;
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Meetings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Upcoming Meetings ({upcomingMeetings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {upcomingMeetings.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Calendar className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">No upcoming meetings</h3>
                <p className="text-gray-500 mt-1">
                  You don't have any meetings scheduled yet
                </p>
              </div>
            ) : (
              upcomingMeetings.map((meeting) => {
                const { date, time, day, shortWeekday } = getMeetingDateTime(meeting);
                const isActive = isMeetingActive(meeting);
                const meetingDate = parseISO(meeting.date);

                return (
                  <motion.div
                    key={meeting.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow ${
                      isActive ? 'border-blue-500 bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4 w-full sm:w-auto">
                      <div className="text-center min-w-[40px]">
                        <p className="text-lg font-semibold">{day}</p>
                        <p className="text-xs text-gray-500">{shortWeekday}</p>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{meeting.title}</h3>
                          <Badge className={getTypeColor(meeting.type)}>
                            {meeting.type === 'common' ? 'All Staff' : meeting.department}
                          </Badge>
                          {isToday(meetingDate) && (
                            <Badge className="bg-red-100 text-red-700">Today</Badge>
                          )}
                          {isTomorrow(meetingDate) && (
                            <Badge className="bg-orange-100 text-orange-700">Tomorrow</Badge>
                          )}
                          {isActive && (
                            <Badge className="bg-green-100 text-green-700">Live Now</Badge>
                          )}
                          {meeting.reminded5MinBefore && (
                            <Badge className="bg-blue-100 text-blue-700">Reminder Sent</Badge>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-2">{meeting.description}</p>
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{time} ({meeting.duration} min)</span>
                          </div>
                          {meeting.meetingLink && (
                            <div className="flex items-center gap-1">
                              <Video className="h-3 w-3" />
                              <span>Online Meeting</span>
                            </div>
                          )}
                        </div>
                        
                        {meeting.agenda && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-gray-700">Agenda:</p>
                            <p className="text-xs text-gray-600">{meeting.agenda}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-3 sm:mt-0 w-full sm:w-auto">
                      {meeting.meetingLink && (
                        <Button 
                          size="sm" 
                          onClick={() => setActiveMeeting(meeting)}
                          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Video className="h-4 w-4 mr-2" />
                          {isActive ? 'Join Meeting' : 'Start Meeting'}
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Past Meetings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-600" />
            Past Meetings ({pastMeetings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {pastMeetings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No past meetings found
              </div>
            ) : (
              pastMeetings.map((meeting) => {
                const { date, time, day, shortWeekday } = getMeetingDateTime(meeting);

                return (
                  <motion.div
                    key={meeting.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start justify-between p-4 border rounded-lg opacity-75 hover:opacity-100 transition-opacity"
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-center min-w-[40px] opacity-70">
                        <p className="text-lg font-semibold">{day}</p>
                        <p className="text-xs text-gray-500">{shortWeekday}</p>
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{meeting.title}</h3>
                          <Badge variant="outline" className={getTypeColor(meeting.type)}>
                            {meeting.type === 'common' ? 'All Staff' : meeting.department}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-2 line-clamp-1">{meeting.description}</p>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {date} at {time}
                          </span>
                        </div>
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

export default EmployeeMeetings;