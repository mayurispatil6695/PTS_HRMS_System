import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  FolderOpen, Calendar, Target, MessageSquare,
  CheckCircle, AlertCircle, Clock, ChevronDown, ChevronUp,
  Save, X, Edit, Users, Paperclip, Download, Trash2, Image, File, Play, StopCircle
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { useAuth } from '../../hooks/useAuth';
import { database, storage } from '../../firebase';
import { ref, onValue, update, set, push, increment, get } from 'firebase/database';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { toast } from 'react-hot-toast';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import ProjectChat from '../admin/project/ProjectChat';
import { Sparkles } from 'lucide-react';
import { getTaskSuggestions } from '@/services/aiServices';

type ChangeValue = string | number | boolean | null;

interface TaskUpdate {
  timestamp: string;
  updatedBy: string;
  updatedById: string;
  updatedByRole?: 'admin' | 'team_lead' | 'employee';
  changes: { field: string; oldValue: ChangeValue; newValue: ChangeValue }[];
  note?: string;
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedBy: string;
  uploadedById: string;
  uploadedAt: string;
}

interface Comment {
  id: string;
  text: string;
  createdAt: string;
  createdBy: string;
  createdById: string;
  mentions?: string[];
}

// Time log entry interface
interface TimeLogEntry {
  id?: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  note?: string;
  loggedAt?: number;
  isRunning?: boolean;
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
  attachments?: Record<string, Attachment>;
  updates?: Record<string, TaskUpdate>;
  comments?: Record<string, Comment>;
  createdAt?: string;
  updatedAt?: string;
  totalTimeSpentMs?: number;
  timeLogs?: Record<string, TimeLogEntry>;
  dependsOn?: string[];
}

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

interface Employee {
  id: string;
  name: string;
  email: string;
  designation: string;
}

interface FirebaseProjectData {
  name?: string;
  description?: string;
  department?: string;
  startDate?: string;
  endDate?: string;
  priority?: string;
  status?: string;
  progress?: number;
  tasks?: Record<string, Task>;
  assignedTeamLeader?: string;
  assignedEmployees?: string[];
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
  const [uploadingAttachments, setUploadingAttachments] = useState<Record<string, boolean>>({});
  const [isManager, setIsManager] = useState(false);
  const [runningTimer, setRunningTimer] = useState<{ projectId: string; taskId: string; logId: string; startTime: number } | null>(null);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Manual time log modal state
  const [showManualLogModal, setShowManualLogModal] = useState(false);
  const [manualLogTask, setManualLogTask] = useState<Task | null>(null);
  const [manualHours, setManualHours] = useState(0);
  const [manualMinutes, setManualMinutes] = useState(0);
  const [manualNote, setManualNote] = useState('');

  const employeesList = useMemo(() => Object.values(employees).map(emp => ({ id: emp.id, name: emp.name })), [employees]);

  const formatDuration = (ms: number) => {
    if (!ms) return '0m';
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  // ✅ FIXED: Single startTimer function with all checks
  const startTimer = async (projectId: string, taskId: string) => {
    if (runningTimer) {
      toast.error('Stop current timer first');
      return;
    }
    if (!taskId || taskId === 'undefined' || taskId === 'null') {
      toast.error('Invalid task – cannot start timer');
      console.error('startTimer called with invalid taskId:', taskId);
      return;
    }
    if (!user?.id) return;

    const logId = Date.now().toString();
    const logRef = ref(database, `projects/${projectId}/tasks/${taskId}/timeLogs/${logId}`);

    await set(logRef, {
      employeeId: user.id,
      employeeName: user.name,
      startTime: Date.now(),
      endTime: null,
      durationMs: 0,
      note: '',
      loggedAt: Date.now(),
      isRunning: true
    });

    setRunningTimer({ projectId, taskId, logId, startTime: Date.now() });
    setTimerElapsed(0);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setTimerElapsed(prev => prev + 1000);
    }, 1000);

    toast.success('Timer started');
  };

  const stopTimer = async () => {
    if (!runningTimer) return;
    const { projectId, taskId, logId, startTime } = runningTimer;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    const endTime = Date.now();
    const duration = endTime - startTime;
    const logRef = ref(database, `projects/${projectId}/tasks/${taskId}/timeLogs/${logId}`);
    await update(logRef, { endTime, durationMs: duration, isRunning: false });
    const taskRef = ref(database, `projects/${projectId}/tasks/${taskId}`);
    await update(taskRef, { totalTimeSpentMs: increment(duration) });
    setRunningTimer(null);
    setTimerElapsed(0);
    toast.success(`Logged ${Math.round(duration / 60000)} minutes`);
  };

  // Add this after the `stopTimer` function and before `updateTaskStatus`

  const sendTeamNotification = async (project: Project, task: Task, completedBy: string) => {
    const teamMemberIds = [...(project.assignedEmployees || []), project.assignedTeamLeader].filter(Boolean);
    for (const memberId of teamMemberIds) {
      const notifRef = push(ref(database, `notifications/${memberId}`));
      await set(notifRef, {
        title: 'Task Completed ✅',
        body: `${completedBy} completed "${task.title}" in project ${project.name}`,
        type: 'task_completed',
        read: false,
        createdAt: Date.now(),
        taskId: task.id,
        projectId: project.id,
      });
      // Browser notification (if permission granted)
      if (Notification.permission === 'granted') {
        new Notification('Task Completed', { body: `${completedBy} completed "${task.title}"` });
      }
    }
  };

  // ✅ IMPLEMENTED: Manual time log modal
  const openManualLogModal = (task: Task) => {
    setManualLogTask(task);
    setManualHours(0);
    setManualMinutes(0);
    setManualNote('');
    setShowManualLogModal(true);
  };

  const saveManualLog = async () => {
    if (!manualLogTask || !user?.id) return;
    const durationMs = (manualHours * 60 + manualMinutes) * 60 * 1000;
    if (durationMs <= 0) {
      toast.error('Please enter a positive duration');
      return;
    }
    const logId = Date.now().toString();
    const logRef = ref(database, `projects/${manualLogTask.projectId}/tasks/${manualLogTask.id}/timeLogs/${logId}`);
    await set(logRef, {
      employeeId: user.id,
      employeeName: user.name,
      startTime: Date.now() - durationMs,
      endTime: Date.now(),
      durationMs,
      note: manualNote,
      loggedAt: Date.now(),
      isRunning: false,
    });
    const taskRef = ref(database, `projects/${manualLogTask.projectId}/tasks/${manualLogTask.id}`);
    await update(taskRef, { totalTimeSpentMs: increment(durationMs) });
    toast.success(`Logged ${manualHours}h ${manualMinutes}m manually`);
    setShowManualLogModal(false);
    // Refresh local state by re-fetching projects (or update optimistically)
    // For simplicity, we'll just refetch – but you can update local state directly.
    window.location.reload(); // Or better: refetch projects data
  };

  const uploadAttachment = async (projectId: string, taskId: string, file: File) => {
    if (!user?.id) return;
    const uploadId = `${projectId}_${taskId}_${Date.now()}`;
    setUploadingAttachments(prev => ({ ...prev, [uploadId]: true }));
    try {
      let downloadURL: string;
      if (import.meta.env.VITE_STORAGE_PROVIDER === 'cloudinary') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/upload`, { method: 'POST', body: formData });
        const data = await response.json();
        downloadURL = data.secure_url;
      } else {
        const storagePath = `tasks/${projectId}/${taskId}/${Date.now()}_${file.name}`;
        const fileStorageRef = storageRef(storage, storagePath);
        const uploadTask = uploadBytesResumable(fileStorageRef, file);
        await new Promise((resolve, reject) => {
          uploadTask.on('state_changed', null, reject, async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          });
        });
        downloadURL = await getDownloadURL(fileStorageRef);
      }
      const attachmentId = Date.now().toString();
      const attachment: Attachment = {
        id: attachmentId,
        name: file.name,
        url: downloadURL,
        size: file.size,
        type: file.type,
        uploadedBy: user.name || (isTeamLead ? 'Team Lead' : 'Employee'),
        uploadedById: user.id,
        uploadedAt: new Date().toISOString(),
      };
      await set(ref(database, `projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`), attachment);
      setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        const updatedTasks = { ...p.tasks };
        if (!updatedTasks[taskId].attachments) updatedTasks[taskId].attachments = {};
        updatedTasks[taskId].attachments![attachmentId] = attachment;
        return { ...p, tasks: updatedTasks };
      }));
      toast.success(`File "${file.name}" uploaded`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploadingAttachments(prev => { const newState = { ...prev }; delete newState[uploadId]; return newState; });
    }
  };

  const deleteAttachment = async (projectId: string, taskId: string, attachmentId: string, attachmentUrl: string) => {
    if (!user?.id) return;
    try {
      const fileRef = storageRef(storage, attachmentUrl);
      await deleteObject(fileRef);
      await set(ref(database, `projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`), null);
      setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        const updatedTasks = { ...p.tasks };
        if (updatedTasks[taskId].attachments) {
          const newAttachments = { ...updatedTasks[taskId].attachments };
          delete newAttachments[attachmentId];
          updatedTasks[taskId].attachments = newAttachments;
        }
        return { ...p, tasks: updatedTasks };
      }));
      toast.success('Attachment deleted');
    } catch (error) { console.error('Delete error:', error); toast.error('Failed to delete attachment'); }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  useEffect(() => {
    if (!user?.adminUid || !user?.id) return;
    const employeeRef = ref(database, `users/${user.adminUid}/employees/${user.id}`);
    const unsubscribe = onValue(employeeRef, (snapshot) => {
      const data = snapshot.val();
      setIsTeamLead(data?.role === 'team_leader');
      setIsManager(data?.role === 'team_manager');
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user?.adminUid) return;
    const employeesRef = ref(database, `users/${user.adminUid}/employees`);
    const unsubscribeEmployees = onValue(employeesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setEmployees(data);
    });
    return () => unsubscribeEmployees();
  }, [user?.adminUid]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const projectsRef = ref(database, 'projects');
    const unsubscribe = onValue(projectsRef, (snapshot) => {
      try {
        const data = snapshot.val() as Record<string, FirebaseProjectData> | null;
        if (!data) {
          setProjects([]);
          setLoading(false);
          return;
        }
        const allProjects: Project[] = Object.entries(data).map(([key, value]) => ({
          id: key,
          name: value.name || '',
          description: value.description || '',
          department: value.department || '',
          startDate: value.startDate || '',
          endDate: value.endDate || '',
          priority: value.priority || 'low',
          status: value.status || 'not_started',
          progress: Number(value.progress ?? 0),
          tasks: value.tasks || {},
          assignedTeamLeader: value.assignedTeamLeader,
          assignedEmployees: value.assignedEmployees || [],
        }));

        const filtered = isTeamLead
          ? allProjects.filter(p => p.assignedTeamLeader === user.id)
          : allProjects.filter(p => p.assignedEmployees?.includes(user.id));

        const enhanced = filtered.map(proj => {
          const enhancedTasks: Record<string, Task> = {};
          Object.entries(proj.tasks).forEach(([tid, task]) => {
            enhancedTasks[tid] = {
              ...task,
              id: tid,
              projectId: proj.id,
              dependsOn: task.dependsOn || [],
              assignedToName: task.assignedTo && employees[task.assignedTo] ? employees[task.assignedTo].name : 'Unassigned',
            };
          });
          return { ...proj, tasks: enhancedTasks };
        });

        setProjects(enhanced);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError('Failed to load projects');
        setLoading(false);
      }
    }, (err) => {
      console.error(err);
      setError('Failed to load projects');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, isTeamLead, employees]);

  // ✅ FIXED: updateTaskStatus – now uses fresh state and proper path
  const updateTaskStatus = async (projectId: string, taskId: string, newStatus: string) => {
    if (!user?.id || !newStatus) return;

    try {
      const project = projects.find(p => p.id === projectId);
      const task = project?.tasks[taskId];
      if (!task) {
        toast.error('Task not found');
        return;
      }

      // Check dependencies
      if (task.dependsOn && task.dependsOn.length > 0) {
        const incompleteDeps: string[] = [];
        for (const depId of task.dependsOn) {
          const normalizedId = String(depId).trim();
          const depTask = project.tasks[normalizedId];
          console.log(`Checking ${depId} -> found:`, depTask?.title, depTask?.status);
          if (depTask && depTask.status !== 'completed') {
            incompleteDeps.push(depTask.title || depId);
          } else if (!depTask) {
            console.warn(`Dependency task not found: ${depId}`);
          }
        }
        if (incompleteDeps.length > 0) {
          toast.error(`Cannot update status. Complete: ${incompleteDeps.join(', ')}`);
          return;
        }
      }

      if (task.status === newStatus) {
        toast('Status already set to this value');
        setEditingTaskId(null);
        setNewTaskStatus('');
        return;
      }

      const timestamp = Date.now().toString();
      const isoTime = new Date().toISOString();
      const changes = [{
        field: 'status',
        oldValue: task.status,
        newValue: newStatus,
      }];
      const updateData: TaskUpdate = {
        timestamp: isoTime,
        updatedBy: user.name || (isTeamLead ? 'Team Lead' : 'Employee'),
        updatedById: user.id,
        updatedByRole: isTeamLead ? 'team_lead' : 'employee',
        changes,
        note: `Status updated by ${isTeamLead ? 'Team Lead' : 'Employee'}`,
      };

      await update(ref(database, `projects/${projectId}/tasks/${taskId}`), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
        [`updates/${timestamp}`]: updateData,
      });
      // Send team notification if task is completed
      if (newStatus === 'completed') {
        await sendTeamNotification(project, task, user.name || 'Someone');
      }
      // Update local state
      setProjects(prev =>
        prev.map(p => {
          if (p.id !== projectId) return p;
          const updatedTasks = { ...p.tasks };
          updatedTasks[taskId] = {
            ...updatedTasks[taskId],
            status: newStatus,
            updatedAt: new Date().toISOString(),
            updates: {
              ...(updatedTasks[taskId].updates || {}),
              [timestamp]: updateData,
            },
          };
          return { ...p, tasks: updatedTasks };
        })
      );

      // Send notifications
      const taskTitle = task.title || 'a task';
      const adminNotifications: Promise<void>[] = [];
      const usersSnapshot = await get(ref(database, 'users'));
      usersSnapshot.forEach((userSnap) => {
        const userData = userSnap.val();
        if (userData.role === 'admin') {
          const notifRef = push(ref(database, `notifications/${userSnap.key}`));
          adminNotifications.push(set(notifRef, {
            title: 'Task Status Updated',
            body: `${user?.name} changed status of "${taskTitle}" (${project?.name}) to ${newStatus}`,
            type: 'task_update',
            read: false,
            createdAt: Date.now(),
            taskId: taskId,
            projectId: projectId,
          }));
        }
      });
      if (project?.assignedTeamLeader && project.assignedTeamLeader !== user?.id) {
        const notifRef = push(ref(database, `notifications/${project.assignedTeamLeader}`));
        adminNotifications.push(set(notifRef, {
          title: 'Task Status Updated',
          body: `${user?.name} changed status of "${taskTitle}" to ${newStatus}`,
          type: 'task_update',
          read: false,
          createdAt: Date.now(),
          taskId: taskId,
          projectId: projectId,
        }));
      }
      await Promise.all(adminNotifications);

      toast.success('Task status updated');
      setEditingTaskId(null);
      setNewTaskStatus('');
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task status');
    }
  };

  const addTaskComment = async (projectId: string, taskId: string) => {
    if (!user?.id || !taskComment.trim()) {
      toast.error('Please enter a comment');
      return;
    }
    try {
      const timestamp = Date.now().toString();
      const commentId = timestamp;
      const currentProject = projects.find(p => p.id === projectId);
      const taskTitle = currentProject?.tasks[taskId]?.title || 'a task';
      const commentData: Comment = {
        id: commentId,
        text: taskComment,
        createdAt: new Date().toISOString(),
        createdBy: user.name || (isTeamLead ? 'Team Lead' : 'Employee'),
        createdById: user.id,
        mentions: [],
      };
      await set(ref(database, `projects/${projectId}/tasks/${taskId}/comments/${commentId}`), commentData);
      toast.success('Comment added successfully');
      setTaskComment('');
      setProjects(prev =>
        prev.map(p => {
          if (p.id !== projectId) return p;
          const updatedTasks = { ...p.tasks };
          if (!updatedTasks[taskId].comments) updatedTasks[taskId].comments = {};
          updatedTasks[taskId].comments![commentId] = commentData;
          return { ...p, tasks: updatedTasks };
        })
      );
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const toggleProjectExpand = (projectId: string) => setExpandedProjects(prev => ({ ...prev, [projectId]: !prev[projectId] }));

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
    return date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const isTaskOverdue = (dueDate: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div></div>;
  if (error) return <div className="text-center py-8 text-red-500">{error}</div>;

  return (
    <>
      <style>{`
        .ql-container { overflow: visible !important; }
        .ql-editor { overflow-y: auto !important; }
        .relative { overflow: visible !important; }
        .space-y-2 > .w-full { width: 100% !important; }
      `}</style>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{isTeamLead ? 'Team Projects' : 'My Projects'}</h1>
            <p className="text-gray-600">{isTeamLead ? 'View and manage your team projects' : 'View and update your assigned projects and tasks'}</p>
          </div>
        </motion.div>

        {projects.length === 0 ? (
          <Card><CardContent className="text-center py-12"><FolderOpen className="mx-auto h-12 w-12 text-gray-400" /><h3 className="mt-4 text-lg font-medium text-gray-900">{isTeamLead ? 'No team projects assigned' : 'No projects assigned'}</h3><p className="mt-1 text-gray-500">{isTeamLead ? 'You are not assigned as team lead for any projects' : "You don't have any projects assigned to you yet"}</p></CardContent></Card>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => {
              const tasksArray = Object.values(project.tasks);
              const completedTasksCount = tasksArray.filter(task => task.status === 'completed').length;
              const totalTasksCount = tasksArray.length;
              const progress = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
              const teamMembers = isTeamLead && project.assignedEmployees
                ? project.assignedEmployees.map(employeeId => ({ id: employeeId, name: employees[employeeId]?.name || 'Unknown', email: employees[employeeId]?.email || '' }))
                : [];

              return (
                <Card key={project.id}>
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
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2"><Users className="h-4 w-4" /> Team Members ({teamMembers.length})</h4>
                        <div className="flex flex-wrap gap-2">{teamMembers.map(member => (<Badge key={member.id} variant="outline" className="bg-white">{member.name} ({member.email})</Badge>))}</div>
                      </div>
                    )}

                    <div className="space-y-2 w-full">
                      <div className="flex justify-between text-sm">
                        <span>Overall Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {tasksArray.length > 0 && (
                      <div className="border-t pt-3">
                        <Collapsible>
                          <CollapsibleTrigger className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-md" onClick={() => toggleProjectExpand(project.id)}>
                            <div className="flex items-center gap-2"><span className="font-medium">Tasks ({tasksArray.length})</span></div>
                            {expandedProjects[project.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-2">
                            <div className="space-y-4">
                              {tasksArray.map((task) => {
                                const status = isTaskOverdue(task.dueDate) && task.status !== 'completed' ? 'overdue' : task.status || 'not_started';
                                const taskUpdates = task.updates ? Object.entries(task.updates).sort(([a], [b]) => parseInt(b) - parseInt(a)).map(([ts, upd]) => ({ timestamp: ts, ...upd })) : [];
                                const comments = task.comments ? Object.entries(task.comments).sort(([a], [b]) => parseInt(b) - parseInt(a)).map(([ts, cmt]) => ({ timestamp: ts, ...cmt })) : [];
                                const attachments = task.attachments ? Object.values(task.attachments) : [];

                                // ✅ Check if employee is allowed to see full controls
                                const isAssignedToMe = task.assignedTo === user?.id;
                                const canFullAccess = isTeamLead || isAssignedToMe;

                                return (
                                  <div key={`${project.id}_${task.id}`} className="border rounded-lg p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <h4 className="font-medium">{task.title || 'Untitled Task'}</h4>
                                        {task.description && <p className="text-sm text-gray-600 mt-1">{task.description}</p>}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {canFullAccess && (
                                          <Badge className={getTaskStatusColor(status)}>{status.replace('_', ' ')}</Badge>
                                        )}
                                        <div className="text-right text-sm text-gray-500">
                                          {task.dueDate && (<><div>Due: {formatDate(task.dueDate)}</div><div>{formatTime(task.dueDate)}</div></>)}
                                        </div>
                                      </div>
                                    </div>

                                    {isTeamLead && canFullAccess && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <span className="font-medium">Assigned to:</span>
                                        <Badge variant="outline">{task.assignedToName || 'Unassigned'}</Badge>
                                      </div>
                                    )}

                                    {/* ✅ Only show full details if allowed */}
                                    {canFullAccess ? (
                                      <>
                                        {/* ATTACHMENTS SECTION */}
                                        <div className="border-t pt-3">
                                          <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-sm font-medium">Attachments</h4>
                                            {(isTeamLead || task.assignedTo === user.id) && (
                                              <label className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3">
                                                <Paperclip className="h-4 w-4 mr-1" /> Upload
                                                <input type="file" className="hidden" onChange={(e) => { if (e.target.files && e.target.files[0]) uploadAttachment(project.id, task.id, e.target.files[0]); }} />
                                              </label>
                                            )}
                                          </div>
                                          {attachments.length === 0 ? (<p className="text-xs text-gray-400">No attachments yet</p>) : (
                                            <div className="space-y-2">
                                              {attachments.map(att => (
                                                <div key={att.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    {att.type.startsWith('image/') ? <Image className="h-4 w-4 text-blue-500 flex-shrink-0" /> : <File className="h-4 w-4 text-gray-500 flex-shrink-0" />}
                                                    <span className="truncate">{att.name}</span>
                                                    <span className="text-xs text-gray-400">({formatFileSize(att.size)})</span>
                                                    <span className="text-xs text-gray-400">by {att.uploadedBy}</span>
                                                  </div>
                                                  <div className="flex items-center gap-1">
                                                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-gray-200 rounded"><Download className="h-4 w-4 text-gray-600" /></a>
                                                    {(isTeamLead || att.uploadedById === user.id) && (
                                                      <button onClick={() => deleteAttachment(project.id, task.id, att.id, att.url)} className="p-1 hover:bg-red-100 rounded"><Trash2 className="h-4 w-4 text-red-500" /></button>
                                                    )}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          {uploadingAttachments[`${project.id}_${task.id}`] && (<div className="mt-2 text-xs text-blue-500">Uploading...</div>)}
                                        </div>

                                        {/* Update Status */}
                                        <div className="border-t pt-3">
                                          {editingTaskId === task.id ? (
                                            <div className="space-y-3">
                                              <div className="flex items-center gap-2">
                                                <Select value={newTaskStatus || task.status} onValueChange={setNewTaskStatus}>
                                                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select status" /></SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="not_started">Not Started</SelectItem>
                                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                                    <SelectItem value="completed">Completed</SelectItem>
                                                    <SelectItem value="pending">Pending</SelectItem>
                                                    <SelectItem value="having_issue">Having Issue</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                                <Button size="sm" onClick={() => updateTaskStatus(project.id, task.id, newTaskStatus)}><Save className="h-4 w-4 mr-1" /> Save</Button>
                                                <Button variant="outline" size="sm" onClick={() => { setEditingTaskId(null); setNewTaskStatus(''); }}><X className="h-4 w-4 mr-1" /> Cancel</Button>
                                                {/* ✅ AI Suggest Button */}
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={async () => {
                                                    try {
                                                      const suggestions = await getTaskSuggestions(task.title, task.description);
                                                      toast.success(`AI suggests: ${suggestions.priority} priority, due in ${suggestions.dueDateOffsetDays} days`);
                                                    } catch (error) {
                                                      console.error(error);
                                                      if (error instanceof Error && error.message?.includes('429')) {
                                                        toast.error('AI quota exceeded. Please try again later or upgrade your plan.');
                                                      } else {
                                                        toast.error('AI suggestion failed');
                                                      }
                                                    }
                                                  }}
                                                >
                                                  <Sparkles className="h-4 w-4 mr-1" />
                                                  AI Suggest
                                                </Button>
                                              </div>
                                            </div>
                                          ) : (
                                            <Button variant="outline" size="sm" onClick={() => { setEditingTaskId(task.id); setNewTaskStatus(task.status || 'not_started'); }}><Edit className="h-4 w-4 mr-1" /> Update Status</Button>
                                          )}
                                        </div>

                                        {/* Time Tracking */}
                                        <div className="border-t pt-3">
                                          <h4 className="text-sm font-medium mb-2">Time Tracking</h4>
                                          <div className="flex items-center gap-3">
                                            {runningTimer && runningTimer.taskId === task.id ? (
                                              <Button size="sm" variant="outline" onClick={stopTimer} className="bg-red-50"><StopCircle className="h-4 w-4 mr-1" /> Stop Timer ({formatDuration(timerElapsed)})</Button>
                                            ) : (
                                              <Button size="sm" variant="outline" onClick={() => startTimer(project.id, task.id)}><Play className="h-4 w-4 mr-1" /> Start Timer</Button>
                                            )}
                                            <Button size="sm" variant="outline" onClick={() => openManualLogModal(task)}><Edit className="h-4 w-4 mr-1" /> Log Time</Button>
                                          </div>
                                          <div className="mt-2 text-sm text-gray-600">Total logged: {formatDuration(task.totalTimeSpentMs || 0)}</div>
                                          {task.timeLogs && Object.values(task.timeLogs).slice(0, 2).map((log) => (
                                            <div key={log.id} className="text-xs text-gray-500 mt-1">
                                              {new Date(log.startTime).toLocaleTimeString()} – {formatDuration(log.durationMs || 0)} {log.note && `(${log.note})`}
                                            </div>
                                          ))}
                                        </div>

                                        {/* Task Updates */}
                                        {taskUpdates.length > 0 && (
                                          <div className="border-t pt-3">
                                            <h4 className="text-sm font-medium mb-2">Update History</h4>
                                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                              {taskUpdates.map((update, idx) => (
                                                <div key={idx} className="text-xs bg-gray-50 p-2 rounded">
                                                  <div className="flex justify-between">
                                                    <span className="font-medium">{update.updatedByRole === 'admin' ? 'Admin' : update.updatedByRole === 'team_lead' ? 'Team Lead' : update.updatedBy}</span>
                                                    <span className="text-gray-500">{formatDate(update.timestamp)} {formatTime(update.timestamp)}</span>
                                                  </div>
                                                  <div className="mt-1">
                                                    {update.changes.map((change, i) => (
                                                      <p key={i}>Changed <span className="font-medium">{change.field}</span> from <span className="italic"> "{change.oldValue}"</span> to <span className="font-medium"> "{change.newValue}"</span></p>
                                                    ))}
                                                  </div>
                                                  {update.note && <p className="mt-1 italic">Note: "{update.note}"</p>}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Comments */}
                                        <div className="border-t pt-3">
                                          <h4 className="text-sm font-medium mb-2">Comments</h4>
                                          <div className="space-y-3">
                                            {comments.map((comment, idx) => (
                                              <div key={idx} className="text-sm bg-gray-50 p-3 rounded-lg">
                                                <div className="text-gray-700" dangerouslySetInnerHTML={{ __html: comment.text }} />
                                                <p className="text-xs text-gray-500 mt-1">{comment.createdBy} • {formatDate(comment.createdAt)} • {formatTime(comment.createdAt)}</p>
                                              </div>
                                            ))}
                                            <div className="space-y-2">
                                              <textarea
                                                value={taskComment}
                                                onChange={(e) => setTaskComment(e.target.value)}
                                                placeholder="Add a comment..."
                                                className="w-full p-2 border rounded"
                                              />
                                              <Button size="sm" onClick={() => addTaskComment(project.id, task.id)}>
                                                <MessageSquare className="h-4 w-4 mr-1" /> Add Comment
                                              </Button>
                                            </div>
                                          </div>
                                        </div>
                                      </>
                                    ) : (
                                      // ✅ Minimal view for unassigned tasks (only task name and due date)
                                      <div className="text-xs text-gray-400 italic border-t pt-2 mt-2">
                                        Only assigned employee can view details
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    )}

                    <Collapsible>
                      <CollapsibleTrigger className="w-full text-left p-2 hover:bg-gray-50 rounded">
                        💬 Team Chat
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2">
                        <ProjectChat projectId={project.id} />
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual Time Log Modal */}
      <Dialog open={showManualLogModal} onOpenChange={setShowManualLogModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Time Manually</DialogTitle>
            <DialogDescription>
              Enter the time spent on this task. You can also add a note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Hours</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={manualHours}
                  onChange={(e) => setManualHours(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Minutes</Label>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  step={1}
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="e.g., Code review, bug fixing, etc."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowManualLogModal(false)}>Cancel</Button>
              <Button onClick={saveManualLog}>Save Time</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmployeeProjects;