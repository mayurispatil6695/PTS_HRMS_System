import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { motion } from 'framer-motion';
import { FolderOpen, Users, Calendar } from 'lucide-react';
import { format } from 'date-fns';

// ---------- TYPES ----------
interface FirebaseTask {
  id?: string;
  title?: string;
  status?: string;
  dueDate?: string;
  [key: string]: unknown; // allow extra fields like description, priority, etc.
}

interface FirebaseProject {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  assignedTeamLeader?: string;
  assignedEmployees?: string[];
  tasks?: Record<string, FirebaseTask>;
}

interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: string;
  assignedTeamLeader?: string;
  assignedEmployees?: string[];
  tasks?: Record<string, FirebaseTask>;
}

// ---------- COMPONENT ----------
const MyProjects: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const projectsRef = ref(database, 'projects');
    const unsubscribe = onValue(projectsRef, (snapshot) => {
      const data = snapshot.val() as Record<string, FirebaseProject> | null;
      if (!data) {
        setProjects([]);
        setLoading(false);
        return;
      }
      const allProjects: Project[] = Object.entries(data).map(([id, proj]) => ({
        id,
        name: proj.name || '',
        description: proj.description || '',
        startDate: proj.startDate || '',
        endDate: proj.endDate || '',
        status: proj.status || 'not_started',
        assignedTeamLeader: proj.assignedTeamLeader,
        assignedEmployees: proj.assignedEmployees || [],
        tasks: proj.tasks || {},
      }));
      const myProjects = allProjects.filter(
        (p) => p.assignedEmployees?.includes(user.id) || p.assignedTeamLeader === user.id
      );
      setProjects(myProjects);
      setLoading(false);
    });
    return () => off(projectsRef);
  }, [user]);

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return 'Not set';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? dateStr : format(date, 'MMM dd, yyyy');
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'in_progress': return 'bg-blue-100 text-blue-700';
      case 'not_started': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-2 border-gray-900 rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Projects</h1>
        <p className="text-gray-600">Projects you are part of (read‑only view)</p>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500">You are not assigned to any project yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => (
            <motion.div key={project.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedProject(project)}>
                <CardHeader>
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  <Badge className={getStatusColor(project.status)}>
                    {project.status.replace('_', ' ')}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 line-clamp-2">{project.description || 'No description'}</p>
                  <div className="flex gap-4 mt-3 text-xs text-gray-500">
                    <span><Calendar className="h-3 w-3 inline mr-1" /> {formatDate(project.startDate)} – {formatDate(project.endDate)}</span>
                    <span><Users className="h-3 w-3 inline mr-1" /> {Object.keys(project.tasks || {}).length} tasks</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedProject?.name}</DialogTitle>
          </DialogHeader>
          {selectedProject && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm text-gray-500">Description</h4>
                <p className="mt-1">{selectedProject.description || 'No description'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="font-medium">Status:</span> <Badge className={getStatusColor(selectedProject.status)}>{selectedProject.status}</Badge></div>
                <div><span className="font-medium">Timeline:</span> {formatDate(selectedProject.startDate)} – {formatDate(selectedProject.endDate)}</div>
              </div>
              <div>
                <h4 className="font-medium text-sm text-gray-500 mb-2">Other Tasks in this Project</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {Object.values(selectedProject.tasks || {}).length === 0 ? (
                    <p className="text-sm text-gray-400">No tasks yet</p>
                  ) : (
                    Object.values(selectedProject.tasks!).map((task) => (
                      <div key={task.id} className="border rounded p-2 text-sm">
                        <div className="font-medium">{task.title || 'Untitled'}</div>
                        <div className="flex gap-2 text-xs text-gray-500 mt-1">
                          <span>Status: {task.status || 'pending'}</span>
                          <span>Due: {formatDate(task.dueDate || '')}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="text-center text-xs text-gray-400 pt-2">
                This is a read‑only view. To update tasks, go to <strong>My Work</strong>.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyProjects;