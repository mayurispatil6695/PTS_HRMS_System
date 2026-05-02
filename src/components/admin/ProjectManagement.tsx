// src/components/admin/ProjectManagement.tsx
import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, Plus, List, LayoutGrid, Calendar, PlusCircle, Trash2, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { toast } from '../ui/use-toast';
import { ref, onValue, off, remove, get } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible';
import { Project, Task } from '@/types/project';
import { Employee } from '@/types/employee';
import { addAuditLog } from '../../utils/auditLog'; // ✅ audit log

// Lazy load heavy components – FIXED default export handling
const EnhancedProjectForm = lazy(() => import('./project/EnhancedProjectForm'));
const KanbanBoard = lazy(() => import('./project/KanbanBoard'));
const ListView = lazy(() => import('./project/ListView'));
const TimelineView = lazy(() => import('./project/TimelineView'));
const ProjectChat = lazy(() => import('./project/ProjectChat'));
const ProjectCalendar = lazy(() => import('./project/ProjectCalendar'));
const ProjectReportModal = lazy(() =>
  import('./project/ProjectReportModal').then(module => ({ default: module.ProjectReportModal }))
);
const TaskCreateModal = lazy(() => import('./project/TaskCreateModal'));

// ========== TYPES ==========
interface FirebaseProjectRaw {
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
  tasks?: Record<string, Task>;
  progress?: number;
  clientId?: string;
}

interface UserData {
  role?: string;
  name?: string;
  profile?: { name?: string; email?: string; department?: string; designation?: string; phone?: string };
  employee?: { name?: string; email?: string; department?: string; designation?: string; phone?: string };
}

interface ProjectManagementProps {
  role?: 'admin' | 'team_manager' | 'team_leader' | 'client' | 'employee';
  userId?: string;
  readOnly?: boolean;
  department?: string;
}

// ========== CONVERSION FUNCTIONS for subcomponents ==========
interface KanbanTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignedTo?: string;
  description?: string;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
  dependsOn?: string[];
}

interface KanbanProject {
  id: string;
  name: string;
  tasks: Record<string, KanbanTask>;
  assignedTeamLeader?: string;
  assignedEmployees?: string[];
}

const toKanbanProject = (project: Project): KanbanProject => ({
  id: project.id,
  name: project.name,
  tasks: project.tasks || {},
  assignedTeamLeader: project.assignedTeamLeader,
  assignedEmployees: project.assignedEmployees,
});

interface ListViewTask {
  id: string;
  title: string;
  assignedTo: string;
  status: string;
  priority: string;
  dueDate: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  dependsOn?: string[];
}

interface ListViewProject {
  id: string;
  name: string;
  tasks: Record<string, ListViewTask>;
}

const toListViewProject = (project: Project): ListViewProject => ({
  id: project.id,
  name: project.name,
  tasks: project.tasks || {},
});

interface TimelineTask {
  id: string;
  title: string;
  dueDate: string;
}

interface TimelineProject {
  id: string;
  name: string;
  tasks: Record<string, TimelineTask>;
}

const toTimelineProject = (project: Project): TimelineProject => ({
  id: project.id,
  name: project.name,
  tasks: project.tasks || {},
});

// ========== HELPERS ==========
const isTaskCompleted = (task: Task): boolean => task.status === 'completed';

// ========== MAIN COMPONENT ==========
const ProjectManagement: React.FC<ProjectManagementProps> = ({
  role: propRole,
  userId: propUserId,
  readOnly = false,
  department: propDepartment
}) => {
  const { user: authUser } = useAuth();
  const effectiveRole = propRole || authUser?.role || 'employee';
  const effectiveUserId = propUserId || authUser?.id || '';
  const effectiveDepartment = propDepartment || authUser?.department || '';

  const [showAddForm, setShowAddForm] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<'kanban' | 'list' | 'timeline' | 'calendar'>('kanban');
  const [reportProjectId, setReportProjectId] = useState<string | null>(null);
  const [adminNames, setAdminNames] = useState<Record<string, string>>({});
  const [globalEmployees, setGlobalEmployees] = useState<Employee[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [taskCreateProject, setTaskCreateProject] = useState<{ id: string; name: string } | null>(null);

  const isAdmin = effectiveRole === 'admin';
  const isTeamManager = effectiveRole === 'team_manager';
  const isTeamLeader = effectiveRole === 'team_leader';
  const isClient = effectiveRole === 'client';
  const canCreate = !readOnly && (isAdmin || isTeamManager || isTeamLeader);

  // Fetch admin names
  useEffect(() => {
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const users = snapshot.val() as Record<string, UserData> | null;
      if (users) {
        const names: Record<string, string> = {};
        Object.entries(users).forEach(([uid, userData]) => {
          if (userData.role === 'admin') {
            names[uid] = userData.name || uid.slice(0, 8);
          }
        });
        setAdminNames(names);
      }
    });
    return () => off(usersRef);
  }, []);

  // Fetch all employees (non‑admin)
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
            phone: profile.phone || '',
            employeeId: child.key || '',
            isActive: true,
            createdAt: new Date().toISOString(),
          });
        }
      });
      setGlobalEmployees(employeesList);
    });
    return () => off(usersRef);
  }, []);

  // Fetch projects
  useEffect(() => {
    if (!effectiveUserId) return;
    setLoading(true);
    setError(null);

    const projectsRef = ref(database, 'projects');
    const unsubscribe = onValue(
      projectsRef,
      (snapshot) => {
        try {
          const data = snapshot.val() as Record<string, FirebaseProjectRaw> | null;
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
            priority: (projData.priority as Project['priority']) || 'medium',
            status: (projData.status as Project['status']) || 'not_started',
            projectType: projData.projectType || 'common',
            specificDepartment: projData.specificDepartment,
            createdAt: projData.createdAt || new Date().toISOString(),
            createdBy: projData.createdBy || '',
            tasks: projData.tasks || {},
            progress: projData.progress || 0,
            clientId: projData.clientId,
          }));

          let filtered: Project[] = [];
          if (isAdmin) {
            filtered = allProjects;
          } else if (isTeamManager && effectiveDepartment) {
            filtered = allProjects.filter(p => p.department === effectiveDepartment);
          } else if (isTeamLeader) {
            filtered = allProjects.filter(p => p.assignedTeamLeader === effectiveUserId);
          } else if (isClient) {
            filtered = allProjects.filter(p => p.clientId === effectiveUserId);
          } else {
            filtered = allProjects.filter(p => p.assignedEmployees?.includes(effectiveUserId));
          }
          filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setProjects(filtered);
          setLoading(false);
        } catch (err) {
          console.error(err);
          setError('Failed to load projects');
          setLoading(false);
        }
      },
      (err) => {
        console.error(err);
        setError('Failed to load projects from database');
        setLoading(false);
      }
    );
    return () => off(projectsRef);
  }, [effectiveUserId, isAdmin, isTeamManager, isTeamLeader, isClient, effectiveDepartment]);

  // Memoized stats
  const counts = useMemo(() => {
    const completed = projects.filter(p => p.status === 'completed').length;
    const inProgress = projects.filter(p => p.status === 'active' || p.status === 'in_progress').length;
    const pending = projects.filter(p => p.status === 'not_started').length;
    const onHold = projects.filter(p => p.status === 'on_hold').length;
    return { completed, inProgress, pending, onHold };
  }, [projects]);

  // Group projects by creator (admin only)
  const projectsByCreator = useMemo(() => {
    if (!isAdmin) return null;
    const grouped: Record<string, Project[]> = {};
    projects.forEach(project => {
      const creatorId = project.createdBy || 'unknown';
      if (!grouped[creatorId]) grouped[creatorId] = [];
      grouped[creatorId].push(project);
    });
    return grouped;
  }, [projects, isAdmin]);

  const handleProjectCreated = useCallback(() => {
    setShowAddForm(false);
    toast({ title: 'Project Created', description: 'Your new project has been created successfully' });
  }, []);

  // ✅ Add audit log on project deletion
  const handleDeleteProject = useCallback(async (projectId: string, projectName: string) => {
    if (!window.confirm(`Are you sure you want to delete the project "${projectName}"? This action cannot be undone.`)) return;
    try {
      const projectRef = ref(database, `projects/${projectId}`);
      const projectSnap = await get(projectRef);
      const projectData = projectSnap.val() as FirebaseProjectRaw | null;
      if (!projectData) {
        toast({ title: "Not Found", description: "Project does not exist", variant: "destructive" });
        return;
      }
      const assignedUsers = [
        ...(projectData.assignedEmployees || []),
        projectData.assignedTeamLeader
      ].filter(Boolean) as string[];
      const deletePromises = assignedUsers.map(userId => remove(ref(database, `users/${userId}/projects/${projectId}`)));
      deletePromises.push(remove(projectRef));
      await Promise.all(deletePromises);
      toast({ title: "Project Deleted", description: `"${projectName}" has been deleted.` });

      // ✅ Audit log
      await addAuditLog({
        action: 'project_deleted',
        performedBy: authUser?.id || 'unknown',
        performedByName: authUser?.name || 'System',
        targetId: projectId,
        details: {
          projectName,
          assignedTeamLeader: projectData.assignedTeamLeader,
          assignedEmployeesCount: projectData.assignedEmployees?.length || 0,
        },
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to delete project", variant: "destructive" });
    }
  }, [authUser]);

  const renderAdminView = () => {
    if (!isAdmin || !projectsByCreator) return null;
    if (Object.keys(projectsByCreator).length === 0) {
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
        {Object.entries(projectsByCreator).map(([creatorId, creatorProjects]) => {
          let totalTasks = 0, completedTasks = 0, inProgressTasks = 0;
          creatorProjects.forEach(project => {
            if (project.tasks) {
              const tasksArray = Object.values(project.tasks);
              totalTasks += tasksArray.length;
              completedTasks += tasksArray.filter(t => isTaskCompleted(t)).length;
              inProgressTasks += tasksArray.filter(t => t.status === 'in_progress').length;
            }
          });
          const creatorName = adminNames[creatorId] || creatorId.slice(0, 8);
          return (
            <Card key={creatorId}>
              <CardHeader className="bg-gray-50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-gray-600" />
                    <CardTitle className="text-lg">Created by: {creatorName}</CardTitle>
                    <Badge variant="outline" className="ml-2">
                      {creatorProjects.length} Project{creatorProjects.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-green-50">✓ {completedTasks} / {totalTasks} Tasks Completed</Badge>
                    {inProgressTasks > 0 && <Badge variant="outline" className="bg-blue-50">🔄 {inProgressTasks} In Progress</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {creatorProjects.map(project => (
                  <div key={project.id} className="border rounded-lg p-4 mb-6 last:mb-0">
                    {/* ... existing content ... */}
                    <div className="flex flex-wrap justify-between items-center mb-2 gap-2">
                      <h3 className="text-lg font-bold">{project.name}</h3>
                      <Button size="sm" variant="outline" onClick={() => setTaskCreateProject({ id: project.id, name: project.name })}>
                        <PlusCircle className="h-4 w-4 mr-1" /> Add Task
                      </Button>
                    </div>

                    <Suspense fallback={<div className="py-4 text-center">Loading view...</div>}>
                      {displayMode === 'kanban' && <KanbanBoard projects={[toKanbanProject(project)]} employees={globalEmployees} readOnly={readOnly} />}
                      {displayMode === 'list' && <ListView projects={[toListViewProject(project)]} employees={globalEmployees} readOnly={readOnly} onTaskUpdate={() => setRefreshKey(prev => prev + 1)} />}
                      {displayMode === 'timeline' && <TimelineView projects={[toTimelineProject(project)]} readOnly={readOnly} />}
                      {displayMode === 'calendar' && <ProjectCalendar tasks={Object.values(project.tasks || {})} projectId={project.id} readOnly={readOnly} />}
                    </Suspense>

                    <div className="flex flex-wrap justify-end gap-2 mt-4">
                      <Button variant="outline" size="sm" onClick={() => setReportProjectId(project.id)}>
                        <FolderOpen className="h-4 w-4 mr-1" /> Export Report
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleDeleteProject(project.id, project.name)}>
                        <Trash2 className="h-4 w-4 mr-1" /> Delete Project
                      </Button>
                    </div>

                    <Collapsible>
                      <CollapsibleTrigger className="w-full text-left p-2 hover:bg-gray-50 rounded mt-4">💬 Team Chat</CollapsibleTrigger>
                      <CollapsibleContent className="pt-2">
                        <Suspense fallback={<div>Loading chat...</div>}>
                          <ProjectChat projectId={project.id} />
                        </Suspense>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin h-10 w-10 border-b-2 border-gray-900 rounded-full" />
        <p className="mt-3 text-gray-500">Loading projects...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        <p>{error}</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 pb-20 sm:px-6 sm:pb-0">
      <Suspense fallback={null}>
        {reportProjectId && <ProjectReportModal open={!!reportProjectId} onOpenChange={() => setReportProjectId(null)} projectId={reportProjectId} />}
        {taskCreateProject && (
          <TaskCreateModal
            open={!!taskCreateProject}
            onOpenChange={() => setTaskCreateProject(null)}
            projectId={taskCreateProject.id}
            projectName={taskCreateProject.name}
            employees={globalEmployees.map(e => ({ id: e.id, name: e.name }))}
            onTaskCreated={() => setRefreshKey(prev => prev + 1)}
          />
        )}
      </Suspense>

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Project Management</h1>
          <p className="text-gray-600 text-sm">
            {isAdmin ? `Viewing all projects across the organization (${projects.length} total projects)` :
             isTeamManager ? `Managing projects for ${effectiveDepartment} department` :
             isTeamLeader ? 'Managing your team projects' :
             isClient ? 'Viewing your assigned projects' : 'Create and manage your projects'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1">
            <Button variant={displayMode === 'kanban' ? 'default' : 'outline'} size="sm" onClick={() => setDisplayMode('kanban')}>
              <LayoutGrid className="h-4 w-4 mr-1" /> Board
            </Button>
            <Button variant={displayMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setDisplayMode('list')}>
              <List className="h-4 w-4 mr-1" /> List
            </Button>
            <Button variant={displayMode === 'timeline' ? 'default' : 'outline'} size="sm" onClick={() => setDisplayMode('timeline')}>
              <Calendar className="h-4 w-4 mr-1" /> Timeline
            </Button>
            <Button variant={displayMode === 'calendar' ? 'default' : 'outline'} size="sm" onClick={() => setDisplayMode('calendar')}>
              <Calendar className="h-4 w-4 mr-1" /> Calendar
            </Button>
          </div>
          {canCreate && (
            <Button onClick={() => setShowAddForm(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" /> New Project
            </Button>
          )}
        </div>
      </motion.div>

      <Suspense fallback={null}>
        {showAddForm && (
          <EnhancedProjectForm
            onSuccess={handleProjectCreated}
            onCancel={() => setShowAddForm(false)}
            role={effectiveRole}
            userId={effectiveUserId}
            department={effectiveDepartment}
          />
        )}
      </Suspense>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between gap-4">
          <CardTitle>
            {isAdmin ? 'All Projects' : isTeamManager ? 'Department Projects' : isTeamLeader ? 'Team Projects' : 'My Projects'} ({projects.length})
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            {counts.completed > 0 && <Badge variant="outline" className="bg-green-50">✓ {counts.completed} Completed</Badge>}
            {counts.inProgress > 0 && <Badge variant="outline" className="bg-blue-50">🔄 {counts.inProgress} In Progress</Badge>}
            {counts.pending > 0 && <Badge variant="outline" className="bg-yellow-50">⏳ {counts.pending} Pending</Badge>}
            {counts.onHold > 0 && <Badge variant="outline" className="bg-gray-50">⏸ {counts.onHold} On Hold</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">No projects found</p>
              <p className="text-sm mb-4">
                {isAdmin ? 'No projects have been created yet' :
                 isTeamManager ? 'No projects found for your department' :
                 isTeamLeader ? 'No projects assigned to your team' :
                 isClient ? 'No projects assigned to you' : 'Get started by creating your first project'}
              </p>
              {canCreate && <Button onClick={() => setShowAddForm(true)}><Plus className="h-4 w-4 mr-2" /> Create Project</Button>}
            </div>
          ) : isAdmin ? (
            renderAdminView()
          ) : (
            <div className="space-y-6">
              {projects.map(project => (
                <div key={project.id} className="border rounded-lg p-4">
                  <div className="flex flex-wrap justify-between items-center mb-2 gap-2">
                    <h3 className="text-lg font-bold">{project.name}</h3>
                    <Button size="sm" variant="outline" onClick={() => setTaskCreateProject({ id: project.id, name: project.name })}>
                      <PlusCircle className="h-4 w-4 mr-1" /> Add Task
                    </Button>
                  </div>

                  <Suspense fallback={<div className="py-4 text-center">Loading view...</div>}>
                    {displayMode === 'kanban' && <KanbanBoard projects={[toKanbanProject(project)]} employees={globalEmployees} readOnly={readOnly} />}
                    {displayMode === 'list' && <ListView projects={[toListViewProject(project)]} employees={globalEmployees} readOnly={readOnly} onTaskUpdate={() => setRefreshKey(prev => prev + 1)} />}
                    {displayMode === 'timeline' && <TimelineView projects={[toTimelineProject(project)]} readOnly={readOnly} />}
                    {displayMode === 'calendar' && <ProjectCalendar tasks={Object.values(project.tasks || {})} projectId={project.id} readOnly={readOnly} />}
                  </Suspense>

                  <div className="flex flex-wrap justify-end gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => setReportProjectId(project.id)}>
                      <FolderOpen className="h-4 w-4 mr-1" /> Export Report
                    </Button>
                    {(isAdmin || isTeamManager || isTeamLeader) && (
                      <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleDeleteProject(project.id, project.name)}>
                        <Trash2 className="h-4 w-4 mr-1" /> Delete Project
                      </Button>
                    )}
                  </div>

                  <Collapsible>
                    <CollapsibleTrigger className="w-full text-left p-2 hover:bg-gray-50 rounded mt-4">💬 Team Chat</CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <Suspense fallback={<div>Loading chat...</div>}>
                        <ProjectChat projectId={project.id} />
                      </Suspense>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default React.memo(ProjectManagement);