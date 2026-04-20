import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { update } from 'firebase/database';
import { database } from '../../../firebase';
import { ref } from 'firebase/database';
import { Calendar, Clock, User, Save, X, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { getTaskSuggestions } from '@/services/aiServices';

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  projectName: string;
  projectId: string;
  assignedTo?: string;
  description?: string;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
  dependsOn?: string[];
}

interface KanbanProject {
  id: string;
  name: string;
  tasks?: Record<string, {
    id: string;
    title: string;
    status: string;
    priority: string;
    assignedTo?: string;
    description?: string;
    dueDate?: string;
    createdAt?: string;
    updatedAt?: string;
    dependsOn?: string[];
  }>;
}

interface KanbanBoardProps {
  projects: KanbanProject[];
  employees: Employee[];
  onTaskClick?: (task: Task) => void;
  readOnly?: boolean;
}

const columns = ['todo', 'in_progress', 'review', 'done'];
const columnNames: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done'
};

const mapStatusToColumn = (status: string): string => {
  const s = status?.toLowerCase() || '';
  if (s === 'pending' || s === 'not_started' || s === 'todo') return 'todo';
  if (s === 'in_progress' || s === 'in-progress' || s === 'active') return 'in_progress';
  if (s === 'review') return 'review';
  if (s === 'completed' || s === 'done') return 'done';
  return 'todo';
};

const KanbanBoard: React.FC<KanbanBoardProps> = ({ projects, employees, onTaskClick, readOnly = false }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPriority, setEditPriority] = useState('medium');
  const [editStatus, setEditStatus] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [editDependsOn, setEditDependsOn] = useState<string[]>([]);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);

  useEffect(() => {
    const allTasks: Task[] = [];
    projects.forEach((project) => {
      if (project.tasks) {
        Object.values(project.tasks).forEach((task) => {
          allTasks.push({
            id: task.id,
            title: task.title,
            status: mapStatusToColumn(task.status),
            priority: task.priority,
            projectName: project.name,
            projectId: project.id,
            assignedTo: task.assignedTo,
            description: task.description,
            dueDate: task.dueDate,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
            dependsOn: task.dependsOn || [],
          });
        });
      }
    });
    setTasks(allTasks);
  }, [projects]);

  const getTasksByStatus = (status: string) => tasks.filter(t => t.status === status);

  const onDragEnd = async (result: DropResult) => {
    if (readOnly) return;
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;

    const task = tasks.find(t => t.id === draggableId);
    if (task) {
      let newStatus = destination.droppableId;
      if (newStatus === 'todo') newStatus = 'pending';
      else if (newStatus === 'in_progress') newStatus = 'in_progress';
      else if (newStatus === 'review') newStatus = 'review';
      else if (newStatus === 'done') newStatus = 'completed';
      await update(ref(database, `projects/${task.projectId}/tasks/${task.id}`), {
        status: newStatus
      });
      setTasks(prev =>
        prev.map(t => (t.id === draggableId ? { ...t, status: destination.droppableId } : t))
      );
      toast.success('Task status updated');
    }
  };

  const getEmployeeName = (empId?: string) => {
    if (!empId) return '';
    const emp = employees.find(e => e.id === empId);
    return emp ? emp.name : '';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return format(date, 'MMM dd, yyyy');
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return format(date, 'MMM dd, yyyy hh:mm a');
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

  const openEditModal = (task: Task) => {
    setSelectedTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditDueDate(task.dueDate?.split('T')[0] || '');
    setEditPriority(task.priority);
    setEditStatus(task.status);
    setEditAssignedTo(task.assignedTo || '');
    setEditDependsOn(task.dependsOn || []);

    const sameProjectTasks = tasks.filter(t => t.projectId === task.projectId && t.id !== task.id);
    setProjectTasks(sameProjectTasks);

    setEditMode(true);
    setModalOpen(true);
  };

  const saveTaskChanges = async () => {
    if (!selectedTask) return;
    try {
      const taskRef = ref(database, `projects/${selectedTask.projectId}/tasks/${selectedTask.id}`);
      await update(taskRef, {
        title: editTitle,
        description: editDescription,
        dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
        priority: editPriority,
        status: editStatus,
        assignedTo: editAssignedTo === 'unassigned' ? null : editAssignedTo,
        dependsOn: editDependsOn,
        updatedAt: new Date().toISOString(),
      });
      setTasks(prev =>
        prev.map(t =>
          t.id === selectedTask.id
            ? { ...t, title: editTitle, description: editDescription, dueDate: editDueDate, priority: editPriority, status: editStatus, assignedTo: editAssignedTo === 'unassigned' ? '' : editAssignedTo, dependsOn: editDependsOn }
            : t
        )
      );
      toast.success('Task updated');
      setEditMode(false);
      setModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to update task');
    }
  };

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {columns.map(col => (
            <Droppable key={col} droppableId={col}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="bg-gray-50 p-3 rounded-lg min-h-[400px]"
                >
                  <h3 className="font-semibold mb-3 capitalize">{columnNames[col]}</h3>
                  {getTasksByStatus(col).map((task, idx) => {
                    const draggableId = task.id && task.id !== 'undefined' ? task.id : `${task.projectId}-${idx}`;
                    return (
                      <Draggable key={draggableId} draggableId={draggableId} index={idx} isDragDisabled={readOnly}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="mb-2 cursor-pointer"
                            onClick={() => openEditModal(task)}
                          >
                            <Card className="hover:shadow-md transition-shadow">
                              <CardContent className="p-3 space-y-1">
                                <p className="font-medium text-sm">{task.title}</p>
                                <p className="text-xs text-gray-500">{task.projectName}</p>
                                <div className="flex justify-between items-center">
                                  <Badge variant="outline" className="text-xs">{task.priority}</Badge>
                                  {task.assignedTo && (
                                    <span className="text-xs text-gray-400">
                                      @{getEmployeeName(task.assignedTo).split(' ')[0]}
                                    </span>
                                  )}
                                </div>
                                {task.dependsOn && task.dependsOn.length > 0 && (
                                  <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-1">
                                    <span className="font-medium">Depends on:</span>
                                    {task.dependsOn.map(depId => {
                                      const depTask = tasks.find(t => t.id === depId);
                                      return (
                                        <Badge key={depId} variant="outline" className="text-xs bg-yellow-50">
                                          {depTask?.title || depId}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {/* Edit Task Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) setEditMode(false); setModalOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editMode ? 'Edit Task' : selectedTask?.title}</DialogTitle>
            <DialogDescription className="sr-only">
              Task details and dependencies
            </DialogDescription>
          </DialogHeader>
          {selectedTask && (
            editMode ? (
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <Label>Title</Label>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </div>

                {/* Description */}
                <div>
                  <Label>Description</Label>
                  <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
                </div>

                {/* Due Date & Priority with AI button */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Due Date</Label>
                    <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                  </div>
                  <div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label>Priority</Label>
                        <Select value={editPriority} onValueChange={setEditPriority}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            const suggestions = await getTaskSuggestions(editTitle, editDescription);
                            setEditPriority(suggestions.priority);
                            if (suggestions.dueDateOffsetDays) {
                              const newDueDate = new Date();
                              newDueDate.setDate(newDueDate.getDate() + suggestions.dueDateOffsetDays);
                              setEditDueDate(newDueDate.toISOString().split('T')[0]);
                            }
                            toast.success(`AI suggests: ${suggestions.priority} priority, due in ${suggestions.dueDateOffsetDays} days`);
                          } catch (error: any) {
                            console.error(error);
                            if (error.message?.includes('429')) {
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
                </div>

                {/* Status & Assigned To */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Status</Label>
                    <Select value={editStatus} onValueChange={setEditStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="review">Review</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Assigned To</Label>
                    <Select value={editAssignedTo || "unassigned"} onValueChange={setEditAssignedTo}>
                      <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {employees.map(emp => (
                          <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Task Dependencies */}
                <div className="space-y-2">
                  <Label>Depends on (tasks that must be completed first)</Label>
                  <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                    {projectTasks.length === 0 ? (
                      <p className="text-sm text-gray-400">No other tasks in this project</p>
                    ) : (
                      projectTasks.map(task => (
                        <label key={task.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editDependsOn.includes(task.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditDependsOn([...editDependsOn, task.id]);
                              } else {
                                setEditDependsOn(editDependsOn.filter(id => id !== task.id));
                              }
                            }}
                          />
                          {task.title} ({task.status})
                        </label>
                      ))
                    )}
                  </div>
                  {editDependsOn.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {editDependsOn.map(depId => {
                        const depTask = projectTasks.find(t => t.id === depId);
                        return (
                          <Badge key={depId} variant="secondary" className="text-xs">
                            {depTask?.title || depId}
                            <button
                              className="ml-1 text-red-500 hover:text-red-700"
                              onClick={() => setEditDependsOn(editDependsOn.filter(id => id !== depId))}
                            >
                              ×
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                  <Button onClick={saveTaskChanges}>Save Changes</Button>
                </div>
              </div>
            ) : (
              // View mode
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Badge className={getPriorityColor(selectedTask.priority)}>
                    {selectedTask.priority}
                  </Badge>
                  <Badge className="bg-blue-100 text-blue-700">
                    {selectedTask.status.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-gray-600">{selectedTask.description || 'No description'}</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span>Assigned to: {getEmployeeName(selectedTask.assignedTo) || 'Unassigned'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span>Due: {formatDate(selectedTask.dueDate)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span>Created: {formatDateTime(selectedTask.createdAt)}</span>
                  </div>
                  {selectedTask.updatedAt && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span>Updated: {formatDateTime(selectedTask.updatedAt)}</span>
                    </div>
                  )}
                </div>
                {selectedTask.dependsOn && selectedTask.dependsOn.length > 0 && (
                  <div className="border-t pt-3">
                    <h4 className="text-sm font-medium mb-2">Depends on</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTask.dependsOn.map(depId => {
                        const depTask = tasks.find(t => t.id === depId);
                        return (
                          <Badge key={depId} variant="outline" className="bg-yellow-50">
                            {depTask?.title || depId}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  {!readOnly && (
                    <Button onClick={() => openEditModal(selectedTask)}>Edit Task</Button>
                  )}
                  <Button variant="outline" onClick={() => setModalOpen(false)} className="ml-2">Close</Button>
                </div>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default KanbanBoard;