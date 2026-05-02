// src/components/employee/TaskCard.tsx
import React, { useState } from 'react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../ui/select';
import { Save, X, Edit, ChevronUp, ChevronDown } from 'lucide-react';
import TaskComments from './TaskComments';
import TaskAttachments from './TaskAttachments';
import TimeTracker from './TimeTracker';
import TaskUpdateHistory from './TaskUpdateHistory';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../../ui/collapsible';

// This interface MUST match TaskAttachments' Attachment interface exactly
interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedBy: string;
  uploadedById: string;
}

// Local types from ProjectCard
interface LocalComment {
  id: string;
  text: string;
  createdAt: string;
  createdBy: string;
}

interface LocalAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedById: string;
  uploadedAt: string;
}

interface LocalUpdate {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
  updatedBy: string;
  updatedAt: string;
  timestamp: string;
  changes: { field: string; oldValue: unknown; newValue: unknown; }[];
}

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    description?: string;
    assignedTo?: string;
    dueDate?: string;
    status: string;
    comments: LocalComment[];
    attachments: LocalAttachment[];
    totalTimeSpentMs?: number;
    updates?: LocalUpdate[];
  };
  projectId: string;
  isTeamLead: boolean;
  currentUserId: string;
  employeesList: { id: string; name: string }[];
  onStatusUpdate: (projectId: string, taskId: string, newStatus: string) => Promise<void>;
  onAddComment: (projectId: string, taskId: string, text: string, mentions: string[]) => Promise<void>;
  onUploadAttachment: (projectId: string, taskId: string, attachment: LocalAttachment) => Promise<void>;
  onDeleteAttachment: (projectId: string, taskId: string, attachmentId: string, url: string) => Promise<void>;
  onTimeLogged: () => void;
}

// Convert LocalAttachment → Attachment (add uploadedBy, drop uploadedAt)
function toAttachment(local: LocalAttachment): Attachment {
  return {
    id: local.id,
    name: local.name,
    url: local.url,
    size: local.size,
    type: local.type,
    uploadedBy: local.uploadedById,
    uploadedById: local.uploadedById,
  };
}

// Convert Attachment → LocalAttachment (add uploadedAt placeholder)
function toLocalAttachment(att: Attachment): LocalAttachment {
  return {
    id: att.id,
    name: att.name,
    url: att.url,
    size: att.size,
    type: att.type,
    uploadedById: att.uploadedById,
    uploadedAt: new Date().toISOString(),
  };
}

const getAssignedName = (id: string | undefined, list: { id: string; name: string }[]) =>
  id ? list.find(e => e.id === id)?.name || id : 'Unassigned';

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

  const canEdit = isTeamLead || task.assignedTo === currentUserId;
  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString() : '';
  const assignedToName = getAssignedName(task.assignedTo, employeesList);

  const getStatusColor = (status: string) => {
    if (status === 'completed') return 'bg-green-100 text-green-700';
    if (status === 'in_progress') return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
  };

  const handleSaveStatus = async () => {
    await onStatusUpdate(projectId, task.id, newStatus);
    setEditingStatus(false);
  };

  const attachmentsForTaskAttachments = task.attachments.map(toAttachment);
  const handleUploadComplete = (att: Attachment) => {
    const localAtt = toLocalAttachment(att);
    onUploadAttachment(projectId, task.id, localAtt);
  };

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
          <span className="font-medium">Assigned to:</span> {assignedToName}
        </div>
      )}

      <div className="border-t pt-3">
        {canEdit ? (
          editingStatus ? (
            <div className="flex gap-2">
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleSaveStatus}>
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

      <TaskAttachments
        projectId={projectId}
        taskId={task.id}
        attachments={attachmentsForTaskAttachments}
        canUpload={canEdit}
        onUploadComplete={handleUploadComplete}
        onDeleteComplete={(attId) => onDeleteAttachment(projectId, task.id, attId, '')}
      />

      <TimeTracker
        projectId={projectId}
        taskId={task.id}
        currentTotalMs={task.totalTimeSpentMs}
        onTimeLogged={onTimeLogged}
      />

      {task.updates && task.updates.length > 0 && (
        <TaskUpdateHistory updates={task.updates} />
      )}

      <TaskComments
        comments={task.comments}
        employeesList={employeesList}
        onAddComment={(text, mentions) => onAddComment(projectId, task.id, text, mentions)}
      />

      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {expanded ? 'Show less' : 'Show more'}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent />
      </Collapsible>
    </div>
  );
};

export default TaskCard;