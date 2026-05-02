// src/components/employee/ProjectCard.tsx
import React, { useState, memo } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Progress } from '../../ui/progress';
import { Button } from '../../ui/button';
import { Users, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../../ui/collapsible';
import TaskCard from './TaskCard';
import { Project as CentralProject, Attachment as CentralAttachment, Comment as CentralComment } from '@/types/project';
import { Employee } from '@/types/employee';

// Local types that match TaskCard's expectations
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

// Convert central Attachment to LocalAttachment
function toLocalAttachment(att: CentralAttachment): LocalAttachment {
  return {
    id: att.id,
    name: att.name,
    url: att.url,
    size: att.size,
    type: att.type,
    uploadedById: att.uploadedBy,   // map uploadedBy → uploadedById
    uploadedAt: att.uploadedAt,
  };
}

// Convert central Comment to LocalComment
function toLocalComment(comment: CentralComment): LocalComment {
  return {
    id: comment.id ?? '',           // ensure id is always string
    text: comment.text,
    createdAt: comment.createdAt,
    createdBy: comment.createdBy,
  };
}

// Prepare a task for TaskCard – converts Record fields to arrays and the above conversions
function prepareTaskForCard(task: CentralProject['tasks'][string]) {
  const commentsArray = task.comments ? Object.values(task.comments).map(toLocalComment) : [];
  const attachmentsArray = task.attachments ? Object.values(task.attachments).map(toLocalAttachment) : [];
  // No updates in central type for now
  const updatesArray: LocalUpdate[] = [];
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    assignedTo: task.assignedTo,
    dueDate: task.dueDate,
    status: task.status,
    comments: commentsArray,
    attachments: attachmentsArray,
    totalTimeSpentMs: task.totalTimeSpentMs,
    updates: updatesArray,
  };
}

interface ProjectCardProps {
  project: CentralProject;
  isTeamLead: boolean;
  currentUserId: string;
  employeesMap: Record<string, Pick<Employee, 'name'>>;
  employeesList: Pick<Employee, 'id' | 'name'>[];
  onStatusUpdate: (projectId: string, taskId: string, newStatus: string) => Promise<void>;
  onAddComment: (projectId: string, taskId: string, text: string, mentions: string[]) => Promise<void>;
  onUploadAttachment: (projectId: string, taskId: string, attachment: CentralAttachment) => Promise<void>;
  onDeleteAttachment: (projectId: string, taskId: string, attachmentId: string, url: string) => Promise<void>;
  onTimeLogged: () => void;
}

const ProjectCard = memo(({
  project,
  isTeamLead,
  currentUserId,
  employeesMap,
  employeesList,
  onStatusUpdate,
  onAddComment,
  onUploadAttachment,
  onDeleteAttachment,
  onTimeLogged,
}: ProjectCardProps) => {
  const [expanded, setExpanded] = useState(false);

  const getPriorityColor = (p: CentralProject['priority']) => {
    const colors: Record<CentralProject['priority'], string> = {
      low: 'bg-blue-100 text-blue-700',
      medium: 'bg-yellow-100 text-yellow-700',
      high: 'bg-orange-100 text-orange-700',
      urgent: 'bg-red-100 text-red-700',
    };
    return colors[p] || 'bg-gray-100 text-gray-700';
  };

  const getStatusColor = (s: CentralProject['status']) => {
    const colors: Record<CentralProject['status'], string> = {
      not_started: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-blue-100 text-blue-700',
      on_hold: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-green-100 text-green-700',
      active: 'bg-blue-100 text-blue-700',
    };
    return colors[s] || 'bg-gray-100 text-gray-700';
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString() : 'Not set';

  const tasksArray = project.tasks ? Object.values(project.tasks) : [];
  const teamMembers = isTeamLead && project.assignedEmployees
    ? project.assignedEmployees.map(id => ({ id, name: employeesMap[id]?.name || 'Unknown' }))
    : [];

  // Convert local attachment back to central attachment for the parent callback
  const handleUploadAttachment = async (projectId: string, taskId: string, localAtt: LocalAttachment) => {
    const centralAtt: CentralAttachment = {
      id: localAtt.id,
      name: localAtt.name,
      url: localAtt.url,
      size: localAtt.size,
      type: localAtt.type,
      uploadedBy: localAtt.uploadedById,
      uploadedAt: localAtt.uploadedAt,
    };
    await onUploadAttachment(projectId, taskId, centralAtt);
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex justify-between items-start flex-wrap gap-2">
          <div>
            <h3 className="text-lg font-bold">{project.name}</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge className={getPriorityColor(project.priority)}>{project.priority} priority</Badge>
              <Badge className={getStatusColor(project.status)}>{project.status.replace('_', ' ')}</Badge>
              <Badge variant="outline">{project.department}</Badge>
              {isTeamLead && <Badge variant="outline" className="bg-purple-100 text-purple-700">Team Lead</Badge>}
            </div>
          </div>
          <div className="text-sm text-gray-500 text-right">
            {project.startDate && <div>Start: {formatDate(project.startDate)}</div>}
            {project.endDate && <div>End: {formatDate(project.endDate)}</div>}
          </div>
        </div>

        {project.description && <p className="text-gray-600">{project.description}</p>}

        {isTeamLead && teamMembers.length > 0 && (
          <div className="border rounded-lg p-3 bg-gray-50">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2"><Users className="h-4 w-4" /> Team Members ({teamMembers.length})</h4>
            <div className="flex flex-wrap gap-2">
              {teamMembers.map(m => <Badge key={m.id} variant="outline" className="bg-white">{m.name}</Badge>)}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-sm"><span>Overall Progress</span><span>{project.progress}%</span></div>
          <Progress value={project.progress} />
        </div>

        {tasksArray.length > 0 && (
          <div className="border-t pt-3">
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between" onClick={() => setExpanded(!expanded)}>
                  <span>Tasks ({tasksArray.length})</span>
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4 space-y-4">
                {tasksArray.map(task => (
                  <TaskCard
                    key={task.id}
                    task={prepareTaskForCard(task)}
                    projectId={project.id}
                    isTeamLead={isTeamLead}
                    currentUserId={currentUserId}
                    employeesList={employeesList}
                    onStatusUpdate={onStatusUpdate}
                    onAddComment={onAddComment}
                    onUploadAttachment={handleUploadAttachment}
                    onDeleteAttachment={onDeleteAttachment}
                    onTimeLogged={onTimeLogged}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

ProjectCard.displayName = 'ProjectCard';

export default ProjectCard;