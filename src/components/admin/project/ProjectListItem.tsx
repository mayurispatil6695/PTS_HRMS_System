import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Trash2, Users, Calendar, Clock, CheckCircle, ChevronDown, ChevronUp, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { toast } from '../../ui/use-toast';
import { format } from 'date-fns';
import { ref, onValue, off, get, set, remove, update, DataSnapshot } from 'firebase/database';
import { database } from '../../../firebase';
import { useAuth } from '../../../hooks/useAuth';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../../ui/collapsible';

// ==================== LOCAL TYPES (No `any`) ====================
interface LocalEmployee {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  isActive: boolean;
  profileImage?: string;
}

interface LocalTaskUpdate {
  timestamp: string;
  updatedBy: string;
  updatedById: string;
  changes: {
    field: string;
    oldValue: string;
    newValue: string;
  }[];
  note: string;
}

interface LocalTask {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'review';
  createdAt: string;
  updatedAt: string;
  dependsOn?: string[];
  achievementSummary?: string;
  comments?: Record<string, unknown>;
  attachments?: Record<string, unknown>;
  totalTimeSpentMs?: number;
  updates?: LocalTaskUpdate[];
}

interface LocalProject {
  id: string;
  name: string;
  description: string;
  projectType: string;
  department: string;
  assignedTeamLeader: string;
  assignedEmployees: string[];
  tasks: LocalTask[];
  startDate: string;
  endDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'not_started' | 'in_progress' | 'on_hold' | 'completed';
  createdAt: string;
  createdBy: string;
  lastUpdated: string;
  updates?: unknown[];
}

interface ProjectListItemProps {
  projectId: string;
  employeeId: string;
  index: number;
  onEdit?: (project: LocalProject) => void;
  onDelete?: (projectId: string) => void;
}

// ==================== HELPERS ====================
const formatDisplayDate = (dateString?: string): string => {
  if (!dateString) return 'Not set';
  try {
    return format(new Date(dateString), 'MMM dd, yyyy');
  } catch {
    return dateString;
  }
};

const formatUpdateDateTime = (timestamp: string): string => {
  try {
    const date = new Date(parseInt(timestamp));
    return format(date, 'MMM dd, yyyy h:mm a');
  } catch {
    return timestamp;
  }
};

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

const statusColors: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-purple-100 text-purple-700',
  pending: 'bg-yellow-100 text-yellow-700',
  not_started: 'bg-gray-100 text-gray-700',
  on_hold: 'bg-orange-100 text-orange-700',
};

// ==================== COMPONENT ====================
const ProjectListItem: React.FC<ProjectListItemProps> = ({
  projectId,
  employeeId,
  index,
  onEdit,
  onDelete,
}) => {
  const { user } = useAuth();
  const [project, setProject] = useState<LocalProject | null>(null);
  const [employees, setEmployees] = useState<LocalEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<LocalTask | null>(null);
  const [newTaskStatus, setNewTaskStatus] = useState('');
  const [updateNote, setUpdateNote] = useState('');

  const [editData, setEditData] = useState({
    name: '',
    description: '',
    priority: 'medium' as LocalProject['priority'],
    status: 'not_started' as LocalProject['status'],
    startDate: '',
    endDate: '',
  });

  const getEmployeeName = useCallback(
    (empId: string): string => employees.find((e) => e.id === empId)?.name || 'Unknown',
    [employees]
  );

  // Parse Firebase tasks object to array with updates (no `any`)
  const parseTasks = useCallback((tasksObj: Record<string, unknown> | undefined): LocalTask[] => {
    if (!tasksObj) return [];
    return Object.entries(tasksObj).map(([id, task]) => {
      const taskData = task as Record<string, unknown>;
      const updatesRaw = taskData.updates as Record<string, unknown> | undefined;
      let updates: LocalTaskUpdate[] = [];
      if (updatesRaw) {
        updates = Object.entries(updatesRaw).map(([timestamp, u]) => {
          const updateData = u as Record<string, unknown>;
          return {
            timestamp,
            updatedBy: updateData.updatedBy as string,
            updatedById: updateData.updatedById as string,
            changes: (updateData.changes as Array<{ field: string; oldValue: string; newValue: string }>) || [],
            note: (updateData.note as string) || '',
          };
        });
      }
      return {
        id,
        title: (taskData.title as string) || '',
        description: (taskData.description as string) || '',
        assignedTo: (taskData.assignedTo as string) || '',
        dueDate: (taskData.dueDate as string) || '',
        priority: (taskData.priority as LocalTask['priority']) || 'medium',
        status: (taskData.status as LocalTask['status']) || 'pending',
        createdAt: (taskData.createdAt as string) || '',
        updatedAt: (taskData.updatedAt as string) || '',
        dependsOn: (taskData.dependsOn as string[]) || [],
        achievementSummary: taskData.achievementSummary as string,
        comments: taskData.comments as Record<string, unknown>,
        attachments: taskData.attachments as Record<string, unknown>,
        totalTimeSpentMs: (taskData.totalTimeSpentMs as number) || 0,
        updates,
      };
    });
  }, []);

  // Fetch project data with real‑time listener
  useEffect(() => {
    if (!user?.id) return;
    const projectRef = ref(database, `users/${user.id}/employees/${employeeId}/projects/${projectId}`);
    let isMounted = true;

    const unsubscribe = onValue(projectRef, async (snapshot: DataSnapshot) => {
      if (!isMounted) return;
      if (!snapshot.exists()) {
        setError('Project not found');
        setLoading(false);
        return;
      }

      const data = snapshot.val() as Record<string, unknown>;
      const tasksArray = parseTasks(data.tasks as Record<string, unknown> | undefined);

      const projectData: LocalProject = {
        id: projectId,
        name: (data.name as string) || '',
        description: (data.description as string) || '',
        projectType: (data.projectType as string) || 'common',
        department: (data.department as string) || '',
        assignedTeamLeader: (data.assignedTeamLeader as string) || '',
        assignedEmployees: (data.assignedEmployees as string[]) || [],
        tasks: tasksArray,
        startDate: (data.startDate as string) || '',
        endDate: (data.endDate as string) || '',
        priority: (data.priority as LocalProject['priority']) || 'medium',
        status: (data.status as LocalProject['status']) || 'not_started',
        createdAt: (data.createdAt as string) || '',
        createdBy: (data.createdBy as string) || '',
        lastUpdated: (data.lastUpdated as string) || '',
        updates: data.updates ? Object.values(data.updates as Record<string, unknown>) : [],
      };

      setProject(projectData);
      setEditData({
        name: projectData.name,
        description: projectData.description,
        priority: projectData.priority,
        status: projectData.status,
        startDate: projectData.startDate,
        endDate: projectData.endDate,
      });

      // Fetch assigned employees
      try {
        const employeeIds = [...projectData.assignedEmployees];
        if (projectData.assignedTeamLeader) employeeIds.push(projectData.assignedTeamLeader);
        const employeesRef = ref(database, `users/${user.id}/employees`);
        const employeesSnap = await get(employeesRef);
        const empList: LocalEmployee[] = [];
        employeesSnap.forEach((child) => {
          const empId = child.key;
          if (empId && employeeIds.includes(empId)) {
            const empData = child.val() as Record<string, unknown>;
            empList.push({
              id: empId,
              name: (empData.name as string) || '',
              email: (empData.email as string) || '',
              department: (empData.department as string) || '',
              designation: (empData.designation as string) || '',
              isActive: (empData.status as string) === 'active',
              profileImage: empData.profileImage as string,
            });
          }
        });
        if (isMounted) setEmployees(empList);
      } catch (err) {
        console.error('Error fetching employees:', err);
      }

      setLoading(false);
      setError(null);
    });

    return () => {
      isMounted = false;
      off(projectRef);
    };
  }, [user, employeeId, projectId, parseTasks]);

  const progress = useMemo(() => {
    if (!project?.tasks.length) return 0;
    const completed = project.tasks.filter((t) => t.status === 'completed').length;
    return Math.round((completed / project.tasks.length) * 100);
  }, [project]);

  const toggleTaskExpand = useCallback((taskId: string) => {
    setExpandedTasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  }, []);

  const handleEdit = useCallback(async () => {
    if (!user || !project) return;
    try {
      const updatedProject: LocalProject = {
        ...project,
        name: editData.name,
        description: editData.description,
        priority: editData.priority,
        status: editData.status,
        startDate: editData.startDate,
        endDate: editData.endDate,
        lastUpdated: new Date().toISOString(),
      };

      const allEmpIds = [...project.assignedEmployees];
      if (project.assignedTeamLeader && !allEmpIds.includes(project.assignedTeamLeader)) {
        allEmpIds.push(project.assignedTeamLeader);
      }
      const updatePromises = allEmpIds.map((empId) =>
        set(ref(database, `users/${user.id}/employees/${empId}/projects/${projectId}`), updatedProject)
      );
      await Promise.all(updatePromises);

      if (onEdit) onEdit(updatedProject);
      setIsEditOpen(false);
      toast({ title: 'Project Updated', description: 'Project has been updated successfully' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update project' });
    }
  }, [user, project, editData, projectId, onEdit]);

  const handleDelete = useCallback(async () => {
    if (!user || !project) return;
    if (!window.confirm('Delete this project? This action cannot be undone.')) return;
    try {
      const allEmpIds = [...project.assignedEmployees];
      if (project.assignedTeamLeader && !allEmpIds.includes(project.assignedTeamLeader)) {
        allEmpIds.push(project.assignedTeamLeader);
      }
      const deletePromises = allEmpIds.map((empId) =>
        remove(ref(database, `users/${user.id}/employees/${empId}/projects/${projectId}`))
      );
      await Promise.all(deletePromises);
      if (onDelete) onDelete(projectId);
      toast({ title: 'Project Deleted', description: 'Project has been deleted' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete project' });
    }
  }, [user, project, projectId, onDelete]);

  const handleTaskStatusUpdate = useCallback(async () => {
    if (!user || !project || !selectedTask) return;
    try {
      const timestamp = Date.now().toString();
      const changes = [
        { field: 'status', oldValue: selectedTask.status, newValue: newTaskStatus },
      ];
      const updateData: LocalTaskUpdate = {
        timestamp,
        updatedBy: user.name || 'Admin',
        updatedById: user.id,
        changes,
        note: updateNote,
      };

      const updatesObj: Record<string, unknown> = {
        [`tasks/${selectedTask.id}/status`]: newTaskStatus,
        [`tasks/${selectedTask.id}/updatedAt`]: new Date().toISOString(),
        [`tasks/${selectedTask.id}/updates/${timestamp}`]: updateData,
      };

      const allEmpIds = [...project.assignedEmployees];
      if (project.assignedTeamLeader && !allEmpIds.includes(project.assignedTeamLeader)) {
        allEmpIds.push(project.assignedTeamLeader);
      }
      const updatePromises = allEmpIds.map((empId) =>
        update(ref(database, `users/${user.id}/employees/${empId}/projects/${projectId}`), updatesObj)
      );
      await Promise.all(updatePromises);

      const updatedTask: LocalTask = {
        ...selectedTask,
        status: newTaskStatus as LocalTask['status'],
        updatedAt: new Date().toISOString(),
        updates: [updateData, ...(selectedTask.updates || [])],
      };
      const updatedTasks = project.tasks.map((t) => (t.id === selectedTask.id ? updatedTask : t));

      setProject({ ...project, tasks: updatedTasks });

      setSelectedTask(null);
      setUpdateNote('');
      setNewTaskStatus('');
      setShowTaskDialog(false);
      toast({ title: 'Task Updated', description: 'Task status has been updated' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update task' });
    }
  }, [user, project, selectedTask, newTaskStatus, updateNote, projectId]);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="border rounded-lg p-4 animate-pulse"
      >
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </motion.div>
    );
  }

  if (error || !project) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="border rounded-lg p-4 bg-red-50 text-red-500"
      >
        {error || 'Project not found'}
      </motion.div>
    );
  }

  const teamLeader = employees.find((e) => e.id === project.assignedTeamLeader);
  const assignedEmployees = employees.filter((e) => project.assignedEmployees.includes(e.id));
  const tasksByEmployee = project.tasks.reduce((acc, task) => {
    const empId = task.assignedTo;
    if (!acc[empId]) acc[empId] = [];
    acc[empId].push(task);
    return acc;
  }, {} as Record<string, LocalTask[]>);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-start gap-2">
          <div className="flex-1">
            <h3 className="text-lg font-semibold break-words">{project.name}</h3>
            <p className="text-sm text-gray-600 break-words">{project.description}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Project Name"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  />
                  <Textarea
                    placeholder="Description"
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={editData.priority}
                      onValueChange={(val) =>
                        setEditData({ ...editData, priority: val as LocalProject['priority'] })
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={editData.status}
                      onValueChange={(val) =>
                        setEditData({ ...editData, status: val as LocalProject['status'] })
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">Not Started</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="on_hold">On Hold</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="date" value={editData.startDate} onChange={(e) => setEditData({ ...editData, startDate: e.target.value })} />
                    <Input type="date" value={editData.endDate} onChange={(e) => setEditData({ ...editData, endDate: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleEdit} className="flex-1">Save</Button>
                    <Button variant="outline" onClick={() => setIsEditOpen(false)} className="flex-1">Cancel</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge className={priorityColors[project.priority] || 'bg-gray-100'}>{project.priority}</Badge>
          <Badge className={statusColors[project.status] || 'bg-gray-100'}>{project.status.replace('_', ' ')}</Badge>
          <Badge variant="outline" className="text-xs">{project.department || 'No Department'}</Badge>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-gray-500" />{formatDisplayDate(project.startDate)}</div>
          <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-gray-500" />{formatDisplayDate(project.endDate)}</div>
        </div>

        {/* Team */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-gray-500" /><span className="font-medium">Team Leader:</span>
            {teamLeader ? (
              <div className="flex items-center gap-1">
                <Avatar className="h-5 w-5"><AvatarFallback>{teamLeader.name.charAt(0)}</AvatarFallback></Avatar>
                <span>{teamLeader.name}</span>
              </div>
            ) : <span className="text-gray-400">Not assigned</span>}
          </div>
          {assignedEmployees.length > 0 && (
            <div className="flex items-start gap-2 text-sm">
              <Users className="h-4 w-4 text-gray-500 opacity-0" /><span className="font-medium">Team Members:</span>
              <div className="flex flex-wrap gap-1">
                {assignedEmployees.slice(0, 3).map(emp => (
                  <div key={emp.id} className="flex items-center gap-1">
                    <Avatar className="h-5 w-5"><AvatarFallback>{emp.name.charAt(0)}</AvatarFallback></Avatar>
                    <span>{emp.name}</span>
                  </div>
                ))}
                {assignedEmployees.length > 3 && <span className="text-xs text-gray-500">+{assignedEmployees.length - 3} more</span>}
              </div>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-gray-500" /><span className="font-medium">Tasks:</span>
            <span>{project.tasks.filter(t => t.status === 'completed').length} / {project.tasks.length} completed</span>
          </div>
          {project.tasks.length > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>

        {/* Task list */}
        {project.tasks.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Task Details</h4>
            {Object.entries(tasksByEmployee).map(([empId, tasks]) => {
              const employee = employees.find(e => e.id === empId);
              const completedCount = tasks.filter(t => t.status === 'completed').length;
              return (
                <div key={empId} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5"><AvatarFallback>{employee?.name?.charAt(0) || '?'}</AvatarFallback></Avatar>
                    <span className="text-sm font-medium">{employee?.name || 'Unknown'}'s Tasks:</span>
                    <span className="text-xs text-gray-500">{completedCount} / {tasks.length} completed</span>
                  </div>
                  <div className="space-y-2 pl-7">
                    {tasks.map(task => (
                      <div key={task.id} className="border rounded p-2">
                        <div className="flex flex-wrap justify-between items-start gap-2">
                          <div className="flex-1">
                            <h5 className="text-sm font-medium break-words">{task.title}</h5>
                            {task.description && <p className="text-xs text-gray-500 break-words">{task.description}</p>}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Badge className={priorityColors[task.priority] || 'bg-gray-100'}>{task.priority}</Badge>
                            <Badge className={statusColors[task.status] || 'bg-gray-100'}>{task.status.replace('_', ' ')}</Badge>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => toggleTaskExpand(task.id)}>
                              {expandedTasks[task.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                        <Collapsible open={expandedTasks[task.id]}>
                          <CollapsibleContent className="mt-2 space-y-2">
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span>Due: {formatDisplayDate(task.dueDate)}</span>
                              <span>Created: {formatDisplayDate(task.createdAt)}</span>
                              {task.updatedAt && <span>Updated: {formatDisplayDate(task.updatedAt)}</span>}
                            </div>
                            <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="text-xs h-6" onClick={() => {
                                  setSelectedTask(task);
                                  setNewTaskStatus(task.status);
                                  setUpdateNote('');
                                }}>
                                  Update Status
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader><DialogTitle>Update Task Status</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                  <div><label className="block text-sm font-medium mb-1">Current Status</label><p className="text-sm">{task.status.replace('_', ' ')}</p></div>
                                  <div><label className="block text-sm font-medium mb-1">New Status</label>
                                    <Select value={newTaskStatus} onValueChange={setNewTaskStatus}>
                                      <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="not_started">Not Started</SelectItem>
                                        <SelectItem value="in_progress">In Progress</SelectItem>
                                        <SelectItem value="on_hold">On Hold</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div><label className="block text-sm font-medium mb-1">Update Note</label>
                                    <Textarea placeholder="Describe the update..." value={updateNote} onChange={(e) => setUpdateNote(e.target.value)} />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setShowTaskDialog(false)}>Cancel</Button>
                                  <Button onClick={handleTaskStatusUpdate}>Save Update</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            {task.updates && task.updates.length > 0 && (
                              <div className="mt-2 border-t pt-2">
                                <h5 className="text-xs font-medium mb-1">Update History</h5>
                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                  {task.updates.map((update, idx) => (
                                    <div key={idx} className="text-xs bg-gray-50 p-2 rounded">
                                      <div className="flex justify-between flex-wrap gap-1">
                                        <div className="flex items-center gap-1"><User className="h-3 w-3" /><span className="font-medium">{update.updatedBy}</span></div>
                                        <span className="text-gray-500">{formatUpdateDateTime(update.timestamp)}</span>
                                      </div>
                                      {update.changes.map((change, i) => (
                                        <p key={i} className="mt-1">Changed <span className="font-medium">{change.field}</span> from <span className="italic">"{change.oldValue}"</span> to <span className="font-medium">"{change.newValue}"</span></p>
                                      ))}
                                      {update.note && <p className="mt-1 italic">Note: "{update.note}"</p>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-xs text-gray-500">Last updated: {formatDisplayDate(project.lastUpdated)}</div>
      </div>
    </motion.div>
  );
};

export default ProjectListItem;