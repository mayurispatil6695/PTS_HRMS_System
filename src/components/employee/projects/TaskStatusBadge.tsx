// src/components/employee/TaskStatusBadge.tsx
import React from 'react';
import { Badge } from '../../ui/badge';
import { Task } from '@/types/project';

interface TaskStatusBadgeProps {
  status: Task['status'] | string;
  className?: string;
}

const statusConfig: Record<Task['status'], { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  review: { label: 'Review', color: 'bg-purple-100 text-purple-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
};

const TaskStatusBadge: React.FC<TaskStatusBadgeProps> = ({ status, className = '' }) => {
  const config = statusConfig[status as Task['status']] || {
    label: status.replace('_', ' '),
    color: 'bg-gray-100 text-gray-700',
  };
  return (
    <Badge className={`${config.color} ${className}`}>
      {config.label}
    </Badge>
  );
};

export default React.memo(TaskStatusBadge);