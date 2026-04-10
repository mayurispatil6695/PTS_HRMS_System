import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Users, Clock, Edit, Trash2, CheckCircle, ChevronDown, ChevronUp, User, Paperclip, Play, Pause, Plus, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Progress } from '../../ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { toast } from '../../ui/use-toast';
import { ref, onValue, off, set, remove, update, get } from 'firebase/database';
import { database } from '../../../firebase';
import { useAuth } from '../../../hooks/useAuth';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../../ui/collapsible';

// Extended interfaces
interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  assignedTo?: string;
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  uploadedBy: string;
  date: string;
}

interface ExtendedTask extends Task {
  subtasks?: Subtask[];
  timeSpent?: number;
  timerActive?: boolean;
  timerStart?: number | null;
  attachments?: Attachment[];
  tags?: string[];
  mentions?: string[];
}

interface Employee {
  id: string;
  name: string;
  department: string;
  designation: string;
  isActive: boolean;
}

interface ProjectUpdate {
  timestamp: string;
  updatedBy: string;
  updatedById: string;
  changes: {
    field: string;
    oldValue: string | number | boolean;
    newValue: string | number | boolean;
  }[];
  note?: string;
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
  updates?: Record<string, ProjectUpdate>;
}

interface Project {
  id: string;
  name: string;
  description: string;
  department: string;
  assignedTeamLeader: string;
  assignedEmployees: string[];
  tasks: Record<string, ExtendedTask>;
  startDate: string;
  endDate: string;
  priority: string;
  status: string;
  projectType: string;
  specificDepartment?: string;
  createdAt: string;
  createdBy: string;
  updates?: Record<string, ProjectUpdate>;
}

interface ProjectCardProps {
  projectId: string;
  index: number;
  onEdit?: (project: Project) => void;
  onDelete?: (projectId: string) => void;
  onClick?: () => void;
}

// Type for user data when fetching employees
interface UserData {
  role?: string;
  profile?: {
    name?: string;
    department?: string;
    designation?: string;
    status?: string;
  };
  employee?: {
    name?: string;
    department?: string;
    designation?: string;
    status?: string;
  };
}

const ProjectCard: React.FC<ProjectCardProps> = ({ projectId, index, onEdit, onDelete, onClick }) => {
  const { user } = useAuth();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [updateNote, setUpdateNote] = useState('');
  const [selectedTask, setSelectedTask] = useState<ExtendedTask | null>(null);
  const [newTaskStatus, setNewTaskStatus] = useState('');
  const [showTaskDialog, setShowTaskDialog] = useState(false);

  const [editData, setEditData] = useState({
    name: '',
    description: '',
    priority: 'medium',
    status: 'not_started',
    startDate: '',
    endDate: ''
  });

  // Timer interval
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (project && project.tasks) {
      interval = setInterval(async () => {
        for (const [taskId, task] of Object.entries(project.tasks)) {
          if (task.timerActive && task.timerStart) {
            const elapsed = Math.floor((Date.now() - task.timerStart) / 1000);
            if (elapsed >= 10) {
              await update(ref(database, `projects/${projectId}/tasks/${taskId}`), {
                timeSpent: (task.timeSpent || 0) + elapsed,
                timerStart: Date.now()
              });
            }
          }
        }
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [project, projectId]);

  // Fetch all employees globally (non‑admin users) to resolve names
  useEffect(() => {
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const usersData = snapshot.val() as Record<string, UserData> | null;
      if (usersData) {
        const empList: Employee[] = [];
        for (const [uid, userData] of Object.entries(usersData)) {
          if (userData.role === 'admin') continue;
          const profile = userData.profile || userData.employee;
          if (profile && profile.name) {
            empList.push({
              id: uid,
              name: profile.name,
              department: profile.department || '',
              designation: profile.designation || '',
              isActive: profile.status === 'active'
            });
          }
        }
        setEmployees(empList);
      }
    });
    return () => off(usersRef);
  }, []);

  // Fetch project from global `/projects` node
  useEffect(() => {
    const projectRef = ref(database, `projects/${projectId}`);
    const unsubscribe = onValue(projectRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const fetchedProject: Project = {
          id: projectId,
          name: data.name || '',
          description: data.description || '',
          department: data.department || '',
          assignedTeamLeader: data.assignedTeamLeader || '',
          assignedEmployees: data.assignedEmployees || [],
          tasks: data.tasks || {},
          startDate: data.startDate || '',
          endDate: data.endDate || '',
          priority: data.priority || 'medium',
          status: data.status || 'not_started',
          projectType: data.projectType || 'common',
          specificDepartment: data.specificDepartment,
          createdAt: data.createdAt || new Date().toISOString(),
          createdBy: data.createdBy || '',
          updates: data.updates || {}
        };
        setProject(fetchedProject);
        setEditData({
          name: fetchedProject.name,
          description: fetchedProject.description,
          priority: fetchedProject.priority,
          status: fetchedProject.status,
          startDate: fetchedProject.startDate,
          endDate: fetchedProject.endDate
        });
        setLoading(false);
        setError(null);
      } else {
        setError('Project not found');
        setLoading(false);
      }
    }, (err) => {
      console.error(err);
      setError('Failed to load project data');
      setLoading(false);
    });
    return () => off(projectRef);
  }, [projectId]);

  // Helper functions for new features
  const startTimer = async (taskId: string) => {
    await update(ref(database, `projects/${projectId}/tasks/${taskId}`), {
      timerActive: true,
      timerStart: Date.now()
    });
    toast({ title: "Timer started", description: "Timer has started" });
  };

  const stopTimer = async (taskId: string) => {
    const taskRef = ref(database, `projects/${projectId}/tasks/${taskId}`);
    const snap = await get(taskRef);
    const task = snap.val();
    if (task && task.timerStart) {
      const elapsed = Math.floor((Date.now() - task.timerStart) / 1000);
      await update(taskRef, {
        timerActive: false,
        timerStart: null,
        timeSpent: (task.timeSpent || 0) + elapsed
      });
      toast({ title: "Timer stopped", description: `Added ${Math.floor(elapsed / 60)} minutes.` });
    }
  };

  const addSubtask = async (taskId: string) => {
    const title = prompt('Enter subtask title:');
    if (title) {
      const newSubtask: Subtask = {
        id: Date.now().toString(),
        title,
        completed: false
      };
      const task = project?.tasks[taskId];
      const existingSubtasks = task?.subtasks || [];
      await update(ref(database, `projects/${projectId}/tasks/${taskId}`), {
        subtasks: [...existingSubtasks, newSubtask]
      });
      toast({ title: "Subtask added", description: `Added "${title}"` });
    }
  };

  const toggleSubtask = async (taskId: string, subtaskId: string) => {
    const task = project?.tasks[taskId];
    if (!task) return;
    const updatedSubtasks = (task.subtasks || []).map(sub =>
      sub.id === subtaskId ? { ...sub, completed: !sub.completed } : sub
    );
    await update(ref(database, `projects/${projectId}/tasks/${taskId}`), {
      subtasks: updatedSubtasks
    });
  };

  const uploadAttachment = (taskId: string) => {
    toast({ title: "File upload", description: "File upload not yet implemented. Would store in Firebase Storage." });
  };

  const mentionUser = async (taskId: string, userId: string) => {
    const task = project?.tasks[taskId];
    const currentMentions = task?.mentions || [];
    if (!currentMentions.includes(userId)) {
      await update(ref(database, `projects/${projectId}/tasks/${taskId}`), {
        mentions: [...currentMentions, userId]
      });
      toast({ title: "Mention added", description: `@${employees.find(e => e.id === userId)?.name} mentioned` });
    }
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
      case 'in_progress': return 'bg-blue-100 text-blue-700';
      case 'on_hold': return 'bg-yellow-100 text-yellow-700';
      case 'not_started': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const calculateProgress = (): number => {
    if (!project || !project.tasks) return 0;
    const tasksArray = Object.values(project.tasks);
    if (tasksArray.length === 0) return 0;
    const completedTasks = tasksArray.filter(task => task.status === 'completed').length;
    return Math.round((completedTasks / tasksArray.length) * 100);
  };

  const toggleTaskExpand = (taskId: string) => {
    setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleEdit = async () => {
    if (!user || !project) return;
    try {
      const changes = [];
      const updatedProject = { ...project };

      if (editData.name !== project.name) {
        changes.push({ field: 'name', oldValue: project.name, newValue: editData.name });
        updatedProject.name = editData.name;
      }
      if (editData.description !== project.description) {
        changes.push({ field: 'description', oldValue: project.description, newValue: editData.description });
        updatedProject.description = editData.description;
      }
      if (editData.priority !== project.priority) {
        changes.push({ field: 'priority', oldValue: project.priority, newValue: editData.priority });
        updatedProject.priority = editData.priority;
      }
      if (editData.status !== project.status) {
        changes.push({ field: 'status', oldValue: project.status, newValue: editData.status });
        updatedProject.status = editData.status;
      }
      if (editData.startDate !== project.startDate) {
        changes.push({ field: 'startDate', oldValue: project.startDate, newValue: editData.startDate });
        updatedProject.startDate = editData.startDate;
      }
      if (editData.endDate !== project.endDate) {
        changes.push({ field: 'endDate', oldValue: project.endDate, newValue: editData.endDate });
        updatedProject.endDate = editData.endDate;
      }

      if (changes.length === 0) {
        setIsEditOpen(false);
        return;
      }

      const timestamp = Date.now().toString();
      updatedProject.updates = {
        ...updatedProject.updates,
        [timestamp]: {
          timestamp,
          updatedBy: user.name || 'Admin',
          updatedById: user.id,
          changes,
          note: 'Project details updated'
        }
      };

      await update(ref(database, `projects/${projectId}`), updatedProject);
      if (onEdit) onEdit(updatedProject);
      setIsEditOpen(false);
      toast({ title: "Project Updated", description: "Project has been updated successfully" });
    } catch (error) {
      console.error('Error updating project:', error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update project." });
    }
  };

  const handleDelete = async () => {
    if (!user || !project) return;
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      await remove(ref(database, `projects/${projectId}`));
      if (onDelete) onDelete(projectId);
      toast({ title: "Project Deleted", description: "Project has been deleted successfully" });
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete project." });
    }
  };

  const handleTaskStatusUpdate = async () => {
    if (!user || !project || !selectedTask) return;
    try {
      const timestamp = Date.now().toString();
      const changes = [{ field: 'status', oldValue: selectedTask.status, newValue: newTaskStatus }];
      const updateData: ProjectUpdate = {
        timestamp,
        updatedBy: user.name || 'Admin',
        updatedById: user.id,
        changes,
        note: updateNote
      };

      await update(ref(database, `projects/${projectId}/tasks/${selectedTask.id}`), {
        status: newTaskStatus,
        updatedAt: new Date().toISOString(),
        [`updates/${timestamp}`]: updateData
      });

      setSelectedTask(null);
      setUpdateNote('');
      setNewTaskStatus('');
      setShowTaskDialog(false);
      toast({ title: "Task Updated", description: "Task status has been updated successfully" });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update task." });
    }
  };

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatUpdateDateTime = (timestamp: string) => {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;
  if (!project) return null;

  const assignedEmployeesNames = project.assignedEmployees
    .map(empId => employees.find(emp => emp.id === empId)?.name)
    .filter(Boolean);
  const teamLeaderName = employees.find(emp => emp.id === project.assignedTeamLeader)?.name || '';
  const progress = calculateProgress();
  const tasksArray = Object.values(project.tasks);
  const completedTasksCount = tasksArray.filter(task => task.status === 'completed').length;
  const totalTasksCount = tasksArray.length;

  const tasksByEmployee: Record<string, ExtendedTask[]> = {};
  tasksArray.forEach(task => {
    if (!tasksByEmployee[task.assignedTo]) tasksByEmployee[task.assignedTo] = [];
    tasksByEmployee[task.assignedTo].push(task);
  });

  const projectUpdates = project.updates
    ? Object.entries(project.updates).sort(([a], [b]) => parseInt(b) - parseInt(a)).map(([timestamp, update]) => ({ timestamp, ...update }))
    : [];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="w-full">
      <Card className="hover:shadow-lg transition-shadow duration-200" onClick={onClick}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg font-semibold line-clamp-2 break-words">{project.name}</CardTitle>
            <div className="flex gap-1 shrink-0">
              <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Edit className="h-4 w-4" /></Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <Input placeholder="Project Name" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                    <Textarea placeholder="Description" value={editData.description} onChange={(e) => setEditData({ ...editData, description: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={editData.priority} onValueChange={(value) => setEditData({ ...editData, priority: value })}>
                        <SelectTrigger className="text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={editData.status} onValueChange={(value) => setEditData({ ...editData, status: value })}>
                        <SelectTrigger className="text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_started">Not Started</SelectItem><SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem><SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="date" value={editData.startDate} onChange={(e) => setEditData({ ...editData, startDate: e.target.value })} className="text-xs" />
                      <Input type="date" value={editData.endDate} onChange={(e) => setEditData({ ...editData, endDate: e.target.value })} className="text-xs" />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleEdit} className="flex-1">Save</Button>
                      <Button variant="outline" onClick={() => setIsEditOpen(false)} className="flex-1">Cancel</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700" onClick={(e) => { e.stopPropagation(); handleDelete(); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge className={`text-xs ${getPriorityColor(project.priority)}`}>{project.priority}</Badge>
            <Badge className={`text-xs ${getStatusColor(project.status)}`}>{project.status.replace('_', ' ')}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 line-clamp-3 break-words">{project.description}</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm"><span>Progress</span><span>{progress}%</span></div>
            <Progress value={progress} className="h-2" />
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-gray-500 shrink-0" /><span className="truncate">{formatDisplayDate(project.startDate)}</span></div>
            <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-gray-500 shrink-0" /><span className="truncate">{formatDisplayDate(project.endDate)}</span></div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-gray-500 shrink-0" /><span className="text-sm font-medium truncate">Team Leader:</span><Badge variant="outline" className="text-xs truncate max-w-[120px]">{teamLeaderName || 'Unassigned'}</Badge></div>
            {assignedEmployeesNames.length > 0 && (
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-gray-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0"><span className="text-sm font-medium">Team Members:</span><div className="flex flex-wrap gap-1 mt-1">{assignedEmployeesNames.slice(0,3).map((name,idx)=><Badge key={idx} variant="outline" className="text-xs truncate max-w-[100px]">{name}</Badge>)}{assignedEmployeesNames.length>3 && <Badge variant="outline" className="text-xs">+{assignedEmployeesNames.length-3} more</Badge>}</div></div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-gray-500 shrink-0" /><span className="text-sm font-medium">Total Tasks:</span><span className="text-sm">{completedTasksCount} / {totalTasksCount} completed</span></div>
            {Object.entries(tasksByEmployee).map(([empId, tasks]) => {
              const employee = employees.find(emp => emp.id === empId);
              if (!employee) return null;
              const completed = tasks.filter(task => task.status === 'completed').length;
              return (
                <div key={empId} className="space-y-2">
                  <div className="flex items-center gap-2 pl-6"><User className="h-4 w-4 text-gray-500 shrink-0" /><span className="text-sm font-medium truncate">{employee.name}:</span><span className="text-xs">{completed} / {tasks.length} completed</span></div>
                  <div className="pl-6 sm:pl-10 space-y-2">
                    {tasks.map(task => {
                      const taskUpdates = task.updates ? Object.entries(task.updates).sort(([a],[b])=>parseInt(b)-parseInt(a)).map(([timestamp,update])=>({timestamp,...update})) : [];
                      return (
                        <div key={task.id} className="border rounded p-2 space-y-2">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium line-clamp-1 break-words">{task.title}</h4>
                              {task.description && <p className="text-xs text-gray-500 line-clamp-2 break-words mt-1">{task.description}</p>}
                            </div>
                            <div className="flex items-center gap-1 flex-wrap">
                              <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>{task.priority}</Badge>
                              <Badge className={`text-xs ${getStatusColor(task.status)}`}>{task.status.replace('_', ' ')}</Badge>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto" onClick={(e)=>{e.stopPropagation(); toggleTaskExpand(task.id);}}>
                                {expandedTasks[task.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>

                          {/* New features: Subtasks, Timer, Attachments, Mentions */}
                          <div className="mt-2 space-y-2">
                            {/* Subtasks */}
                            {task.subtasks && task.subtasks.length > 0 && (
                              <div className="pl-2 border-l-2 border-gray-200">
                                <p className="text-xs font-medium">Subtasks</p>
                                {task.subtasks.map(sub => (
                                  <div key={sub.id} className="flex items-center gap-2 text-xs">
                                    <input type="checkbox" checked={sub.completed} onChange={() => toggleSubtask(task.id, sub.id)} />
                                    <span className={sub.completed ? 'line-through text-gray-500' : ''}>{sub.title}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => addSubtask(task.id)} className="text-xs h-6">
                              <Plus className="h-3 w-3 mr-1" /> Add subtask
                            </Button>

                            {/* Timer */}
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-gray-500" />
                              <span className="text-xs">
                                Time spent: {Math.floor((task.timeSpent || 0) / 3600)}h {Math.floor(((task.timeSpent || 0) % 3600) / 60)}m
                              </span>
                              {task.timerActive ? (
                                <Button size="sm" variant="outline" onClick={() => stopTimer(task.id)} className="h-6 px-2 text-xs">
                                  <Pause className="h-3 w-3 mr-1" /> Pause
                                </Button>
                              ) : (
                                <Button size="sm" variant="outline" onClick={() => startTimer(task.id)} className="h-6 px-2 text-xs">
                                  <Play className="h-3 w-3 mr-1" /> Start
                                </Button>
                              )}
                            </div>

                            {/* Attachments */}
                            {task.attachments && task.attachments.length > 0 && (
                              <div className="text-xs">
                                <p className="font-medium">Attachments:</p>
                                {task.attachments.map(att => (
                                  <div key={att.id}>
                                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">{att.name}</a>
                                  </div>
                                ))}
                              </div>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => uploadAttachment(task.id)} className="text-xs h-6">
                              <Paperclip className="h-3 w-3 mr-1" /> Attach file
                            </Button>

                            {/* Mentions */}
                            {task.mentions && task.mentions.length > 0 && (
                              <div className="text-xs text-gray-500">
                                Mentions: {task.mentions.map(mid => `@${employees.find(e => e.id === mid)?.name || mid}`).join(', ')}
                              </div>
                            )}
                            <Select onValueChange={(val) => mentionUser(task.id, val)}>
                              <SelectTrigger className="h-6 text-xs w-32"><SelectValue placeholder="Mention @user" /></SelectTrigger>
                              <SelectContent>
                                {employees.map(emp => (
                                  <SelectItem key={emp.id} value={emp.id}>@{emp.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <Collapsible open={expandedTasks[task.id]}>
                            <CollapsibleContent className="mt-2 space-y-2">
                              <div className="flex flex-col xs:flex-row xs:items-center gap-2 text-xs flex-wrap">
                                <span>Due: {formatDisplayDate(task.dueDate)}</span>
                                <span>Created: {formatDisplayDate(task.createdAt)}</span>
                                {task.updatedAt && <span>Updated: {formatDisplayDate(task.updatedAt)}</span>}
                              </div>
                              <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="text-xs h-6 w-full sm:w-auto" onClick={(e)=>{e.stopPropagation(); setSelectedTask(task); setNewTaskStatus(task.status); setUpdateNote('');}}>
                                    Update Status
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                  <DialogHeader><DialogTitle>Update Task Status</DialogTitle></DialogHeader>
                                  <div className="space-y-4">
                                    <div><label className="block text-sm font-medium mb-1">Current Status</label><p className="text-sm">{task.status.replace('_', ' ')}</p></div>
                                    <div><label className="block text-sm font-medium mb-1">New Status</label><Select value={newTaskStatus} onValueChange={setNewTaskStatus}><SelectTrigger className="text-xs"><SelectValue placeholder="Select status" /></SelectTrigger><SelectContent><SelectItem value="not_started">Not Started</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="on_hold">On Hold</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent></Select></div>
                                    <div><label className="block text-sm font-medium mb-1">Update Note</label><Textarea placeholder="Describe the update..." value={updateNote} onChange={(e)=>setUpdateNote(e.target.value)} className="text-xs" /></div>
                                  </div>
                                  <DialogFooter><Button variant="outline" onClick={()=>setShowTaskDialog(false)} className="text-xs">Cancel</Button><Button onClick={handleTaskStatusUpdate} className="text-xs">Save Update</Button></DialogFooter>
                                </DialogContent>
                              </Dialog>
                              {taskUpdates.length > 0 && (
                                <div className="mt-2 border-t pt-2"><h5 className="text-xs font-medium mb-1">Update History</h5><div className="space-y-2 max-h-40 overflow-y-auto">{taskUpdates.map((update,idx)=><div key={idx} className="text-xs bg-gray-50 p-2 rounded"><div className="flex flex-col xs:flex-row xs:justify-between xs:items-start gap-1"><div className="flex items-center gap-1"><User className="h-3 w-3 shrink-0" /><span className="font-medium truncate">{update.updatedBy}</span></div><span className="text-gray-500 text-right xs:text-left">{formatUpdateDateTime(update.timestamp)}</span></div><div className="mt-1">{update.changes.map((change,i)=><p key={i} className="mt-1 break-words">Changed <span className="font-medium">{change.field}</span> from<span className="italic"> "{change.oldValue}"</span> to<span className="font-medium"> "{change.newValue}"</span></p>)}</div>{update.note && <p className="mt-1 italic break-words">Note: "{update.note}"</p>}</div>)}</div></div>
                              )}
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {projectUpdates.length > 0 && (
            <div className="space-y-2 border-t pt-4"><h3 className="text-sm font-medium">Project Updates</h3><div className="space-y-2 max-h-40 overflow-y-auto">{projectUpdates.map((update,idx)=><div key={idx} className="text-xs bg-gray-50 p-2 rounded"><div className="flex flex-col xs:flex-row xs:justify-between xs:items-start gap-1"><div className="flex items-center gap-1"><User className="h-3 w-3 shrink-0" /><span className="font-medium truncate">{update.updatedBy}</span></div><span className="text-gray-500 text-right xs:text-left">{formatUpdateDateTime(update.timestamp)}</span></div><div className="mt-1">{update.changes.map((change,i)=><p key={i} className="mt-1 break-words">Changed <span className="font-medium">{change.field}</span> from<span className="italic"> "{change.oldValue}"</span> to<span className="font-medium"> "{change.newValue}"</span></p>)}</div>{update.note && <p className="mt-1 italic break-words">Note: "{update.note}"</p>}</div>)}</div></div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ProjectCard;