// src/components/admin/project/ListView.tsx
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';

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
  assignedTo: string;
  status: string;
  priority: string;
  dueDate: string;
  projectName: string;
}

interface ListViewProject {
  name: string;
  tasks?: Record<string, {
    id: string;
    title: string;
    assignedTo: string;
    status: string;
    priority: string;
    dueDate: string;
  }>;
}

interface ListViewProps {
  projects: ListViewProject[];
  employees: Employee[];
  readOnly?: boolean;
}

const ListView: React.FC<ListViewProps> = ({ projects, employees, readOnly = false }) => {
  const allTasks: Task[] = [];
  projects.forEach(project => {
    if (project.tasks) {
      Object.values(project.tasks).forEach((task) => {
        const assignedEmployee = employees.find(emp => emp.id === task.assignedTo);
        const assignedToName = assignedEmployee?.name || task.assignedTo || 'Unassigned';
        allTasks.push({
          id: task.id,
          title: task.title,
          assignedTo: assignedToName,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          projectName: project.name,
        });
      });
    }
  });

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Due Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allTasks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-gray-500">No tasks found</TableCell>
            </TableRow>
          ) : (
            allTasks.map(task => (
              <TableRow key={task.id}>
                <TableCell>{task.title}</TableCell>
                <TableCell>{task.projectName}</TableCell>
                <TableCell>{task.assignedTo}</TableCell>
                <TableCell><Badge>{task.status}</Badge></TableCell>
                <TableCell><Badge variant="outline">{task.priority}</Badge></TableCell>
                <TableCell>{task.dueDate}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default ListView;