import React from 'react';
import { Card, CardContent } from '../../ui/card';

interface Task {
  id: string;
  title: string;
  dueDate: string;
  projectName: string;
}

interface TimelineProject {
  name: string;
  tasks?: Record<string, {
    id: string;
    title: string;
    dueDate: string;
  }>;
}

interface TimelineViewProps {
  projects: TimelineProject[];
}

const TimelineView: React.FC<TimelineViewProps> = ({ projects }) => {
  const allTasks: Task[] = [];
  projects.forEach(project => {
    if (project.tasks) {
      Object.values(project.tasks).forEach((task) => {
        if (task.dueDate) {
          allTasks.push({
            id: task.id,
            title: task.title,
            dueDate: task.dueDate,
            projectName: project.name,
          });
        }
      });
    }
  });

  // Sort by due date
  allTasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <div className="space-y-2">
      {allTasks.length === 0 ? (
        <div className="text-center text-gray-500 py-8">No tasks with due dates</div>
      ) : (
        allTasks.map(task => (
          <Card key={task.id}>
            <CardContent className="p-3 flex justify-between items-center">
              <div>
                <span className="font-medium">{task.title}</span>
                <span className="text-sm text-gray-500 ml-2">({task.projectName})</span>
              </div>
              <div className="text-sm text-gray-600">
                Due: {new Date(task.dueDate).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default TimelineView;