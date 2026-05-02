import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Checkbox } from '../../ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { Badge } from '../../ui/badge';
import { update, ref } from 'firebase/database';
import { database } from '../../../firebase';
import { toast } from 'react-hot-toast';

// Local Task interface (matches the structure used in this modal)
interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  dependsOn?: string[];
  achievementSummary?: string;
}

interface TaskEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  projectId: string;
  allTasks: Task[];
  onSuccess: () => void;
}

export const TaskEditModal: React.FC<TaskEditModalProps> = ({ 
  open, onOpenChange, task, projectId, allTasks, onSuccess 
}) => {
  const [formData, setFormData] = useState({
    title: task.title,
    description: task.description,
    assignedTo: task.assignedTo,
    priority: task.priority,
    dueDate: task.dueDate,
    status: task.status,
    dependsOn: task.dependsOn || [],
    achievementSummary: task.achievementSummary || '',
  });
  const [loading, setLoading] = useState(false);
  const [depPopoverOpen, setDepPopoverOpen] = useState(false);

  const handlePriorityChange = (value: string) => {
    setFormData(prev => ({ ...prev, priority: value as Task['priority'] }));
  };

  const handleStatusChange = (value: string) => {
    setFormData(prev => ({ ...prev, status: value as Task['status'] }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await update(ref(database, `projects/${projectId}/tasks/${task.id}`), formData);
      toast.success('Task updated');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to update task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})} 
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea 
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})} 
              rows={3} 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Priority</Label>
              <Select value={formData.priority} onValueChange={handlePriorityChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={handleStatusChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Due Date</Label>
            <Input 
              type="date" 
              value={formData.dueDate} 
              onChange={e => setFormData({...formData, dueDate: e.target.value})} 
            />
          </div>
          <div>
            <Label>Achievement Summary (for completed tasks)</Label>
            <Textarea 
              value={formData.achievementSummary} 
              onChange={e => setFormData({...formData, achievementSummary: e.target.value})} 
              placeholder="What was achieved? e.g., Fixed bug, added tests" 
              rows={2} 
            />
          </div>
          <div>
            <Label>Depends On</Label>
            <Popover open={depPopoverOpen} onOpenChange={setDepPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  {formData.dependsOn.length === 0 ? "Select dependencies" : `${formData.dependsOn.length} task(s) selected`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-2 max-h-48 overflow-auto">
                {allTasks.filter(t => t.id !== task.id).map(t => (
                  <div key={t.id} className="flex items-center gap-2 py-1">
                    <Checkbox
                      checked={formData.dependsOn.includes(t.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData(prev => ({ ...prev, dependsOn: [...prev.dependsOn, t.id] }));
                        } else {
                          setFormData(prev => ({ ...prev, dependsOn: prev.dependsOn.filter(id => id !== t.id) }));
                        }
                      }}
                    />
                    <span>{t.title}</span>
                  </div>
                ))}
              </PopoverContent>
            </Popover>
            {formData.dependsOn.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {formData.dependsOn.map(depId => {
                  const depTask = allTasks.find(t => t.id === depId);
                  return <Badge key={depId} variant="secondary">{depTask?.title || depId}</Badge>;
                })}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={loading}>Save Changes</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};