import { useState, useEffect } from 'react';
import { ref, onValue, off, DataSnapshot } from 'firebase/database';
import { database } from '../firebase';
import { Project, Task, ProjectUpdate } from '@/types/project';

interface FirebaseProjectRaw {
  name?: string;
  description?: string;
  department?: string;
  assignedTeamLeader?: string;
  assignedEmployees?: string[];
  tasks?: Record<string, Task>;   // already a record
  startDate?: string;
  endDate?: string;
  priority?: Project['priority'];
  status?: Project['status'];
  progress?: number;
  createdAt?: string;
  createdBy?: string;
  updates?: Record<string, ProjectUpdate>;
}

export const useProjects = (user: unknown) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const projectsRef = ref(database, 'projects');
    const unsubscribe = onValue(projectsRef, (snapshot: DataSnapshot) => {
      const data = snapshot.val() as Record<string, FirebaseProjectRaw> | null;
      if (!data) {
        setProjects([]);
        setLoading(false);
        return;
      }

      const projList: Project[] = Object.entries(data).map(([projId, projData]) => {
        // Keep tasks as record (object), do NOT convert to array
        const tasksRecord = projData.tasks || {};

        // Convert updates from object to array (Project expects array)
        const updatesArray = projData.updates ? Object.values(projData.updates) : [];

        return {
          id: projId,
          name: projData.name || '',
          description: projData.description || '',
          department: projData.department || '',
          assignedTeamLeader: projData.assignedTeamLeader || '',
          assignedEmployees: projData.assignedEmployees || [],
          tasks: tasksRecord,   // now a Record<string, Task>
          startDate: projData.startDate || '',
          endDate: projData.endDate || '',
          priority: projData.priority || 'medium',
          status: projData.status || 'not_started',
          progress: projData.progress || 0,
          createdAt: projData.createdAt || '',
          createdBy: projData.createdBy || '',
          updates: updatesArray,
        };
      });

      setProjects(projList);
      setLoading(false);
    }, (error) => {
      console.error('useProjects error:', error);
      setLoading(false);
    });

    return () => off(projectsRef);
  }, [user]);

  return { projects, loading };
};