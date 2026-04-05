import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, Plus, List, Grid, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { toast } from '../ui/use-toast';
import EnhancedProjectForm from './project/EnhancedProjectForm';
import ProjectCard from './project/ProjectCard';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../ui/badge';

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
  userId?: string;
  employeeName?: string;
  employeeEmail?: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
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

  /* ================= CHECK IF USER IS ADMIN ================= */
  const isAdmin = useMemo(() => {
    return userRole === 'admin' || userRole === 'super_admin' || userRole === 'Administrator';
  }, [userRole]);

  /* ================= FETCH PROJECTS ================= */
  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    if (!isAdmin) {
      // REGULAR USER: Fetch only their own projects
      const projectsRef = ref(database, `users/${userId}/projects`);

      const unsubscribe = onValue(
        projectsRef,
        (snapshot) => {
          try {
            const data = snapshot.val();
            console.log("🔥 User Projects Data:", data);

            if (!data) {
              setProjects([]);
              setLoading(false);
              return;
            }

            const projectsData: Project[] = Object.entries(data)
              .filter(([key]) => key && key.trim() !== '')
              .map(([key, value]: [string, any]) => ({
                id: key,
                userId: userId,
                ...(value as Omit<Project, 'id'>),
              }))
              .sort(
                (a, b) =>
                  new Date(b.createdAt || 0).getTime() -
                  new Date(a.createdAt || 0).getTime()
              );

            setProjects(projectsData);
          } catch (err) {
            console.error("❌ Parsing error:", err);
            setError("Error processing project data");
          } finally {
            setLoading(false);
          }
        },
        (err) => {
          console.error("❌ Firebase error:", err);
          setError("Failed to load projects");
          setLoading(false);
        }
      );

      return () => off(projectsRef);
    } else {
      // ADMIN: Fetch ALL projects from ALL users in the system
      const usersRef = ref(database, 'users');
      
      const unsubscribe = onValue(
        usersRef,
        (snapshot) => {
          try {
            const usersData = snapshot.val();
            console.log("🔥 All Users Data:", usersData);
            
            if (!usersData) {
              setProjects([]);
              setLoading(false);
              return;
            }

            const allProjects: Project[] = [];
            
            // Loop through each user in the system
            Object.entries(usersData).forEach(([uid, userData]: [string, any]) => {
              // Skip if user doesn't have projects
              if (!userData.projects) return;
              
              // Get employee name and email
              const employeeName = userData.name || userData.email || `Employee (${uid.slice(0, 6)})`;
              const employeeEmail = userData.email || '';
              
              // Loop through all projects of this user
              Object.entries(userData.projects).forEach(([projectId, projectData]: [string, any]) => {
                allProjects.push({
                  id: projectId,
                  userId: uid,
                  employeeName: employeeName,
                  employeeEmail: employeeEmail,
                  ...(projectData as Omit<Project, 'id'>),
                });
              });
            });

            // Sort all projects by createdAt (newest first)
            allProjects.sort(
              (a, b) =>
                new Date(b.createdAt || 0).getTime() -
                new Date(a.createdAt || 0).getTime()
            );

            setProjects(allProjects);
            console.log(`✅ Loaded ${allProjects.length} projects from ${Object.keys(usersData).length} users`);
          } catch (err) {
            console.error("❌ Error fetching all projects:", err);
            setError("Error loading all projects data");
          } finally {
            setLoading(false);
          }
        },
        (err) => {
          console.error("❌ Firebase error:", err);
          setError("Failed to load projects from database");
          setLoading(false);
        }
      );

      return () => off(usersRef);
    }
  }, [userId, isAdmin]);

  /* ================= COUNTS ================= */
  const counts = useMemo(() => {
    const completed = projects.filter((p) => p.status === 'completed').length;
    const inProgress = projects.filter((p) => p.status === 'in_progress').length;
    const pending = projects.filter((p) => p.status === 'pending').length;
    const onHold = projects.filter((p) => p.status === 'on_hold').length;
    
    return { completed, inProgress, pending, onHold };
  }, [projects]);

  /* ================= GROUP PROJECTS BY EMPLOYEE (FOR ADMIN) ================= */
  const projectsByEmployee = useMemo(() => {
    if (!isAdmin) return null;
    
    const grouped = projects.reduce((acc, project) => {
      const employeeName = project.employeeName || 'Unknown Employee';
      if (!acc[employeeName]) {
        acc[employeeName] = [];
      }
      acc[employeeName].push(project);
      return acc;
    }, {} as Record<string, Project[]>);
    
    return grouped;
  }, [projects, isAdmin]);

  /* ================= HANDLERS ================= */
  const handleProjectCreated = () => {
    setShowAddForm(false);
    toast({
      title: 'Project Created',
      description: 'Your new project has been created successfully',
    });
  };

  const handleProjectEdit = () => {
    toast({
      title: 'Project Updated',
      description: 'Project updated successfully',
    });
  };

  const handleProjectDelete = () => {
    toast({
      title: 'Project Deleted',
      description: 'Project deleted successfully',
    });
  };

  /* ================= LOADING ================= */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin h-10 w-10 border-b-2 border-gray-900 rounded-full"></div>
        <p className="mt-3 text-gray-500">Loading projects...</p>
      </div>
    );
  }

  /* ================= ERROR ================= */
  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        <p>{error}</p>
        <Button 
          onClick={() => window.location.reload()} 
          variant="outline" 
          className="mt-4"
        >
          Retry
        </Button>
      </div>
    );
  }

  /* ================= RENDER ADMIN VIEW ================= */
  const renderAdminView = () => {
    if (!isAdmin || !projectsByEmployee) return null;

    if (Object.keys(projectsByEmployee).length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <FolderOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium mb-2">No projects found</p>
          <p className="text-sm">No employees have created any projects yet</p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {Object.entries(projectsByEmployee).map(([employeeName, employeeProjects]) => (
          <Card key={employeeName}>
            <CardHeader className="bg-gray-50">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-gray-600" />
                  <CardTitle className="text-lg">{employeeName}</CardTitle>
                  <Badge variant="outline" className="ml-2">
                    {employeeProjects.length} Project{employeeProjects.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="bg-green-50">
                    {employeeProjects.filter(p => p.status === 'completed').length} Completed
                  </Badge>
                  <Badge variant="outline" className="bg-blue-50">
                    {employeeProjects.filter(p => p.status === 'in_progress').length} In Progress
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {employeeProjects.map((project, index) => (
                    <ProjectCard
                      key={project.id}
                      projectId={project.id}
                      index={index}
                      onEdit={handleProjectEdit}
                      onDelete={handleProjectDelete}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {employeeProjects.map((project, index) => (
                    <ProjectCard
                      key={project.id}
                      projectId={project.id}
                      index={index}
                      onEdit={handleProjectEdit}
                      onDelete={handleProjectDelete}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  /* ================= UI ================= */
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
              : "Create and manage your projects"}
          </p>
        </div>

        <div className="flex gap-2">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => {
              if (value === 'grid' || value === 'list') {
                setViewMode(value);
              }
            }}
          >
            <ToggleGroupItem value="grid">
              <Grid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>

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
          <CardTitle>
            {isAdmin ? 'All Employee Projects' : 'My Projects'} ({projects.length})
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
                  ? "No projects have been created by any employees yet" 
                  : "Get started by creating your first project"}
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
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project, index) => (
                <ProjectCard
                  key={project.id}
                  projectId={project.id}
                  index={index}
                  onEdit={handleProjectEdit}
                  onDelete={handleProjectDelete}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {projects.map((project, index) => (
                <ProjectCard
                  key={project.id}
                  projectId={project.id}
                  index={index}
                  onEdit={handleProjectEdit}
                  onDelete={handleProjectDelete}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectManagement;