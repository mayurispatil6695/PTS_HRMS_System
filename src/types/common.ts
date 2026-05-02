// src/types/common.ts

export interface LocationData {
  lat: number;
  lng: number;
  name: string;
}

export interface Notification {
  id: string;
  type: 'punch-in' | 'punch-out' | 'break-in' | 'break-out' | 'task_assigned' | 'leave_approved';
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
  data?: Record<string, unknown>;
}

// src/types/common.ts

export interface LocationData {
  lat: number;
  lng: number;
  name: string;
}

export interface Notification {
  id: string;
  type: 'punch-in' | 'punch-out' | 'break-in' | 'break-out' | 'task_assigned' | 'leave_approved';
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
  data?: Record<string, unknown>;
}

