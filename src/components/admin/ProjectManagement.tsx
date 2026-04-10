import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, Plus, List, Grid, Users, LayoutGrid, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { toast } from '../ui/use-toast';
import EnhancedProjectForm from './project/EnhancedProjectForm';
import ProjectCard from './project/ProjectCard';
import KanbanBoard from './project/KanbanBoard';
import ListView from './project/ListView';
import TimelineView from './project/TimelineView';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../ui/badge';

// Employee interface
interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
}

// Firebase project data structure
interface FirebaseProjectData {
  name?: string;
  description?: string;
  department?: string;
  assignedTeamLeader?: string;
  assignedEmployees?: string[];
  startDate?: string;
  endDate?: string;
  priority?: string;
  status?: string;
  projectType?: string;
  specificDepartment?: string;
  createdAt?: string;
  createdBy?: string;
  tasks?: Record<string, unknown>;
  progress?: number;
}

// Project interface for the component
interface Project {
  id: string;
  name: string;
  description: string;
  department: string;
  assignedTeamLeader: string;
  assignedEmployees: string[];
  startDate: string;
  endDate: string;
  priority: string;
  status: string;
  projectType: string;
  specificDepartment?: string;
  createdAt: string;
  createdBy: string;
}

// User data interface for Firebase users
interface UserData {
  role?: string;
  name?: string;
  profile?: EmployeeProfile;
  employee?: EmployeeProfile;
}

// Employee profile data interface
interface EmployeeProfile {
  name?: string;
  email?: string;
  department?: string;
  designation?: string;
  status?: string;
}

const ProjectManagement = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const userRole = user?.role;

  const [showAddForm, setShowAddForm] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [displayMode, setDisplayMode] = useState<'kanban' | 'list' | 'timeline'>('kanban');

  const isAdmin = useMemo(() => userRole === 'admin', [userRole]);
  const [adminNames, setAdminNames] = useState<Record<string, string>>({});
  const [globalEmployees, setGlobalEmployees] = useState<Employee[]>([]);

  // Fetch admin names from users node
  useEffect(() => {
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const users = snapshot.val() as Record<string, UserData> | null;
      if (users) {
        const names: Record<string, string> = {};
        for (const [uid, userData] of Object.entries(users)) {
          if (userData.role === 'admin') {
            names[uid] = userData.name || uid.slice(0, 8);
          }
        }
        setAdminNames(names);
      }
    });
    return () => off(usersRef);
  }, []);

  // Fetch all employees (non‑admin) globally
  useEffect(() => {
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const employeesList: Employee[] = [];
      snapshot.forEach((child) => {
        const userData = child.val() as UserData;
        if (userData.role === 'admin') return;
        const profile = userData.profile || userData.employee;
        if (profile?.name) {
          employeesList.push({
            id: child.key || '',
            name: profile.name,
            email: profile.email || '',
            department: profile.department || '',
            designation: profile.designation || '',
          });
        }
      });
      setGlobalEmployees(employeesList);
    });
    return () => off(usersRef);
  }, []);

  // Fetch projects from the global `/projects` node
  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    const projectsRef = ref(database, 'projects');
    const unsubscribe = onValue(
      projectsRef,
      (snapshot) => {
        try {
          const data = snapshot.val() as Record<string, FirebaseProjectData> | null;
          if (!data) {
            setProjects([]);
            setLoading(false);
            return;
          }

          const allProjects: Project[] = Object.entries(data).map(([projId, projData]) => ({
            id: projId,
            name: projData.name || '',
            description: projData.description || '',
            department: projData.department || '',
            assignedTeamLeader: projData.assignedTeamLeader || '',
            assignedEmployees: projData.assignedEmployees || [],
            startDate: projData.startDate || '',
            endDate: projData.endDate || '',
            priority: projData.priority || 'medium',
            status: projData.status || 'not_started',
            projectType: projData.projectType || 'common',
            specificDepartment: projData.specificDepartment,
            createdAt: projData.createdAt || new Date().toISOString(),
            createdBy: projData.createdBy || '',
          }));

          const filteredProjects = isAdmin
            ? allProjects
            : allProjects.filter((proj) => proj.assignedEmployees.includes(userId));

          filteredProjects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          setProjects(filteredProjects);
          setLoading(false);
        } catch (err) {
          console.error('Error loading projects:', err);
          setError('Failed to load projects');
          setLoading(false);
        }
      },
      (err) => {
        console.error('Firebase error:', err);
        setError('Failed to load projects from database');
        setLoading(false);
      }
    );

    return () => off(projectsRef);
  }, [userId, isAdmin]);

  // Counts for badges
  const counts = useMemo(() => {
    const completed = projects.filter((p) => p.status === 'completed').length;
    const inProgress = projects.filter((p) => p.status === 'in_progress').length;
    const pending = projects.filter((p) => p.status === 'pending').length;
    const onHold = projects.filter((p) => p.status === 'on_hold').length;
    return { completed, inProgress, pending, onHold };
  }, [projects]);

  // Group projects by creator for admin view
  const projectsByCreator = useMemo(() => {
    if (!isAdmin) return null;
    const grouped: Record<string, Project[]> = {};
    for (const project of projects) {
      const creatorId = project.createdBy || 'unknown';
      if (!grouped[creatorId]) grouped[creatorId] = [];
      grouped[creatorId].push(project);
    }
    return grouped;
  }, [projects, isAdmin]);

  const handleProjectCreated = () => {
    setShowAddForm(false);
    toast({ title: 'Project Created', description: 'Your new project has been created successfully' });
  };

  const handleProjectEdit = () => {
    toast({ title: 'Project Updated', description: 'Project updated successfully' });
  };

  const handleProjectDelete = () => {
    toast({ title: 'Project Deleted', description: 'Project deleted successfully' });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin h-10 w-10 border-b-2 border-gray-900 rounded-full"></div>
        <p className="mt-3 text-gray-500">Loading projects...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        <p>{error}</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  // Admin view: group by creator
  const renderAdminView = () => {
    if (!projectsByCreator) return null;
    const creatorEntries = Object.entries(projectsByCreator);
    if (creatorEntries.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <FolderOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium mb-2">No projects found</p>
          <p className="text-sm">No projects have been created yet</p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {creatorEntries.map(([creatorId, creatorProjects]) => (
          <Card key={creatorId}>
            <CardHeader className="bg-gray-50">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-gray-600" />
                  <CardTitle className="text-lg">Created by: {adminNames[creatorId] || creatorId.slice(0, 8)}</CardTitle>
                  <Badge variant="outline" className="ml-2">
                    {creatorProjects.length} Project{creatorProjects.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="bg-green-50">
                    {creatorProjects.filter((p) => p.status === 'completed').length} Completed
                  </Badge>
                  <Badge variant="outline" className="bg-blue-50">
                    {creatorProjects.filter((p) => p.status === 'in_progress').length} In Progress
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {displayMode === 'kanban' && <KanbanBoard projects={creatorProjects} employees={globalEmployees} />}
              {displayMode === 'list' && <ListView projects={creatorProjects} employees={globalEmployees} />}
              {displayMode === 'timeline' && <TimelineView projects={creatorProjects} />}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 px-4 sm:px-6">
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold">Project Management</h1>
          <p className="text-gray-600 text-sm">
            {isAdmin
              ? `Viewing all projects across the organization (${projects.length} total projects)`
              : 'Create and manage your projects'}
          </p>
        </div>

        <div className="flex gap-2">
          {/* View Mode Toggle: Kanban / List / Timeline */}
          <div className="flex gap-1 mr-2">
            <Button
              variant={displayMode === 'kanban' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDisplayMode('kanban')}
            >
              <LayoutGrid className="h-4 w-4 mr-1" /> Board
            </Button>
            <Button
              variant={displayMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDisplayMode('list')}
            >
              <List className="h-4 w-4 mr-1" /> List
            </Button>
            <Button
              variant={displayMode === 'timeline' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDisplayMode('timeline')}
            >
              <Calendar className="h-4 w-4 mr-1" /> Timeline
            </Button>
          </div>

          {!isAdmin && (
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          )}
          {isAdmin && (
            <Button onClick={() => setShowAddForm(true)} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Create Project (as Admin)
            </Button>
          )}
        </div>
      </motion.div>

      {/* FORM */}
      {showAddForm && (
        <EnhancedProjectForm
          onSuccess={handleProjectCreated}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* PROJECT LIST */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between gap-4">
          <CardTitle>{isAdmin ? 'All Projects' : 'My Projects'} ({projects.length})</CardTitle>
          <div className="flex gap-2 flex-wrap">
            {counts.completed > 0 && (
              <Badge variant="outline" className="bg-green-50">
                ✓ {counts.completed} Completed
              </Badge>
            )}
            {counts.inProgress > 0 && (
              <Badge variant="outline" className="bg-blue-50">
                🔄 {counts.inProgress} In Progress
              </Badge>
            )}
            {counts.pending > 0 && (
              <Badge variant="outline" className="bg-yellow-50">
                ⏳ {counts.pending} Pending
              </Badge>
            )}
            {counts.onHold > 0 && (
              <Badge variant="outline" className="bg-gray-50">
                ⏸ {counts.onHold} On Hold
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {projects.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">No projects found</p>
              <p className="text-sm mb-4">
                {isAdmin
                  ? 'No projects have been created yet'
                  : 'Get started by creating your first project'}
              </p>
              {!isAdmin && (
                <Button onClick={() => setShowAddForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </Button>
              )}
            </div>
          ) : isAdmin ? (
            renderAdminView()
          ) : displayMode === 'kanban' ? (
            <KanbanBoard projects={projects} employees={globalEmployees} />
          ) : displayMode === 'list' ? (
            <ListView projects={projects} employees={globalEmployees} />
          ) : (
            <TimelineView projects={projects} />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectManagement;