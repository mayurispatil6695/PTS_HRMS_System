import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  Plane,
  FolderOpen,
  Calendar,
  CheckCircle,
  Users,
  TrendingUp,
  AlertCircle,
  Coffee,
  Target,
  Video,
  MapPin,
  AlertTriangle,
  XCircle,
  Download,
  Share2,
  Image as ImageIcon,
  Link as LinkIcon,
  Camera
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, push, set, onValue, update, get, query, orderByChild, DataSnapshot } from 'firebase/database';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import SelfieCapture from '../attendance/SelfieCapture';
import { useWorkSession } from '../../contexts/WorkSessionContext';
import { useIdleDetection } from '../../hooks/useIdleDetection';
import ProjectsPopup from '../admin/popups/ProjectsPopup';
import { Project, Task } from '@/types/project';

// ==================== LOCAL TYPES FOR FIREBASE RAW DATA ====================
interface RawAttendanceValue {
  date?: string | number;
  punchIn?: string;
  punchOut?: string | null;
  status?: string;
  workMode?: string;
  timestamp?: number;
  department?: string;
  designation?: string;
  selfie?: string;
  selfieOut?: string;
  location?: { lat: number; lng: number; name: string };
  locationOut?: { lat: number; lng: number; name: string };
  breaks?: Record<string, RawBreak>;
  markedLateBy?: string;
  markedLateAt?: string;
  markedHalfDayBy?: string;
  markedHalfDayAt?: string;
}

interface RawBreak {
  breakIn: string;
  breakOut?: string;
  duration?: string;
  timestamp: number;
}

interface RawLeaveValue {
  leaveType?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
  status?: string;
  appliedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  approvedBy?: string;
}

interface RawMeetingValue {
  title?: string;
  description?: string;
  date?: string;
  time?: string;
  duration?: string;
  type?: string;
  department?: string;
  meetingLink?: string;
  agenda?: string;
  createdAt?: number;
  employeeId?: string;
  employeeName?: string;
}

interface RawSocialMediaValue {
  platform?: string;
  createdAt?: string | number;
  content?: string;
  scheduledDate?: string;
  status?: string;
}

interface RawProjectValue {
  name?: string;
  description?: string;
  department?: string;
  assignedTeamLeader?: string;
  assignedEmployees?: string[];
  tasks?: Record<string, Task>;
  startDate?: string;
  endDate?: string;
  priority?: string;
  status?: string;
  projectType?: string;
  specificDepartment?: string;
  createdAt?: string;
  createdBy?: string;
  progress?: number;
  clientId?: string;
}

// ==================== TYPES ====================
interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeCode?: string;   
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
  selfie?: string;
  selfieOut?: string;
  location?: { lat: number; lng: number; name: string };
  locationOut?: { lat: number; lng: number; name: string };
  breaks?: Record<string, RawBreak>;
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
  meetingLink?: string;
  agenda?: string;
  createdAt?: number;
  employeeId?: string;
  employeeName?: string;
}

interface SocialMediaActivity {
  id: string;
  type: 'social_media';
  action: string;
  platform: string;
  timestamp: number;
  content?: string;
  scheduledDate?: string;
  status?: string;
}

interface BreakDetails {
  breakIn: string;
  breakOut?: string;
  duration?: string;
  timestamp: number;
}

interface SocialMediaDetails {
  platform: string;
  content?: string;
  scheduledDate?: string;
}

interface RecentActivity {
  id: string;
  type: 'project' | 'attendance' | 'task' | 'social_media' | 'break';
  action: string;
  time: string;
  timestamp: number;
  details?: BreakDetails | SocialMediaDetails;
}

interface ExtendedProject extends Project {
  projectType?: string;
  specificDepartment?: string;
  clientId?: string;
}

interface PunchOutUpdates {
  punchOut: string;
  timestamp: number;
  selfieOut: string;
  locationOut?: { lat: number; lng: number; name: string };
  status?: string;
  markedLateBy?: string | null;
  markedLateAt?: string | null;
  markedHalfDayBy?: string | null;
  markedHalfDayAt?: string | null;
}

// ==================== COMPONENT ====================
const EmployeeDashboardHome = () => {
  const { user } = useAuth();
  const { isPunchedIn, isOnBreak, punchIn, punchOut, startBreak, endBreak, loading: sessionLoading } = useWorkSession();
  const isActive = isPunchedIn && !isOnBreak;
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [breakLoading, setBreakLoading] = useState(false);
  const [currentBreakId, setCurrentBreakId] = useState<string | null>(null);
  const [showSelfieCapture, setShowSelfieCapture] = useState(false);
  const [pendingPunchType, setPendingPunchType] = useState<'in' | 'out' | null>(null);
  const [isAutoPunchOut, setIsAutoPunchOut] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [employeeProfile, setEmployeeProfile] = useState<{ workMode?: string } | null>(null);
  const [adminUid, setAdminUid] = useState<string | undefined>(undefined);
  const [stats, setStats] = useState({
    attendanceRate: 0,
    leavesUsed: 0,
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    pausedProjects: 0,
    upcomingMeetings: 0,
    presentDays: 0,
    totalDays: 0,
    scheduledPosts: 0,
    totalBreakTime: 0,
  });
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [socialMediaActivities, setSocialMediaActivities] = useState<SocialMediaActivity[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [isTeamLead, setIsTeamLead] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [showProjectsPopup, setShowProjectsPopup] = useState(false);
  const [employeeProjects, setEmployeeProjects] = useState<ExtendedProject[]>([]);
  const navigate = useNavigate();
  const lastNotifiedStatusRef = useRef<string | null>(null);
  const idleNotifiedRef = useRef(false);
  const lastAutoPunchOutNotif = useRef<number>(0);
  const lastReminderNotif = useRef<number>(0);
  const lastStatusNotif = useRef<Record<string, number>>({});

  // Employee ID display
  const [employeeIdDisplay, setEmployeeIdDisplay] = useState<string | undefined>(user?.employeeId);

  useEffect(() => {
    if (!user?.id || !user?.adminUid) return;
    if (user.employeeId) {
      setEmployeeIdDisplay(user.employeeId);
      return;
    }
    const fetchEmpId = async () => {
      try {
        const empRef = ref(database, `users/${user.adminUid}/employees/${user.id}`);
        const snap = await get(empRef);
        const data = snap.val() as { employeeId?: string } | null;
        if (data?.employeeId) {
          setEmployeeIdDisplay(data.employeeId);
          await update(ref(database, `users/${user.id}/profile`), { employeeId: data.employeeId });
        }
      } catch (err) {
        console.error('Error fetching employee ID:', err);
      }
    };
    fetchEmpId();
  }, [user]);

  // Helper: convert minutes to "Xh Ym"
  const formatMinutesToHours = (minutes: number): string => {
    if (minutes <= 0) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const convertTimeToMinutes = (timeStr: string): number => {
    try {
      let hours = 0, minutes = 0;
      const trimmed = timeStr.trim().toUpperCase();
      if (!trimmed.includes('AM') && !trimmed.includes('PM')) {
        const parts = trimmed.split(':');
        hours = parseInt(parts[0], 10);
        minutes = parseInt(parts[1], 10);
      } else {
        const [time, period] = trimmed.split(' ');
        const [h, m] = time.split(':').map(Number);
        hours = h;
        minutes = m;
        if (period === 'PM' && hours < 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
      }
      return hours * 60 + minutes;
    } catch {
      return 0;
    }
  };

  const parseDurationToMinutes = (durationStr: string): number => {
    if (!durationStr) return 0;
    const colonMatch = durationStr.match(/^(\d+):(\d+)$/);
    if (colonMatch) return parseInt(colonMatch[1], 10) * 60 + parseInt(colonMatch[2], 10);
    const hoursMatch = durationStr.match(/(\d+(?:\.\d+)?)\s*h/i);
    const minutesMatch = durationStr.match(/(\d+(?:\.\d+)?)\s*m/i);
    let total = 0;
    if (hoursMatch) total += parseFloat(hoursMatch[1]) * 60;
    if (minutesMatch) total += parseFloat(minutesMatch[1]);
    return Math.round(total) || 0;
  };

  const calculateTotalWorkedMinutes = (
    punchInTime: string,
    punchOutTime: string,
    breaks?: Record<string, RawBreak>
  ): number => {
    if (!punchInTime || !punchOutTime) return 0;
    const inMin = convertTimeToMinutes(punchInTime);
    const outMin = convertTimeToMinutes(punchOutTime);
    let total = outMin - inMin;
    if (total < 0) total += 24 * 60;
    if (total > 12 * 60) total -= 24 * 60;
    if (total < 0) total = 0;
    if (breaks) {
      Object.values(breaks).forEach(br => {
        if (br.breakOut && br.duration) total -= parseDurationToMinutes(br.duration);
      });
    }
    return total;
  };

  const getCurrentLocation = (): Promise<{ lat: number; lng: number; name: string }> => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return Promise.resolve({ lat: 0, lng: 0, name: 'Location unknown' });
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=18`);
            const data = await res.json();
            resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, name: data.display_name || `${pos.coords.latitude},${pos.coords.longitude}` });
          } catch {
            resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, name: `${pos.coords.latitude},${pos.coords.longitude}` });
          }
        },
        () => resolve({ lat: 0, lng: 0, name: 'Location unknown' })
      );
    });
  };

  // Fetch employee profile and role
  useEffect(() => {
    if (!user?.id) return;
    const profileRef = ref(database, `users/${user.id}/profile`);
    const unsub = onValue(profileRef, (snap) => {
      const data = snap.val() as { workMode?: string } | null;
      if (data) setEmployeeProfile({ workMode: data.workMode || 'office' });
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user?.adminUid || !user?.id) return;
    const empRef = ref(database, `users/${user.adminUid}/employees/${user.id}`);
    const unsub = onValue(empRef, (snap) => {
      const data = snap.val() as { designation?: string; role?: string } | null;
      setIsTeamLead(data?.designation === 'Team Lead');
      setIsManager(data?.role === 'team_manager');
    });
    return () => unsub();
  }, [user]);

  // Fetch attendance records
  useEffect(() => {
    if (!user?.id || !user?.adminUid) {
      setLoading(false);
      return;
    }
    const attRef = ref(database, `users/${user.adminUid}/employees/${user.id}/punching`);
    const attQuery = query(attRef, orderByChild('timestamp'));
    const unsub = onValue(attQuery, (snap) => {
      const data = snap.val() as Record<string, RawAttendanceValue> | null;
      if (data && typeof data === 'object') {
        const records: AttendanceRecord[] = Object.entries(data).map(([key, val]) => ({
          id: key,
          employeeId: user.id,
          employeeName: user.name || 'Unknown',
          date: safeDate(val.date),
          punchIn: val.punchIn || '',
          punchOut: val.punchOut !== undefined ? (typeof val.punchOut === 'string' ? val.punchOut : null) : null,
          status: val.status || 'present',
          workMode: val.workMode || 'office',
          timestamp: val.timestamp || Date.now(),
          department: val.department,
          designation: val.designation,
          selfie: val.selfie,
          selfieOut: val.selfieOut,
          location: val.location,
          locationOut: val.locationOut,
          breaks: val.breaks as Record<string, RawBreak> | undefined,
          markedLateBy: val.markedLateBy,
          markedLateAt: val.markedLateAt,
          markedHalfDayBy: val.markedHalfDayBy,
          markedHalfDayAt: val.markedHalfDayAt,
        }));
        setAttendanceRecords(records);
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const monthly = records.filter(r => {
          if (!r.date) return false;
          const d = new Date(r.date);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });
        const presentDays = monthly.filter(r => r.status === 'present').length;
        const totalDays = monthly.length;
        const rate = totalDays ? Math.round((presentDays / totalDays) * 100) : 0;
        let breakTime = 0;
        records.forEach(r => {
          if (r.breaks) {
            Object.values(r.breaks).forEach(b => {
              if (b.duration) breakTime += parseDurationToMinutes(b.duration);
            });
          }
        });
        setStats(prev => ({ ...prev, attendanceRate: rate, presentDays, totalDays, totalBreakTime: breakTime }));
      } else {
        setAttendanceRecords([]);
        setStats(prev => ({ ...prev, attendanceRate: 0, presentDays: 0, totalDays: 0, totalBreakTime: 0 }));
      }
    });
    return () => unsub();
  }, [user]);

  // Fetch project stats
  useEffect(() => {
    if (!user?.id) return;
    const fetchProjects = async () => {
      try {
        const snap = await get(ref(database, 'projects'));
        const all = snap.val() as Record<string, RawProjectValue> | null;
        if (!all) {
          setStats(prev => ({ ...prev, totalProjects: 0, activeProjects: 0, completedProjects: 0, pausedProjects: 0 }));
          setEmployeeProjects([]);
          return;
        }
        let total = 0, active = 0, completed = 0, paused = 0;
        const list: ExtendedProject[] = [];
        for (const [id, proj] of Object.entries(all)) {
          const isAssigned = proj.assignedTeamLeader === user.id || (proj.assignedEmployees && proj.assignedEmployees.includes(user.id));
          if (!isAssigned) continue;
          total++;
          const status = proj.status;
          if (status === 'in_progress' || status === 'active') active++;
          else if (status === 'completed') completed++;
          else if (status === 'on_hold') paused++;
          list.push({
            id,
            name: proj.name || '',
            description: proj.description || '',
            department: proj.department || '',
            assignedTeamLeader: proj.assignedTeamLeader || '',
            assignedEmployees: proj.assignedEmployees || [],
            tasks: proj.tasks || {},
            startDate: proj.startDate || '',
            endDate: proj.endDate || '',
            priority: (proj.priority as Project['priority']) || 'medium',
            status: (status as Project['status']) || 'not_started',
            progress: proj.progress || 0,
            createdAt: proj.createdAt || '',
            createdBy: proj.createdBy || '',
            projectType: proj.projectType || 'common',
            specificDepartment: proj.specificDepartment,
            clientId: proj.clientId,
          });
        }
        setStats(prev => ({ ...prev, totalProjects: total, activeProjects: active, completedProjects: completed, pausedProjects: paused }));
        setEmployeeProjects(list);
      } catch (err) { console.error(err); }
    };
    fetchProjects();
  }, [user]);

  // Upcoming meetings
  useEffect(() => {
    if (!user?.id || !user?.adminUid) return;
    const meetRef = ref(database, `users/${user.adminUid}/employees/${user.id}/meetings`);
    const q = query(meetRef, orderByChild('date'));
    const unsub = onValue(q, (snap) => {
      const data = snap.val() as Record<string, RawMeetingValue> | null;
      if (data && typeof data === 'object') {
        const meetings = Object.entries(data).map(([key, val]) => ({
          id: key,
          title: val.title || '',
          description: val.description || '',
          date: val.date || '',
          time: val.time || '',
          duration: val.duration || '',
          type: (val.type === 'common' ? 'common' : 'department') as 'common' | 'department',
          department: val.department,
          meetingLink: val.meetingLink,
          agenda: val.agenda,
          createdAt: val.createdAt,
          employeeId: val.employeeId,
          employeeName: val.employeeName,
        }));
        const now = new Date();
        const upcoming = meetings.filter(m => new Date(`${m.date}T${m.time}`).getTime() > now.getTime());
        setUpcomingMeetings(upcoming);
        setStats(prev => ({ ...prev, upcomingMeetings: upcoming.length }));
      } else {
        setUpcomingMeetings([]);
        setStats(prev => ({ ...prev, upcomingMeetings: 0 }));
      }
    });
    return () => unsub();
  }, [user]);

  // Social media activities (only for Digital Marketing)
  useEffect(() => {
    if (!user?.id || !user?.adminUid || user?.department !== 'Digital Marketing') {
      setSocialMediaActivities([]);
      return;
    }
    const smRef = ref(database, `users/${user.adminUid}/employees/${user.id}/socialmedia`);
    const q = query(smRef, orderByChild('createdAt'));
    const unsub = onValue(q, (snap) => {
      const data = snap.val() as Record<string, RawSocialMediaValue> | null;
      if (data && typeof data === 'object') {
        const activities: SocialMediaActivity[] = Object.entries(data).map(([key, val]) => ({
          id: key,
          type: 'social_media' as const,
          action: `Scheduled ${val.platform || 'social media'} post`,
          platform: val.platform || '',
          timestamp: val.createdAt ? new Date(val.createdAt).getTime() : Date.now(),
          content: val.content || '',
          scheduledDate: val.scheduledDate || '',
          status: val.status || '',
        })).sort((a, b) => b.timestamp - a.timestamp);
        setSocialMediaActivities(activities);
        setStats(prev => ({ ...prev, scheduledPosts: activities.filter(a => a.status === 'scheduled').length }));
      } else {
        setSocialMediaActivities([]);
        setStats(prev => ({ ...prev, scheduledPosts: 0 }));
      }
    });
    return () => unsub();
  }, [user]);

  // Recent activities combine
  useEffect(() => {
    const now = new Date();
    const all: RecentActivity[] = [];
    attendanceRecords.slice(0, 3).forEach(rec => {
      all.push({ id: rec.id, type: 'attendance', action: `Marked ${rec.status} for ${new Date(rec.date).toLocaleDateString()}`, time: formatTimeDifference(now, new Date(rec.timestamp)), timestamp: rec.timestamp });
      if (rec.breaks) {
        Object.entries(rec.breaks).forEach(([bid, br]) => {
          all.push({ id: bid, type: 'break', action: br.breakOut ? `Completed break (${br.duration})` : `Started break at ${br.breakIn}`, time: formatTimeDifference(now, new Date(rec.timestamp)), timestamp: rec.timestamp, details: br as BreakDetails });
        });
      }
    });
    socialMediaActivities.slice(0, 3).forEach(act => {
      all.push({ id: act.id, type: 'social_media', action: act.action, time: formatTimeDifference(now, new Date(act.timestamp)), timestamp: act.timestamp, details: { platform: act.platform, content: act.content, scheduledDate: act.scheduledDate } as SocialMediaDetails });
    });
    all.sort((a, b) => b.timestamp - a.timestamp);
    setRecentActivities(all.slice(0, 5));
  }, [attendanceRecords, socialMediaActivities]);

  const formatTimeDifference = (now: Date, past: Date): string => {
    const diffSec = Math.floor((now.getTime() - past.getTime()) / 1000);
    if (diffSec < 60) return `${diffSec} seconds ago`;
    const mins = Math.floor(diffSec / 60);
    if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  };

  const calculateLeaveDays = (start: string, end: string): number => {
    const diff = Math.abs(new Date(end).getTime() - new Date(start).getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  const loadLeaveData = async () => {
    if (!user?.id || !user?.adminUid) return;
    try {
      const leavesRef = ref(database, `users/${user.adminUid}/employees/${user.id}/leaves`);
      const snap = await get(leavesRef);
      const data = snap.val() as Record<string, RawLeaveValue> | null;
      if (data && typeof data === 'object') {
        const requests: LeaveRequest[] = Object.entries(data).map(([key, val]) => ({
          id: key,
          employeeId: user.id,
          employeeName: user.name || 'Unknown',
          employeeEmail: user.email || '',
          department: user.department || '',
          leaveType: val.leaveType || '',
          startDate: val.startDate || '',
          endDate: val.endDate || '',
          reason: val.reason || '',
          status: (val.status as LeaveRequest['status']) || 'pending',
          appliedAt: val.appliedAt || new Date().toISOString(),
          approvedAt: val.approvedAt,
          rejectedAt: val.rejectedAt,
          approvedBy: val.approvedBy,
        }));
        const approvedDays = requests.filter(r => r.status === 'approved').reduce((sum, r) => sum + calculateLeaveDays(r.startDate, r.endDate), 0);
        setLeaveRequests(requests);
        setStats(prev => ({ ...prev, leavesUsed: approvedDays }));
      } else {
        setLeaveRequests([]);
      }
    } catch (err) { console.error(err); }
  };

  const loadTodayAttendance = async (): Promise<(() => void) | undefined> => {
    if (!user?.id || !user?.adminUid) {
      setLoading(false);
      return;
    }
    try {
      const today = new Date();
      const attRef = ref(database, `users/${user.adminUid}/employees/${user.id}/punching`);
      const snap = await get(attRef);
      const data = snap.val() as Record<string, RawAttendanceValue> | null;
      if (data && typeof data === 'object') {
        const records = Object.entries(data).map(([key, val]) => ({
          id: key,
          employeeId: user.id,
          employeeName: user.name || 'Unknown',
          date: safeDate(val.date),
          punchIn: val.punchIn || '',
          punchOut: val.punchOut !== undefined ? (typeof val.punchOut === 'string' ? val.punchOut : null) : null,
          status: val.status || 'present',
          workMode: val.workMode || 'office',
          timestamp: val.timestamp || Date.now(),
          department: val.department,
          designation: val.designation,
          selfie: val.selfie,
          selfieOut: val.selfieOut,
          location: val.location,
          locationOut: val.locationOut,
          breaks: val.breaks as Record<string, RawBreak> | undefined,
          markedLateBy: val.markedLateBy,
          markedLateAt: val.markedLateAt,
          markedHalfDayBy: val.markedHalfDayBy,
          markedHalfDayAt: val.markedHalfDayAt,
        }));
        const todayRec = records.find(r => {
          const d = new Date(r.date);
          return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        });
        if (todayRec) {
          setTodayAttendance(todayRec);
          if (todayRec.breaks) {
            const active = Object.entries(todayRec.breaks).find(([, br]) => !br.breakOut);
            if (active) setCurrentBreakId(active[0]);
          }
        } else {
          setTodayAttendance(null);
          setCurrentBreakId(null);
        }
      } else {
        setTodayAttendance(null);
        setCurrentBreakId(null);
      }
      const unsub = onValue(attRef, (snap) => {
        const updated = snap.val() as Record<string, RawAttendanceValue> | null;
        if (updated && typeof updated === 'object') {
          const updatedRecs = Object.entries(updated).map(([key, val]) => ({
            id: key,
            employeeId: user.id,
            employeeName: user.name || 'Unknown',
            date: safeDate(val.date),
            punchIn: val.punchIn || '',
            punchOut: val.punchOut !== undefined ? (typeof val.punchOut === 'string' ? val.punchOut : null) : null,
            status: val.status || 'present',
            workMode: val.workMode || 'office',
            timestamp: val.timestamp || Date.now(),
            department: val.department,
            designation: val.designation,
            selfie: val.selfie,
            selfieOut: val.selfieOut,
            location: val.location,
            locationOut: val.locationOut,
            breaks: val.breaks as Record<string, RawBreak> | undefined,
            markedLateBy: val.markedLateBy,
            markedLateAt: val.markedLateAt,
            markedHalfDayBy: val.markedHalfDayBy,
            markedHalfDayAt: val.markedHalfDayAt,
          }));
          const updatedToday = updatedRecs.find(r => {
            const d = new Date(r.date);
            return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
          });
          if (updatedToday) {
            setTodayAttendance(updatedToday);
            if (updatedToday.breaks) {
              const active = Object.entries(updatedToday.breaks).find(([, br]) => !br.breakOut);
              if (active) setCurrentBreakId(active[0]); else setCurrentBreakId(null);
            } else setCurrentBreakId(null);
          } else {
            setTodayAttendance(null);
            setCurrentBreakId(null);
          }
        } else {
          setTodayAttendance(null);
          setCurrentBreakId(null);
        }
      });
      return unsub;
    } catch (err) {
      console.error(err);
      setTodayAttendance(null);
      setCurrentBreakId(null);
    } finally {
      setLoading(false);
    }
  };

  // Helper to safely convert date
  const safeDate = (val: unknown): string => {
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return new Date(val).toISOString().split('T')[0];
    return '';
  };

  // Auto punch-out (throttled)
  const performAutoPunchOut = async () => {
    if (!todayAttendance || todayAttendance.punchOut || !user?.id || !user?.adminUid) return;
    const now = Date.now();
    if (now - lastAutoPunchOutNotif.current < 30000) return;
    lastAutoPunchOutNotif.current = now;
    const punchOutTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updates = { punchOut: punchOutTime, timestamp: now, status: 'auto-punched-out', markedBy: 'System', updatedAt: new Date().toISOString() };
    const recordRef = ref(database, `users/${user.adminUid}/employees/${user.id}/punching/${todayAttendance.id}`);
    await update(recordRef, updates);
    toast(`Auto punched out at ${punchOutTime}`, { icon: '🕒' });
    const notifRef = push(ref(database, `notifications/${user.id}`));
    await set(notifRef, {
      title: 'Auto Punch‑out',
      body: `You were automatically punched out at ${punchOutTime}.`,
      type: 'auto_punchout',
      read: false,
      createdAt: Date.now(),
    });
    const adminNotifRef = push(ref(database, `notifications/${user.adminUid}`));
    await set(adminNotifRef, {
      title: 'Auto Punch‑out',
      body: `${user.name} was auto‑punched out at ${punchOutTime}.`,
      type: 'auto_punchout',
      read: false,
      createdAt: now,
    });
  };

  // Safety net: auto punch-out at midnight (only if still punched in)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!todayAttendance || todayAttendance.punchOut) return;
      const now = new Date();
      if (now.getHours() === 23 && now.getMinutes() >= 59) {
        await performAutoPunchOut();
      }
    }, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [todayAttendance, user?.id]);

  // Reminder between 6 PM and 8 PM
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!todayAttendance || todayAttendance.punchOut) return;
      const now = new Date();
      const hour = now.getHours();
      if (hour >= 18 && hour < 20) {
        const nowTime = now.getTime();
        if (nowTime - lastReminderNotif.current > 3600000) {
          lastReminderNotif.current = nowTime;
          const notifRef = push(ref(database, `notifications/${user?.id}`));
          await set(notifRef, {
            title: 'Punch‑out Reminder',
            body: 'You have not punched out yet. Please do so before 8:00 PM.',
            type: 'punchout_reminder',
            read: false,
            createdAt: Date.now(),
          });
          toast('You are still punched in. Please punch out before 8:00 PM.', { icon: '⚠️', duration: 10000 });
        }
      }
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [todayAttendance, user?.id]);
    
  // Late/Half-day status notification
  useEffect(() => {
    if (!todayAttendance) return;
    const curStatus = todayAttendance.status;
    const prevStatus = lastNotifiedStatusRef.current;
    if (curStatus !== prevStatus && (curStatus === 'late' || curStatus === 'half-day')) {
      const markedBy = curStatus === 'late' ? (todayAttendance.markedLateBy || 'System') : (todayAttendance.markedHalfDayBy || 'System');
      const title = `Attendance Status: ${curStatus === 'late' ? 'Late' : 'Half Day'}`;
      const body = `You have been marked as ${curStatus === 'late' ? 'Late' : 'Half Day'} by ${markedBy}.`;
      const key = `${todayAttendance.id}-${curStatus}`;
      const now = Date.now();
      if (!lastStatusNotif.current[key] || now - lastStatusNotif.current[key] > 60000) {
        lastStatusNotif.current[key] = now;
        const notifRef = push(ref(database, `notifications/${user?.id}`));
        set(notifRef, {
          title,
          body,
          type: 'attendance_status',
          read: false,
          createdAt: now,
        });
      }
      lastNotifiedStatusRef.current = curStatus;
    }
  }, [todayAttendance, user?.id]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    const fetchData = async () => {
      await loadLeaveData();
      unsub = await loadTodayAttendance();
    };
    fetchData();
    return () => { if (unsub) unsub(); };
  }, [user]);

  // Idle detection
  const { isIdle, forceEndIdle } = useIdleDetection({
    idleTimeout: 120000,
    userId: user?.id,
    adminId: user?.adminUid,
    employeeName: user?.name,
    employeeEmail: user?.email,
    department: user?.department,
    isActive: isPunchedIn && !isOnBreak,
    onIdleStart: () => {
      if (!idleNotifiedRef.current) {
        idleNotifiedRef.current = true;
        toast('You have been idle for 2 minutes. Please resume work.', { icon: '⚠️' });
      }
    },
    onIdleEnd: () => { idleNotifiedRef.current = false; },
  });

  const handleSelfieCapture = async (imageData: string) => {
    const loc = await getCurrentLocation();
    setCurrentLocation(loc);
    if (pendingPunchType === 'in') await performPunchIn(imageData, loc);
    else if (pendingPunchType === 'out') await performPunchOut(imageData, loc);
    setShowSelfieCapture(false);
    setPendingPunchType(null);
  };

  const performPunchIn = async (selfieImage: string, location: { lat: number; lng: number; name: string } | null) => {
    if (!user?.id || !user?.adminUid) { toast.error("User info missing"); return; }
    if (todayAttendance) { toast.error("Already punched in"); return; }
    setLoading(true);
    try {
      const now = new Date();
      const customId = employeeIdDisplay || user?.employeeId || user?.id;
      const rec: Omit<AttendanceRecord, 'id'> = {
        employeeId: user.id,
        employeeCode: customId,
        employeeName: user.name || 'Unknown',
        date: now.toISOString(),
        punchIn: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        punchOut: null,
        status: 'present',
        workMode: employeeProfile?.workMode || 'office',
        timestamp: now.getTime(),
        department: user.department || '',
        designation: user.designation || '',
        selfie: selfieImage,
        location: location || undefined,
      };
      const refPath = ref(database, `users/${user.adminUid}/employees/${user.id}/punching`);
      const newRef = push(refPath);
      await set(newRef, rec);
      await punchIn();
      toast.success("Punched in with selfie!");
    } catch (err) {
      console.error(err);
      toast.error("Punch-in failed");
    } finally {
      setLoading(false);
    }
  };

  const performPunchOut = async (selfieImage: string, location: { lat: number; lng: number; name: string } | null, skipSelfie = false) => {
    if (!skipSelfie && !selfieImage) { toast.error("Selfie required"); return; }
    if (!user?.id || !user?.adminUid || !todayAttendance?.id) { toast.error("Missing data"); return; }
    if (todayAttendance.punchOut) { toast.error("Already punched out"); return; }
    if (currentBreakId) { toast.error("End break first"); return; }
    setLoading(true);
    try {
      const now = new Date();
      const punchOutTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const inTime = todayAttendance.punchIn;
      const workedMin = calculateTotalWorkedMinutes(inTime, punchOutTime, todayAttendance.breaks);
      const workedHours = workedMin / 60;
      const inMin = convertTimeToMinutes(inTime);
      const late = inMin > (9 * 60 + 40);
      const halfDay = workedHours < 4;
      let newStatus = 'present';
      if (halfDay) newStatus = 'half-day';
      else if (late) newStatus = 'late';
      const updates: PunchOutUpdates = { punchOut: punchOutTime, timestamp: now.getTime(), selfieOut: selfieImage, locationOut: location || undefined };
      if (newStatus !== 'present') {
        updates.status = newStatus;
        if (newStatus === 'late') {
          updates.markedLateBy = 'System (Auto)';
          updates.markedLateAt = new Date().toISOString();
          updates.markedHalfDayBy = null;
          updates.markedHalfDayAt = null;
        } else {
          updates.markedHalfDayBy = 'System (Auto)';
          updates.markedHalfDayAt = new Date().toISOString();
          updates.markedLateBy = null;
          updates.markedLateAt = null;
        }
      }
      const recordRef = ref(database, `users/${user.adminUid}/employees/${user.id}/punching/${todayAttendance.id}`);
      await update(recordRef, updates);
      await punchOut();
      if (newStatus === 'late') toast.success("Punched out (late after 9:40 AM)");
      else if (newStatus === 'half-day') toast.success("Punched out (half‑day, <4h)");
      else toast.success("Punched out");
    } catch (err) {
      console.error(err);
      toast.error("Punch-out failed");
    } finally {
      setLoading(false);
    }
  };

  const autoPunchOut = async () => {
    if (!todayAttendance || todayAttendance.punchOut) return;
    const loc = await getCurrentLocation();
    await performPunchOut('', loc, true);
    toast.success('Auto punched out');
  };

  // ==================== NEW: Auto punch-out on browser close after 6:30 PM ====================
  // ==================== AUTO PUNCH-OUT ON BROWSER CLOSE AFTER 6:30 PM ====================
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (!todayAttendance?.punchOut && todayAttendance) {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      if (hour > 18 || (hour === 18 && minute >= 30)) {
        // Store pending punch-out synchronously
        localStorage.setItem('pending_punch_out', JSON.stringify({
          employeeId: user?.id,
          adminId: user?.adminUid,
          date: todayAttendance.date,
          recordId: todayAttendance.id,
          timestamp: Date.now(),
        }));
        e.preventDefault();
        // Return a string to show confirmation message
        return 'You are still punched in. Auto punch‑out will be attempted on next login.';
      }
    }
  };
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [todayAttendance, user?.id, user?.adminUid]);

// ==================== RECOVER PENDING PUNCH-OUT ON PAGE LOAD ====================
useEffect(() => {
  const pending = localStorage.getItem('pending_punch_out');
  if (pending && todayAttendance && !todayAttendance.punchOut) {
    const data = JSON.parse(pending);
    if (data.date === todayAttendance.date) {
      autoPunchOut().then(() => localStorage.removeItem('pending_punch_out'));
    } else {
      localStorage.removeItem('pending_punch_out');
    }
  }
}, [todayAttendance, autoPunchOut]);
// ==================== END OF AUTO PUNCH-OUT SECTION ====================

  // ==================== END OF NEW SECTION ====================

  const handlePunchIn = () => { setPendingPunchType('in'); setShowSelfieCapture(true); };
  const handlePunchOut = () => { setPendingPunchType('out'); setShowSelfieCapture(true); };
  const handleMarkAttendance = () => { setPendingPunchType(todayAttendance && !todayAttendance.punchOut ? 'out' : 'in'); setShowSelfieCapture(true); };
  
  const handleBreakIn = async () => {
    if (!user?.id || !user?.adminUid || !todayAttendance?.id) { toast.error("Cannot start break"); return; }
    if (currentBreakId) { toast.error("Already in break"); return; }
    forceEndIdle();
    setBreakLoading(true);
    try {
      const now = new Date();
      const breakInTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const breakId = `break_${now.getTime()}`;
      await update(ref(database, `users/${user.adminUid}/employees/${user.id}/punching/${todayAttendance.id}`), {
        [`breaks/${breakId}/breakIn`]: breakInTime,
        [`breaks/${breakId}/timestamp`]: now.getTime()
      });
      await startBreak();
      setCurrentBreakId(breakId);
      toast.success("Break started");
    } catch (err) {
      console.error(err);
      toast.error("Failed to start break");
    } finally {
      setBreakLoading(false);
    }
  };

  const calculateBreakDuration = (inTime: string, outTime: string): string => {
    const inMin = convertTimeToMinutes(inTime);
    const outMin = convertTimeToMinutes(outTime);
    let dur = outMin - inMin;
    if (dur < 0) dur += 24 * 60;
    const h = Math.floor(dur / 60);
    const m = dur % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };
  
  const handleBreakOut = async () => {
    if (!user?.id || !user?.adminUid || !todayAttendance?.id || !currentBreakId) { toast.error("Cannot end break"); return; }
    setBreakLoading(true);
    try {
      const now = new Date();
      const outTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const inTime = todayAttendance.breaks?.[currentBreakId]?.breakIn;
      if (!inTime) throw new Error("No break in time");
      const duration = calculateBreakDuration(inTime, outTime);
      await update(ref(database, `users/${user.adminUid}/employees/${user.id}/punching/${todayAttendance.id}`), { 
        [`breaks/${currentBreakId}/breakOut`]: outTime,
        [`breaks/${currentBreakId}/duration`]: duration,
        [`breaks/${currentBreakId}/timestamp`]: now.getTime()
      });
      await endBreak();
      setCurrentBreakId(null);
      toast.success("Break ended");
    } catch (err) {
      console.error(err);
      toast.error("Failed to end break");
    } finally {
      setBreakLoading(false);
    }
  };

  const quickActions = [
    { icon: Clock, label: 'Mark Attendance', color: 'bg-blue-600 hover:bg-blue-700', onClick: handleMarkAttendance },
    { icon: Plane, label: 'Apply Leave', color: 'bg-green-600 hover:bg-green-700', onClick: () => navigate('/employee/leaves') },
    { icon: FolderOpen, label: 'View Projects', color: 'bg-purple-600 hover:bg-purple-700', onClick: () => navigate('/employee/projects') },
    { icon: Calendar, label: 'My Meetings', color: 'bg-orange-600 hover:bg-orange-700', onClick: () => navigate('/employee/meetings') },
  ];

  const cardVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };
  const isToday = (d: string) => new Date(d).toDateString() === new Date().toDateString();
  const isTomorrow = (d: string) => {
    const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
    return new Date(d).toDateString() === tmrw.toDateString();
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
    if (status === 'present') return <CheckCircle className="h-4 w-4" />;
    if (status === 'absent') return <XCircle className="h-4 w-4" />;
    if (status === 'late') return <AlertTriangle className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
  };
  const getPlatformColor = (platform?: string) => {
    const colors: Record<string, string> = {
      'Facebook': 'bg-blue-100 text-blue-700',
      'Instagram': 'bg-pink-100 text-pink-700',
      'Twitter': 'bg-sky-100 text-sky-700',
      'LinkedIn': 'bg-indigo-100 text-indigo-700',
      'YouTube': 'bg-red-100 text-red-700',
      'TikTok': 'bg-purple-100 text-purple-700',
    };
    return platform ? colors[platform] || 'bg-gray-100 text-gray-700' : 'bg-gray-100 text-gray-700';
  };

  if (loading && leaveRequests.length === 0) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg">
        <div className="flex justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {user?.name}!</h1>
            <p className="text-blue-100 mt-1">{user?.designation} • {user?.department}</p>
            <p className="text-blue-100 text-sm">Employee ID: {employeeIdDisplay || 'Not assigned'}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-blue-100">Today's Date</p>
            <p className="text-lg font-semibold">{new Date().toLocaleDateString()}</p>
            <p className="text-sm text-blue-100">{new Date().toLocaleDateString('en-US', { weekday: 'long' })}</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <motion.div variants={cardVariants} initial="hidden" animate="visible" transition={{ delay: 0.1 }}>
          <Card><CardHeader className="flex flex-row justify-between pb-2"><CardTitle className="text-sm font-medium">Attendance Rate</CardTitle><Clock className="h-4 w-4 text-blue-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.attendanceRate}%</div><p className="text-xs text-muted-foreground">{stats.presentDays} of {stats.totalDays} days</p></CardContent></Card>
        </motion.div>
        <motion.div variants={cardVariants} initial="hidden" animate="visible" transition={{ delay: 0.2 }}>
          <Card><CardHeader className="flex flex-row justify-between pb-2"><CardTitle className="text-sm font-medium">Leaves Used</CardTitle><Plane className="h-4 w-4 text-green-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.leavesUsed}</div><p className="text-xs text-muted-foreground">Days taken this year</p></CardContent></Card>
        </motion.div>
        <motion.div variants={cardVariants} initial="hidden" animate="visible" transition={{ delay: 0.3 }} onClick={() => setShowProjectsPopup(true)} className="cursor-pointer">
          <Card><CardHeader className="flex flex-row justify-between pb-2"><CardTitle className="text-sm font-medium">Total Projects</CardTitle><FolderOpen className="h-4 w-4 text-purple-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.totalProjects}</div><p className="text-xs text-muted-foreground">Active: {stats.activeProjects} | Completed: {stats.completedProjects} | Paused: {stats.pausedProjects}</p></CardContent></Card>
        </motion.div>
        <motion.div variants={cardVariants} initial="hidden" animate="visible" transition={{ delay: 0.4 }}>
          <Card><CardHeader className="flex flex-row justify-between pb-2"><CardTitle className="text-sm font-medium">Upcoming Meetings</CardTitle><Calendar className="h-4 w-4 text-orange-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.upcomingMeetings}</div><p className="text-xs text-muted-foreground">Scheduled meetings</p></CardContent></Card>
        </motion.div>
        {user?.department === 'Digital Marketing' && <motion.div variants={cardVariants} initial="hidden" animate="visible" transition={{ delay: 0.5 }}>
          <Card><CardHeader className="flex flex-row justify-between pb-2"><CardTitle className="text-sm font-medium">Scheduled Posts</CardTitle><Share2 className="h-4 w-4 text-pink-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.scheduledPosts}</div><p className="text-xs text-muted-foreground">Social media posts</p></CardContent></Card>
        </motion.div>}
      </div>

      {upcomingMeetings.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card><CardHeader><CardTitle className="flex gap-2"><Calendar className="h-5 w-5 text-blue-600" /> Next Meeting</CardTitle></CardHeader><CardContent><div className="border rounded-lg p-4"><div className="flex flex-col sm:flex-row"><div className="text-center min-w-[40px]"><p className="text-lg font-semibold">{new Date(upcomingMeetings[0].date).getDate()}</p><p className="text-xs text-gray-500">{new Date(upcomingMeetings[0].date).toLocaleDateString('en-US', { weekday: 'short' })}</p></div><div className="flex-1"><div className="flex flex-wrap gap-2 mb-1"><h3 className="font-semibold text-lg">{upcomingMeetings[0].title}</h3><Badge>{upcomingMeetings[0].type === 'common' ? 'All Staff' : upcomingMeetings[0].department}</Badge>{isToday(upcomingMeetings[0].date) && <Badge className="bg-red-100 text-red-700">Today</Badge>}{isTomorrow(upcomingMeetings[0].date) && <Badge className="bg-orange-100 text-orange-700">Tomorrow</Badge>}</div><p className="text-sm text-gray-600 mb-2">{upcomingMeetings[0].description}</p><div className="flex flex-wrap gap-4 text-sm text-gray-500"><div className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(`${upcomingMeetings[0].date}T${upcomingMeetings[0].time}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} ({upcomingMeetings[0].duration} min)</div>{upcomingMeetings[0].meetingLink && <div className="flex items-center gap-1"><Video className="h-3 w-3" /> Online Meeting</div>}</div></div></div></div>{upcomingMeetings.length > 1 && <div className="text-center pt-4"><Button variant="ghost" className="text-blue-600" onClick={() => navigate('/employee/meetings')}>View all {upcomingMeetings.length} upcoming meetings</Button></div>}</CardContent></Card>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
          <CardHeader><CardTitle className="flex gap-2"><Clock className="h-5 w-5 text-green-600" /> Today's Attendance</CardTitle></CardHeader>
          <CardContent>
            {loading ? <div className="flex justify-center h-20"><div className="animate-spin h-8 w-8 border-b-2 border-gray-900 rounded-full" /></div> : todayAttendance ? (
              <div className="space-y-4">
                <div className="flex justify-between">
                  <div className="flex gap-6">
                    <div><p className="text-sm text-gray-600">Punch In</p><p className="text-lg font-semibold text-green-600">{todayAttendance.punchIn}</p></div>
                    {todayAttendance.punchOut && <div><p className="text-sm text-gray-600">Punch Out</p><p className="text-lg font-semibold text-red-600">{todayAttendance.punchOut}</p></div>}
                    <Badge variant="outline" className="text-green-600 border-green-200"><CheckCircle className="w-3 h-3 mr-1" /> Present</Badge>
                  </div>
                  {!todayAttendance.punchOut ? <Button onClick={handlePunchOut} className="bg-red-600"><Camera className="h-4 w-4 mr-2" />Punch Out</Button> : <div className="text-sm text-gray-500">Attendance completed</div>}
                </div>
                <div className="text-sm">
                  {!todayAttendance.punchOut ? <div><span className="font-medium">Worked so far: </span>{formatMinutesToHours(calculateTotalWorkedMinutes(todayAttendance.punchIn, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), todayAttendance.breaks))}</div> : <div><span className="font-medium">Total Worked: </span>{formatMinutesToHours(calculateTotalWorkedMinutes(todayAttendance.punchIn, todayAttendance.punchOut, todayAttendance.breaks))}{todayAttendance.status === 'half-day' && <span className="ml-2 text-purple-600 italic">(Net hours &lt; 4 → half‑day)</span>}</div>}
                </div>
                <div className="border-t pt-4">
                  <h3 className="font-medium mb-3">Break Management</h3>
                  {todayAttendance.breaks && Object.entries(todayAttendance.breaks).length > 0 && <div className="mb-4"><h4 className="text-sm font-medium mb-2">Today's Breaks:</h4><div className="space-y-2">{Object.entries(todayAttendance.breaks).map(([bid, br]) => <div key={bid} className="flex justify-between p-2 bg-gray-50 rounded"><div className="flex gap-4"><div><p className="text-sm text-gray-600">Break In</p><p className="font-medium">{br.breakIn}</p></div>{br.breakOut ? <><div><p className="text-sm text-gray-600">Break Out</p><p className="font-medium">{br.breakOut}</p></div><div><p className="text-sm text-gray-600">Duration</p><p className="font-medium">{br.duration || '--:--'}</p></div></> : <Badge className="bg-yellow-100 text-yellow-700">In Progress</Badge>}</div>{!br.breakOut && bid === currentBreakId && <Button size="sm" variant="outline" onClick={handleBreakOut} disabled={breakLoading}>{breakLoading ? "Ending..." : "End Break"}</Button>}</div>)}</div></div>}
                  {!todayAttendance.punchOut && <div className="flex gap-4">{currentBreakId ? <Button onClick={handleBreakOut} className="bg-yellow-600" disabled={breakLoading}>{breakLoading ? "Ending Break..." : "End Current Break"}</Button> : <Button onClick={handleBreakIn} className="bg-blue-600" disabled={breakLoading}>{breakLoading ? "Starting..." : "Start New Break"}</Button>}</div>}
                </div>
              </div>
            ) : (
              <div className="flex justify-between"><div><p className="text-lg font-semibold">Ready to start your day?</p><p className="text-gray-600">Mark your attendance to begin</p></div><Button onClick={handlePunchIn} className="bg-green-600"><Camera className="h-4 w-4 mr-2" />Punch In</Button></div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
        <Card><CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader><CardContent><div className="grid grid-cols-2 gap-4">{quickActions.map((a, i) => <Button key={i} onClick={a.onClick} className={`h-20 flex flex-col gap-2 ${a.color} text-white`}><a.icon className="h-5 w-5" /><span className="text-sm">{a.label}</span></Button>)}</div></CardContent></Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
        <Card><CardHeader><CardTitle className="flex gap-2"><Plane className="h-4 w-4" /> Recent Leave Requests</CardTitle></CardHeader><CardContent>
          {leaveRequests.length === 0 ? <div className="text-center py-8 text-gray-500">No leave requests found</div> : <div className="space-y-4">{leaveRequests.slice(0, 3).map(req => <div key={req.id} className="border rounded-lg p-4"><div><div className="flex items-center gap-2 mb-2"><h3 className="font-semibold">{req.leaveType}</h3><Badge className={req.status === 'approved' ? 'bg-green-100 text-green-700' : req.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}>{req.status}</Badge></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600"><div><p className="font-medium">Duration</p><p>{calculateLeaveDays(req.startDate, req.endDate)} day(s)</p></div><div><p className="font-medium">Start Date</p><p>{new Date(req.startDate).toLocaleDateString()}</p></div><div><p className="font-medium">End Date</p><p>{new Date(req.endDate).toLocaleDateString()}</p></div></div><p className="text-xs text-gray-500">Applied on: {new Date(req.appliedAt).toLocaleString()}</p></div></div>)}</div>}
          {leaveRequests.length > 3 && <div className="text-center pt-2"><Button variant="ghost" className="text-blue-600" onClick={() => navigate('/employee/leaves')}>View all {leaveRequests.length} leave requests</Button></div>}
        </CardContent></Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }}>
        <Card><CardHeader><CardTitle className="flex gap-2"><Target className="h-4 w-4" /> Recent Activities</CardTitle></CardHeader><CardContent>
          {recentActivities.length === 0 ? <div className="text-center py-8 text-gray-500">No recent activities</div> : <div className="space-y-4">{recentActivities.map(act => <div key={act.id} className="flex items-start gap-3"><div className={`w-2 h-2 rounded-full mt-2 ${act.type === 'project' ? 'bg-blue-500' : act.type === 'attendance' ? 'bg-green-500' : act.type === 'social_media' ? 'bg-pink-500' : act.type === 'break' ? 'bg-yellow-500' : 'bg-purple-500'}`} /><div className="flex-1"><div className="flex items-center gap-2"><p className="font-medium">{act.action}</p>{act.type === 'social_media' && act.details && <Badge className={getPlatformColor((act.details as SocialMediaDetails).platform)}>{(act.details as SocialMediaDetails).platform}</Badge>}{act.type === 'break' && <Badge className="bg-yellow-100 text-yellow-700">Break</Badge>}</div><p className="text-sm text-gray-500">{act.time}</p>{act.type === 'social_media' && (act.details as SocialMediaDetails)?.content && <div className="mt-2 p-2 bg-gray-50 rounded text-sm"><p className="truncate">{(act.details as SocialMediaDetails).content}</p>{(act.details as SocialMediaDetails).scheduledDate && <div className="flex items-center gap-1 text-xs"><Calendar className="h-3 w-3" /> Scheduled: {new Date((act.details as SocialMediaDetails).scheduledDate!).toLocaleDateString()}</div>}</div>}</div></div>)}</div>}
        </CardContent></Card>
      </motion.div>

      <ProjectsPopup isOpen={showProjectsPopup} onClose={() => setShowProjectsPopup(false)} projects={employeeProjects} employees={[]} />
      <SelfieCapture isOpen={showSelfieCapture} onClose={() => { setShowSelfieCapture(false); setPendingPunchType(null); }} onCapture={handleSelfieCapture} employeeName={user?.name || 'Employee'} punchType={pendingPunchType === 'in' ? 'Punch In' : 'Punch Out'} />
    </div>
  );
};

export default EmployeeDashboardHome;