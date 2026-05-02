// src/types/meeting.ts

export interface Meeting {
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

export interface MeetingParticipant {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeDepartment: string;
  adminId: string;
  reminded5MinBefore: boolean;
  notifiedAtStart: boolean;
}

// Raw Firebase shapes (for reading from database)
export interface RawMeeting {
  title?: string;
  description?: string;
  date?: string;
  time?: string;
  duration?: string;
  meetingLink?: string;
  agenda?: string;
  status?: string;
  createdAt?: string;
  createdBy?: string;
  createdByName?: string;
  type?: string;
  department?: string | null;
  participantCount?: number;
}

export interface RawMeetingParticipant {
  employeeId?: string;
  employeeName?: string;
  employeeEmail?: string;
  employeeDepartment?: string;
  adminId?: string;
  reminded5MinBefore?: boolean;
  notifiedAtStart?: boolean;
}