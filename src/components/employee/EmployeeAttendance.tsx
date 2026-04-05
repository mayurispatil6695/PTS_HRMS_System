import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Clock, Calendar, Download, MapPin, AlertTriangle, CheckCircle, XCircle, Bell, Sun } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, onValue, query, orderByChild } from 'firebase/database';
import { toast } from 'react-hot-toast';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  punchIn: string;
  punchOut: string | null;
  status: string;
  workMode: string;
  timestamp: number;
  totalHours?: string;
  markedLateBy?: string;
  markedLateAt?: string;
  markedHalfDayBy?: string;
  markedHalfDayAt?: string;
  department?: string;
  designation?: string;
}

interface Notification {
  id: string;
  type: 'late' | 'half-day' | 'status-reset';
  changedBy: string;
  changedAt: string;
  date: string;
  status: string;
  timestamp: number;
  read: boolean;
}

const EmployeeAttendance = () => {
  const { user } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const prevRecordsRef = useRef<AttendanceRecord[]>([]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Enhanced notification permission request
  useEffect(() => {
    const requestNotificationPermission = async () => {
      if ('Notification' in window) {
        try {
          // Check current permission first
          if (Notification.permission === 'granted') {
            setNotificationPermission('granted');
            return;
          }

          if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);

            if (permission === 'granted') {
              console.log('Notification permission granted');
            }
          }
        } catch (error) {
          console.error('Error requesting notification permission:', error);
          toast.error('Failed to request notification permission');
        }
      } else {
        console.warn('Notifications not supported in this browser');
      }
    };

    requestNotificationPermission();
  }, []);

  // Main data loading effect with notification detection
  useEffect(() => {
    if (!user?.id || !user?.adminUid) {
      console.error("User ID or Admin UID not available");
      setLoading(false);
      return;
    }

    setLoading(true);
    const attendanceRef = ref(database, `users/${user.adminUid}/employees/${user.id}/punching`);
    const attendanceQuery = query(attendanceRef, orderByChild('timestamp'));

    const unsubscribe = onValue(attendanceQuery, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          const records: AttendanceRecord[] = Object.entries(data).map(([key, value]) => ({
            id: key,
            ...(value as Omit<AttendanceRecord, 'id'>)
          })).sort((a, b) => b.timestamp - a.timestamp);

          // Check for status changes by comparing with previous records
          const currentPrevRecords = prevRecordsRef.current;
          records.forEach(record => {
            const prevRecord = currentPrevRecords.find(r => r.id === record.id);

            // If this is a new late marking
            if (prevRecord && prevRecord.status !== 'late' && record.status === 'late') {
              const notificationPayload: Omit<Notification, 'id' | 'read'> = {
                type: 'late', // or 'half-day' or 'status-reset'
                changedBy: record.markedLateBy || 'Admin',
                changedAt: record.markedLateAt || new Date().toISOString(),
                date: record.date,
                status: record.status,
                timestamp: Date.now()
              };
              showSystemNotification(notificationPayload);
              showBrowserNotification(notificationPayload);
            }

            // If this is a new half-day marking
            if (prevRecord && prevRecord.status !== 'half-day' && record.status === 'half-day') {
              const notificationPayload: Omit<Notification, 'id' | 'read'> = {
                type: 'half-day', // or 'half-day' or 'status-reset'
                changedBy: record.markedLateBy || 'Admin',
                changedAt: record.markedLateAt || new Date().toISOString(),
                date: record.date,
                status: record.status,
                timestamp: Date.now()
              };
              showSystemNotification(notificationPayload);
              showBrowserNotification(notificationPayload);
            }

            // If status was reset from late/half-day to present
            if (prevRecord &&
              (prevRecord.status === 'late' || prevRecord.status === 'half-day') &&
              record.status === 'present') {
              const notificationPayload: Omit<Notification, 'id' | 'read'> = {
                type: 'status-reset', // or 'half-day' or 'status-reset'
                changedBy: record.markedLateBy || 'Admin',
                changedAt: record.markedLateAt || new Date().toISOString(),
                date: record.date,
                status: record.status,
                timestamp: Date.now()
              };
              showSystemNotification(notificationPayload);
              showBrowserNotification(notificationPayload);
            }
          });

          prevRecordsRef.current = records;
          setAttendanceRecords(records);
        } else {
          setAttendanceRecords([]);
          prevRecordsRef.current = [];
        }
      } catch (error) {
        console.error("Error fetching attendance data:", error);
        toast.error("Failed to load attendance records");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // System notification (in-app)
  const showSystemNotification = (notification: Omit<Notification, 'id' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `${notification.type}-${notification.timestamp}`,
      read: false
    };

    setNotifications(prev => [newNotification, ...prev]);
    setCurrentNotification(newNotification);
    setShowNotification(true);

    const timeoutId = setTimeout(() => {
      setShowNotification(false);
      setTimeout(() => setCurrentNotification(null), 500);
    }, 5000);

    return () => clearTimeout(timeoutId);
  };

  // Browser/system notification
  const showBrowserNotification = (notification: Omit<Notification, 'id' | 'read'>) => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notifications');
      return;
    }

    if (Notification.permission !== 'granted') {
      console.log('Notification permission not granted');
      return;
    }

    const notificationDetails = getNotificationDetails(notification.type);
    const notificationBody = notificationDetails.description
      .replace('{date}', new Date(notification.date).toLocaleDateString())
      .replace('{changedBy}', notification.changedBy);

    try {
      const notificationOptions = {
        body: notificationBody,
        icon: '/logo.png',
        badge: '/badge.png',
        vibrate: [200, 100, 200],
        tag: `attendance-${notification.type}-${notification.timestamp}`,
        data: {
          url: window.location.href,
          timestamp: notification.timestamp
        }
      };

      // Show notification
      const notificationInstance = new Notification(notificationDetails.title, notificationOptions);

      // Handle click on notification
      notificationInstance.onclick = (event) => {
        event.preventDefault();
        window.focus();
        notificationInstance.close();

        // Show the corresponding notification in-app
        showSystemNotification(notification);
      };

      // Handle close event
      notificationInstance.onclose = () => {
        console.log('Notification closed');
      };

      return () => {
        notificationInstance.close();
      };
    } catch (error) {
      console.error('Error showing browser notification:', error);

      // Fallback for browsers that might not support all options
      try {
        new Notification(notificationDetails.title, {
          body: notificationBody,
          icon: '/logo.png'
        });
      } catch (fallbackError) {
        console.error('Fallback notification also failed:', fallbackError);
        toast.error('Failed to show notification');
      }
    }
  };

  const getNotificationDetails = (type: string) => {
    switch (type) {
      case 'late':
        return {
          title: 'Marked as Late',
          description: 'Your attendance for {date} has been marked as late by {changedBy}',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-500'
        };
      case 'half-day':
        return {
          title: 'Marked as Half Day',
          description: 'Your attendance for {date} has been marked as half day by {changedBy}',
          color: 'bg-blue-100 text-blue-800 border-blue-500'
        };
      case 'status-reset':
        return {
          title: 'Status Reset',
          description: 'Your attendance status for {date} has been reset to present by {changedBy}',
          color: 'bg-green-100 text-green-800 border-green-500'
        };
      default:
        return {
          title: 'Attendance Update',
          description: 'Your attendance status has been updated',
          color: 'bg-gray-100 text-gray-800 border-gray-500'
        };
    }
  };

  useEffect(() => {
    const filtered = attendanceRecords.filter(record => {
      if (!record.date) return false;

      const recordDate = new Date(record.date);
      return recordDate.getMonth() === selectedMonth &&
        recordDate.getFullYear() === selectedYear;
    });

    const recordsWithHours = filtered.map(record => {
      if (record.punchIn && record.punchOut) {
        const punchInTime = convertTimeToMinutes(record.punchIn);
        const punchOutTime = convertTimeToMinutes(record.punchOut);
        const totalMinutes = punchOutTime - punchInTime;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return {
          ...record,
          totalHours: `${hours}h ${minutes}m`
        };
      }
      return record;
    });

    setFilteredRecords(recordsWithHours);
  }, [attendanceRecords, selectedMonth, selectedYear]);

  const convertTimeToMinutes = (timeString: string) => {
    const [time, period] = timeString.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    let totalHours = hours;

    if (period === 'PM' && hours < 12) {
      totalHours += 12;
    }
    if (period === 'AM' && hours === 12) {
      totalHours = 0;
    }

    return totalHours * 60 + minutes;
  };

  const getAttendanceStats = () => {
    const totalDays = filteredRecords.length;
    const presentDays = filteredRecords.filter(record => record.status === 'present').length;
    const absentDays = filteredRecords.filter(record => record.status === 'absent').length;
    const lateDays = filteredRecords.filter(record => record.status === 'late').length;
    const halfDays = filteredRecords.filter(record => record.status === 'half-day').length;

    return { totalDays, presentDays, absentDays, lateDays, halfDays };
  };

  const downloadAttendanceReport = () => {
    if (filteredRecords.length === 0) {
      toast.error("No records to export");
      return;
    }

    const csvContent = [
      ['Date', 'Status', 'Punch In', 'Punch Out', 'Work Mode', 'Total Hours', 'Department', 'Designation', 'Marked Late By', 'Marked Late At', 'Marked Half Day By', 'Marked Half Day At'],
      ...filteredRecords.map(record => [
        new Date(record.date).toLocaleDateString(),
        record.status.charAt(0).toUpperCase() + record.status.slice(1),
        record.punchIn || '-',
        record.punchOut || '-',
        record.workMode || 'office',
        record.totalHours || '-',
        record.department || user?.department || '-',
        record.designation || user?.designation || '-',
        record.markedLateBy || '-',
        record.markedLateAt ? new Date(record.markedLateAt).toLocaleString() : '-',
        record.markedHalfDayBy || '-',
        record.markedHalfDayAt ? new Date(record.markedHalfDayAt).toLocaleString() : '-'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${user?.name}-${months[selectedMonth]}-${selectedYear}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-700';
      case 'absent': return 'bg-red-100 text-red-700';
      case 'late': return 'bg-yellow-100 text-yellow-700';
      case 'half-day': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle className="h-4 w-4" />;
      case 'absent': return <XCircle className="h-4 w-4" />;
      case 'late': return <AlertTriangle className="h-4 w-4" />;
      case 'half-day': return <Sun className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const stats = getAttendanceStats();
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

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
                  .replace('{date}', new Date(currentNotification.date).toLocaleDateString())
                  .replace('{changedBy}', currentNotification.changedBy)}
              </p>
              <p className="mt-1 text-xs text-gray-600">
                {new Date(currentNotification.changedAt).toLocaleTimeString()}
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
          <h1 className="text-2xl font-bold text-gray-800">My Attendance</h1>
          <p className="text-gray-600">View your attendance records and statistics</p>
        </div>
      </motion.div>

      {/* Filter Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Filter Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                <div>
                  <label className="text-sm font-medium mb-1 block">Month</label>
                  <Select
                    value={selectedMonth.toString()}
                    onValueChange={(value) => setSelectedMonth(parseInt(value))}
                  >
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder="Select Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month, index) => (
                        <SelectItem key={index} value={index.toString()}>{month}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Year</label>
                  <Select
                    value={selectedYear.toString()}
                    onValueChange={(value) => setSelectedYear(parseInt(value))}
                  >
                    <SelectTrigger className="w-full md:w-32">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={downloadAttendanceReport}
                className="w-full md:w-auto"
                disabled={filteredRecords.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Report
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Attendance Stats */}
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Days</p>
                      <p className="text-xl font-bold">{stats.totalDays}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-green-100 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Present</p>
                      <p className="text-xl font-bold text-green-600">{stats.presentDays}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-red-100 text-red-600">
                      <XCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Absent</p>
                      <p className="text-xl font-bold text-red-600">{stats.absentDays}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-yellow-100 text-yellow-600">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Late</p>
                      <p className="text-xl font-bold text-yellow-600">{stats.lateDays}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                      <Sun className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Half Days</p>
                      <p className="text-xl font-bold text-blue-600">{stats.halfDays}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Attendance Records */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Attendance Records - {months[selectedMonth]} {selectedYear}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredRecords.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Calendar className="h-10 w-10 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No records found</h3>
                    <p className="text-gray-500 mt-1">
                      No attendance records available for {months[selectedMonth]} {selectedYear}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredRecords.map((record, index) => (
                      <motion.div
                        key={record.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start gap-4 w-full sm:w-auto">
                          <div className="text-center min-w-[40px]">
                            <p className="text-lg font-semibold">
                              {new Date(record.date).getDate()}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(record.date).toLocaleDateString('en-US', { weekday: 'short' })}
                            </p>
                          </div>

                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <Badge className={`${getStatusColor(record.status)} flex items-center gap-1`}>
                                {getStatusIcon(record.status)}
                                {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                              </Badge>
                              {record.workMode && (
                                <Badge variant="outline" className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {record.workMode.charAt(0).toUpperCase() + record.workMode.slice(1)}
                                </Badge>
                              )}
                              {record.markedLateBy && (
                                <Badge variant="outline" className="flex items-center gap-1 text-yellow-600">
                                  <AlertTriangle className="h-3 w-3" />
                                  Marked Late
                                </Badge>
                              )}
                              {record.markedHalfDayBy && (
                                <Badge variant="outline" className="flex items-center gap-1 text-blue-600">
                                  <Sun className="h-3 w-3" />
                                  Marked Half Day
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">
                              {new Date(record.date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                            {record.markedLateBy && (
                              <p className="text-xs text-yellow-600 mt-1">
                                Marked as late by {record.markedLateBy} on {new Date(record.markedLateAt || '').toLocaleString()}
                              </p>
                            )}
                            {record.markedHalfDayBy && (
                              <p className="text-xs text-blue-600 mt-1">
                                Marked as half day by {record.markedHalfDayBy} on {new Date(record.markedHalfDayAt || '').toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 sm:mt-0 w-full sm:w-auto">
                          <div className="flex items-center justify-between sm:justify-end gap-4 text-sm">
                            {record.punchIn && (
                              <div className="text-center">
                                <p className="text-gray-500">In</p>
                                <p className="font-medium text-green-600">{record.punchIn}</p>
                              </div>
                            )}
                            {record.punchOut && (
                              <div className="text-center">
                                <p className="text-gray-500">Out</p>
                                <p className="font-medium text-red-600">{record.punchOut}</p>
                              </div>
                            )}
                            {record.totalHours && (
                              <div className="text-center">
                                <p className="text-gray-500">Hours</p>
                                <p className="font-medium">{record.totalHours}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  );
};

export default EmployeeAttendance;