import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Clock, Check, X, AlertTriangle, FileText, Calendar, User, Link, Edit, Trash2, Filter, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';
import { useAuth } from '../../../hooks/useAuth';
import { database } from '../../../firebase';
import { ref, onValue, push, set, remove, update } from 'firebase/database';
import { toast } from '../../ui/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { Calendar as CalendarComp } from '../../ui/calendar';
import { Label } from '@/components/ui/label';

interface Task {
  id: string;
  date: string;
  employeeName: string;
  employeeId: string;
  department: string;
  designation: string;
  taskTitle: string;
  taskType: string;
  priority: string;
  assignedBy: string;
  assignedDate: string;
  startTime: string;
  endTime: string;
  totalDuration: string;
  status: string;
  workSummary: string;
  pendingWork: string;
  challenges: string;
  verifiedBy: string;
  managerRemarks: string;
  employeeRemarks: string;
  attachments: string[];
}

const DailyTask = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [currentTask, setCurrentTask] = useState<Partial<Task>>({
    date: new Date().toISOString().split('T')[0],
    employeeName: user?.name || '',
    employeeId: user?.id || '',
    department: user?.department || '',
    designation: user?.designation || '',
    status: 'pending',
    priority: 'medium'
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);

  useEffect(() => {
    if (!user?.id || !user?.adminUid) {
      setLoading(false);
      return;
    }

    const tasksRef = ref(database, `users/${user.adminUid}/employees/${user.id}/dailytask`);
    
    const unsubscribe = onValue(tasksRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          const tasksList: Task[] = Object.entries(data).map(([key, value]) => ({
            id: key,
            ...(value as Omit<Task, 'id'>)
          }));
          tasksList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setTasks(tasksList);
          setFilteredTasks(tasksList);
        } else {
          setTasks([]);
          setFilteredTasks([]);
        }
      } catch (error) {
        console.error("Error fetching tasks:", error);
        toast({
          title: "Error",
          description: "Failed to load tasks",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (dateFilter) {
      const filtered = tasks.filter(task => {
        const taskDate = new Date(task.date);
        return (
          taskDate.getDate() === dateFilter.getDate() &&
          taskDate.getMonth() === dateFilter.getMonth() &&
          taskDate.getFullYear() === dateFilter.getFullYear()
        );
      });
      setFilteredTasks(filtered);
    } else {
      setFilteredTasks(tasks);
    }
  }, [dateFilter, tasks]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentTask(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setCurrentTask(prev => ({ ...prev, [name]: value }));
  };

  const calculateDuration = (start: string, end: string) => {
    if (!start || !end) return 'N/A';
    
    const startTime = new Date(`2000-01-01T${start}`);
    const endTime = new Date(`2000-01-01T${end}`);
    
    const diffMs = endTime.getTime() - startTime.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id || !user?.adminUid) {
      toast({
        title: "Error",
        description: "User information not available",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const duration = calculateDuration(currentTask.startTime || '', currentTask.endTime || '');
      
      const taskData: Omit<Task, 'id'> = {
        date: currentTask.date || '',
        employeeName: currentTask.employeeName || '',
        employeeId: currentTask.employeeId || '',
        department: currentTask.department || '',
        designation: currentTask.designation || '',
        taskTitle: currentTask.taskTitle || '',
        taskType: currentTask.taskType || '',
        priority: currentTask.priority || 'medium',
        assignedBy: currentTask.assignedBy || '',
        assignedDate: currentTask.assignedDate || '',
        startTime: currentTask.startTime || '',
        endTime: currentTask.endTime || '',
        totalDuration: duration,
        status: currentTask.status || 'pending',
        workSummary: currentTask.workSummary || '',
        pendingWork: currentTask.pendingWork || '',
        challenges: currentTask.challenges || '',
        verifiedBy: currentTask.verifiedBy || '',
        managerRemarks: currentTask.managerRemarks || '',
        employeeRemarks: currentTask.employeeRemarks || '',
        attachments: currentTask.attachments || []
      };

      if (isEditing && currentTask.id) {
        const taskRef = ref(database, `users/${user.adminUid}/employees/${user.id}/dailytask/${currentTask.id}`);
        await update(taskRef, taskData);
        toast({
          title: "Task Updated",
          description: "Your task has been updated successfully."
        });
      } else {
        const tasksRef = ref(database, `users/${user.adminUid}/employees/${user.id}/dailytask`);
        const newTaskRef = push(tasksRef);
        await set(newTaskRef, taskData);
        toast({
          title: "Task Added",
          description: "Your task has been submitted successfully."
        });
      }
      
      resetForm();
      setIsFormOpen(false);
    } catch (error) {
      console.error("Error submitting task:", error);
      toast({
        title: "Error",
        description: "Failed to submit task",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditTask = (task: Task) => {
    setCurrentTask({
      ...task,
      id: task.id
    });
    setIsEditing(true);
    setIsFormOpen(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user?.id || !user?.adminUid) {
      toast({
        title: "Error",
        description: "User information not available",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const taskRef = ref(database, `users/${user.adminUid}/employees/${user.id}/dailytask/${taskId}`);
      await remove(taskRef);
      toast({
        title: "Task Deleted",
        description: "The task has been deleted successfully."
      });
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewTask = (task: Task) => {
    setSelectedTask(task);
    setIsViewModalOpen(true);
  };

  const resetForm = () => {
    setCurrentTask({
      date: new Date().toISOString().split('T')[0],
      employeeName: user?.name || '',
      employeeId: user?.id || '',
      department: user?.department || '',
      designation: user?.designation || '',
      status: 'pending',
      priority: 'medium'
    });
    setIsEditing(false);
  };

  const clearDateFilter = () => {
    setDateFilter(undefined);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-100 text-green-700"><Check className="h-3 w-3 mr-1" /> Completed</Badge>;
      case 'in-progress': return <Badge className="bg-blue-100 text-blue-700"><Clock className="h-3 w-3 mr-1" /> In Progress</Badge>;
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-700"><AlertTriangle className="h-3 w-3 mr-1" /> Pending</Badge>;
      case 'cancelled': return <Badge className="bg-red-100 text-red-700"><X className="h-3 w-3 mr-1" /> Cancelled</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <Badge variant="destructive">High</Badge>;
      case 'medium': return <Badge className="bg-yellow-100 text-yellow-700">Medium</Badge>;
      case 'low': return <Badge className="bg-green-100 text-green-700">Low</Badge>;
      default: return <Badge>{priority}</Badge>;
    }
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="text-lg sm:text-xl">Daily Tasks</span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <Popover open={isDateFilterOpen} onOpenChange={setIsDateFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-[180px] justify-start">
                    <Filter className="h-4 w-4 mr-2" />
                    {dateFilter ? new Date(dateFilter).toLocaleDateString() : 'Filter by Date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComp
                    mode="single"
                    selected={dateFilter}
                    onSelect={(date) => {
                      setDateFilter(date);
                      setIsDateFilterOpen(false);
                    }}
                    initialFocus
                  />
                  {dateFilter && (
                    <div className="p-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={clearDateFilter}
                      >
                        Clear Filter
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              <Button 
                onClick={() => {
                  resetForm();
                  setIsFormOpen(true);
                }}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                <span>Add Task</span>
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-full">
            <TableCaption>A list of your daily tasks.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Date</TableHead>
                <TableHead className="whitespace-nowrap">Task Title</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="whitespace-nowrap">Priority</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="hidden md:table-cell">Duration</TableHead>
                <TableHead className="hidden md:table-cell">Assigned By</TableHead>
                <TableHead className="whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.length > 0 ? (
                filteredTasks.map(task => (
                  <TableRow key={task.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(task.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium max-w-[150px] truncate">
                      {task.taskTitle}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {task.taskType}
                    </TableCell>
                    <TableCell>
                      {getPriorityBadge(task.priority)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(task.status)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {task.totalDuration}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {task.assignedBy}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleViewTask(task)}
                          className="h-8 w-8 p-0 sm:h-auto sm:w-auto sm:px-3"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="sr-only sm:not-sr-only sm:ml-2">View</span>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditTask(task)}
                          className="h-8 w-8 p-0 sm:h-auto sm:w-auto sm:px-3"
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only sm:not-sr-only sm:ml-2">Edit</span>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteTask(task.id)}
                          className="h-8 w-8 p-0 sm:h-auto sm:w-auto sm:px-3 text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only sm:not-sr-only sm:ml-2">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    {dateFilter ? 'No tasks found for selected date' : 'No tasks added yet.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Task Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg sm:text-xl font-bold">{isEditing ? 'Edit Task' : 'Add New Task'}</h2>
              <button 
                onClick={() => {
                  setIsFormOpen(false);
                  resetForm();
                }} 
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    name="date"
                    value={currentTask.date}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div>
                  <Label>Employee Name</Label>
                  <Input
                    name="employeeName"
                    value={currentTask.employeeName || ''}
                    onChange={handleInputChange}
                    required
                    disabled
                  />
                </div>
                
                <div>
                  <Label>Employee ID</Label>
                  <Input
                    name="employeeId"
                    value={currentTask.employeeId || ''}
                    onChange={handleInputChange}
                    required
                    disabled
                  />
                </div>
                
                <div>
                  <Label>Department</Label>
                  <Input
                    name="department"
                    value={currentTask.department || ''}
                    onChange={handleInputChange}
                    required
                    disabled
                  />
                </div>
                
                <div>
                  <Label>Designation</Label>
                  <Input
                    name="designation"
                    value={currentTask.designation || ''}
                    onChange={handleInputChange}
                    required
                    disabled
                  />
                </div>
                
                <div>
                  <Label>Task Title</Label>
                  <Input
                    name="taskTitle"
                    value={currentTask.taskTitle || ''}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div>
                  <Label>Task Type</Label>
                  <Select
                    value={currentTask.taskType || ''}
                    onValueChange={(value) => handleSelectChange('taskType', value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select task type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="testing">Testing</SelectItem>
                      <SelectItem value="documentation">Documentation</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="support">Support</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Priority</Label>
                  <Select
                    value={currentTask.priority || 'medium'}
                    onValueChange={(value) => handleSelectChange('priority', value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Assigned By</Label>
                  <Input
                    name="assignedBy"
                    value={currentTask.assignedBy || ''}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div>
                  <Label>Assigned Date</Label>
                  <Input
                    type="date"
                    name="assignedDate"
                    value={currentTask.assignedDate || ''}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div>
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    name="startTime"
                    value={currentTask.startTime || ''}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div>
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    name="endTime"
                    value={currentTask.endTime || ''}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div>
                  <Label>Status</Label>
                  <Select
                    value={currentTask.status || 'pending'}
                    onValueChange={(value) => handleSelectChange('status', value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {currentTask.startTime && currentTask.endTime && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    Duration: {calculateDuration(currentTask.startTime, currentTask.endTime)}
                  </p>
                </div>
              )}
              
              <div>
                <Label>Work Summary / Progress</Label>
                <Textarea
                  name="workSummary"
                  value={currentTask.workSummary || ''}
                  onChange={handleInputChange}
                  rows={3}
                  required
                />
              </div>
              
              <div>
                <Label>Pending Work</Label>
                <Textarea
                  name="pendingWork"
                  value={currentTask.pendingWork || ''}
                  onChange={handleInputChange}
                  rows={2}
                />
              </div>
              
              <div>
                <Label>Challenges Faced</Label>
                <Textarea
                  name="challenges"
                  value={currentTask.challenges || ''}
                  onChange={handleInputChange}
                  rows={2}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Verified By</Label>
                  <Input
                    name="verifiedBy"
                    value={currentTask.verifiedBy || ''}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div>
                  <Label>Manager Remarks</Label>
                  <Input
                    name="managerRemarks"
                    value={currentTask.managerRemarks || ''}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
              
              <div>
                <Label>Employee Remarks</Label>
                <Textarea
                  name="employeeRemarks"
                  value={currentTask.employeeRemarks || ''}
                  onChange={handleInputChange}
                  rows={2}
                />
              </div>
              
              <div>
                <Label>Attachments (comma separated)</Label>
                <Input
                  name="attachments"
                  value={currentTask.attachments?.join(', ') || ''}
                  onChange={(e) => {
                    const attachments = e.target.value.split(',').map(item => item.trim());
                    setCurrentTask(prev => ({ ...prev, attachments }));
                  }}
                  placeholder="Enter file names or URLs separated by commas"
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsFormOpen(false);
                    resetForm();
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (isEditing ? "Updating..." : "Submitting...") : (isEditing ? "Update Task" : "Save Task")}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Task Details Modal */}
      {isViewModalOpen && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg sm:text-xl font-bold truncate max-w-[80%]">
                Task Details: {selectedTask.taskTitle}
              </h2>
              <button 
                onClick={() => setIsViewModalOpen(false)} 
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Task Title</Label>
                  <p className="text-sm mt-1">{selectedTask.taskTitle}</p>
                </div>
                <div>
                  <Label>Task Type</Label>
                  <p className="text-sm mt-1">{selectedTask.taskType}</p>
                </div>
                <div>
                  <Label>Date</Label>
                  <p className="text-sm mt-1">{new Date(selectedTask.date).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="text-sm mt-1">{getStatusBadge(selectedTask.status)}</div>
                </div>
                <div>
                  <Label>Priority</Label>
                  <div className="text-sm mt-1">{getPriorityBadge(selectedTask.priority)}</div>
                </div>
                <div>
                  <Label>Duration</Label>
                  <p className="text-sm mt-1">{selectedTask.totalDuration}</p>
                </div>
                <div>
                  <Label>Start Time</Label>
                  <p className="text-sm mt-1">{selectedTask.startTime}</p>
                </div>
                <div>
                  <Label>End Time</Label>
                  <p className="text-sm mt-1">{selectedTask.endTime}</p>
                </div>
                <div>
                  <Label>Assigned By</Label>
                  <p className="text-sm mt-1">{selectedTask.assignedBy}</p>
                </div>
                <div>
                  <Label>Assigned Date</Label>
                  <p className="text-sm mt-1">{new Date(selectedTask.assignedDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label>Employee Name</Label>
                  <p className="text-sm mt-1">{selectedTask.employeeName}</p>
                </div>
                <div>
                  <Label>Employee ID</Label>
                  <p className="text-sm mt-1">{selectedTask.employeeId}</p>
                </div>
                <div>
                  <Label>Department</Label>
                  <p className="text-sm mt-1">{selectedTask.department}</p>
                </div>
                <div>
                  <Label>Designation</Label>
                  <p className="text-sm mt-1">{selectedTask.designation}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label>Work Summary</Label>
                <p className="text-sm mt-1 whitespace-pre-line">{selectedTask.workSummary}</p>
              </div>

              <div className="border-t pt-4">
                <Label>Pending Work</Label>
                <p className="text-sm mt-1 whitespace-pre-line">{selectedTask.pendingWork}</p>
              </div>

              <div className="border-t pt-4">
                <Label>Challenges Faced</Label>
                <p className="text-sm mt-1 whitespace-pre-line">{selectedTask.challenges}</p>
              </div>

              <div className="border-t pt-4">
                <Label>Employee Remarks</Label>
                <p className="text-sm mt-1 whitespace-pre-line">{selectedTask.employeeRemarks}</p>
              </div>

              {selectedTask.managerRemarks && (
                <div className="border-t pt-4">
                  <Label>Manager Remarks</Label>
                  <p className="text-sm mt-1 whitespace-pre-line">{selectedTask.managerRemarks}</p>
                </div>
              )}

              {selectedTask.verifiedBy && (
                <div className="border-t pt-4">
                  <Label>Verified By</Label>
                  <p className="text-sm mt-1">{selectedTask.verifiedBy}</p>
                </div>
              )}

              {selectedTask.attachments && selectedTask.attachments.length > 0 && (
                <div className="border-t pt-4">
                  <Label>Attachments ({selectedTask.attachments.length})</Label>
                  <div className="mt-2 space-y-1">
                    {selectedTask.attachments.map((attachment, index) => (
                      <div key={index} className="flex items-center text-sm text-blue-600 hover:underline">
                        <Link className="h-3 w-3 mr-1" />
                        <a href={attachment} target="_blank" rel="noopener noreferrer" className="truncate">
                          {attachment}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <Button 
                variant="outline" 
                onClick={() => setIsViewModalOpen(false)}
                className="w-full sm:w-auto"
              >
                Close
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default DailyTask;