// This is the complete file with fixes. Replace your existing EmployeeProjects.tsx.

import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
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
  timeLogs?: Record<string, any>;
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
  const [showMention, setShowMention] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const quillRef = useRef<any>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);
  const [isManager, setIsManager] = useState(false);
  const [runningTimer, setRunningTimer] = useState<{ projectId: string; taskId: string; logId: string; startTime: number } | null>(null);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'clean']
    ]
  };

  const employeesList = useMemo(() => Object.values(employees).map(emp => ({ id: emp.id, name: emp.name })), [employees]);

  const filteredEmployees = useMemo(() => {
    if (!mentionFilter) return employeesList;
    return employeesList.filter(emp => emp.name.toLowerCase().includes(mentionFilter.toLowerCase()));
  }, [employeesList, mentionFilter]);

  const formatDuration = (ms: number) => {
    if (!ms) return '0m';
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const startTimer = async (projectId: string, taskId: string) => {
    if (runningTimer) return;
    const logId = Date.now().toString();
    const logRef = ref(database, `projects/${projectId}/tasks/${taskId}/timeLogs/${logId}`);
    await set(logRef, {
      employeeId: user?.id,
      employeeName: user?.name,
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
    timerIntervalRef.current = setInterval(() => setTimerElapsed(prev => prev + 1000), 1000);
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

  const openManualLogModal = (task: Task) => toast.error('Manual time log coming soon');

  const insertMention = (employeeName: string) => {
    if (!quillRef.current) return;
    const editor = quillRef.current.getEditor();
    const selection = editor.getSelection();
    if (!selection) return;
    const cursorPos = selection.index;
    const textBeforeCursor = editor.getText(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      editor.deleteText(lastAtIndex, cursorPos - lastAtIndex);
      editor.insertText(lastAtIndex, `@${employeeName} `);
      editor.setSelection(lastAtIndex + employeeName.length + 2);
    }
    setShowMention(false);
    setMentionFilter('');
  };

  const handleEditorChange = (content: string, delta: any, source: string, editor: any) => {
    setTaskComment(content);
    if (source !== 'user') return;
    const selection = editor.getSelection();
    if (!selection) { setShowMention(false); return; }
    const cursorPos = selection.index;
    const textBeforeCursor = editor.getText(0, cursorPos);
    const match = textBeforeCursor.match(/@([\w\s]*)$/);
    if (match) {
      const filter = match[1];
      setMentionFilter(filter);
      setShowMention(true);
      const bounds = editor.getBounds(cursorPos - filter.length - 1, 1);
      const editorElement = document.querySelector('.ql-editor');
      if (editorElement) {
        const editorRect = editorElement.getBoundingClientRect();
        setMentionPosition({
          top: bounds.top - editorRect.top + bounds.height + 5,
          left: bounds.left - editorRect.left
        });
      }
    } else {
      setShowMention(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mentionDropdownRef.current && !mentionDropdownRef.current.contains(e.target as Node)) setShowMention(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, []);

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

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@([^@\s]+(?: [^@\s]+)*)/g;
    const matches = text.matchAll(mentionRegex);
    const mentionedNames = [...matches].map(m => m[1]);
    return employeesList.filter(emp => mentionedNames.includes(emp.name)).map(emp => emp.id);
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

  // Determine if user is team lead (legacy) – we now use role, but keep for compatibility
  useEffect(() => {
    if (!user?.adminUid || !user?.id) return;
    const employeeRef = ref(database, `users/${user.adminUid}/employees/${user.id}`);
    const unsubscribe = onValue(employeeRef, (snapshot) => {
      const data = snapshot.val();
      setIsTeamLead(data?.role === 'team_leader');
    });
    return () => unsubscribe();
  }, [user]);

  // Load all employees
  useEffect(() => {
    if (!user?.adminUid) return;
    const employeesRef = ref(database, `users/${user.adminUid}/employees`);
    const unsubscribeEmployees = onValue(employeesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setEmployees(data);
    });
    return () => unsubscribeEmployees();
  }, [user?.adminUid]);

  // Fetch projects
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

  // FIXED: updateTaskStatus – no new task created, only updates existing task
  const updateTaskStatus = async (projectId: string, taskId: string) => {
    if (!user?.id || !newTaskStatus) return;
    try {
      const timestamp = Date.now().toString();
      const isoTime = new Date().toISOString();
      const changes = [{
        field: 'status',
        oldValue: projects.find(p => p.id === projectId)?.tasks[taskId]?.status || '',
        newValue: newTaskStatus,
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
        status: newTaskStatus,
        updatedAt: new Date().toISOString(),
        [`updates/${timestamp}`]: updateData,
      });

      // ✅ Notify admin and team lead about task status change
      const project = projects.find(p => p.id === projectId);
      const taskTitle = project?.tasks[taskId]?.title || 'a task';
      const adminNotifications: Promise<void>[] = [];

      // Notify all admins
      const usersSnapshot = await get(ref(database, 'users'));
      usersSnapshot.forEach((userSnap) => {
        const userData = userSnap.val();
        if (userData.role === 'admin') {
          const notifRef = push(ref(database, `notifications/${userSnap.key}`));
          adminNotifications.push(set(notifRef, {
            title: 'Task Status Updated',
            body: `${user?.name} changed status of "${taskTitle}" (${project?.name}) to ${newTaskStatus}`,
            type: 'task_update',
            read: false,
            createdAt: Date.now(),
            taskId: taskId,
            projectId: projectId,
          }));
        }
      });
      // Notify team lead if not the same user
      if (project?.assignedTeamLeader && project.assignedTeamLeader !== user?.id) {
        const notifRef = push(ref(database, `notifications/${project.assignedTeamLeader}`));
        adminNotifications.push(set(notifRef, {
          title: 'Task Status Updated',
          body: `${user?.name} changed status of "${taskTitle}" to ${newTaskStatus}`,
          type: 'task_update',
          read: false,
          createdAt: Date.now(),
          taskId: taskId,
          projectId: projectId,
        }));
      }
      await Promise.all(adminNotifications);

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
              [timestamp]: updateData,
            },
          };
          return { ...p, tasks: updatedTasks };
        })
      );
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
      const mentionedUserIds = extractMentions(taskComment);
      const commentData: Comment = {
        id: commentId,
        text: taskComment,
        createdAt: new Date().toISOString(),
        createdBy: user.name || (isTeamLead ? 'Team Lead' : 'Employee'),
        createdById: user.id,
        mentions: mentionedUserIds,
      };
      await set(ref(database, `projects/${projectId}/tasks/${taskId}/comments/${commentId}`), commentData);
      for (const userId of mentionedUserIds) {
        if (userId === user.id) continue;
        const notifRef = push(ref(database, `notifications/${userId}`));
        await set(notifRef, {
          title: `New mention from ${user.name}`,
          body: `${user.name} mentioned you in a comment on task "${taskTitle}"`,
          read: false,
          createdAt: Date.now(),
          taskId: taskId,
          projectId: projectId,
          type: 'mention',
        });
      }
      setProjects(prev =>
        prev.map(p => {
          if (p.id !== projectId) return p;
          const updatedTasks = { ...p.tasks };
          if (!updatedTasks[taskId].comments) updatedTasks[taskId].comments = {};
          updatedTasks[taskId].comments![commentId] = commentData;
          return { ...p, tasks: updatedTasks };
        })
      );
      toast.success('Comment added successfully');
      setTaskComment('');
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
        .mention-dropdown {
          position: absolute;
          z-index: 50;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
          max-height: 160px;
          overflow-y: auto;
          min-width: 150px;
        }
        .mention-dropdown-item {
          padding: 0.5rem 1rem;
          cursor: pointer;
          font-size: 0.875rem;
        }
        .mention-dropdown-item:hover {
          background-color: #f3f4f6;
        }
        .ql-container {
          overflow: visible !important;
        }
        .ql-editor {
          overflow-y: auto !important;
        }
        .relative {
          overflow: visible !important;
        }
        /* Fix progress bar alignment */
        .space-y-2 > .w-full {
          width: 100% !important;
        }
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

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm"><span>Overall Progress</span><span>{progress}%</span></div>
                      <Progress value={progress} className="h-2 w-full" />
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

                                return (
                                  <div key={`${project.id}_${task.id}`} className="border rounded-lg p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                      <div><h4 className="font-medium">{task.title || 'Untitled Task'}</h4>{task.description && <p className="text-sm text-gray-600 mt-1">{task.description}</p>}</div>
                                      <div className="flex items-center gap-2">
                                        <Badge className={getTaskStatusColor(status)}>{status.replace('_', ' ')}</Badge>
                                        <div className="text-right text-sm text-gray-500">{task.dueDate && (<><div>Due: {formatDate(task.dueDate)}</div><div>{formatTime(task.dueDate)}</div></>)}</div>
                                      </div>
                                    </div>

                                    {isTeamLead && (<div className="flex items-center gap-2 text-sm"><span className="font-medium">Assigned to:</span><Badge variant="outline">{task.assignedToName || 'Unassigned'}</Badge></div>)}

                                    {/* ATTACHMENTS SECTION */}
                                    <div className="border-t pt-3">
                                      <div className="flex items-center justify-between mb-2"><h4 className="text-sm font-medium">Attachments</h4>{(isTeamLead || task.assignedTo === user.id) && (<label className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"><Paperclip className="h-4 w-4 mr-1" /> Upload<input type="file" className="hidden" onChange={(e) => { if (e.target.files && e.target.files[0]) uploadAttachment(project.id, task.id, e.target.files[0]); }} /></label>)}</div>
                                      {attachments.length === 0 ? (<p className="text-xs text-gray-400">No attachments yet</p>) : (<div className="space-y-2">{attachments.map(att => (<div key={att.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"><div className="flex items-center gap-2 flex-1 min-w-0">{att.type.startsWith('image/') ? <Image className="h-4 w-4 text-blue-500 flex-shrink-0" /> : <File className="h-4 w-4 text-gray-500 flex-shrink-0" />}<span className="truncate">{att.name}</span><span className="text-xs text-gray-400">({formatFileSize(att.size)})</span><span className="text-xs text-gray-400">by {att.uploadedBy}</span></div><div className="flex items-center gap-1"><a href={att.url} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-gray-200 rounded"><Download className="h-4 w-4 text-gray-600" /></a>{(isTeamLead || att.uploadedById === user.id) && (<button onClick={() => deleteAttachment(project.id, task.id, att.id, att.url)} className="p-1 hover:bg-red-100 rounded"><Trash2 className="h-4 w-4 text-red-500" /></button>)}</div></div>))}</div>)}
                                      {uploadingAttachments[`${project.id}_${task.id}`] && (<div className="mt-2 text-xs text-blue-500">Uploading...</div>)}
                                    </div>

                                    {/* Update Status */}
                                    <div className="border-t pt-3">
                                      {isTeamLead || task.assignedTo === user.id ? (
                                        editingTaskId === task.id ? (
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
                                              <Button size="sm" onClick={() => updateTaskStatus(project.id, task.id)}><Save className="h-4 w-4 mr-1" /> Save</Button>
                                              <Button variant="outline" size="sm" onClick={() => { setEditingTaskId(null); setNewTaskStatus(''); }}><X className="h-4 w-4 mr-1" /> Cancel</Button>
                                            </div>
                                          </div>
                                        ) : (
                                          <Button variant="outline" size="sm" onClick={() => { setEditingTaskId(task.id); setNewTaskStatus(task.status || 'not_started'); }}><Edit className="h-4 w-4 mr-1" /> Update Status</Button>
                                        )
                                      ) : (<div className="text-xs text-gray-400">Only assigned employee can update</div>)}
                                    </div>

                                    {/* Time Tracking */}
                                    <div className="border-t pt-3">
                                      <h4 className="text-sm font-medium mb-2">Time Tracking</h4>
                                      <div className="flex items-center gap-3">
                                        {runningTimer && runningTimer.taskId === task.id ? (<Button size="sm" variant="outline" onClick={stopTimer} className="bg-red-50"><StopCircle className="h-4 w-4 mr-1" /> Stop Timer ({formatDuration(timerElapsed)})</Button>) : (<Button size="sm" variant="outline" onClick={() => startTimer(project.id, task.id)}><Play className="h-4 w-4 mr-1" /> Start Timer</Button>)}
                                        <Button size="sm" variant="outline" onClick={() => openManualLogModal(task)}><Edit className="h-4 w-4 mr-1" /> Log Time</Button>
                                      </div>
                                      <div className="mt-2 text-sm text-gray-600">Total logged: {formatDuration(task.totalTimeSpentMs || 0)}</div>
                                      {task.timeLogs && Object.values(task.timeLogs).slice(0, 2).map((log: any) => (<div key={log.id} className="text-xs text-gray-500 mt-1">{new Date(log.startTime).toLocaleTimeString()} – {formatDuration(log.durationMs)} {log.note && `(${log.note})`}</div>))}
                                    </div>

                                    {/* Task Updates */}
                                    {taskUpdates.length > 0 && (<div className="border-t pt-3"><h4 className="text-sm font-medium mb-2">Update History</h4><div className="space-y-2 max-h-40 overflow-y-auto">{taskUpdates.map((update, idx) => (<div key={idx} className="text-xs bg-gray-50 p-2 rounded"><div className="flex justify-between"><span className="font-medium">{update.updatedByRole === 'admin' ? 'Admin' : update.updatedByRole === 'team_lead' ? 'Team Lead' : update.updatedBy}</span><span className="text-gray-500">{formatDate(update.timestamp)} {formatTime(update.timestamp)}</span></div><div className="mt-1">{update.changes.map((change, i) => (<p key={i}>Changed <span className="font-medium">{change.field}</span> from <span className="italic"> "{change.oldValue}"</span> to <span className="font-medium"> "{change.newValue}"</span></p>))}</div>{update.note && <p className="mt-1 italic">Note: "{update.note}"</p>}</div>))}</div></div>)}

                                    {/* Comments */}
                                    <div className="border-t pt-3">
                                      <h4 className="text-sm font-medium mb-2">Comments</h4>
                                      <div className="space-y-3">
                                        {comments.map((comment, idx) => (<div key={idx} className="text-sm bg-gray-50 p-3 rounded-lg"><div className="text-gray-700" dangerouslySetInnerHTML={{ __html: comment.text }} /><p className="text-xs text-gray-500 mt-1">{comment.createdBy} • {formatDate(comment.createdAt)} • {formatTime(comment.createdAt)}</p></div>))}
                                        <div className="space-y-2 relative">
                                          <ReactQuill ref={quillRef} value={taskComment} onChange={handleEditorChange} placeholder="Add a comment... (use @ to mention someone)" modules={quillModules} />
                                          {showMention && (<div ref={mentionDropdownRef} className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto min-w-[180px]" style={{ top: `${mentionPosition.top + (document.querySelector('.ql-editor')?.getBoundingClientRect().top || 0)}px`, left: `${mentionPosition.left + (document.querySelector('.ql-editor')?.getBoundingClientRect().left || 0)}px` }}>{filteredEmployees.length > 0 ? filteredEmployees.map(emp => (<div key={emp.id} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm border-b last:border-b-0" onClick={() => insertMention(emp.name)}>{emp.name}</div>)) : <div className="px-4 py-2 text-sm text-gray-500">No employees found</div>}</div>)}
                                          <Button size="sm" onClick={() => addTaskComment(project.id, task.id)}><MessageSquare className="h-4 w-4 mr-1" /> Add Comment</Button>
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
    </>
  );
};

export default EmployeeProjects;