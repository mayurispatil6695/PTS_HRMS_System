
export interface Project {
  id: string;
  name: string;
  description: string;
  department: string;
  assignedTeamLeader?: string;
  assignedEmployees: string[];
  tasks?: Task[]; // ✅ FIXED
  startDate: string;
  endDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
 status: 'not_started' | 'in_progress' | 'on_hold' | 'completed' | 'active'; 
  progress: number;
  createdAt: string;
  createdBy: string;
  lastUpdated?: string;
  updates?: ProjectUpdate[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  createdAt: string;
  completedAt?: string;
}

export interface ProjectUpdate {
  id: string;
  note: string;
  progress: number;
  updatedBy: string;
  updatedAt: string;
}
