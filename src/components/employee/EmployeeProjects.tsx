import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FolderOpen, Calendar, Target, MessageSquare,
  CheckCircle, AlertCircle, Clock, ChevronDown, ChevronUp,
  ChevronRight, Save, X,
  Edit, Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Textarea } from '../ui/textarea';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, onValue, update, push, set, get } from 'firebase/database';
import { toast } from 'react-hot-toast';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

type FirebaseProject = Partial<Project> & {
  progress?: number;
  tasks?: Record<string, Task>;
};

interface Project {
  id: string;
  name: string;
  description: string;
  department: string;
  startDate: string;
  endDate: string;
  priority: string;
  status: string;
  progress: number;
  tasks: Record<string, Task>;
  assignedTeamLeader?: string;
  assignedEmployees?: string[];
}

type TaskUpdateValue = string | number | boolean | null;

interface TaskUpdate {
  timestamp: string; // ISO string (for UI)
  updatedBy: string;
  updatedById: string;
  updatedByRole?: 'admin' | 'team_lead' | 'employee';
  changes: {
    field: string;
    oldValue: TaskUpdateValue;
    newValue: TaskUpdateValue;
  }[];
  note?: string;
}
interface Comment {
  text: string;
  createdAt: string;
  createdBy: string;
  createdById: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  dueDate: string;
  priority: string;
  status: string;
  assignedTo?: string;
  assignedToName?: string;
  updates?: Record<string, TaskUpdate>;
  comments?: Record<string, Comment>;
  createdAt?: string;   // ✅ add this
  updatedAt?: string;   // ✅ add this
}

interface Employee {
  id: string;
  name: string;
  email: string;
  designation: string;
}

const EmployeeProjects = () => {
  const { user } = useAuth();
  const [isTeamLead, setIsTeamLead] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Record<string, Employee>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newTaskStatus, setNewTaskStatus] = useState<string>('');
  const [taskComment, setTaskComment] = useState<string>('');

  useEffect(() => {
    if (!user?.adminUid || !user?.id) return;

    const employeeRef = ref(database, `users/${user.adminUid}/employees/${user.id}`);
    onValue(employeeRef, (snapshot) => {
      const data = snapshot.val();
      setIsTeamLead(data?.designation === 'Team Lead');
    });
  }, [user]);

  useEffect(() => {
    if (!user?.adminUid) return;

    // Load all employees for team lead to see who tasks are assigned to
    const employeesRef = ref(database, `users/${user.adminUid}/employees`);
    const unsubscribeEmployees = onValue(employeesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setEmployees(data);
      }
    });

    return () => unsubscribeEmployees();
  }, [user?.adminUid]);

  useEffect(() => {
    if (!user?.id || !user?.adminUid) {
      setLoading(false);
      return;
    }

    if (isTeamLead) {
      // For team leads, fetch only projects where they are assigned as team lead
      const projectsRef = ref(database, `users/${user.adminUid}/projects`);
      const unsubscribeProjects = onValue(projectsRef, (snapshot) => {
        try {
          const data = snapshot.val();
          if (data) {
           const allProjects: Project[] = Object.entries(data).map(([key, value]) => {
  const project = value as FirebaseProject;

  return {
    id: key,
    name: project.name || '',
    description: project.description || '',
    department: project.department || '',
    startDate: project.startDate || '',
    endDate: project.endDate || '',
    priority: project.priority || 'low',
    status: project.status || 'not_started',
    progress: Number(project.progress ?? 0),
    tasks: project.tasks || {},
    assignedTeamLeader: project.assignedTeamLeader,
    assignedEmployees: project.assignedEmployees || []
  };
});

            // Filter projects where this team lead is assigned
            const teamLeadProjects = allProjects.filter(
              project => project.assignedTeamLeader === user.id
            );

            // Enhance tasks with assigned employee names
            const enhancedProjects = teamLeadProjects.map(project => {
              const enhancedTasks: Record<string, Task> = {};

              if (project.tasks) {
                Object.entries(project.tasks).forEach(([taskId, task]) => {
                  enhancedTasks[taskId] = {
                    ...task,
                    assignedToName: task.assignedTo && employees[task.assignedTo]
                      ? employees[task.assignedTo].name
                      : 'Unassigned'
                  };
                });
              }

              return {
                ...project,
                tasks: enhancedTasks
              };
            });

            setProjects(enhancedProjects);
          } else {
            setProjects([]);
          }
          setLoading(false);
        } catch (error) {
          console.error("Error loading data:", error);
          toast.error("Failed to load projects");
          setLoading(false);
        }
      }, (error) => {
        console.error("Error setting up listener:", error);
        toast.error("Failed to load projects");
        setLoading(false);
      });

      return () => unsubscribeProjects();
    } else {
      // For regular employees, get their assigned projects
  // For regular employees, fetch from admin projects (source of truth)
const projectsRef = ref(database, `users/${user.adminUid}/projects`);

const unsubscribeProjects = onValue(
  projectsRef,
  (snapshot) => {
    try {
      const data = snapshot.val();

      if (data) {
        const allProjects: Project[] = [];

        Object.entries(data).forEach(([key, value]) => {
          if (!value) return;

          const project = value as FirebaseProject;

          // ✅ filter only projects where employee is assigned
          if (!project.assignedEmployees?.includes(user.id)) return;

          allProjects.push({
            id: key,
            name: project.name || '',
            description: project.description || '',
            department: project.department || '',
            startDate: project.startDate || '',
            endDate: project.endDate || '',
            priority: project.priority || 'low',
            status: project.status || 'not_started',
            progress: Number(project.progress ?? 0),
            tasks: project.tasks || {},
            assignedTeamLeader: project.assignedTeamLeader,
            assignedEmployees: project.assignedEmployees || []
          });
        });

        setProjects(allProjects);
      } else {
        setProjects([]);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load projects");
      setLoading(false);
    }
  },
  (error) => {
    console.error("Error setting up listener:", error);
    toast.error("Failed to load projects");
    setLoading(false);
  }
);

      return () => unsubscribeProjects();
    }
  }, [user, isTeamLead, employees]);

  const updateTaskStatus = async (projectId: string, taskId: string) => {
    if (!user?.id || !user?.adminUid || !newTaskStatus) return;

    try {
      const timestamp = Date.now().toString(); // Firebase key
      const isoTime = new Date().toISOString(); // actual readable time
      const changes = [{
        field: 'status',
        oldValue: projects.find(p => p.id === projectId)?.tasks[taskId]?.status || '',
        newValue: newTaskStatus
      }];

      const updateData: TaskUpdate = {
        timestamp: isoTime, // ✅ use ISO here
        updatedBy: user.name || (isTeamLead ? 'Team Lead' : 'Employee'),
        updatedById: user.id,
        updatedByRole: isTeamLead ? 'team_lead' : 'employee', // optional but recommended
        changes,
        note: `Status updated by ${isTeamLead ? 'Team Lead' : 'Employee'}`
      };
      // First update the task in admin's project
      const adminUpdates = {
        [`tasks/${taskId}/status`]: newTaskStatus,
        [`tasks/${taskId}/updatedAt`]: new Date().toISOString(),
        [`tasks/${taskId}/updates/${timestamp}`]: updateData
      };

      await update(
        ref(database, `users/${user.adminUid}/projects/${projectId}`),
        adminUpdates
      );

      // Get the task to find out who it's assigned to
      const taskRef = ref(database, `users/${user.adminUid}/projects/${projectId}/tasks/${taskId}`);
      const taskSnapshot = await get(taskRef);
      const taskData = taskSnapshot.val();

      if (isTeamLead) {
        // If team lead is updating, only update the assigned employee's task
        if (taskData.assignedTo) {
          const employeeUpdates = {
            [`tasks/${taskId}/status`]: newTaskStatus,
            [`tasks/${taskId}/updatedAt`]: new Date().toISOString(),
            [`tasks/${taskId}/updates/${timestamp}`]: updateData
          };

          await update(
            ref(database, `users/${user.adminUid}/employees/${taskData.assignedTo}/projects/${projectId}`),
            employeeUpdates
          );
        }
      } else {
        // If regular employee is updating, update their own task
        const employeeUpdates = {
          [`tasks/${taskId}/status`]: newTaskStatus,
          [`tasks/${taskId}/updatedAt`]: new Date().toISOString(),
          [`tasks/${taskId}/updates/${timestamp}`]: updateData
        };

        await update(
          ref(database, `users/${user.adminUid}/employees/${user.id}/projects/${projectId}`),
          employeeUpdates
        );
      }

      // Update local state
      setProjects(prev =>
        prev.map(p => {
          if (p.id !== projectId) return p;

          const updatedTasks = { ...p.tasks };
          updatedTasks[taskId] = {
            ...updatedTasks[taskId],
            status: newTaskStatus,
            updatedAt: new Date().toISOString(),
            updates: {
              ...(updatedTasks[taskId].updates || {}),
              [timestamp]: updateData
            }
          };

          return {
            ...p,
            tasks: updatedTasks
          };
        })
      );

      toast.success("Task status updated");
      setEditingTaskId(null);
      setNewTaskStatus('');
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task status");
    }
  };

  const addTaskComment = async (projectId: string, taskId: string) => {
    if (!user?.id || !user?.adminUid || !taskComment.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    try {
      const timestamp = Date.now().toString();
      const commentData = {
        text: taskComment,
        createdAt: new Date().toISOString(),
        createdBy: user.name || (isTeamLead ? 'Team Lead' : 'Employee'),
        createdById: user.id
      };

      // First add to admin's project
      const adminCommentRef = ref(
        database,
        `users/${user.adminUid}/projects/${projectId}/tasks/${taskId}/comments/${timestamp}`
      );
      await set(adminCommentRef, commentData);

      // Get the task to find out who it's assigned to
      const taskRef = ref(database, `users/${user.adminUid}/projects/${projectId}/tasks/${taskId}`);
      const taskSnapshot = await get(taskRef);
      const taskData = taskSnapshot.val();

      if (isTeamLead) {
        // If team lead is commenting, only add to the assigned employee's task
        if (taskData.assignedTo) {
          const employeeCommentRef = ref(
            database,
            `users/${user.adminUid}/employees/${taskData.assignedTo}/projects/${projectId}/tasks/${taskId}/comments/${timestamp}`
          );
          await set(employeeCommentRef, commentData);
        }
      } else {
        // If regular employee is commenting, add to their own task
        const employeeCommentRef = ref(
          database,
          `users/${user.adminUid}/employees/${user.id}/projects/${projectId}/tasks/${taskId}/comments/${timestamp}`
        );
        await set(employeeCommentRef, commentData);
      }

      // Update local state
      setProjects(prev =>
        prev.map(p => {
          if (p.id !== projectId) return p;

          const updatedTasks = { ...p.tasks };
          if (!updatedTasks[taskId].comments) {
            updatedTasks[taskId].comments = {};
          }
          updatedTasks[taskId].comments[timestamp] = commentData;

          return {
            ...p,
            tasks: updatedTasks
          };
        })
      );

      toast.success("Comment added successfully");
      setTaskComment('');
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    }
  };

  const toggleProjectExpand = (projectId: string) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

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
      case 'not_started': return 'bg-gray-100 text-gray-700';
      case 'in_progress': return 'bg-blue-100 text-blue-700';
      case 'on_hold': return 'bg-yellow-100 text-yellow-700';
      case 'completed': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'not_started': return 'bg-gray-100 text-gray-700';
      case 'in_progress': return 'bg-blue-100 text-blue-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'overdue': return 'bg-red-100 text-red-700';
      case 'pending': return 'bg-purple-100 text-purple-700';
      case 'having_issue': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isTaskOverdue = (dueDate: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isTeamLead ? 'Team Projects' : 'My Projects'}
          </h1>
          <p className="text-gray-600">
            {isTeamLead ? 'View and manage your team projects' : 'View and update your assigned projects and tasks'}
          </p>
        </div>
      </motion.div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {isTeamLead ? 'No team projects assigned' : 'No projects assigned'}
            </h3>
            <p className="mt-1 text-gray-500">
              {isTeamLead ? 'You are not assigned as team lead for any projects' : 'You don\'t have any projects assigned to you yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => {
            const tasksArray = Object.values(project.tasks);
            const completedTasksCount = tasksArray.filter(task => task.status === 'completed').length;
            const totalTasksCount = tasksArray.length;
            const progress = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

            // Get team members for this project if team lead
            const teamMembers = isTeamLead && project.assignedEmployees
              ? project.assignedEmployees.map(employeeId => ({
                id: employeeId,
                name: employees[employeeId]?.name || 'Unknown',
                email: employees[employeeId]?.email || ''
              }))
              : [];

            return (
              <Card key={project.id}>
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold">{project.name}</h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge className={getPriorityColor(project.priority)}>
                          {project.priority} priority
                        </Badge>
                        <Badge className={getStatusColor(project.status)}>
                          {project.status.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline">
                          {project.department}
                        </Badge>
                        {isTeamLead && (
                          <Badge variant="outline" className="bg-purple-100 text-purple-700">
                            Team Lead
                          </Badge>
                        )}
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
                        <Users className="h-4 w-4" />
                        Team Members ({teamMembers.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {teamMembers.map(member => (
                          <Badge key={member.id} variant="outline" className="bg-white">
                            {member.name} ({member.email})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Overall Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>

                  {tasksArray.length > 0 && (
                    <div className="border-t pt-3">
                      <Collapsible>
                        <CollapsibleTrigger
                          className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-md"
                          onClick={() => toggleProjectExpand(project.id)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Tasks ({tasksArray.length})</span>
                          </div>
                          {expandedProjects[project.id] ?
                            <ChevronUp className="h-4 w-4" /> :
                            <ChevronDown className="h-4 w-4" />
                          }
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2">
                          <div className="space-y-4">
                            {tasksArray.map(task => {
                              const status = isTaskOverdue(task.dueDate) && task.status !== 'completed' ?
                                'overdue' : task.status || 'not_started';
                              const taskUpdates = task.updates
                                ? Object.entries(task.updates)
                                  .sort(([a], [b]) => parseInt(b) - parseInt(a))
                                  .map(([timestamp, update]) => ({ timestamp, ...update }))
                                : [];
                              const comments = task.comments
                                ? Object.entries(task.comments)
                                  .sort(([a], [b]) => parseInt(b) - parseInt(a))
                                  .map(([timestamp, comment]) => ({ timestamp, ...comment }))
                                : [];

                              return (
                                <div key={task.id} className="border rounded-lg p-4 space-y-3">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <h4 className="font-medium">{task.title || 'Untitled Task'}</h4>
                                      {task.description && (
                                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge className={getTaskStatusColor(status)}>
                                        {status.replace('_', ' ')}
                                      </Badge>
                                      <div className="text-right text-sm text-gray-500">
                                        {task.dueDate && (
                                          <>
                                            <div>Due: {formatDate(task.dueDate)}</div>
                                            <div>{formatTime(task.dueDate)}</div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {isTeamLead && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="font-medium">Assigned to:</span>
                                      <Badge variant="outline">
                                        {task.assignedToName || 'Unassigned'}
                                      </Badge>
                                    </div>
                                  )}

                                  <div className="border-t pt-3">
                                    {editingTaskId === task.id ? (
                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                          <Select
                                            value={newTaskStatus || task.status}
                                            onValueChange={(value) => setNewTaskStatus(value)}
                                          >
                                            <SelectTrigger className="w-[180px]">
                                              <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="not_started">Not Started</SelectItem>
                                              <SelectItem value="in_progress">In Progress</SelectItem>
                                              <SelectItem value="completed">Completed</SelectItem>
                                              <SelectItem value="pending">Pending</SelectItem>
                                              <SelectItem value="having_issue">Having Issue</SelectItem>
                                            </SelectContent>
                                          </Select>
                                          <Button
                                            size="sm"
                                            onClick={() => updateTaskStatus(project.id, task.id)}
                                          >
                                            <Save className="h-4 w-4 mr-1" />
                                            Save
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              setEditingTaskId(null);
                                              setNewTaskStatus('');
                                            }}
                                          >
                                            <X className="h-4 w-4 mr-1" />
                                            Cancel
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setEditingTaskId(task.id);
                                          setNewTaskStatus(task.status || 'not_started');
                                        }}
                                      >
                                        <Edit className="h-4 w-4 mr-1" />
                                        Update Status
                                      </Button>
                                    )}
                                  </div>

                                  {/* Task Updates */}
                                  {taskUpdates.length > 0 && (
                                    <div className="border-t pt-3">
                                      <h4 className="text-sm font-medium mb-2">Update History</h4>
                                      <div className="space-y-2">
                                        {taskUpdates.map((update, idx) => (
                                          <div key={idx} className="text-xs bg-gray-50 p-2 rounded">
                                            <div className="flex justify-between">
                                              <span className="font-medium">
                                                {update.updatedByRole === 'admin'
                                                  ? 'Admin'
                                                  : update.updatedByRole === 'team_lead'
                                                    ? 'Team Lead'
                                                    : update.updatedBy}
                                              </span>
                                              <span className="text-gray-500">{formatDate(update.timestamp)} {formatTime(update.timestamp)}</span>
                                            </div>
                                            <div className="mt-1">
                                              {update.changes.map((change, i) => (
                                                <p key={i}>
                                                  Changed <span className="font-medium">{change.field}</span> from
                                                  <span className="italic"> "{change.oldValue}"</span> to
                                                  <span className="font-medium"> "{change.newValue}"</span>
                                                </p>
                                              ))}
                                            </div>
                                            {update.note && (
                                              <p className="mt-1 italic">Note: "{update.note}"</p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Task Comments */}
                                  <div className="border-t pt-3">
                                    <h4 className="text-sm font-medium mb-2">Comments</h4>
                                    <div className="space-y-3">
                                      {comments.map((comment, idx) => (
                                        <div key={idx} className="text-sm bg-gray-50 p-3 rounded-lg">
                                          <p className="text-gray-700">{comment.text}</p>
                                          <p className="text-xs text-gray-500 mt-1">
                                            {comment.createdBy} • {formatDate(comment.createdAt)} • {formatTime(comment.createdAt)}
                                          </p>
                                        </div>
                                      ))}
                                      <div className="space-y-2">
                                        <Textarea
                                          placeholder="Add a comment..."
                                          value={taskComment}
                                          onChange={(e) => setTaskComment(e.target.value)}
                                        />
                                        <Button
                                          size="sm"
                                          onClick={() => addTaskComment(project.id, task.id)}
                                        >
                                          <MessageSquare className="h-4 w-4 mr-1" />
                                          Add Comment
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmployeeProjects;