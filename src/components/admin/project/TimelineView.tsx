import React, { useMemo } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Calendar } from 'lucide-react';

// Local types (matching the incoming data)
interface TimelineTask {
  id: string;
  title: string;
  dueDate?: string;
}

interface TimelineProject {
  name: string;
  tasks?: Record<string, TimelineTask>;
}

interface TimelineViewProps {
  projects: TimelineProject[];
  readOnly?: boolean;  // kept for consistency, not used
}

interface FormattedTask {
  id: string;
  title: string;
  dueDate: string;      // guaranteed to exist after filtering
  projectName: string;
}

const TimelineView: React.FC<TimelineViewProps> = ({ projects }) => {
  // Collect and sort tasks with valid due dates
  const sortedTasks = useMemo<FormattedTask[]>(() => {
    const tasks: FormattedTask[] = [];
    projects.forEach(project => {
      if (project.tasks) {
        Object.values(project.tasks).forEach(task => {
          if (task.dueDate) {
            tasks.push({
              id: task.id,
              title: task.title,
              dueDate: task.dueDate,
              projectName: project.name,
            });
          }
        });
      }
    });
    // Sort by due date (earliest first)
    tasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    return tasks;
  }, [projects]);

  if (sortedTasks.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No tasks with due dates
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedTasks.map(task => (
        <Card key={task.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <div className="flex-1">
              <span className="font-medium break-words">{task.title}</span>
              <span className="text-sm text-gray-500 ml-2 break-words">({task.projectName})</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-600 shrink-0">
              <Calendar className="h-4 w-4" />
              <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default TimelineView;