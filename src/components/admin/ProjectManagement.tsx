// src/components/admin/ProjectManagement.tsx
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
import { ref, onValue, off, remove } from 'firebase/database';
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

// Admin view: group by creator
interface TaskItem {
  status?: string;
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
  clientId?: string; // optional for client filtering
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
  tasks?: Record<string, any>;
  progress?: number;
  clientId?: string;
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

interface ProjectManagementProps {
  role?: 'admin' | 'team_manager' | 'team_leader' | 'client' | 'employee';
  userId?: string;
  readOnly?: boolean;
  department?: string; // for manager filtering
}

const ProjectManagement: React.FC<ProjectManagementProps> = ({ 
  role: propRole, 
  userId: propUserId, 
  readOnly = false,
  department: propDepartment 
}) => {
  const { user: authUser } = useAuth();
  // Determine effective role and userId: use props if provided, else from auth
  const effectiveRole = propRole || authUser?.role || 'employee';
  const effectiveUserId = propUserId || authUser?.id || '';
  const effectiveDepartment = propDepartment || authUser?.department || '';

  const [showAddForm, setShowAddForm] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [displayMode, setDisplayMode] = useState<'kanban' | 'list' | 'timeline'>('kanban');

  const isAdmin = effectiveRole === 'admin';
  const isTeamManager = effectiveRole === 'team_manager';
  const isTeamLeader = effectiveRole === 'team_leader';
  const isClient = effectiveRole === 'client';
  const isEmployee = effectiveRole === 'employee';

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
    if (!effectiveUserId) return;

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
            tasks: projData.tasks || {},
            progress: projData.progress || 0,
            clientId: projData.clientId,
          }));

          let filteredProjects: Project[] = [];

          // Role-based filtering
          if (isAdmin) {
            filteredProjects = allProjects;
          } else if (isTeamManager && effectiveDepartment) {
            filteredProjects = allProjects.filter(p => p.department === effectiveDepartment);
          } else if (isTeamLeader) {
            filteredProjects = allProjects.filter(p => p.assignedTeamLeader === effectiveUserId);
          } else if (isClient) {
            filteredProjects = allProjects.filter(p => p.clientId === effectiveUserId);
          } else {
            // Employee (default) – show only projects they are assigned to
            filteredProjects = allProjects.filter(p => p.assignedEmployees?.includes(effectiveUserId));
          }

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
  }, [effectiveUserId, isAdmin, isTeamManager, isTeamLeader, isClient, effectiveDepartment]);

  const counts = useMemo(() => {
    const completed = projects.filter((p) => p.status === 'completed' || p.status === 'done').length;
    const inProgress = projects.filter((p) => p.status === 'active' || p.status === 'in_progress').length;
    const pending = projects.filter((p) => p.status === 'planned' || p.status === 'not_started' || p.status === 'pending').length;
    const onHold = projects.filter((p) => p.status === 'paused' || p.status === 'on_hold').length;
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

  const canCreate = !readOnly && (isAdmin || isTeamManager || isTeamLeader);

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

  const renderAdminView = () => {
    if (!isAdmin) return null;

    if (Object.keys(projectsByCreator || {}).length === 0) {
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
        {Object.entries(projectsByCreator || {}).map(([creatorId, creatorProjects]) => {
          let totalTasks = 0;
          let completedTasks = 0;
          let inProgressTasks = 0;
          for (const project of creatorProjects) {
            if (project.tasks) {
              const tasksArray = Object.values(project.tasks) as TaskItem[];
              totalTasks += tasksArray.length;
              completedTasks += tasksArray.filter(t => t.status === 'completed' || t.status === 'done').length;
              inProgressTasks += tasksArray.filter(t => t.status === 'in_progress').length;
            }
          }

          const creatorName = adminNames[creatorId] || creatorId.slice(0, 8);

          return (
            <Card key={creatorId}>
              <CardHeader className="bg-gray-50">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-gray-600" />
                    <CardTitle className="text-lg">Created by: {creatorName}</CardTitle>
                    <Badge variant="outline" className="ml-2">
                      {creatorProjects.length} Project{creatorProjects.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-green-50">
                      ✓ {completedTasks} / {totalTasks} Tasks Completed
                    </Badge>
                    {inProgressTasks > 0 && (
                      <Badge variant="outline" className="bg-blue-50">
                        🔄 {inProgressTasks} In Progress
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {creatorProjects.map(project => {
                  const tasksArray = project.tasks ? Object.values(project.tasks) as TaskItem[] : [];
                  const projectProgress = tasksArray.length > 0
                    ? Math.round((tasksArray.filter(t => t.status === 'completed' || t.status === 'done').length / tasksArray.length) * 100)
                    : 0;

                  return (
                    <div key={project.id} className="mb-8 border rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-2">{project.name}</h3>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Overall Progress</span>
                        <span>{projectProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${projectProgress}%` }}></div>
                      </div>
                      {displayMode === 'kanban' && (
                        <KanbanBoard
                          projects={[project]}
                          employees={globalEmployees}
                          onTaskClick={(task) => alert(`Task: ${task.title}\nStatus: ${task.status}\nPriority: ${task.priority}\nAssigned to: ${task.assignedTo || 'Unassigned'}`)}
                          readOnly={readOnly}
                        />
                      )}
                      {displayMode === 'list' && <ListView projects={[project]} employees={globalEmployees} readOnly={readOnly} />}
                      {displayMode === 'timeline' && <TimelineView projects={[project]} readOnly={readOnly} />}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
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
              : isTeamManager
              ? `Managing projects for ${effectiveDepartment} department`
              : isTeamLeader
              ? 'Managing your team projects'
              : isClient
              ? 'Viewing your assigned projects'
              : 'Create and manage your projects'}
          </p>
        </div>

        <div className="flex gap-2">
          {/* View Mode Toggle */}
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

          {canCreate && (
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          )}
        </div>
      </motion.div>

      {/* FORM */}
      {showAddForm && (
        <EnhancedProjectForm
          onSuccess={handleProjectCreated}
          onCancel={() => setShowAddForm(false)}
          role={effectiveRole}
          userId={effectiveUserId}
          department={effectiveDepartment}
        />
      )}

      {/* PROJECT LIST */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between gap-4">
          <CardTitle>
            {isAdmin ? 'All Projects' : isTeamManager ? 'Department Projects' : isTeamLeader ? 'Team Projects' : 'My Projects'} ({projects.length})
          </CardTitle>
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
                  : isTeamManager
                  ? 'No projects found for your department'
                  : isTeamLeader
                  ? 'No projects assigned to your team'
                  : isClient
                  ? 'No projects assigned to you'
                  : 'Get started by creating your first project'}
              </p>
              {canCreate && (
                <Button onClick={() => setShowAddForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </Button>
              )}
            </div>
          ) : isAdmin ? (
            renderAdminView()
          ) : displayMode === 'kanban' ? (
            <KanbanBoard projects={projects} employees={globalEmployees} readOnly={readOnly} />
          ) : displayMode === 'list' ? (
            <ListView projects={projects} employees={globalEmployees} readOnly={readOnly} />
          ) : (
            <TimelineView projects={projects} readOnly={readOnly} />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectManagement;