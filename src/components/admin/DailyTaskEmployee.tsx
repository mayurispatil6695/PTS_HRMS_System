// src/components/admin/DailyTaskEmployee.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, CardHeader, CardTitle, CardContent
} from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '../ui/table';
import { ref, push, set, onValue, off, query, orderByChild, DataSnapshot, remove, get } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { toast } from '../ui/use-toast';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Users, Calendar, Clock, Filter, Search, RefreshCw, Trash2, Paperclip } from 'lucide-react';
import { MessageSquare } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
/* ================= TYPES ================= */

interface FirebaseEmployeeData {
  name: string;
  email: string;
  department: string;
  designation?: string;
  status: string;
  phone?: string;
  profileImage?: string;
}

interface FirebaseTaskData {
  title: string;
  description?: string;
  date: string;
  time: string;
  status: 'pending' | 'in-progress' | 'completed';
  createdAt: string;
  projectId?: string;
  projectName?: string;
  assignedBy?: string;
  assignedByName?: string;
  adminId?: string;
  employeeId?: string;
  employeeName?: string;
  email?: string;
  department?: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  designation?: string;
  status: string;
  adminId: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  status?: string;
  adminId: string;
}

interface Comment {
  id: string;
  text: string;
  createdAt: string;
  createdBy: string;
  createdById: string;
  mentions?: string[];
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

interface DailyTask {
  id?: string;
  employeeId: string;
  employeeName: string;
  email?: string;
  department: string;
  task: string;
  description: string;
  date: string;
  time: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority?: 'low' | 'medium' | 'high';
  createdAt: string;
  projectId?: string;
  projectName?: string;
  adminId?: string;
  assignedBy?: string;
  assignedByName?: string;
  comments?: Comment[];
  attachments?: Attachment[]; // ✅ ADDED
}

interface DailyTaskEmployeeProps {
  role?: 'admin' | 'team_manager' | 'team_leader' | 'client' | 'employee';
  userId?: string;
  readOnly?: boolean;
  department?: string; // for manager filtering
}

/* ================= COMPONENT ================= */

const DailyTaskEmployee: React.FC<DailyTaskEmployeeProps> = ({
  role: propRole,
  userId: propUserId,
  readOnly = false,
  department: propDepartment,
}) => {
  const { user: authUser } = useAuth();
  const effectiveRole = propRole || authUser?.role || 'employee';
  const effectiveUserId = propUserId || authUser?.id || '';
  const effectiveDepartment = propDepartment || authUser?.department || '';

  const isAdmin = effectiveRole === 'admin';
  const isTeamManager = effectiveRole === 'team_manager';
  const isTeamLeader = effectiveRole === 'team_leader';
  const isClient = effectiveRole === 'client';
  const isEmployee = effectiveRole === 'employee';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskHistory, setTaskHistory] = useState<DailyTask[]>([]);
  const [projectTasks, setProjectTasks] = useState<DailyTask[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<DailyTask[]>([]);

  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [taskType, setTaskType] = useState<'standalone' | 'project'>('standalone');
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const getTime = () => new Date().toTimeString().slice(0, 5);

  const [formData, setFormData] = useState({
    employeeId: '',
    employeeName: '',
    email: '',
    department: '',
    task: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    time: getTime(),
    status: 'pending' as const,
    priority: 'medium' as 'low' | 'medium' | 'high',
  });

  // Can assign tasks? Only admin or team manager (or team leader if allowed)
  const canAssignTasks = !readOnly && (isAdmin || isTeamManager);

  // All tasks (deduplicated)
  const allTasks = useMemo(() => {
    const map = new Map<string, DailyTask>();
    projectTasks.forEach(task => {
      const key = task.projectId ? `${task.projectId}_${task.id}` : `standalone_${task.id}`;
      map.set(key, task);
    });
    taskHistory.forEach(task => {
      const key = `standalone_${task.id}`;
      if (!map.has(key)) map.set(key, task);
    });
    return Array.from(map.values());
  }, [taskHistory, projectTasks]);

  // Fetch all employees (non‑admin)
  useEffect(() => {
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const allEmployees: Employee[] = [];
      snapshot.forEach((childSnapshot) => {
        const uid = childSnapshot.key;
        const userData = childSnapshot.val();
        if (userData.role === 'admin') return;
        const profile = userData.profile || userData.employee;
        if (!profile || !profile.name) return;
        if (profile.status !== 'active') return;
        const adminId = profile.adminUid || '';
        allEmployees.push({
          id: uid || '',
          name: profile.name || '',
          email: profile.email || '',
          department: profile.department || 'No Department',
          designation: profile.designation || '',
          status: profile.status || 'active',
          adminId: adminId,
        });
      });
      setEmployees(allEmployees);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });
    return () => off(usersRef);
  }, []);

  // Fetch all projects (for dropdown)
  useEffect(() => {
    const projectsRef = ref(database, 'projects');
    const unsubscribe = onValue(projectsRef, (snapshot) => {
      const data = snapshot.val() as Record<string, { name: string; status?: string }> | null;
      if (!data) {
        setProjects([]);
        return;
      }
      const allProjects: Project[] = Object.entries(data).map(([id, proj]) => ({
        id,
        name: proj.name || '',
        description: '',
        status: proj.status || 'active',
        adminId: '',
      }));
      setProjects(allProjects);
    });
    return () => off(projectsRef);
  }, []);

  // Fetch project tasks from global `/projects` node
  useEffect(() => {
    const projectsRef = ref(database, 'projects');
    const unsubscribe = onValue(projectsRef, (snapshot) => {
      const projectsData = snapshot.val() as Record<string, {
        name: string;
        tasks?: Record<string, {
          assignedTo?: string;
          employeeName?: string;
          email?: string;
          department?: string;
          title?: string;
          description?: string;
          dueDate?: string;
          status?: string;
          createdAt?: string;
          createdBy?: string;
          createdByName?: string;
        }>;
        createdBy?: string;
      }> | null;

      if (!projectsData) {
        setProjectTasks([]);
        return;
      }

      const tasks: DailyTask[] = [];
      for (const [projId, projData] of Object.entries(projectsData)) {
        if (projData.tasks) {
          for (const [taskId, taskData] of Object.entries(projData.tasks)) {
            tasks.push({
              id: taskId,
              employeeId: taskData.assignedTo || '',
              employeeName: taskData.employeeName || '',
              email: taskData.email || '',
              department: taskData.department || '',
              task: taskData.title || '',
              description: taskData.description || '',
              date: taskData.dueDate ? taskData.dueDate.split('T')[0] : '',
              time: '',
              status: (taskData.status as DailyTask['status']) || 'pending',
              createdAt: taskData.createdAt || new Date().toISOString(),
              projectId: projId,
              projectName: projData.name,
              assignedBy: taskData.createdBy,
              assignedByName: taskData.createdByName,
              adminId: projData.createdBy,
              comments: [],
              attachments: [], // initialize empty
            });
          }
        }
      }

      // Filter tasks based on role
      let filteredTasks = tasks;
      if (isAdmin) {
        // keep all
      } else if (isTeamManager && effectiveDepartment) {
        filteredTasks = tasks.filter(t => t.department === effectiveDepartment);
      } else if (isTeamLeader) {
        filteredTasks = tasks.filter(t => t.department === effectiveDepartment);
      } else if (isClient) {
        filteredTasks = [];
      } else {
        // Employee: only their own tasks
        filteredTasks = tasks.filter(t => t.employeeId === effectiveUserId);
      }

      // Fetch comments AND attachments for each task asynchronously
      const fetchCommentsAndAttachments = async () => {
        const tasksWithData = await Promise.all(
          filteredTasks.map(async (task) => {
            if (!task.projectId || !task.id) return task;
            const commentsRef = ref(database, `projects/${task.projectId}/tasks/${task.id}/comments`);
            const commentsSnapshot = await get(commentsRef);
            const commentsData = commentsSnapshot.val();
            const comments = commentsData ? Object.values(commentsData) as Comment[] : [];

            const attachmentsRef = ref(database, `projects/${task.projectId}/tasks/${task.id}/attachments`);
            const attachmentsSnapshot = await get(attachmentsRef);
            const attachmentsData = attachmentsSnapshot.val();
            const attachments = attachmentsData ? Object.values(attachmentsData) as Attachment[] : [];

            return { ...task, comments, attachments };
          })
        );
        setProjectTasks(tasksWithData);
      };

      fetchCommentsAndAttachments();
    });
    return () => off(projectsRef);
  }, [isAdmin, isTeamManager, isTeamLeader, isClient, effectiveUserId, effectiveDepartment]);

  // Filter employees by department (for assignment form)
  useEffect(() => {
    if (selectedDepartment) {
      setFilteredEmployees(employees.filter(e => e.department === selectedDepartment));
    } else {
      setFilteredEmployees(employees);
    }
  }, [selectedDepartment, employees]);

  // Fetch standalone tasks (daily tasks)
  useEffect(() => {
    if (!effectiveUserId) return;

    const unsubscribers: (() => void)[] = [];
    const allTasksTemp: DailyTask[] = [];

    // For admin/manager, fetch all employees' tasks; for others, only own tasks
    let targetEmployees: Employee[] = [];
    if (isAdmin || isTeamManager) {
      targetEmployees = employees;
    } else if (isTeamLeader) {
      targetEmployees = employees.filter(e => e.department === effectiveDepartment);
    } else if (isClient) {
      targetEmployees = [];
    } else {
      const self = employees.find(e => e.id === effectiveUserId);
      if (self) targetEmployees = [self];
    }

    const employeesByAdmin = targetEmployees.reduce((acc, emp) => {
      if (emp.adminId) {
        if (!acc[emp.adminId]) acc[emp.adminId] = [];
        acc[emp.adminId].push(emp);
      }
      return acc;
    }, {} as Record<string, Employee[]>);

    Object.entries(employeesByAdmin).forEach(([adminId, adminEmployees]) => {
      adminEmployees.forEach(employee => {
        const taskRef = ref(database, `users/${adminId}/employees/${employee.id}/dailyTasks`);
        const tasksQuery = query(taskRef, orderByChild('createdAt'));

        const unsubscribe = onValue(tasksQuery, (snapshot) => {
          const data = snapshot.val() as Record<string, FirebaseTaskData> | null;
          const filtered = allTasksTemp.filter(t => t.employeeId !== employee.id);
          allTasksTemp.length = 0;
          allTasksTemp.push(...filtered);

          if (data && typeof data === 'object') {
            const tasks: DailyTask[] = Object.entries(data).map(([key, taskData]) => ({
              id: key,
              employeeId: employee.id,
              employeeName: employee.name,
              email: employee.email,
              department: employee.department,
              adminId: adminId,
              task: taskData.title,
              description: taskData.description || '',
              date: taskData.date,
              time: taskData.time,
              status: taskData.status,
              createdAt: taskData.createdAt,
              projectId: taskData.projectId,
              projectName: taskData.projectName,
              assignedBy: taskData.assignedBy,
              assignedByName: taskData.assignedByName
            }));
            allTasksTemp.push(...tasks);
          }
          setTaskHistory([...allTasksTemp].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        });
        unsubscribers.push(() => off(taskRef));
      });
    });

    return () => unsubscribers.forEach(fn => fn());
  }, [employees, isAdmin, isTeamManager, isTeamLeader, isClient, effectiveUserId, effectiveDepartment]);

  // Apply filters
  useEffect(() => {
    let filtered = [...allTasks];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(task =>
        task.employeeName?.toLowerCase().includes(term) ||
        task.task?.toLowerCase().includes(term) ||
        task.department?.toLowerCase().includes(term)
      );
    }
    if (filterDate) filtered = filtered.filter(task => task.date === filterDate);
    if (filterStatus !== 'all') filtered = filtered.filter(task => task.status === filterStatus);
    if (filterDepartment !== 'all') filtered = filtered.filter(task => task.department === filterDepartment);
    setFilteredTasks(filtered);
  }, [searchTerm, filterDate, filterStatus, filterDepartment, allTasks]);

  // Delete task (admin only or manager for department tasks)
  const handleDeleteTask = async (task: DailyTask) => {
    if (!isAdmin && !(isTeamManager && task.department === effectiveDepartment)) {
      toast({ title: "Unauthorized", description: "You don't have permission to delete this task", variant: "destructive" });
      return;
    }
    if (!window.confirm(`Delete "${task.task}" for ${task.employeeName}?`)) return;
    if (!task.id) {
      toast({ title: "Error", description: "Task ID not found", variant: "destructive" });
      return;
    }
    try {
      if (task.projectId) {
        const projectTaskRef = ref(database, `projects/${task.projectId}/tasks/${task.id}`);
        await remove(projectTaskRef);
        setProjectTasks(prev => prev.filter(t => t.id !== task.id));
      } else {
        if (!task.adminId || !task.employeeId) {
          toast({ title: "Error", description: "Unable to determine admin or employee", variant: "destructive" });
          return;
        }
        const taskRef = ref(database, `users/${task.adminId}/employees/${task.employeeId}/dailyTasks/${task.id}`);
        await remove(taskRef);
        setTaskHistory(prev => prev.filter(t => t.id !== task.id));
      }
      toast({ title: "Success", description: "Task deleted successfully" });
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
    }
  };

  // Submit new task (only admin or manager)
   // Submit new task (only admin or manager)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAssignTasks) {
      toast({ title: "Unauthorized", description: "You don't have permission to assign tasks", variant: "destructive" });
      return;
    }
    if (!formData.employeeId) return toast({ title: "Please select an employee", variant: "destructive" });
    if (!formData.task.trim()) return toast({ title: "Please enter a task", variant: "destructive" });
    if (taskType === 'project' && (!selectedProject || selectedProject === 'none')) {
      return toast({ title: "Please select a valid project", variant: "destructive" });
    }
    const selectedEmployee = employees.find(emp => emp.id === formData.employeeId);
    if (!selectedEmployee?.adminId) return toast({ title: "Unable to determine employee's admin", variant: "destructive" });

    try {
      const projectData = projects.find(p => p.id === selectedProject);
      const newTask: DailyTask = {
        ...formData,
        createdAt: new Date().toISOString(),
        assignedBy: effectiveUserId,
        assignedByName: authUser?.name || 'Admin',
        adminId: selectedEmployee.adminId,
        ...(taskType === 'project' && {
          projectId: selectedProject,
          projectName: projectData?.name || ''
        })
      };

      if (taskType === 'project' && selectedProject) {
        const projectRef = ref(database, `projects/${selectedProject}/tasks`);
        const newTaskRef = push(projectRef);
        await set(newTaskRef, {
          title: newTask.task,
          description: newTask.description,
          assignedTo: newTask.employeeId,
          employeeName: newTask.employeeName,
          email: newTask.email,
          department: newTask.department,
          dueDate: newTask.date,
          time: newTask.time,
          status: newTask.status,
          priority: newTask.priority, // ✅ ADDED
          createdAt: newTask.createdAt,
          createdBy: newTask.assignedBy,
          createdByName: newTask.assignedByName,
        });
        // ✅ Notification for project task (with projectId)
        const notifRef = push(ref(database, `notifications/${formData.employeeId}`));
        await set(notifRef, {
          title: 'New Task Assigned',
          body: `You have been assigned a new task: ${formData.task}`,
          type: 'task_assigned',
          read: false,
          createdAt: Date.now(),
          taskId: newTaskRef.key,
          projectId: selectedProject,
        });
      } else {
        const empTaskRef = push(ref(database, `users/${selectedEmployee.adminId}/employees/${formData.employeeId}/dailyTasks`));
        await set(empTaskRef, {
          title: newTask.task,
          description: newTask.description,
          date: newTask.date,
          time: newTask.time,
          status: newTask.status,
          priority: newTask.priority, // ✅ ADDED
          createdAt: newTask.createdAt,
          assignedBy: newTask.assignedBy,
          assignedByName: newTask.assignedByName,
          employeeId: newTask.employeeId,
          employeeName: newTask.employeeName,
          email: newTask.email,
          department: newTask.department,
          adminId: newTask.adminId,
        });
        // ✅ Notification for standalone task (NO projectId)
        const notifRef = push(ref(database, `notifications/${formData.employeeId}`));
        await set(notifRef, {
          title: 'New Task Assigned',
          body: `You have been assigned a new task: ${formData.task}`,
          type: 'task_assigned',
          read: false,
          createdAt: Date.now(),
          taskId: empTaskRef.key,
        });
      }

      toast({ title: "Task Added Successfully ✅", variant: "default" });
      setFormData({
        ...formData,
        task: '',
        description: '',
        time: getTime(),
        employeeId: '',
        employeeName: '',
        email: '',
        department: '',
        priority: 'medium',
      });
      setSelectedProject('');
      setTaskType('standalone');
      setSelectedDepartment('');
    } catch (err) {
      console.error(err);
      toast({ title: "Error saving task", variant: "destructive" });
    }
  };
  const formatDate = (d: string) => {
    if (!d) return 'Invalid date';
    const date = new Date(d);
    if (isNaN(date.getTime())) return 'Invalid date';
    return format(date, 'MMM dd, yyyy');
  };
  const formatTime = (t: string) => t ? t.slice(0, 5) : '';

  const getBadge = (status: string) => {
    if (status === 'completed') return 'bg-green-100 text-green-700';
    if (status === 'in-progress') return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterDate('');
    setFilterStatus('all');
    setFilterDepartment('all');
  };

  const departments = [...new Set(employees.map(emp => emp.department))].filter(Boolean);

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="p-4 space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Task Management</h1>
          <p className="text-gray-600">
            {isAdmin ? 'Assign and track tasks across all employees' :
              isTeamManager ? `Manage tasks for ${effectiveDepartment} department` :
                isTeamLeader ? 'Manage your team tasks' :
                  'View your assigned tasks'}
          </p>
        </div>
        <Badge variant="outline" className="bg-blue-50">
          <Users className="h-3 w-3 mr-1" /> {employees.length} Employees
        </Badge>
      </motion.div>

      {/* ASSIGN TASK FORM – only for admin/manager */}
      {canAssignTasks && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader><CardTitle>Assign New Task</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Select value={taskType} onValueChange={(v: 'standalone' | 'project') => setTaskType(v)}>
                  <SelectTrigger><SelectValue placeholder="Select task type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standalone">Standalone Task</SelectItem>
                    <SelectItem value="project">Project Task</SelectItem>
                  </SelectContent>
                </Select>
                {taskType === 'project' && (
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                    <SelectContent>
                      {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={formData.employeeId} onValueChange={(id) => {
                  const emp = employees.find(e => e.id === id);
                  setFormData({ ...formData, employeeId: id, employeeName: emp?.name || '', email: emp?.email || '', department: emp?.department || '' });
                }} disabled={!selectedDepartment && filteredEmployees.length === 0}>
                  <SelectTrigger><SelectValue placeholder={selectedDepartment ? "Select employee" : "Select department first"} /></SelectTrigger>
                  <SelectContent>
                    {filteredEmployees.map(e => <SelectItem key={e.id} value={e.id}>{e.name} - {e.email}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="Task title" value={formData.task} onChange={e => setFormData({ ...formData, task: e.target.value })} />
                <Textarea placeholder="Task description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} />
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Priority</label>
                      <Select value={formData.priority} onValueChange={(val) => setFormData({ ...formData, priority: val as 'low' | 'medium' | 'high' })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Due Date</label>
                      <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Time</label>
                      <Input type="time" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
                    </div>
                  </div>
                                  </div>
                <Button type="submit" className="w-full">Assign Task</Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* TASKS TABLE */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Tasks ({filteredTasks.length})</CardTitle>
              <Button variant="outline" size="sm" onClick={clearFilters}><RefreshCw className="h-3 w-3 mr-1" /> Clear Filters</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input placeholder="Search tasks..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} placeholder="Filter by date" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Comments</TableHead>
                    <TableHead>Attachments</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-gray-500">No tasks found</TableCell></TableRow>
                  ) : (
                    filteredTasks.map((task, index) => {
                      const uniqueKey = task.projectId ? `${task.projectId}_${task.id}` : `standalone_${task.id}`;
                      const canDelete = isAdmin || (isTeamManager && task.department === effectiveDepartment);
                      return (
                        <motion.tr key={uniqueKey} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.02 }} className="border-b hover:bg-gray-50">
                          <TableCell className="py-3">{formatDate(task.date)}</TableCell>
                          <TableCell>
                            <div><p className="font-medium">{task.employeeName}</p><p className="text-xs text-gray-500">{task.email}</p></div>
                          </TableCell>
                          <TableCell><Badge variant="outline">{task.department}</Badge></TableCell>
                          <TableCell>
                            <div><p className="font-medium">{task.task}</p>{task.description && <p className="text-xs text-gray-500 truncate max-w-xs">{task.description}</p>}</div>
                          </TableCell>
                          <TableCell>{task.projectName ? <Badge variant="outline" className="bg-blue-50">{task.projectName}</Badge> : '-'}</TableCell>
                          <TableCell><Badge className={getBadge(task.status)}>{task.status}</Badge></TableCell>
                          <TableCell><div className="flex items-center gap-1"><Clock className="h-3 w-3 text-gray-400" /><span className="text-sm">{formatTime(task.time)}</span></div></TableCell>
                          <TableCell>
                            <Collapsible>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="gap-1">
                                  <MessageSquare className="h-4 w-4" />
                                  {task.comments?.length || 0}
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="space-y-2 mt-2">
                                {task.comments?.map((comment: Comment) => (
                                  <div key={comment.id} className="text-xs p-2 bg-gray-50 rounded">
                                    <div className="font-medium">{comment.createdBy}</div>
                                    <div dangerouslySetInnerHTML={{ __html: comment.text }} />
                                    <div className="text-gray-400 mt-1">
                                      {formatDate(comment.createdAt)} {formatTime(comment.createdAt)}
                                    </div>
                                  </div>
                                ))}
                              </CollapsibleContent>
                            </Collapsible>
                          </TableCell>


                          <TableCell>
                            {task.attachments && task.attachments.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {task.attachments.slice(0, 2).map((att) => {
                                  const isImage = att.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(att.name);
                                  return isImage ? (
                                    <button
                                      key={att.id}
                                      onClick={() => setPreviewImage(att.url)}
                                      className="text-blue-500 hover:underline text-xs flex items-center gap-1 text-left"
                                    >
                                      <Paperclip className="h-3 w-3" />
                                      {att.name.length > 20 ? att.name.slice(0, 20) + '…' : att.name}
                                    </button>
                                  ) : (
                                    <a
                                      key={att.id}
                                      href={att.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-500 hover:underline text-xs flex items-center gap-1"
                                    >
                                      <Paperclip className="h-3 w-3" />
                                      {att.name.length > 20 ? att.name.slice(0, 20) + '…' : att.name}
                                    </a>
                                  );
                                })}
                                {task.attachments.length > 2 && (
                                  <span className="text-xs text-gray-400">+{task.attachments.length - 2} more</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </TableCell>



                          <TableCell>
                            {canDelete && (
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteTask(task)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </motion.tr>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      {/* Image Preview Modal */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Image Preview</DialogTitle>
             <DialogDescription className="sr-only">
              Preview of the uploaded image attachment.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center">
            <img src={previewImage || ''} alt="Preview" className="max-w-full max-h-[70vh] object-contain" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DailyTaskEmployee;
