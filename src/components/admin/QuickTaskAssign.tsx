import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { ref, push, set, get } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';

interface Employee {
  id: string;
  name: string;
  email: string;
}

interface QuickTaskAssignProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: () => void;
}

const QuickTaskAssign: React.FC<QuickTaskAssignProps> = ({ open, onOpenChange, onTaskCreated }) => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignedTo: '',
    dueDate: new Date().toISOString().split('T')[0],
    priority: 'medium' as 'low' | 'medium' | 'high',
  });

  useEffect(() => {
    if (!open) return;
    const fetchEmployees = async () => {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      const list: Employee[] = [];
      snapshot.forEach((child) => {
        const data = child.val();
        if (data.role === 'admin') return;
        const profile = data.profile || data.employee;
        if (profile?.name) {
          list.push({
            id: child.key || '',
            name: profile.name,
            email: profile.email || '',
          });
        }
      });
      setEmployees(list);
    };
    fetchEmployees();
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Task title is required');
      return;
    }
    if (!formData.assignedTo) {
      toast.error('Select an employee');
      return;
    }
    setLoading(true);

    try {
      // Ensure default project "Internal Operations" exists
      let internalProjectId = localStorage.getItem('internal_project_id');
      if (!internalProjectId) {
        const projectsRef = ref(database, 'projects');
        const snapshot = await get(projectsRef);
        let existing = null;
        snapshot.forEach((child) => {
          const proj = child.val();
          if (proj.name === 'Internal Operations') {
            existing = child.key;
          }
        });
        if (existing) {
          internalProjectId = existing;
        } else {
          const newProjRef = push(projectsRef);
          await set(newProjRef, {
            name: 'Internal Operations',
            description: 'Default project for quick daily tasks',
            type: 'internal',
            createdAt: new Date().toISOString(),
            createdBy: user?.id,
            assignedEmployees: [],
          });
          internalProjectId = newProjRef.key;
        }
        localStorage.setItem('internal_project_id', internalProjectId!);
      }

      // Create task inside that project
      const taskRef = push(ref(database, `projects/${internalProjectId}/tasks`));
      await set(taskRef, {
        title: formData.title,
        description: formData.description,
        category: 'daily_task',
        assignedTo: formData.assignedTo,
        dueDate: formData.dueDate,
        priority: formData.priority,
        status: 'pending',
        createdAt: new Date().toISOString(),
        createdBy: user?.id,
        createdByName: user?.name,
      });

      // Send notification
      const notifRef = push(ref(database, `notifications/${formData.assignedTo}`));
      await set(notifRef, {
        title: 'New Daily Task',
        body: `${formData.title} – due ${formData.dueDate}`,
        type: 'task_assigned',
        read: false,
        createdAt: Date.now(),
        taskId: taskRef.key,
        projectId: internalProjectId,
      });

      toast.success('Task assigned successfully');
      setFormData({
        title: '',
        description: '',
        assignedTo: '',
        dueDate: new Date().toISOString().split('T')[0],
        priority: 'medium',
      });
      onOpenChange(false);
      onTaskCreated?.();
    } catch (err) {
      console.error(err);
      toast.error('Failed to assign task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Quick Task Assignment</DialogTitle>
          <DialogDescription>
            Assign a daily task. It will appear in the employee's "My Work" dashboard.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Task Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Update client report"
              required
            />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional details"
              rows={3}
            />
          </div>
          <div>
            <Label>Assign To *</Label>
            <Select value={formData.assignedTo} onValueChange={(val) => setFormData({ ...formData, assignedTo: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name} ({emp.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={formData.priority} onValueChange={(val: string) => setFormData({ ...formData, priority: val as 'low' | 'medium' | 'high' })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Assigning...' : 'Assign Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default QuickTaskAssign;