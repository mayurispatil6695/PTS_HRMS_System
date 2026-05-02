// hooks/useEnhancedProjectManagement.ts
import { useState, useEffect } from 'react';
import { Project } from '../types/project';
import { User } from '../types/user';
import { toast } from '../components/ui/use-toast';

interface ProjectFormData {
  name: string;
  description?: string;
  department?: string;
  assignedTeamLeader?: string;
  assignedEmployees?: string[];
  startDate?: string;
  endDate?: string;
  priority?: Project['priority'];
  status?: Project['status'];
  projectType?: string;
  specificDepartment?: string;
  clientId?: string;
}

export const useEnhancedProjectManagement = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);

  useEffect(() => {
    // NOTE: This uses localStorage – replace with Firebase calls in production
    const savedProjects = JSON.parse(localStorage.getItem('projects') || '[]');
    setProjects(savedProjects);

    const allUsers = JSON.parse(localStorage.getItem('hrms_users') || '[]');
    const activeEmployees = allUsers.filter((user: User) => 
      (user.role === 'employee' || user.role === 'team_leader') && user.isActive
    );
    setEmployees(activeEmployees);
  }, []);

  const addProject = (projectData: ProjectFormData) => {
    const newProject: Project = {
      id: Date.now().toString(),
      name: projectData.name,
      description: projectData.description || '',
      department: projectData.department || '',
      assignedTeamLeader: projectData.assignedTeamLeader,
      assignedEmployees: projectData.assignedEmployees || [],
      startDate: projectData.startDate || '',
      endDate: projectData.endDate || '',
      priority: projectData.priority || 'medium',
      status: projectData.status || 'not_started',
      projectType: projectData.projectType,
      specificDepartment: projectData.specificDepartment,
      clientId: projectData.clientId,
      progress: 0,
      createdAt: new Date().toISOString(),
      createdBy: 'admin',
      tasks: {},
    };

    const updatedProjects = [...projects, newProject];
    setProjects(updatedProjects);
    localStorage.setItem('projects', JSON.stringify(updatedProjects));

    if (projectData.assignedTeamLeader) {
      sendProjectNotification(projectData.assignedTeamLeader, newProject, 'team_leader');
    }

    projectData.assignedEmployees?.forEach((employeeId: string) => {
      sendProjectNotification(employeeId, newProject, 'employee');
    });

    toast({
      title: "Project Created",
      description: `Project "${newProject.name}" has been created successfully.`
    });
  };

  const sendProjectNotification = (userId: string, project: Project, userType: string) => {
    const notification = {
      id: Date.now().toString() + userId,
      type: 'project_assignment',
      title: userType === 'team_leader' ? 'New Project Assignment (Team Leader)' : 'New Project Assignment',
      message: `You have been assigned to project: ${project.name}`,
      projectId: project.id,
      userId: userId,
      timestamp: new Date().toISOString(),
      read: false
    };

    const existingNotifications = JSON.parse(localStorage.getItem(`${userType}_notifications_${userId}`) || '[]');
    existingNotifications.push(notification);
    localStorage.setItem(`${userType}_notifications_${userId}`, JSON.stringify(existingNotifications));
  };

  return {
    projects,
    employees,
    addProject
  };
};