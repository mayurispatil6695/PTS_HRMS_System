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
import { ref, push, set, onValue, off, query, orderByChild, DataSnapshot, remove } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { toast } from '../ui/use-toast';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Users, Calendar, Clock, Filter, Search, RefreshCw, Trash2 } from 'lucide-react';

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

interface FirebaseProjectData {
  name: string;
  description?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

interface FirebaseTaskData {
  task: string;
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
  createdAt: string;
  projectId?: string;
  projectName?: string;
  adminId?: string;
  assignedBy?: string;
  assignedByName?: string;
}

/* ================= COMPONENT ================= */

const DailyTaskEmployee = () => {
  const { user } = useAuth();

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
    status: 'pending' as const
  });

  // Combine all tasks (standalone + project tasks)
  const allTasks = useMemo(() => [...taskHistory, ...projectTasks], [taskHistory, projectTasks]);

  /* ================= FETCH ALL EMPLOYEES FROM ALL ADMINS ================= */
  useEffect(() => {
    if (!user) return;

    const employeesRef = ref(database, "users");
    const allEmployees: Employee[] = [];

    const unsubscribeEmployees = onValue(employeesRef, (snapshot: DataSnapshot) => {
      allEmployees.length = 0;

      if (snapshot.exists()) {
        snapshot.forEach((adminSnap: DataSnapshot) => {
          const adminId = adminSnap.key;
          const employeesData = adminSnap.child("employees").val() as Record<string, FirebaseEmployeeData> | null;

          if (employeesData && typeof employeesData === 'object') {
            Object.entries(employeesData).forEach(([key, emp]) => {
              if (emp.status === 'active') {
                allEmployees.push({
                  id: key,
                  name: emp.name || '',
                  email: emp.email || '',
                  department: emp.department || 'No Department',
                  designation: emp.designation || '',
                  status: emp.status || 'active',
                  adminId: adminId || ''
                });
              }
            });
          }
        });
      }

      setEmployees([...allEmployees]);
      setLoading(false);
    }, (error: Error) => {
      console.error('Error fetching employees:', error);
      setLoading(false);
    });

    return () => {
      off(employeesRef);
    };
  }, [user]);

  /* ================= FETCH ALL PROJECTS FROM ALL ADMINS ================= */
  useEffect(() => {
    if (!user) return;

    const projectsRef = ref(database, "users");
    const allProjects: Project[] = [];

    const unsubscribeProjects = onValue(projectsRef, (snapshot: DataSnapshot) => {
      allProjects.length = 0;

      if (snapshot.exists()) {
        snapshot.forEach((adminSnap: DataSnapshot) => {
          const adminId = adminSnap.key;
          const projectsData = adminSnap.child("projects").val() as Record<string, FirebaseProjectData> | null;

          if (projectsData && typeof projectsData === 'object') {
            Object.entries(projectsData).forEach(([key, project]) => {
              allProjects.push({
                id: key,
                name: project.name || '',
                description: project.description || '',
                status: project.status || 'active',
                adminId: adminId || ''
              });
            });
          }
        });
      }

      setProjects([...allProjects]);
    }, (error: Error) => {
      console.error('Error fetching projects:', error);
    });

    return () => {
      off(projectsRef);
    };
  }, [user]);

  // Fetch project tasks from global projects node
  useEffect(() => {
    const projectsRef = ref(database, 'projects');
    const unsubscribe = onValue(projectsRef, (snapshot) => {
      const projectsData = snapshot.val();
      if (!projectsData) {
        setProjectTasks([]);
        return;
      }
      const tasks: DailyTask[] = [];
      for (const [projId, projData] of Object.entries(projectsData) as any[]) {
        if (projData.tasks) {
          for (const [taskId, taskData] of Object.entries(projData.tasks) as any[]) {
            tasks.push({
              id: taskId,
              employeeId: taskData.assignedTo,
              employeeName: taskData.employeeName || '',
              email: taskData.email || '',
              department: taskData.department || '',
              task: taskData.title || taskData.task || '',
              description: taskData.description || '',
              date: taskData.dueDate ? taskData.dueDate.split('T')[0] : '',
              time: '',
              status: taskData.status || 'pending',
              createdAt: taskData.createdAt || new Date().toISOString(),
              projectId: projId,
              projectName: projData.name,
              assignedBy: taskData.createdBy,
              assignedByName: taskData.createdByName,
              adminId: projData.createdBy,
            });
          }
        }
      }
      setProjectTasks(tasks);
    });
    return () => off(projectsRef);
  }, []);

  /* ================= FILTER EMPLOYEES BY DEPARTMENT ================= */
  useEffect(() => {
    if (selectedDepartment) {
      setFilteredEmployees(
        employees.filter(e => e.department === selectedDepartment)
      );
    } else {
      setFilteredEmployees(employees);
    }
  }, [selectedDepartment, employees]);

  /* ================= FETCH ALL STANDALONE TASKS ================= */
  useEffect(() => {
    if (!user || employees.length === 0) return;

    const unsubscribers: (() => void)[] = [];
    const allTasksTemp: DailyTask[] = [];

    const employeesByAdmin = employees.reduce((acc, emp) => {
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

        const unsubscribe = onValue(tasksQuery, (snapshot: DataSnapshot) => {
          const data = snapshot.val() as Record<string, FirebaseTaskData> | null;
          
          const index = allTasksTemp.findIndex(t => t.employeeId === employee.id);
          if (index !== -1) {
            allTasksTemp.splice(index, 1);
          }

          if (data && typeof data === 'object') {
            const tasks: DailyTask[] = Object.entries(data).map(([key, taskData]) => ({
              id: key,
              employeeId: employee.id,
              employeeName: employee.name,
              email: employee.email,
              department: employee.department,
              adminId: adminId,
              task: taskData.task,
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
          
          setTaskHistory([...allTasksTemp].sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ));
        });

        unsubscribers.push(() => off(taskRef));
      });
    });

    return () => unsubscribers.forEach(fn => fn());
  }, [user, employees]);

  /* ================= APPLY FILTERS TO TASKS ================= */
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

    if (filterDate) {
      filtered = filtered.filter(task => task.date === filterDate);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(task => task.status === filterStatus);
    }

    if (filterDepartment !== 'all') {
      filtered = filtered.filter(task => task.department === filterDepartment);
    }

    setFilteredTasks(filtered);
  }, [searchTerm, filterDate, filterStatus, filterDepartment, allTasks]);

  /* ================= DELETE TASK ================= */
  const handleDeleteTask = async (task: DailyTask) => {
    if (!window.confirm(`Are you sure you want to delete the task "${task.task}" for ${task.employeeName}?`)) {
      return;
    }

    if (!task.id) {
      toast({ title: "Error", description: "Task ID not found", variant: "destructive" });
      return;
    }

    try {
      // Determine if it's a standalone or project task
      if (task.projectId) {
        // Project task: delete from global projects node
        const projectTaskRef = ref(database, `projects/${task.projectId}/tasks/${task.id}`);
        await remove(projectTaskRef);
        // Also remove from local projectTasks state
        setProjectTasks(prev => prev.filter(t => t.id !== task.id));
      } else {
        // Standalone task: delete from employee's dailyTasks node
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

  /* ================= SUBMIT TASK ================= */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (!formData.employeeId) {
      return toast({ title: "Please select an employee", variant: "destructive" });
    }

    if (!formData.task.trim()) {
      return toast({ title: "Please enter a task", variant: "destructive" });
    }

    if (taskType === 'project' && (!selectedProject || selectedProject === 'none')) {
      return toast({ title: "Please select a valid project", variant: "destructive" });
    }

    const selectedEmployee = employees.find(emp => emp.id === formData.employeeId);
    if (!selectedEmployee?.adminId) {
      return toast({ title: "Unable to determine employee's admin", variant: "destructive" });
    }

    try {
      const projectData = projects.find(p => p.id === selectedProject);

      const newTask: DailyTask = {
        ...formData,
        createdAt: new Date().toISOString(),
        assignedBy: user.id,
        assignedByName: user.name || 'Admin',
        adminId: selectedEmployee.adminId,
        ...(taskType === 'project' && {
          projectId: selectedProject,
          projectName: projectData?.name || ''
        })
      };

      if (taskType === 'project' && selectedProject) {
        // Save to global projects node
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
          status: newTask.status,
          createdAt: newTask.createdAt,
          createdBy: newTask.assignedBy,
          createdByName: newTask.assignedByName,
        });
      } else {
        // Save to employee's dailyTasks node
        const empTaskRef = push(
          ref(database, `users/${selectedEmployee.adminId}/employees/${formData.employeeId}/dailyTasks`)
        );
        await set(empTaskRef, newTask);
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
        department: ''
      });
      setSelectedProject('');
      setTaskType('standalone');
      setSelectedDepartment('');

    } catch (err) {
      console.error(err);
      toast({ title: "Error saving task", variant: "destructive" });
    }
  };

  const formatDate = (d: string) => format(new Date(d), 'MMM dd, yyyy');
  const formatTime = (t: string) => t.slice(0, 5);

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

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Task Management</h1>
          <p className="text-gray-600">Assign and track tasks across all employees</p>
        </div>
        <Badge variant="outline" className="bg-blue-50">
          <Users className="h-3 w-3 mr-1" />
          {employees.length} Employees
        </Badge>
      </motion.div>

      {/* FORM */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Assign New Task</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Task Type Selection */}
              <Select
                value={taskType}
                onValueChange={(v: 'standalone' | 'project') => setTaskType(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select task type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standalone">Standalone Task</SelectItem>
                  <SelectItem value="project">Project Task</SelectItem>
                </SelectContent>
              </Select>

              {/* Project Selection (if project task) */}
              {taskType === 'project' && (
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Department Selection */}
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Employee Selection */}
              <Select 
                value={formData.employeeId} 
                onValueChange={(id) => {
                  const emp = employees.find(e => e.id === id);
                  setFormData({
                    ...formData,
                    employeeId: id,
                    employeeName: emp?.name || '',
                    email: emp?.email || '',
                    department: emp?.department || ''
                  });
                }}
                disabled={!selectedDepartment && filteredEmployees.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedDepartment ? "Select employee" : "Select department first"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredEmployees.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} - {e.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Task Input */}
              <Input
                placeholder="Task title"
                value={formData.task}
                onChange={e => setFormData({ ...formData, task: e.target.value })}
              />

              {/* Description */}
              <Textarea
                placeholder="Task description"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />

              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                />
                <Input
                  type="time"
                  value={formData.time}
                  onChange={e => setFormData({ ...formData, time: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full">
                Assign Task
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {/* TASKS TABLE */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Tasks ({filteredTasks.length})
              </CardTitle>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Clear Filters
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                placeholder="Filter by date"
              />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tasks Table */}
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
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <div className="flex justify-center items-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        No tasks found matching your filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTasks.map((task, index) => (
                      <motion.tr
                        key={task.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className="border-b hover:bg-gray-50"
                      >
                        <TableCell className="py-3">
                          {formatDate(task.date)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{task.employeeName}</p>
                            <p className="text-xs text-gray-500">{task.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{task.department}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{task.task}</p>
                            {task.description && (
                              <p className="text-xs text-gray-500 truncate max-w-xs">
                                {task.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {task.projectName ? (
                            <Badge variant="outline" className="bg-blue-50">
                              {task.projectName}
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={getBadge(task.status)}>
                            {task.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-gray-400" />
                            <span className="text-sm">{formatTime(task.time)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTask(task)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </motion.tr>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default DailyTaskEmployee;