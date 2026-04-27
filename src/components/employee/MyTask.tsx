import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, StopCircle, Edit, Eye, X, Paperclip, Download, Trash2, Image, File, StopCircleIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { ref, get, update, push, set, increment } from 'firebase/database';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { database, storage } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';

// ---------- TYPES ----------
interface TimeLog {
  id?: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  note?: string;
  loggedAt?: number;
  isRunning?: boolean;
}

interface Comment {
  id?: string;
  text: string;
  createdAt: string;
  createdBy: string;
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedBy: string;
  uploadedAt: string;
}

interface Task {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in-progress' | 'completed';
  assignedTo?: string;
  assignedToName?: string;
  createdAt: string;
  updatedAt?: string;
  totalTimeSpentMs?: number;
  timeLogs?: Record<string, TimeLog>;
  comments?: Record<string, Comment>;
  attachments?: Record<string, Attachment>;
  dependsOn?: string[];
  achievementSummary?: string;
}

// Helper type for Firebase task data
interface FirebaseTaskData {
  title?: string;
  description?: string;
  dueDate?: string;
  priority?: string;
  status?: string;
  assignedTo?: string;
  assignedToName?: string;
  createdAt?: string;
  updatedAt?: string;
  totalTimeSpentMs?: number;
  timeLogs?: Record<string, TimeLog>;
  comments?: Record<string, Comment>;
  attachments?: Record<string, Attachment>;
  dependsOn?: string[];
  achievementSummary?: string;
}

interface FirebaseProject {
  name?: string;
  tasks?: Record<string, FirebaseTaskData>;
}

// ---------- COMPONENT ----------
const MyTasks: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [commentText, setCommentText] = useState('');
  const [uploading, setUploading] = useState(false);

  // Time tracking
  const [runningTimer, setRunningTimer] = useState<{ projectId: string; taskId: string; logId: string; startTime: number } | null>(null);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Modals
  const [showManualLogModal, setShowManualLogModal] = useState(false);
  const [manualLogTask, setManualLogTask] = useState<Task | null>(null);
  const [manualHours, setManualHours] = useState(0);
  const [manualMinutes, setManualMinutes] = useState(0);
  const [manualNote, setManualNote] = useState('');
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [pendingTaskForAchievement, setPendingTaskForAchievement] = useState<Task | null>(null);
  const [achievementText, setAchievementText] = useState('');

  const formatDuration = (ms: number): string => {
    if (!ms) return '0m';
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const fetchTasks = async (): Promise<void> => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const projectsSnap = await get(ref(database, 'projects'));
      const projects = projectsSnap.val() as Record<string, FirebaseProject> | null;
      const taskList: Task[] = [];
      if (projects) {
        for (const [projId, proj] of Object.entries(projects)) {
          if (proj.tasks) {
            for (const [taskId, taskData] of Object.entries(proj.tasks)) {
              if (taskData.assignedTo === user.id) {
                taskList.push({
                  id: taskId,
                  projectId: projId,
                  projectName: proj.name || 'Unnamed Project',
                  title: taskData.title || '',
                  description: taskData.description || '',
                  dueDate: taskData.dueDate || '',
                  priority: (taskData.priority as Task['priority']) || 'medium',
                  status: (taskData.status as Task['status']) || 'pending',
                  assignedTo: taskData.assignedTo,
                  assignedToName: taskData.assignedToName,
                  createdAt: taskData.createdAt || new Date().toISOString(),
                  updatedAt: taskData.updatedAt,
                  totalTimeSpentMs: taskData.totalTimeSpentMs || 0,
                  timeLogs: taskData.timeLogs || {},
                  comments: taskData.comments || {},
                  attachments: taskData.attachments || {},
                  dependsOn: taskData.dependsOn || [],
                  achievementSummary: taskData.achievementSummary,
                });
              }
            }
          }
        }
      }
      taskList.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setTasks(taskList);
    } catch (err) {
      console.error(err);
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  const startTimer = async (task: Task): Promise<void> => {
    if (runningTimer) {
      toast.error('Stop current timer first');
      return;
    }
    const logId = Date.now().toString();
    const logRef = ref(database, `projects/${task.projectId}/tasks/${task.id}/timeLogs/${logId}`);
    await set(logRef, {
      employeeId: user?.id,
      employeeName: user?.name,
      startTime: Date.now(),
      endTime: null,
      durationMs: 0,
      note: '',
      loggedAt: Date.now(),
      isRunning: true,
    });
    setRunningTimer({ projectId: task.projectId, taskId: task.id, logId, startTime: Date.now() });
    setTimerElapsed(0);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => setTimerElapsed(prev => prev + 1000), 1000);
    toast.success('Timer started');
  };

  const stopTimer = async (): Promise<void> => {
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
    setTasks(prev =>
      prev.map(t =>
        t.id === taskId && t.projectId === projectId
          ? { ...t, totalTimeSpentMs: (t.totalTimeSpentMs || 0) + duration }
          : t
      )
    );
    toast.success(`Logged ${Math.round(duration / 60000)} minutes`);
  };

  const openManualLogModal = (task: Task): void => {
    setManualLogTask(task);
    setManualHours(0);
    setManualMinutes(0);
    setManualNote('');
    setShowManualLogModal(true);
  };

  const saveManualLog = async (): Promise<void> => {
    if (!manualLogTask) return;
    const durationMs = (manualHours * 60 + manualMinutes) * 60 * 1000;
    if (durationMs <= 0) {
      toast.error('Please enter a positive duration');
      return;
    }
    const logId = Date.now().toString();
    const logRef = ref(database, `projects/${manualLogTask.projectId}/tasks/${manualLogTask.id}/timeLogs/${logId}`);
    await set(logRef, {
      employeeId: user?.id,
      employeeName: user?.name,
      startTime: Date.now() - durationMs,
      endTime: Date.now(),
      durationMs,
      note: manualNote,
      loggedAt: Date.now(),
      isRunning: false,
    });
    const taskRef = ref(database, `projects/${manualLogTask.projectId}/tasks/${manualLogTask.id}`);
    await update(taskRef, { totalTimeSpentMs: increment(durationMs) });
    setTasks(prev =>
      prev.map(t =>
        t.id === manualLogTask.id && t.projectId === manualLogTask.projectId
          ? { ...t, totalTimeSpentMs: (t.totalTimeSpentMs || 0) + durationMs }
          : t
      )
    );
    toast.success(`Logged ${manualHours}h ${manualMinutes}m manually`);
    setShowManualLogModal(false);
  };

  const updateTaskStatus = async (task: Task, newStatus: 'in-progress' | 'completed', achievement?: string): Promise<void> => {
    try {
      const taskRef = ref(database, `projects/${task.projectId}/tasks/${task.id}`);
      const updates: Record<string, string | undefined> = { status: newStatus, updatedAt: new Date().toISOString() };
      if (newStatus === 'completed' && achievement) updates.achievementSummary = achievement;
      await update(taskRef, updates);
      setTasks(prev =>
        prev.map(t =>
          t.id === task.id && t.projectId === task.projectId
            ? { ...t, status: newStatus, updatedAt: new Date().toISOString(), achievementSummary: achievement || t.achievementSummary }
            : t
        )
      );
      toast.success(`Task marked as ${newStatus}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status');
    }
  };

  const handleStatusUpdate = (task: Task, newStatus: 'in-progress' | 'completed'): void => {
    if (newStatus === 'completed') {
      setPendingTaskForAchievement(task);
      setAchievementText('');
      setShowAchievementModal(true);
    } else {
      updateTaskStatus(task, newStatus);
    }
  };

  const completeWithAchievement = async (): Promise<void> => {
    if (!pendingTaskForAchievement) return;
    if (!achievementText.trim()) {
      toast.error('Please enter an achievement summary');
      return;
    }
    await updateTaskStatus(pendingTaskForAchievement, 'completed', achievementText);
    setShowAchievementModal(false);
    setPendingTaskForAchievement(null);
    setAchievementText('');
  };

  const addComment = async (): Promise<void> => {
    if (!selectedTask || !commentText.trim()) return;
    const commentId = Date.now().toString();
    const commentData: Comment = {
      text: commentText,
      createdAt: new Date().toISOString(),
      createdBy: user?.name || 'Employee',
    };
    const commentRef = ref(database, `projects/${selectedTask.projectId}/tasks/${selectedTask.id}/comments/${commentId}`);
    await set(commentRef, commentData);
    toast.success('Comment added');
    setCommentText('');
    const updatedTask: Task = {
      ...selectedTask,
      comments: { ...selectedTask.comments, [commentId]: commentData },
    };
    setSelectedTask(updatedTask);
    setTasks(prev =>
      prev.map(t =>
        t.id === selectedTask.id && t.projectId === selectedTask.projectId ? updatedTask : t
      )
    );
  };

  const uploadAttachment = async (task: Task, file: File): Promise<void> => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/upload`, { method: 'POST', body: formData });
      const data = await response.json() as { secure_url: string };
      const attachmentId = Date.now().toString();
      const attachment: Attachment = {
        id: attachmentId,
        name: file.name,
        url: data.secure_url,
        size: file.size,
        type: file.type,
        uploadedBy: user?.name || 'Employee',
        uploadedAt: new Date().toISOString(),
      };
      const attachmentRef = ref(database, `projects/${task.projectId}/tasks/${task.id}/attachments/${attachmentId}`);
      await set(attachmentRef, attachment);
      const updatedTask: Task = {
        ...task,
        attachments: { ...task.attachments, [attachmentId]: attachment },
      };
      setSelectedTask(updatedTask);
      setTasks(prev =>
        prev.map(t =>
          t.id === task.id && t.projectId === task.projectId ? updatedTask : t
        )
      );
      toast.success('File uploaded');
    } catch (err) {
      console.error(err);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const deleteAttachment = async (task: Task, attachmentId: string): Promise<void> => {
    if (!confirm('Delete this attachment?')) return;
    const attachmentRef = ref(database, `projects/${task.projectId}/tasks/${task.id}/attachments/${attachmentId}`);
    await set(attachmentRef, null);
    const updatedAttachments = { ...task.attachments };
    delete updatedAttachments[attachmentId];
    const updatedTask: Task = { ...task, attachments: updatedAttachments };
    setSelectedTask(updatedTask);
    setTasks(prev =>
      prev.map(t =>
        t.id === task.id && t.projectId === task.projectId ? updatedTask : t
      )
    );
    toast.success('Attachment deleted');
  };

  const filteredTasks = tasks.filter(task => {
    const statusMatch = filterStatus === 'all' || task.status === filterStatus;
    const dateMatch = !filterDate || task.dueDate?.startsWith(filterDate);
    return statusMatch && dateMatch;
  });

  const getStatusBadge = (status: string): string => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'in-progress': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return format(date, 'MMM dd, yyyy');
  };

  const formatDateTime = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return format(date, 'MMM dd, yyyy hh:mm a');
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const isOverdue = (dueDate: string): boolean => dueDate && new Date(dueDate) < new Date();

  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div></div>;
  if (error) return <div className="text-center py-8 text-red-500">{error}</div>;

  return (
    <div className="space-y-6 px-4 sm:px-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Work</h1>
          <p className="text-gray-600">Your assigned tasks across all projects</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-[150px]" />
          <div className="flex gap-1">
            <Button variant={viewMode === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('table')}>Table</Button>
            <Button variant={viewMode === 'card' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('card')}>Card</Button>
          </div>
        </div>
      </motion.div>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-500">No tasks assigned to you.</CardContent></Card>
      ) : viewMode === 'table' ? (
        <Card>
          <CardHeader><CardTitle>Tasks</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time Spent</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map(task => (
                  <TableRow key={`${task.projectId}_${task.id}`} className={cn(isOverdue(task.dueDate) && task.status !== 'completed' && 'bg-red-50')}>
                    <TableCell className="font-medium max-w-[200px] truncate">{task.title}</TableCell>
                    <TableCell>{task.projectName}</TableCell>
                    <TableCell>{formatDate(task.dueDate)}</TableCell>
                    <TableCell><Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge></TableCell>
                    <TableCell><Badge className={getStatusBadge(task.status)}>{task.status}</Badge></TableCell>
                    <TableCell>{formatDuration(task.totalTimeSpentMs || 0)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedTask(task)}><Eye className="h-4 w-4" /></Button>
                        {task.status === 'pending' && <Button size="sm" onClick={() => handleStatusUpdate(task, 'in-progress')}>Start</Button>}
                        {task.status === 'in-progress' && <Button size="sm" onClick={() => handleStatusUpdate(task, 'completed')}>Complete</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map(task => (
            <motion.div key={`${task.projectId}_${task.id}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.02 }}>
              <Card className={cn('h-full', isOverdue(task.dueDate) && task.status !== 'completed' && 'border-red-300 bg-red-50/30')}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base line-clamp-2">{task.title}</CardTitle>
                    <Badge className={getStatusBadge(task.status)}>{task.status}</Badge>
                  </div>
                  <p className="text-xs text-gray-500">{task.projectName}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>
                  <div className="flex justify-between text-xs">
                    <span>Due: {formatDate(task.dueDate)}</span>
                    <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                    <span>⏱ {formatDuration(task.totalTimeSpentMs || 0)}</span>
                  </div>
                  {task.achievementSummary && <div className="text-xs text-green-700 bg-green-50 p-2 rounded line-clamp-2">✅ {task.achievementSummary}</div>}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedTask(task)}>Details</Button>
                    {task.status === 'pending' && <Button size="sm" onClick={() => handleStatusUpdate(task, 'in-progress')}>Start</Button>}
                    {task.status === 'in-progress' && <Button size="sm" onClick={() => handleStatusUpdate(task, 'completed')}>Complete</Button>}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Task Details Modal – read‑only for employees */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">{selectedTask.title}</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedTask(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><Label>Project</Label><p>{selectedTask.projectName}</p></div>
                <div><Label>Status</Label><Badge className={getStatusBadge(selectedTask.status)}>{selectedTask.status}</Badge></div>
                <div><Label>Due Date</Label><p>{formatDate(selectedTask.dueDate)}</p></div>
                <div><Label>Priority</Label><Badge className={getPriorityColor(selectedTask.priority)}>{selectedTask.priority}</Badge></div>
                <div><Label>Created</Label><p>{formatDateTime(selectedTask.createdAt)}</p></div>
                <div><Label>Time Spent</Label><p>{formatDuration(selectedTask.totalTimeSpentMs || 0)}</p></div>
              </div>
              <div><Label>Description</Label><div className="p-3 bg-gray-50 rounded mt-1"><p className="whitespace-pre-line">{selectedTask.description}</p></div></div>
              {selectedTask.achievementSummary && (
                <div><Label>Achievement</Label><div className="p-3 bg-green-50 rounded border-l-4 border-green-500 mt-1"><p>{selectedTask.achievementSummary}</p></div></div>
              )}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-2">Time Tracking</h4>
                <div className="flex gap-2 mb-2">
                  {runningTimer && runningTimer.taskId === selectedTask.id && runningTimer.projectId === selectedTask.projectId ? (
                    <Button size="sm" variant="outline" onClick={stopTimer} className="bg-red-50"><StopCircle className="h-4 w-4 mr-1" /> Stop ({formatDuration(timerElapsed)})</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => startTimer(selectedTask)}><Play className="h-4 w-4 mr-1" /> Start Timer</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openManualLogModal(selectedTask)}><Edit className="h-4 w-4 mr-1" /> Log Time</Button>
                </div>
                <div className="text-sm">Total logged: {formatDuration(selectedTask.totalTimeSpentMs || 0)}</div>
                {selectedTask.timeLogs && Object.values(selectedTask.timeLogs).slice(0, 3).map(log => (
                  <div key={log.id} className="text-xs text-gray-500 mt-1">{new Date(log.startTime).toLocaleDateString()} {new Date(log.startTime).toLocaleTimeString()} – {formatDuration(log.durationMs || 0)} {log.note && `(${log.note})`}</div>
                ))}
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-medium">Attachments</h4>
                  <label className="cursor-pointer text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded">
                    <Paperclip className="h-3 w-3 inline mr-1" /> Upload
                    <input type="file" className="hidden" onChange={async (e) => { if (e.target.files?.[0]) await uploadAttachment(selectedTask, e.target.files[0]); }} />
                  </label>
                </div>
                {Object.values(selectedTask.attachments || {}).length === 0 ? (
                  <p className="text-xs text-gray-400">No attachments</p>
                ) : (
                  <div className="space-y-2">
                    {Object.values(selectedTask.attachments!).map(att => (
                      <div key={att.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {att.type.startsWith('image/') ? <Image className="h-4 w-4 text-blue-500" /> : <File className="h-4 w-4 text-gray-500" />}
                          <span className="truncate">{att.name}</span>
                        </div>
                        <div className="flex gap-1">
                          <a href={att.url} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-gray-200 rounded"><Download className="h-4 w-4" /></a>
                          <button onClick={() => deleteAttachment(selectedTask, att.id)} className="p-1 hover:bg-red-100 rounded"><Trash2 className="h-4 w-4 text-red-500" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-2">Comments</h4>
                <div className="space-y-3 max-h-40 overflow-y-auto mb-3">
                  {Object.values(selectedTask.comments || {}).map(c => (
                    <div key={c.id} className="p-2 bg-gray-50 rounded text-sm">
                      <p>{c.text}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatDateTime(c.createdAt)} by {c.createdBy}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Add a comment..." className="flex-1" />
                  <Button onClick={addComment}>Add</Button>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              {selectedTask.status === 'pending' && <Button onClick={() => handleStatusUpdate(selectedTask, 'in-progress')}>Start Task</Button>}
              {selectedTask.status === 'in-progress' && <Button onClick={() => handleStatusUpdate(selectedTask, 'completed')}>Complete Task</Button>}
              <Button variant="outline" onClick={() => setSelectedTask(null)}>Close</Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Manual Time Log Modal */}
      <Dialog open={showManualLogModal} onOpenChange={setShowManualLogModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Log Time Manually</DialogTitle><DialogDescription>Enter time spent on this task</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Hours</Label><Input type="number" min={0} value={manualHours} onChange={e => setManualHours(parseInt(e.target.value) || 0)} /></div>
              <div><Label>Minutes</Label><Input type="number" min={0} max={59} value={manualMinutes} onChange={e => setManualMinutes(parseInt(e.target.value) || 0)} /></div>
            </div>
            <div><Label>Note</Label><Input value={manualNote} onChange={e => setManualNote(e.target.value)} placeholder="e.g., Code review" /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowManualLogModal(false)}>Cancel</Button><Button onClick={saveManualLog}>Save</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Achievement Modal */}
      <Dialog open={showAchievementModal} onOpenChange={setShowAchievementModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Task Achievement Summary</DialogTitle><DialogDescription>What did you achieve in this task?</DialogDescription></DialogHeader>
          <Textarea value={achievementText} onChange={e => setAchievementText(e.target.value)} rows={4} placeholder="e.g., Fixed login bug, added tests, deployed..." />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowAchievementModal(false)}>Cancel</Button><Button onClick={completeWithAchievement}>Confirm Completion</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyTasks;