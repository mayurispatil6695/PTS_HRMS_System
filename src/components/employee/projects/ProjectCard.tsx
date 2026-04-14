// src/components/employee/ProjectCard.tsx
import React, { useState } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Progress } from '../../ui/progress';
import { Button } from '../../ui/button';
import { Users, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../../ui/collapsible';
import TaskCard from './TaskCard';

interface Project {
  id: string;
  name: string;
  description?: string;
  department: string;
  priority: string;
  status: string;
  startDate?: string;
  endDate?: string;
  progress: number;
  tasks: any[];
  assignedTeamLeader?: string;
  assignedEmployees?: string[];
}

interface ProjectCardProps {
  project: Project;
  isTeamLead: boolean;
  currentUserId: string;
  employeesMap: Record<string, { name: string }>;
  employeesList: { id: string; name: string }[];
  onStatusUpdate: (projectId: string, taskId: string, newStatus: string) => Promise<void>;
  onAddComment: (projectId: string, taskId: string, text: string, mentions: string[]) => Promise<void>;
  onUploadAttachment: (projectId: string, taskId: string, file: File) => Promise<void>;
  onDeleteAttachment: (projectId: string, taskId: string, attachmentId: string, url: string) => Promise<void>;
  onTimeLogged: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
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
}) => {
  const [expanded, setExpanded] = useState(false);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-blue-100 text-blue-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'urgent': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'in_progress': return 'bg-blue-100 text-blue-700';
      case 'on_hold': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateStr?: string) => dateStr ? new Date(dateStr).toLocaleDateString() : 'Not set';

  const teamMembers = isTeamLead && project.assignedEmployees
    ? project.assignedEmployees.map(empId => ({ id: empId, name: employeesMap[empId]?.name || 'Unknown' }))
    : [];

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex justify-between items-start">
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
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Users className="h-4 w-4" /> Team Members ({teamMembers.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {teamMembers.map(member => (
                <Badge key={member.id} variant="outline" className="bg-white">{member.name}</Badge>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span>{project.progress}%</span>
          </div>
          <Progress value={project.progress} />
        </div>

        {Object.values(project.tasks).length > 0 && (
          <div className="border-t pt-3">
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between" onClick={() => setExpanded(!expanded)}>
                  <span>Tasks ({Object.values(project.tasks).length})</span>
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4 space-y-4">
                {Object.values(project.tasks).map((task: any) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    projectId={project.id}
                    isTeamLead={isTeamLead}
                    currentUserId={currentUserId}
                    employeesList={employeesList}
                    onStatusUpdate={(taskId, status) => onStatusUpdate(project.id, taskId, status)}
                    onAddComment={(taskId, text, mentions) => onAddComment(project.id, taskId, text, mentions)}
                    onUploadAttachment={(taskId, file) => onUploadAttachment(project.id, taskId, file)}
                    onDeleteAttachment={(taskId, attId, url) => onDeleteAttachment(project.id, taskId, attId, url)}
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
};

export default ProjectCard;