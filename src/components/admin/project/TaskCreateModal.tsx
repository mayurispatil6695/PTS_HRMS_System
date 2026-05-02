import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Label } from '../../ui/label';
import { ref, push, set, get } from 'firebase/database';
import { database } from '../../../firebase';
import { useAuth } from '../../../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { Checkbox } from '../../ui/checkbox';

interface Employee {
  id: string;
  name: string;
}

interface TaskCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  employees: Employee[];
  onTaskCreated: () => void;
}

interface ExistingTask {
  id: string;
  title: string;
  status: string;
}

// Firebase raw task shape
interface FirebaseTaskData {
  title?: string;
  status?: string;
  [key: string]: unknown;
}

const TaskCreateModal: React.FC<TaskCreateModalProps> = ({
  open, onOpenChange, projectId, projectName, employees, onTaskCreated
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [existingTasks, setExistingTasks] = useState<ExistingTask[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignedTo: '',
    dueDate: new Date().toISOString().split('T')[0],
    priority: 'medium' as 'low' | 'medium' | 'high',
    dependsOn: [] as string[],
  });

  // Fetch existing tasks in this project for dependency selection
  useEffect(() => {
    if (!open || !projectId) return;
    const fetchTasks = async () => {
      const tasksRef = ref(database, `projects/${projectId}/tasks`);
      const snapshot = await get(tasksRef);
      const tasks = snapshot.val() as Record<string, FirebaseTaskData> | null;
      if (tasks) {
        const taskList: ExistingTask[] = Object.entries(tasks).map(([id, task]) => ({
          id,
          title: task.title || 'Untitled',
          status: task.status || 'pending',
        }));
        setExistingTasks(taskList);
      } else {
        setExistingTasks([]);
      }
    };
    fetchTasks();
  }, [open, projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Task title is required');
      return;
    }
    setLoading(true);

    try {
      const taskRef = push(ref(database, `projects/${projectId}/tasks`));
      const assignedToValue = formData.assignedTo === 'unassigned' ? null : formData.assignedTo;
      
      await set(taskRef, {
        title: formData.title,
        description: formData.description,
        category: 'project_task',
        assignedTo: assignedToValue,
        dueDate: formData.dueDate,
        priority: formData.priority,
        status: 'pending',
        dependsOn: formData.dependsOn,
        createdAt: new Date().toISOString(),
        createdBy: user?.id,
        createdByName: user?.name,
      });

      if (assignedToValue) {
        const notifRef = push(ref(database, `notifications/${assignedToValue}`));
        await set(notifRef, {
          title: 'New Task Assigned',
          body: `${formData.title} in project ${projectName} – due ${formData.dueDate}`,
          type: 'task_assigned',
          read: false,
          createdAt: Date.now(),
          taskId: taskRef.key,
          projectId: projectId,
        });
      }

      toast.success('Task created with dependencies');
      onTaskCreated();
      onOpenChange(false);
      setFormData({
        title: '',
        description: '',
        assignedTo: '',
        dueDate: new Date().toISOString().split('T')[0],
        priority: 'medium',
        dependsOn: [],
      });
    } catch (err) {
      console.error(err);
      toast.error('Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  // Helper for priority select (type‑safe)
  const handlePriorityChange = (value: string) => {
    setFormData(prev => ({ ...prev, priority: value as 'low' | 'medium' | 'high' }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Task in {projectName}</DialogTitle>
          <DialogDescription>
            Assign a new task. Dependencies will block completion until those tasks are done.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Task Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Build login API"
              required
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          <div>
            <Label>Assign To</Label>
            <Select 
              value={formData.assignedTo || "unassigned"} 
              onValueChange={(val) => setFormData({ ...formData, assignedTo: val === "unassigned" ? "" : val })}
            >
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned (no one)</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} />
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={formData.priority} onValueChange={handlePriorityChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dependencies Section */}
          {existingTasks.length > 0 && (
            <div className="space-y-2">
              <Label>Depends On (tasks that must be completed first)</Label>
              <div className="border rounded-md p-3 max-h-32 overflow-y-auto space-y-2">
                {existingTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`dep-${task.id}`}
                      checked={formData.dependsOn.includes(task.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({ ...formData, dependsOn: [...formData.dependsOn, task.id] });
                        } else {
                          setFormData({ ...formData, dependsOn: formData.dependsOn.filter(id => id !== task.id) });
                        }
                      }}
                    />
                    <label htmlFor={`dep-${task.id}`} className="text-sm">
                      {task.title} <span className="text-xs text-gray-400">({task.status})</span>
                    </label>
                  </div>
                ))}
              </div>
              {formData.dependsOn.length > 0 && (
                <div className="text-xs text-gray-500">This task cannot be completed until the selected tasks are done.</div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Task'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TaskCreateModal;