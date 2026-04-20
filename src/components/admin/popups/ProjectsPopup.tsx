import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { FolderOpen, Calendar, Users, CheckCircle, PauseCircle, PlayCircle, ChevronDown, ChevronUp, Clock, User } from 'lucide-react';
import { Progress } from '../../ui/progress';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../../ui/collapsible';
import { Project } from '@/types/project';

interface Employee {
  id: string;
  name: string;
  department: string;
  designation: string;
  isActive: boolean;
}

interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  dueDate: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

interface ProjectsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  employees?: Employee[];
}

const ProjectsPopup: React.FC<ProjectsPopupProps> = ({
  isOpen,
  onClose,
  projects = [],
  employees = [],
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed' | 'paused'>('all');
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});

  // Memoize filtered projects
  const filteredProjects = useMemo(() => {
    if (activeTab === 'all') return projects;
    return projects.filter((project) => {
      if (activeTab === 'active') return project.status === 'in_progress' || project.status === 'active';
      if (activeTab === 'paused') return project.status === 'on_hold';
      if (activeTab === 'completed') return project.status === 'completed';
      return true;
    });
  }, [projects, activeTab]);

  const toggleProjectExpand = (projectId: string) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'in_progress':
      case 'active': return 'bg-blue-100 text-blue-700';
      case 'on_hold':
      case 'paused': return 'bg-yellow-100 text-yellow-700';
      case 'not_started': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in_progress':
      case 'active': return <PlayCircle className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'on_hold':
      case 'paused': return <PauseCircle className="h-4 w-4" />;
      default: return <FolderOpen className="h-4 w-4" />;
    }
  };

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getEmployeeName = (employeeId: string): string => {
    const employee = employees.find((emp) => emp.id === employeeId);
    return employee?.name || 'Unknown';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Projects Overview ({projects.length})
          </DialogTitle>
        </DialogHeader>

        {/* Tab buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            key="tab-all"
            variant={activeTab === 'all' ? 'default' : 'outline'}
            onClick={() => setActiveTab('all')}
            className="flex items-center gap-1"
          >
            All ({projects.length})
          </Button>
          <Button
            key="tab-active"
            variant={activeTab === 'active' ? 'default' : 'outline'}
            onClick={() => setActiveTab('active')}
            className="flex items-center gap-1"
          >
            <PlayCircle className="h-4 w-4" />
            Active ({projects.filter(p => p.status === 'in_progress' || p.status === 'active').length})
          </Button>
          <Button
            key="tab-completed"
            variant={activeTab === 'completed' ? 'default' : 'outline'}
            onClick={() => setActiveTab('completed')}
            className="flex items-center gap-1"
          >
            <CheckCircle className="h-4 w-4" />
            Completed ({projects.filter((p) => p.status === 'completed').length})
          </Button>
          <Button
            key="tab-paused"
            variant={activeTab === 'paused' ? 'default' : 'outline'}
            onClick={() => setActiveTab('paused')}
            className="flex items-center gap-1"
          >
            <PauseCircle className="h-4 w-4" />
            Paused ({projects.filter((p) => p.status === 'on_hold').length})
          </Button>
        </div>

        {/* Projects list */}
        <div className="space-y-4">
          {filteredProjects.map((project, projectIndex) => {
            // Compute task data
            const tasksArray = project.tasks ? Object.values(project.tasks) : [];
            const completedTasksCount = tasksArray.filter((t) => t.status === 'completed').length;
            const totalTasksCount = tasksArray.length;
            const progress = totalTasksCount === 0 ? 0 : Math.round((completedTasksCount / totalTasksCount) * 100);

            const tasksByEmployee: Record<string, Task[]> = {};
            tasksArray.forEach((task) => {
              if (!tasksByEmployee[task.assignedTo]) {
                tasksByEmployee[task.assignedTo] = [];
              }
              tasksByEmployee[task.assignedTo].push(task);
            });

            const assignedEmployeesNames = project.assignedEmployees
              .map((empId) => getEmployeeName(empId))
              .filter((name) => name !== 'Unknown');
            const teamLeaderName = getEmployeeName(project.assignedTeamLeader);

            // Use a unique key: project.id + index as fallback
            const projectKey = project.id ? `${project.id}-${projectIndex}` : `project-${projectIndex}`;

            return (
              <div
                key={projectKey}
                className="border rounded-xl p-4 shadow-sm hover:shadow-lg transition-all duration-200 bg-white"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg text-gray-900">{project.name}</h3>
                      <Badge className={getPriorityColor(project.priority)}>
                        {project.priority}
                      </Badge>
                      <Badge className={getStatusColor(project.status)}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(project.status)}
                          {project.status.replace('_', ' ')}
                        </div>
                      </Badge>
                    </div>

                    <p className="text-gray-600 mb-3">{project.description}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">
                          Start: {formatDisplayDate(project.startDate)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">
                          End: {formatDisplayDate(project.endDate)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">
                          Team: {teamLeaderName || 'Unassigned'}
                          {assignedEmployeesNames.length > 0 && ` + ${assignedEmployeesNames.length}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">
                          Tasks: {completedTasksCount}/{totalTasksCount}
                        </span>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">Progress</span>
                        <span className="text-sm text-gray-600">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => toggleProjectExpand(project.id)}
                  >
                    {expandedProjects[project.id] ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <Collapsible open={expandedProjects[project.id]}>
                  <CollapsibleContent className="mt-4 space-y-4 border-t pt-4">
                    {Object.entries(tasksByEmployee).map(([empId, tasks], empIndex) => {
                      const employeeName = getEmployeeName(empId);
                      const completed = tasks.filter((t) => t.status === 'completed').length;

                      return (
                        <div key={`${empId}-${empIndex}`} className="space-y-2">
                          <div className="flex items-center gap-2 pl-2">
                            <User className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium">{employeeName}:</span>
                            <span className="text-xs">
                              {completed} / {tasks.length} completed
                            </span>
                          </div>

                          <div className="pl-6 space-y-2">
                            {tasks.map((task) => (
                              <div key={task.id} className="border rounded p-2">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <h4 className="text-sm font-medium">{task.title}</h4>
                                    {task.description && (
                                      <p className="text-xs text-gray-500">{task.description}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Badge className={getPriorityColor(task.priority)}>
                                      {task.priority}
                                    </Badge>
                                    <Badge className={getStatusColor(task.status)}>
                                      {task.status.replace('_', ' ')}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="mt-2 flex items-center gap-2 text-xs">
                                  <span>Due: {formatDisplayDate(task.dueDate)}</span>
                                  <span>Created: {formatDisplayDate(task.createdAt)}</span>
                                  {task.updatedAt && (
                                    <span>Updated: {formatDisplayDate(task.updatedAt)}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {Object.keys(tasksByEmployee).length === 0 && (
                      <div className="text-center py-4 text-sm text-gray-500">
                        No tasks assigned yet
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })}

          {filteredProjects.length === 0 && (
            <div className="text-center py-10">
              <FolderOpen className="h-10 w-10 mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500">No projects found in this category</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectsPopup;