// src/types/project.ts

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'review' | 'completed';
  createdAt: string;
  updatedAt?: string;
  dependsOn?: string[];
  achievementSummary?: string;
  comments?: Record<string, Comment>;
  attachments?: Record<string, Attachment>;
  totalTimeSpentMs?: number;
}

export interface Comment {
  id?: string;
  text: string;
  createdAt: string;
  createdBy: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface ProjectUpdate {
  id: string;
  note: string;
  progress: number;
  updatedBy: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  department: string;
  assignedTeamLeader?: string;
  assignedEmployees: string[];
  
  startDate: string;
  endDate: string;
  priority: Task['priority'];
  status: 'not_started' | 'in_progress' | 'on_hold' | 'completed' | 'active';
  progress: number;
  createdAt: string;
  createdBy: string;
  lastUpdated?: string;
  updates?: ProjectUpdate[];
  projectType?: string;
  specificDepartment?: string;
  clientId?: string;
  tasks?: Record<string, Task>; 
}