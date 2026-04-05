
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'employee' | 'team_leader';
  department: string;
  designation: string;
  employeeId: string;
  isActive: boolean;
  phone?: string;
  profileImage?: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'text' | 'image' | 'video';
  timestamp: Date;
  edited?: boolean;
  deleted?: boolean;
  status: 'sent' | 'delivered' | 'read';
}

export interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage?: Message;
  updatedAt: Date;
}
