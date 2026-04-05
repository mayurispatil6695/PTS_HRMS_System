import React, { useState, useEffect } from 'react';
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
import { ref, onValue, off, get, set, remove, update } from 'firebase/database';
import { database } from '../../../firebase';
import { useAuth } from '../../../hooks/useAuth';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../../ui/collapsible';

interface Employee {
  id: string;
  name: string;
  email: string;
  image?: string;
  department: string;
  designation: string;
  status: string;
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
  updatedAt: string;
  updates?: TaskUpdate[];
}

interface TaskUpdate {
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

interface Project {
  id: string;
  name: string;
  description: string;
  projectType: string;
  department: string;
  assignedTeamLeader: string;
  assignedEmployees: string[];
  tasks?: Record<string, Task>;
  startDate: string;
  endDate: string;
  priority: string;
  status: string;
  createdAt: string;
  createdBy: string;
  lastUpdated: string;
  updates?: any[];
}

interface ProjectListItemProps {
  projectId: string;
  employeeId: string;
  index: number;
  onEdit?: (project: Project) => void;
  onDelete?: (projectId: string) => void;
}

const ProjectListItem: React.FC<ProjectListItemProps> = ({
  projectId,
  employeeId,
  index,
  onEdit,
  onDelete
}) => {
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newTaskStatus, setNewTaskStatus] = useState('');
  const [updateNote, setUpdateNote] = useState('');

  const [editData, setEditData] = useState({
    name: '',
    description: '',
    priority: 'medium',
    status: 'not_started',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    if (!user) return;

    const fetchProjectData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch project data
        const projectRef = ref(database, `users/${user.id}/employees/${employeeId}/projects/${projectId}`);
        const projectSnapshot = await get(projectRef);

        if (!projectSnapshot.exists()) {
          throw new Error('Project not found');
        }

        const projectData = projectSnapshot.val();
        const tasks = projectData.tasks ? await fetchTasksWithUpdates(projectData.tasks) : [];

        const fetchedProject: Project = {
          id: projectId,
          name: projectData.name || '',
          description: projectData.description || '',
          projectType: projectData.projectType || 'common',
          department: projectData.department || '',
          assignedTeamLeader: projectData.assignedTeamLeader || '',
          assignedEmployees: projectData.assignedEmployees || [],
          tasks: tasks,
          startDate: projectData.startDate || '',
          endDate: projectData.endDate || '',
          priority: projectData.priority || 'medium',
          status: projectData.status || 'not_started',
          createdAt: projectData.createdAt || '',
          createdBy: projectData.createdBy || '',
          lastUpdated: projectData.lastUpdated || '',
          updates: projectData.updates ? Object.values(projectData.updates) : []
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

        // Fetch employees data
        await fetchAssignedEmployees(fetchedProject);

        setLoading(false);
      } catch (err) {
        console.error('Error fetching project data:', err);
        setError('Failed to load project data');
        setLoading(false);
      }
    };

    const fetchTasksWithUpdates = async (tasksData: Record<string, any>) => {
      const tasks: Task[] = [];
      
      for (const taskId in tasksData) {
        const taskData = tasksData[taskId];
        const updates = taskData.updates ? await processTaskUpdates(taskData.updates) : [];
        
        tasks.push({
          id: taskId,
          title: taskData.title || '',
          description: taskData.description || '',
          assignedTo: taskData.assignedTo || '',
          dueDate: taskData.dueDate || '',
          priority: taskData.priority || 'medium',
          status: taskData.status || 'not_started',
          createdAt: taskData.createdAt || '',
          updatedAt: taskData.updatedAt || '',
          updates: updates
        });
      }
      
      return tasks;
    };

    const processTaskUpdates = async (updatesData: Record<string, any>) => {
      const updates: TaskUpdate[] = [];
      
      for (const timestamp in updatesData) {
        const updateData = updatesData[timestamp];
        const employee = await getEmployeeById(updateData.updatedBy);
        
        updates.push({
          timestamp,
          updatedBy: employee?.name || updateData.updatedBy,
          updatedById: updateData.updatedBy,
          changes: updateData.changes || [],
          note: updateData.note || ''
        });
      }
      
      // Sort updates by timestamp (newest first)
      return updates.sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
    };

    const getEmployeeById = async (employeeId: string) => {
      if (!employeeId) return null;
      
      const employeePath = `users/${user.id}/employees/${employeeId}`;
      const employeeRef = ref(database, employeePath);
      const employeeSnapshot = await get(employeeRef);
      
      if (employeeSnapshot.exists()) {
        const employeeData = employeeSnapshot.val();
        return {
          id: employeeId,
          name: employeeData.name || '',
          email: employeeData.email || '',
          department: employeeData.department || '',
          designation: employeeData.designation || '',
          isActive: employeeData.status === 'active',
        };
      }
      
      return null;
    };

    const fetchAssignedEmployees = async (project: Project) => {
      try {
        const employeesPath = `users/${user.id}/employees`;
        const employeesRef = ref(database, employeesPath);
        const employeesSnapshot = await get(employeesRef);
        const employeesData: Employee[] = [];

        employeesSnapshot.forEach((childSnapshot) => {
          const empId = childSnapshot.key;
          const employeeData = childSnapshot.val();

          if (empId && (project.assignedEmployees.includes(empId) || 
              empId === project.assignedTeamLeader)) {
            employeesData.push({
              id: empId,
              name: employeeData.name || '',
              email: employeeData.email || '',
              image: employeeData.image || '',
              department: employeeData.department || '',
              designation: employeeData.designation || '',
              status: employeeData.status || 'inactive'
            });
          }
        });

        setEmployees(employeesData);
      } catch (err) {
        console.error('Error fetching employees:', err);
      }
    };

    fetchProjectData();

    // Set up real-time listener for project updates
    const projectRef = ref(database, `users/${user.id}/employees/${employeeId}/projects/${projectId}`);
    const unsubscribe = onValue(projectRef, async (snapshot) => {
      if (snapshot.exists()) {
        const projectData = snapshot.val();
        const tasks = projectData.tasks ? await fetchTasksWithUpdates(projectData.tasks) : [];
        
        setProject({
          id: projectId,
          ...projectData,
          tasks: tasks,
          updates: projectData.updates ? Object.values(projectData.updates) : []
        });
      }
    });

    return () => {
      off(projectRef);
    };
  }, [user, projectId, employeeId]);

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
    if (!project || !project.tasks || Object.keys(project.tasks).length === 0) return 0;
    const tasks = Object.values(project.tasks);
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    return Math.round((completedTasks / tasks.length) * 100);
  };

  const toggleTaskExpand = (taskId: string) => {
    setExpandedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const handleEdit = async () => {
    if (!user || !project) return;

    try {
      const updatedProject = {
        ...project,
        ...editData,
        priority: editData.priority as 'low' | 'medium' | 'high' | 'urgent',
        status: editData.status as 'not_started' | 'in_progress' | 'on_hold' | 'completed',
        lastUpdated: new Date().toISOString()
      };

      // Update project for all assigned employees
      const updatePromises = [
        project.assignedTeamLeader,
        ...project.assignedEmployees
      ].filter(Boolean).map(empId => {
        const projectRef = ref(
          database, 
          `users/${user.id}/employees/${empId}/projects/${projectId}`
        );
        return set(projectRef, updatedProject);
      });

      await Promise.all(updatePromises);

      if (onEdit) {
        onEdit(updatedProject);
      }
      
      setIsEditOpen(false);
      toast({
        title: "Project Updated",
        description: "Project has been updated successfully"
      });
    } catch (error) {
      console.error('Error updating project:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update project. Please try again."
      });
    }
  };

  const handleDelete = async () => {
    if (!user || !project) return;
    if (!window.confirm('Are you sure you want to delete this project?')) return;

    try {
      // Delete project from all assigned employees
      const deletePromises = [
        project.assignedTeamLeader,
        ...project.assignedEmployees
      ].filter(Boolean).map(empId => {
        const projectRef = ref(
          database, 
          `users/${user.id}/employees/${empId}/projects/${projectId}`
        );
        return remove(projectRef);
      });

      await Promise.all(deletePromises);

      if (onDelete) {
        onDelete(projectId);
      }
      
      toast({
        title: "Project Deleted",
        description: "Project has been deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete project. Please try again."
      });
    }
  };

  const handleTaskStatusUpdate = async () => {
    if (!user || !project || !selectedTask) return;

    try {
      const timestamp = Date.now().toString();
      const changes = [{
        field: 'status',
        oldValue: selectedTask.status,
        newValue: newTaskStatus
      }];

      const updateData: TaskUpdate = {
        timestamp: timestamp,
        updatedBy: user.name || 'Admin',
        updatedById: user.id,
        changes: changes,
        note: updateNote
      };

      // Update task in all assigned employees' projects
      const updatePath = `tasks/${selectedTask.id}`;
      const updates = {
        [`${updatePath}/status`]: newTaskStatus,
        [`${updatePath}/updatedAt`]: new Date().toISOString(),
        [`${updatePath}/updates/${timestamp}`]: updateData
      };

      const updatePromises = [
        project.assignedTeamLeader,
        ...project.assignedEmployees
      ].filter(Boolean).map(empId => {
        const projectRef = ref(
          database, 
          `users/${user.id}/employees/${empId}/projects/${projectId}`
        );
        return update(projectRef, updates);
      });

      // Also update the main project record
      updatePromises.push(
        update(
          ref(database, `users/${user.id}/projects/${projectId}`),
          updates
        )
      );

      await Promise.all(updatePromises);

      // Update local state
      setProject(prev => {
        if (!prev) return null;
        
        const updatedTasks = prev.tasks ? {
          ...prev.tasks,
          [selectedTask.id]: {
            ...prev.tasks[selectedTask.id],
            status: newTaskStatus,
            updatedAt: new Date().toISOString(),
            updates: [
              updateData,
              ...(prev.tasks[selectedTask.id].updates || [])
            ]
          }
        } : {};

        return {
          ...prev,
          tasks: updatedTasks
        };
      });

      setSelectedTask(null);
      setUpdateNote('');
      setNewTaskStatus('');
      setShowTaskDialog(false);
      
      toast({
        title: "Task Updated",
        description: "Task status has been updated successfully"
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update task. Please try again."
      });
    }
  };

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  const formatUpdateDateTime = (timestamp: string) => {
    try {
      const date = new Date(parseInt(timestamp));
      return format(date, 'MMM dd, yyyy h:mm a');
    } catch {
      return timestamp;
    }
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
      >
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-red-50"
      >
        <div className="text-red-500">{error}</div>
      </motion.div>
    );
  }

  if (!project) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-gray-50"
      >
        <div className="text-gray-500">Project not found</div>
      </motion.div>
    );
  }

  const teamLeader = employees.find(emp => emp.id === project.assignedTeamLeader);
  const assignedEmployees = employees.filter(emp => project.assignedEmployees.includes(emp.id));
  const progress = calculateProgress();
  const tasks = project.tasks ? Object.values(project.tasks) : [];
  const completedTasksCount = tasks.filter(task => task.status === 'completed').length;
  const totalTasksCount = tasks.length;

  // Group tasks by assigned employee
  const tasksByEmployee: Record<string, Task[]> = {};
  tasks.forEach(task => {
    if (!tasksByEmployee[task.assignedTo]) {
      tasksByEmployee[task.assignedTo] = [];
    }
    tasksByEmployee[task.assignedTo].push(task);
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex flex-col space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">{project.name}</h3>
            <p className="text-sm text-gray-600">{project.description}</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Edit Project</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Project Name"
                    value={editData.name}
                    onChange={(e) => setEditData({...editData, name: e.target.value})}
                  />
                  <Textarea
                    placeholder="Description"
                    value={editData.description}
                    onChange={(e) => setEditData({...editData, description: e.target.value})}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Select 
                      value={editData.priority} 
                      onValueChange={(value) => 
                        setEditData({...editData, priority: value})
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select 
                      value={editData.status} 
                      onValueChange={(value) => 
                        setEditData({...editData, status: value})
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">Not Started</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="on_hold">On Hold</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={editData.startDate}
                      onChange={(e) => setEditData({...editData, startDate: e.target.value})}
                    />
                    <Input
                      type="date"
                      value={editData.endDate}
                      onChange={(e) => setEditData({...editData, endDate: e.target.value})}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleEdit} className="flex-1">Save</Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsEditOpen(false)} 
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className={getPriorityColor(project.priority)}>
            {project.priority}
          </Badge>
          <Badge className={getStatusColor(project.status)}>
            {project.status.replace('_', ' ')}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {project.department || 'No Department'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span>{formatDisplayDate(project.startDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span>{formatDisplayDate(project.endDate)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Team Leader:</span>
            {teamLeader ? (
              <div className="flex items-center gap-1">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={teamLeader.image} />
                  <AvatarFallback>{teamLeader.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{teamLeader.name}</span>
              </div>
            ) : (
              <span className="text-sm text-gray-400">Not assigned</span>
            )}
          </div>

          {assignedEmployees.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500 opacity-0" />
              <span className="text-sm font-medium">Team Members:</span>
              <div className="flex flex-wrap items-center gap-1">
                {assignedEmployees.slice(0, 3).map(emp => (
                  <div key={emp.id} className="flex items-center gap-1">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={emp.image} />
                      <AvatarFallback>{emp.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{emp.name}</span>
                  </div>
                ))}
                {assignedEmployees.length > 3 && (
                  <span className="text-xs text-gray-500">
                    +{assignedEmployees.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Tasks:</span>
            <span className="text-sm">
              {completedTasksCount} / {totalTasksCount} completed
            </span>
          </div>
          {totalTasksCount > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-green-500 h-2.5 rounded-full" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}
        </div>

        {/* Tasks Section */}
        {totalTasksCount > 0 && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Task Details</h4>
            {Object.entries(tasksByEmployee).map(([empId, empTasks]) => {
              const employee = employees.find(emp => emp.id === empId);
              if (!employee) return null;

              return (
                <div key={empId} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={employee.image} />
                      <AvatarFallback>{employee.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{employee.name}'s Tasks:</span>
                    <span className="text-xs text-gray-500">
                      {empTasks.filter(t => t.status === 'completed').length} / {empTasks.length} completed
                    </span>
                  </div>

                  <div className="space-y-2 pl-7">
                    {empTasks.map(task => (
                      <div key={task.id} className="border rounded p-2">
                        <div className="flex justify-between items-center">
                          <div>
                            <h5 className="text-sm font-medium">{task.title}</h5>
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
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => toggleTaskExpand(task.id)}
                            >
                              {expandedTasks[task.id] ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        <Collapsible open={expandedTasks[task.id]}>
                          <CollapsibleContent className="mt-2 space-y-2">
                            <div className="flex items-center gap-2 text-xs">
                              <span>Due: {formatDisplayDate(task.dueDate)}</span>
                              <span>Created: {formatDisplayDate(task.createdAt)}</span>
                              {task.updatedAt && (
                                <span>Updated: {formatDisplayDate(task.updatedAt)}</span>
                              )}
                            </div>

                            <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="text-xs h-6"
                                  onClick={() => {
                                    setSelectedTask(task);
                                    setNewTaskStatus(task.status);
                                    setUpdateNote('');
                                  }}
                                >
                                  Update Status
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Update Task Status</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-sm font-medium mb-1">Current Status</label>
                                    <p className="text-sm">{task.status.replace('_', ' ')}</p>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-1">New Status</label>
                                    <Select 
                                      value={newTaskStatus} 
                                      onValueChange={setNewTaskStatus}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="not_started">Not Started</SelectItem>
                                        <SelectItem value="in_progress">In Progress</SelectItem>
                                        <SelectItem value="on_hold">On Hold</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-1">Update Note</label>
                                    <Textarea
                                      placeholder="Describe the update..."
                                      value={updateNote}
                                      onChange={(e) => setUpdateNote(e.target.value)}
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button 
                                    variant="outline"
                                    onClick={() => setShowTaskDialog(false)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button 
                                    onClick={handleTaskStatusUpdate}
                                  >
                                    Save Update
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            {task.updates && task.updates.length > 0 && (
                              <div className="mt-2 border-t pt-2">
                                <h5 className="text-xs font-medium mb-1">Update History</h5>
                                <div className="space-y-2">
                                  {task.updates.map((update, idx) => (
                                    <div key={idx} className="text-xs bg-gray-50 p-2 rounded">
                                      <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-1">
                                          <User className="h-3 w-3" />
                                          <span className="font-medium">{update.updatedBy}</span>
                                        </div>
                                        <span className="text-gray-500">{formatUpdateDateTime(update.timestamp)}</span>
                                      </div>
                                      <div className="mt-1">
                                        {update.changes.map((change, i) => (
                                          <p key={i} className="mt-1">
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

        <div className="text-xs text-gray-500">
          Last updated: {formatDisplayDate(project.lastUpdated)}
        </div>
      </div>
    </motion.div>
  );
};

export default ProjectListItem;