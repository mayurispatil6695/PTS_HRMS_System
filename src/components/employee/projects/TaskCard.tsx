// src/components/employee/TaskCard.tsx
import React, { useState } from 'react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../ui/select';
import { Save, X, Edit, ChevronUp, ChevronDown } from 'lucide-react';
import TaskComments from './TaskComments';
import TaskAttachments from './TaskAttachments';
import TimeTracker from './TimeTracker'
import TaskUpdateHistory from './TaskUpdateHistory';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../../ui/collapsible';

interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  status: string;
  assignedToName?: string;
  assignedTo?: string;
  comments?: any[];
  attachments?: any[];
  updates?: any[];
  totalTimeSpentMs?: number;
  timeLogs?: any;
}

interface TaskCardProps {
  task: Task;
  projectId: string;
  isTeamLead: boolean;
  currentUserId: string;
  employeesList: { id: string; name: string }[];
  onStatusUpdate: (taskId: string, newStatus: string) => Promise<void>;
  onAddComment: (taskId: string, text: string, mentions: string[]) => Promise<void>;
  onUploadAttachment: (taskId: string, file: File) => Promise<void>;
  onDeleteAttachment: (taskId: string, attachmentId: string, url: string) => Promise<void>;
  onTimeLogged: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  projectId,
  isTeamLead,
  currentUserId,
  employeesList,
  onStatusUpdate,
  onAddComment,
  onUploadAttachment,
  onDeleteAttachment,
  onTimeLogged,
}) => {
  const [editingStatus, setEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState(task.status);
  const [expanded, setExpanded] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'in_progress': return 'bg-yellow-100 text-yellow-700';
      case 'overdue': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const canEdit = isTeamLead || task.assignedTo === currentUserId;

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString();

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-medium">{task.title || 'Untitled Task'}</h4>
          {task.description && <p className="text-sm text-gray-600 mt-1">{task.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(task.status)}>{task.status.replace('_', ' ')}</Badge>
          {task.dueDate && <span className="text-xs text-gray-500">Due: {formatDate(task.dueDate)}</span>}
        </div>
      </div>

      {isTeamLead && (
        <div className="text-sm">
          <span className="font-medium">Assigned to:</span> {task.assignedToName || 'Unassigned'}
        </div>
      )}

      {/* Status update */}
      <div className="border-t pt-3">
        {canEdit ? (
          editingStatus ? (
            <div className="flex gap-2">
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="having_issue">Having Issue</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={async () => { await onStatusUpdate(task.id, newStatus); setEditingStatus(false); }}>
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditingStatus(false)}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditingStatus(true)}>
              <Edit className="h-4 w-4 mr-1" /> Update Status
            </Button>
          )
        ) : (
          <div className="text-xs text-gray-400">Only assigned employee can update</div>
        )}
      </div>

      {/* Attachments */}
      <TaskAttachments
        projectId={projectId}
        taskId={task.id}
        attachments={task.attachments || []}
        canUpload={canEdit}
        onUploadComplete={(att) => onUploadAttachment(task.id, att as any)}
        onDeleteComplete={(attId) => onDeleteAttachment(task.id, attId, '')}
      />

      {/* Time Tracking */}
      <TimeTracker
        projectId={projectId}
        taskId={task.id}
        currentTotalMs={task.totalTimeSpentMs}
        onTimeLogged={onTimeLogged}
      />

      {/* Update History */}
      <TaskUpdateHistory updates={task.updates || []} />

      {/* Comments */}
      <TaskComments
        comments={task.comments || []}
        employeesList={employeesList}
        onAddComment={(text, mentions) => onAddComment(task.id, text, mentions)}
      />

      {/* Expand/Collapse (if needed) */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {expanded ? 'Show less' : 'Show more'}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {/* Any extra details */}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default TaskCard;