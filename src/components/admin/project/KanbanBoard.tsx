// src/components/admin/project/KanbanBoard.tsx
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { update } from 'firebase/database';
import { database } from '../../../firebase';
import { ref } from 'firebase/database';
import { Calendar, Clock, User } from 'lucide-react';
import { format } from 'date-fns';

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
}

interface KanbanProject {
  id: string;
  name: string;
  tasks?: Record<string, any>;
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

  useEffect(() => {
    const allTasks: Task[] = [];
    projects.forEach((project) => {
      if (project.tasks) {
        Object.values(project.tasks).forEach((task: any) => {
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
                  {getTasksByStatus(col).map((task, idx) => (
                    <Draggable key={task.id} draggableId={task.id} index={idx} isDragDisabled={readOnly}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="mb-2 cursor-pointer"
                          onClick={() => {
                            setSelectedTask(task);
                            setModalOpen(true);
                            if (onTaskClick) onTaskClick(task);
                          }}
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
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {/* Task Details Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
          </DialogHeader>
          {selectedTask && (
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
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setModalOpen(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default KanbanBoard;