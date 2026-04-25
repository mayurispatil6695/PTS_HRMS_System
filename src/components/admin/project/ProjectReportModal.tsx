import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Label } from '../../ui/label';
import { ref, get } from 'firebase/database';
import { database } from '../../../firebase';
import { toast } from 'react-hot-toast';

interface Task {
  id: string;
  title: string;
  status: string;
  dueDate?: string;
  updatedAt?: string;
  dependsOn?: string[];
  achievementSummary?: string;
}

interface ProjectReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export const ProjectReportModal: React.FC<ProjectReportModalProps> = ({ open, onOpenChange, projectId }) => {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [loading, setLoading] = useState(false);
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    if (open && projectId) {
      const fetchProjectName = async () => {
        const snap = await get(ref(database, `projects/${projectId}/name`));
        setProjectName(snap.val() || 'Project');
      };
      fetchProjectName();
    }
  }, [open, projectId]);

  const generateReport = async () => {
    setLoading(true);
    try {
      const tasksSnap = await get(ref(database, `projects/${projectId}/tasks`));
      const tasksObj = tasksSnap.val() || {};
      const tasks: Task[] = Object.entries(tasksObj).map(([id, data]: [string, any]) => ({
        id,
        title: data.title || '',
        status: data.status || 'not_started',
        dueDate: data.dueDate,
        updatedAt: data.updatedAt,
        dependsOn: data.dependsOn || [],
        achievementSummary: data.achievementSummary,
      }));

      // Calculate date range based on period
      const now = new Date();
      let startDate: Date;
      if (period === 'daily') startDate = new Date(now.setHours(0,0,0,0));
      else if (period === 'weekly') startDate = new Date(now.setDate(now.getDate() - 7));
      else startDate = new Date(now.setMonth(now.getMonth() - 1));
      const endDate = new Date();

      // Filter tasks updated in the period
      const filteredTasks = tasks.filter(task => {
        if (!task.updatedAt) return false;
        const taskDate = new Date(task.updatedAt);
        return taskDate >= startDate && taskDate <= endDate;
      });

      // Build report data
      const completed = filteredTasks.filter(t => t.status === 'completed');
      const inProgress = filteredTasks.filter(t => t.status === 'in_progress');
      const pending = filteredTasks.filter(t => t.status === 'not_started');
      const blocked = filteredTasks.filter(t => t.status === 'blocked');
      const overdue = filteredTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed');

      // Dependencies mapping
      const dependencies: { task: string; dependsOn: string[] }[] = filteredTasks.map(t => ({ task: t.title, dependsOn: t.dependsOn?.map(depId => tasks.find(tt => tt.id === depId)?.title || depId) || [] }));

      // CSV content
      const rows = [
        [`Project Report: ${projectName} (${period})`],
        [],
        ['Completed Tasks', 'In Progress', 'Pending', 'Blocked', 'Overdue'],
        [completed.length, inProgress.length, pending.length, blocked.length, overdue.length],
        [],
        ['=== Completed Tasks with Achievements ==='],
        ['Task Title', 'Achievement Summary', 'Completed Date'],
        ...completed.map(t => [t.title, t.achievementSummary || 'No summary', t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : '']),
        [],
        ['=== Blocked Tasks ==='],
        ['Task Title', 'Reason (if any)'],
        ...blocked.map(t => [t.title, 'Check dependencies']),
        [],
        ['=== Dependencies ==='],
        ['Task', 'Depends On'],
        ...dependencies.filter(d => d.dependsOn.length).map(d => [d.task, d.dependsOn.join(', ')]),
        [],
        ['=== Overdue Tasks ==='],
        ['Task Title', 'Due Date', 'Status'],
        ...overdue.map(t => [t.title, t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '', t.status])
      ];

      const csvContent = rows.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}_report_${period}_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Report exported as CSV`);
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Project Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Period</Label>
            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily (today)</SelectItem>
                <SelectItem value="weekly">Weekly (last 7 days)</SelectItem>
                <SelectItem value="monthly">Monthly (last 30 days)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={generateReport} disabled={loading} className="w-full">
            {loading ? 'Generating...' : 'Download CSV Report'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};