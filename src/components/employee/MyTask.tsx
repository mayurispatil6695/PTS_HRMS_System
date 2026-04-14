import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, AlertCircle, Calendar, Bell, Eye, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ref, onValue, off, update, get, push, set } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { Input } from '../ui/input';
import { toast } from 'react-hot-toast';

interface TaskComment {
  text: string;
  createdAt: string;
  createdBy: string;
}

interface StandaloneTaskData {
  department?: string;
  task?: string;
  description?: string;
  date?: string;
  time?: string;
  status?: 'pending' | 'in-progress' | 'completed';
  createdAt?: string;
  updatedAt?: string;
  startedAt?: string;
  completedAt?: string;
  progressUpdates?: { text: string; createdAt: string }[];
  comments?: TaskComment[];
  assignedBy?: string;
  assignedByName?: string;
}

interface ProjectTaskData {
  assignedTo?: string;
  employeeName?: string;
  department?: string;
  title?: string;
  description?: string;
  dueDate?: string;
  status?: 'pending' | 'in-progress' | 'completed';
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  createdByName?: string;
}

interface FirebaseProjectData {
  tasks?: Record<string, ProjectTaskData>;
  department?: string;
}

interface DailyTask {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  task: string;
  description: string;
  date: string;
  time: string;
  status: 'pending' | 'in-progress' | 'completed';
  createdAt: string;
  updatedAt?: string;
  startedAt?: string;
  completedAt?: string;
  completionNote?: string;
  progressUpdates?: { text: string; createdAt: string }[];
  comments?: TaskComment[];
  assignedBy?: string;
  assignedByName?: string;
  projectId?: string;
  adminId?: string;
}

const MyTasks: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<DailyTask | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [progressText, setProgressText] = useState('');

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const fetchAllTasks = async () => {
      try {
        const adminNamesMap: Record<string, string> = {};

        // 2. Fetch standalone tasks
        let adminId = user.adminUid;
        if (!adminId) {
          const profileRef = ref(database, `users/${user.id}/profile`);
          const profileSnap = await get(profileRef);
          adminId = profileSnap.val()?.adminUid || '';
        }

        const standaloneTasks: DailyTask[] = [];
        if (adminId) {
          const standaloneRef = ref(database, `users/${adminId}/employees/${user.id}/dailyTasks`);
          const snapshot = await get(standaloneRef);
          const data = snapshot.val() as Record<string, StandaloneTaskData> | null;
          if (data) {
            for (const [id, taskData] of Object.entries(data)) {
              let assignedByName = taskData.assignedByName;
              if (!assignedByName && adminId && !adminNamesMap[adminId]) {
                const adminRef = ref(database, `users/${adminId}`);
                const adminSnap = await get(adminRef);
                const adminData = adminSnap.val();
                assignedByName = adminData?.name || adminData?.profile?.name || adminId.slice(0, 8);
                adminNamesMap[adminId] = assignedByName;
              } else if (adminId && adminNamesMap[adminId]) {
                assignedByName = adminNamesMap[adminId];
              }

              standaloneTasks.push({
                id,
                employeeId: user.id,
                employeeName: user.name || '',
                department: taskData.department || '',
                task: taskData.task || '',
                description: taskData.description || '',
                date: taskData.date || '',
                time: taskData.time || '',
                status: taskData.status || 'pending',
                createdAt: taskData.createdAt || new Date().toISOString(),
                updatedAt: taskData.updatedAt,
                startedAt: taskData.startedAt,
                completedAt: taskData.completedAt,
                progressUpdates: taskData.progressUpdates,
                comments: taskData.comments,
                assignedBy: taskData.assignedBy,
                assignedByName: assignedByName || taskData.assignedBy || 'Admin',
                adminId: adminId,
              });
            }
          }
        }

        // 3. Fetch project tasks
        const projectsRef = ref(database, 'projects');
        const projectsSnap = await get(projectsRef);
        const projects = projectsSnap.val() as Record<string, FirebaseProjectData> | null;
        const projectTasks: DailyTask[] = [];

        if (projects) {
          for (const [projId, proj] of Object.entries(projects)) {
            if (proj.tasks) {
              for (const [taskId, taskData] of Object.entries(proj.tasks)) {
                if (taskData.assignedTo === user.id) {
                  projectTasks.push({
                    id: taskId,
                    employeeId: user.id,
                    employeeName: taskData.employeeName || user.name || '',
                    department: taskData.department || proj.department || '',
                    task: taskData.title || '',
                    description: taskData.description || '',
                    date: taskData.dueDate ? taskData.dueDate.split('T')[0] : '',
                    time: '',
                    status: taskData.status || 'pending',
                    createdAt: taskData.createdAt || new Date().toISOString(),
                    updatedAt: taskData.updatedAt,
                    assignedBy: taskData.createdBy,
                    assignedByName: taskData.createdByName || 'Admin',
                    projectId: projId,
                  });
                }
              }
            }
          }
        }

        // Combine and sort
        const allTasks = [...standaloneTasks, ...projectTasks];
        allTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTasks(allTasks);
      } catch (err) {
        console.error(err);
        setError('Failed to load tasks');
      } finally {
        setLoading(false);
      }
    };

    fetchAllTasks();
  }, [user]);

  const handleStatusUpdate = async (task: DailyTask, newStatus: 'in-progress' | 'completed') => {
    if (!user?.id) return;

    try {
      let taskRef;
      const updates: Partial<DailyTask> = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };
      if (newStatus === 'in-progress') updates.startedAt = new Date().toISOString();
      if (newStatus === 'completed') updates.completedAt = new Date().toISOString();

      if (task.projectId) {
        // Project task
        taskRef = ref(database, `projects/${task.projectId}/tasks/${task.id}`);
        const snapshot = await get(taskRef);
        if (!snapshot.exists()) {
          toast.error('Task not found in project. It may have been deleted.');
          return;
        }
        await update(taskRef, updates);
        toast.success(`Task marked as ${newStatus}`);
      } else {
        // Standalone task
        const adminId = task.adminId || user.adminUid;
        if (!adminId) throw new Error('No admin ID');
        taskRef = ref(database, `users/${adminId}/employees/${user.id}/dailyTasks/${task.id}`);
        const snapshot = await get(taskRef);
        if (!snapshot.exists()) {
          toast.error('Task not found. It may have been deleted.');
          return;
        }
        await update(taskRef, updates);
        toast.success(`Task marked as ${newStatus}`);
      }

      // Notify all admins about task status change (for standalone tasks)
      if (!task.projectId) {
        const usersSnapshot = await get(ref(database, 'users'));
        const adminNotifications: Promise<void>[] = [];
        usersSnapshot.forEach((userSnap) => {
          const userData = userSnap.val();
          if (userData.role === 'admin') {
            const notifRef = push(ref(database, `notifications/${userSnap.key}`));
            adminNotifications.push(set(notifRef, {
              title: 'Task Status Updated',
              body: `${user?.name} changed status of "${task.task}" to ${newStatus}`,
              type: 'task_update',
              read: false,
              createdAt: Date.now(),
              taskId: task.id,
            }));
          }
        });
        await Promise.all(adminNotifications);
      }

      // Update local state
      setTasks(prev =>
        prev.map(t =>
          t.id === task.id && t.projectId === task.projectId
            ? { ...t, status: newStatus, updatedAt: new Date().toISOString() }
            : t
        )
      );
    } catch (err) {
      console.error(err);
      toast.error('Failed to update task');
    }
  };

  const handleAddProgress = async () => {
    if (!selectedTask || !user || !progressText.trim()) return;

    try {
      if (selectedTask.projectId) {
        const taskRef = ref(database, `projects/${selectedTask.projectId}/tasks/${selectedTask.id}`);
        const current = (await get(taskRef)).val() as { progressUpdates?: { text: string; createdAt: string }[] };
        const updates = current?.progressUpdates || [];
        await update(taskRef, {
          progressUpdates: [...updates, { text: progressText, createdAt: new Date().toISOString() }],
          updatedAt: new Date().toISOString(),
        });
      } else {
        const adminId = selectedTask.adminId || user.adminUid;
        if (!adminId) throw new Error('No admin ID');
        const taskRef = ref(database, `users/${adminId}/employees/${user.id}/dailyTasks/${selectedTask.id}`);
        const current = (await get(taskRef)).val() as { progressUpdates?: { text: string; createdAt: string }[] };
        const updates = current?.progressUpdates || [];
        await update(taskRef, {
          progressUpdates: [...updates, { text: progressText, createdAt: new Date().toISOString() }],
          updatedAt: new Date().toISOString(),
        });
      }
      toast.success('Progress added');
      setProgressText('');
      const updatedTask = { ...selectedTask, progressUpdates: [...(selectedTask.progressUpdates || []), { text: progressText, createdAt: new Date().toISOString() }] };
      setSelectedTask(updatedTask);
    } catch (err) {
      console.error(err);
      toast.error('Failed to add progress');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'in-progress': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Invalid date';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return format(date, 'MMM dd, yyyy');
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return format(date, 'MMM dd, yyyy hh:mm a');
  };

  const filteredTasks = tasks.filter(task => {
    const statusMatch = filterStatus === 'all' || task.status === filterStatus;
    const dateMatch = !filterDate || task.date === filterDate;
    return statusMatch && dateMatch;
  });

  const clearDateFilter = () => setFilterDate('');

  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div></div>;
  if (error) return <div className="text-center py-8 text-red-500">{error}</div>;

  return (
    <div className="space-y-6 px-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">My Daily Tasks</h1>
          <p className="text-sm sm:text-base text-gray-600">View your assigned tasks</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-[180px]">
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              placeholder="Filter by date"
              className="w-full"
            />
            {filterDate && (
              <button
                onClick={clearDateFilter}
                className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="flex-1 sm:w-auto"
            >
              Table
            </Button>
            <Button
              variant={viewMode === 'card' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('card')}
              className="flex-1 sm:w-auto"
            >
              Card
            </Button>
          </div>
        </div>
      </motion.div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 px-4">
            <CheckCircle className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 text-center">No tasks assigned</h3>
            <p className="text-gray-500 mt-1 text-center">
              You don't have any tasks assigned to you yet
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'table' ? (
        <Card>
          <CardHeader>
            <CardTitle>Task List</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead className="hidden sm:table-cell">Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Assigned By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => (
                  <TableRow key={`${task.projectId || 'standalone'}_${task.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{formatDate(task.date)}</span>
                        <span className="text-xs text-gray-500">{task.time}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">{task.task}</TableCell>
                    <TableCell className="hidden sm:table-cell max-w-[200px] truncate">{task.description}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(task.status)}>{task.status}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{task.assignedByName || task.assignedBy || 'Admin'}</TableCell>
                    <TableCell className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedTask(task)}>
                        <Eye className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">View</span>
                      </Button>
                      {task.status === 'pending' && (
                        <Button size="sm" onClick={() => handleStatusUpdate(task, 'in-progress')}>
                          Start
                        </Button>
                      )}
                      {task.status === 'in-progress' && (
                        <Button size="sm" onClick={() => handleStatusUpdate(task, 'completed')}>
                          Complete
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => (
            <motion.div
              key={`${task.projectId || 'standalone'}_${task.id}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
              className="w-full"
            >
              <Card className="h-full">
                <CardHeader>
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-base line-clamp-2">{task.task}</CardTitle>
                    <Badge className={`whitespace-nowrap ${getStatusBadge(task.status)}`}>
                      {task.status}
                    </Badge>
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500">
                    Assigned on {formatDate(task.createdAt)} by {task.assignedByName || task.assignedBy || 'Admin'}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label>Description</Label>
                      <p className="text-sm text-gray-700 mt-1 line-clamp-3">{task.description}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Due Date</Label>
                        <p className="text-sm">
                          {formatDate(task.date)}
                          <span className="block text-xs text-gray-500">{task.time}</span>
                        </p>
                      </div>
                      <div>
                        <Label>Department</Label>
                        <p className="text-sm truncate">{task.department}</p>
                      </div>
                    </div>
                    {task.comments && task.comments.length > 0 && (
                      <div>
                        <Label>Comments ({task.comments.length})</Label>
                        <div className="space-y-2 mt-2 max-h-20 overflow-y-auto">
                          {task.comments.slice(0, 2).map((c, i) => (
                            <div key={i} className="border-l-2 pl-2 border-gray-200">
                              <p className="text-sm line-clamp-2">{c.text}</p>
                              <p className="text-xs text-gray-500">
                                {formatDate(c.createdAt)} by {c.createdBy}
                              </p>
                            </div>
                          ))}
                          {task.comments.length > 2 && (
                            <p className="text-xs text-gray-500">+{task.comments.length - 2} more comments</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setSelectedTask(task)}>
                      <Eye className="h-4 w-4 sm:mr-2" /> Details
                    </Button>
                    {task.status === 'pending' && (
                      <Button size="sm" onClick={() => handleStatusUpdate(task, 'in-progress')}>
                        Start
                      </Button>
                    )}
                    {task.status === 'in-progress' && (
                      <Button size="sm" onClick={() => handleStatusUpdate(task, 'completed')}>
                        Complete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold line-clamp-1">Task Details: {selectedTask.task}</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedTask(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="overflow-y-auto p-4 sm:p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <Label className="text-gray-500">Task Title</Label>
                  <p className="font-medium">{selectedTask.task}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500">Status</Label>
                  <Badge className={getStatusBadge(selectedTask.status)}>{selectedTask.status}</Badge>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500">Assigned Date</Label>
                  <p>{formatDate(selectedTask.date)} at {selectedTask.time}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500">Assigned By</Label>
                  <p>{selectedTask.assignedByName || selectedTask.assignedBy || 'Admin'}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500">Department</Label>
                  <p>{selectedTask.department}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500">Created At</Label>
                  <p>{formatDateTime(selectedTask.createdAt)}</p>
                </div>
                {selectedTask.updatedAt && (
                  <div className="space-y-2">
                    <Label className="text-gray-500">Last Updated</Label>
                    <p>{formatDateTime(selectedTask.updatedAt)}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-gray-500">Description</Label>
                <div className="p-3 bg-gray-50 rounded-md">
                  <p className="whitespace-pre-line text-gray-700">{selectedTask.description}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Add Work Update</Label>
                <Input
                  value={progressText}
                  onChange={(e) => setProgressText(e.target.value)}
                  placeholder="What did you work on?"
                />
                <Button onClick={handleAddProgress}>Add Update</Button>
              </div>

              {selectedTask.progressUpdates && selectedTask.progressUpdates.length > 0 && (
                <div className="space-y-2">
                  <Label>Work Updates</Label>
                  {selectedTask.progressUpdates.map((u, i) => (
                    <div key={i} className="p-2 bg-gray-100 rounded">
                      <p>{u.text}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(u.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}

              {selectedTask.comments && selectedTask.comments.length > 0 && (
                <div className="space-y-4">
                  <Label className="text-gray-500">Comments ({selectedTask.comments.length})</Label>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {selectedTask.comments.map((c, i) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-md border-l-4 border-gray-300">
                        <p className="text-sm text-gray-700">{c.text}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDateTime(c.createdAt)} by {c.createdBy}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button onClick={() => setSelectedTask(null)} className="w-full sm:w-auto">
                  Close
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default MyTasks;