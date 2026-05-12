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

interface ProjectData {
  name?: string;
  status?: string;
  assignedTeamLeader?: string;
  createdBy?: string;
  progress?: number;
}

type ReportPeriod = 'daily' | 'weekly' | 'monthly';

interface ProjectReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

// Helper: escape CSV field
const escapeCSV = (value: string | number | undefined | null): string => {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const ProjectReportModal: React.FC<ProjectReportModalProps> = ({ open, onOpenChange, projectId }) => {
  const [period, setPeriod] = useState<ReportPeriod>('weekly');
  const [loading, setLoading] = useState(false);
  const [projectInfo, setProjectInfo] = useState<ProjectData>({});

  useEffect(() => {
    if (open && projectId) {
      const fetchProjectInfo = async () => {
        const snap = await get(ref(database, `projects/${projectId}`));
        const data = snap.val() as ProjectData | null;
        if (data) {
          setProjectInfo(data);
        } else {
          setProjectInfo({ name: 'Project' });
        }
      };
      fetchProjectInfo();
    }
  }, [open, projectId]);

  const generateReport = async () => {
    setLoading(true);
    try {
      // Fetch tasks
      const tasksSnap = await get(ref(database, `projects/${projectId}/tasks`));
      const tasksObj = tasksSnap.val() as Record<string, Record<string, unknown>> | null;
      
      const tasks: Task[] = tasksObj
        ? Object.entries(tasksObj).map(([id, data]) => ({
            id,
            title: (data.title as string) || '',
            status: (data.status as string) || 'not_started',
            dueDate: data.dueDate as string,
            updatedAt: data.updatedAt as string,
            dependsOn: (data.dependsOn as string[]) || [],
            achievementSummary: data.achievementSummary as string,
          }))
        : [];

      // Determine team leader (fallback to project creator)
      const teamLeader = projectInfo.assignedTeamLeader || projectInfo.createdBy || 'Not assigned';

      // Calculate progress based on tasks (if any)
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      let calculatedProgress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
      // If project is marked completed, force 100% progress
      if (projectInfo.status === 'completed') calculatedProgress = 100;

      // Date range based on period
      const now = new Date();
      let startDate: Date;
      if (period === 'daily') {
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
      } else if (period === 'weekly') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
      } else {
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
      }
      const endDate = new Date();

      const filteredTasks = tasks.filter(task => {
        if (!task.updatedAt) return false;
        const taskDate = new Date(task.updatedAt);
        return taskDate >= startDate && taskDate <= endDate;
      });

      const completed = filteredTasks.filter(t => t.status === 'completed');
      const inProgress = filteredTasks.filter(t => t.status === 'in_progress');
      const pending = filteredTasks.filter(t => t.status === 'pending' || t.status === 'not_started');
      const blocked = filteredTasks.filter(t => t.status === 'blocked');
      const overdue = filteredTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed');

      const dependencies = filteredTasks.map(t => ({
        task: t.title,
        dependsOn: (t.dependsOn || []).map(depId => tasks.find(tt => tt.id === depId)?.title || depId)
      }));

      const toCSVRow = (cells: (string | number | undefined | null)[]) => cells.map(escapeCSV).join(',');

      const rows: string[] = [];
      rows.push(toCSVRow([`Project Report: ${projectInfo.name || 'Project'} (${period})`]));
      rows.push('');
      rows.push(toCSVRow(['Team Leader', 'Progress (%)']));
      rows.push(toCSVRow([teamLeader, calculatedProgress]));
      rows.push('');
      rows.push(toCSVRow(['Completed Tasks', 'In Progress', 'Pending', 'Blocked', 'Overdue']));
      rows.push(toCSVRow([completed.length, inProgress.length, pending.length, blocked.length, overdue.length]));
      rows.push('');
      rows.push(toCSVRow(['=== Completed Tasks with Achievements ===']));
      rows.push(toCSVRow(['Task Title', 'Achievement Summary', 'Completed Date']));
      for (const t of completed) {
        rows.push(toCSVRow([t.title, t.achievementSummary || 'No summary', t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : '']));
      }
      rows.push('');
      rows.push(toCSVRow(['=== Blocked Tasks ===']));
      rows.push(toCSVRow(['Task Title', 'Reason (if any)']));
      for (const t of blocked) {
        rows.push(toCSVRow([t.title, 'Check dependencies']));
      }
      rows.push('');
      rows.push(toCSVRow(['=== Dependencies ===']));
      rows.push(toCSVRow(['Task', 'Depends On']));
      for (const dep of dependencies) {
        if (dep.dependsOn.length) {
          rows.push(toCSVRow([dep.task, dep.dependsOn.join(', ')]));
        }
      }
      rows.push('');
      rows.push(toCSVRow(['=== Overdue Tasks ===']));
      rows.push(toCSVRow(['Task Title', 'Due Date', 'Status']));
      for (const t of overdue) {
        rows.push(toCSVRow([t.title, t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '', t.status]));
      }

      const csvContent = rows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectInfo.name || 'Project'}_report_${period}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Report exported as CSV`);
    } catch (error) {
      console.error(error);
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
            <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
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