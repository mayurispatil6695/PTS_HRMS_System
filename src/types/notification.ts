export interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'project_assigned' | 'meeting_scheduled' | 'leave_approved' | 'attendance_marked' | 'system';
  read: boolean;
  createdAt: number;
  targetId?: string;      // projectId, meetingId, etc.
  targetType?: string;    // 'project', 'meeting', 'leave'
  actionUrl?: string;     // optional route
}