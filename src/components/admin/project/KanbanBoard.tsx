import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { update } from 'firebase/database';
import { database } from '../../../firebase';
import { ref } from 'firebase/database';

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
}

// Minimal project interface for the Kanban board
interface KanbanProject {
  id: string;
  name: string;
  tasks?: Record<string, Task>;
}

interface KanbanBoardProps {
  projects: KanbanProject[];
  employees: Employee[];
}

const columns = ['todo', 'in_progress', 'review', 'done'];
const columnNames: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done'
};

const KanbanBoard: React.FC<KanbanBoardProps> = ({ projects, employees }) => {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const allTasks: Task[] = [];
    projects.forEach((project) => {
      if (project.tasks) {
        Object.values(project.tasks).forEach((task) => {
          allTasks.push({
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            projectName: project.name,
            projectId: project.id,
            assignedTo: task.assignedTo,
          });
        });
      }
    });
    setTasks(allTasks);
  }, [projects]);

  const getTasksByStatus = (status: string) => tasks.filter(t => t.status === status);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;

    const task = tasks.find(t => t.id === draggableId);
    if (task) {
      await update(ref(database, `projects/${task.projectId}/tasks/${task.id}`), {
        status: destination.droppableId
      });
      setTasks(prev =>
        prev.map(t => (t.id === draggableId ? { ...t, status: destination.droppableId } : t))
      );
    }
  };

  const getEmployeeName = (empId?: string) => {
    if (!empId) return '';
    const emp = employees.find(e => e.id === empId);
    return emp ? ` @${emp.name.split(' ')[0]}` : '';
  };

  return (
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
                  <Draggable key={task.id} draggableId={task.id} index={idx}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className="mb-2"
                      >
                        <Card className="cursor-grab">
                          <CardContent className="p-3 space-y-1">
                            <p className="font-medium text-sm">{task.title}</p>
                            <p className="text-xs text-gray-500">{task.projectName}{getEmployeeName(task.assignedTo)}</p>
                            <Badge variant="outline" className="text-xs">{task.priority}</Badge>
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
  );
};

export default KanbanBoard;