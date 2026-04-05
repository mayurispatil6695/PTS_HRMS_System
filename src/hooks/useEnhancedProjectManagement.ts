
import { useState, useEffect } from 'react';
import { Project } from '../types/project';
import { User } from '../types/auth';
import { toast } from '../components/ui/use-toast';

export const useEnhancedProjectManagement = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);

  useEffect(() => {
    const savedProjects = JSON.parse(localStorage.getItem('projects') || '[]');
    setProjects(savedProjects);

    const allUsers = JSON.parse(localStorage.getItem('hrms_users') || '[]');
    const activeEmployees = allUsers.filter((user: User) => 
      (user.role === 'employee' || user.role === 'team_leader') && user.isActive
    );
    setEmployees(activeEmployees);
  }, []);

  const addProject = (projectData: any) => {
    const newProject: Project = {
      id: Date.now().toString(),
      ...projectData,
      progress: 0,
      createdAt: new Date().toISOString(),
      createdBy: 'admin',
      tasks: projectData.tasks || []
    };

    const updatedProjects = [...projects, newProject];
    setProjects(updatedProjects);
    localStorage.setItem('projects', JSON.stringify(updatedProjects));

    // Send notifications to assigned team leader and employees
    if (projectData.assignedTeamLeader) {
      sendProjectNotification(projectData.assignedTeamLeader, newProject, 'team_leader');
    }

    projectData.assignedEmployees.forEach((employeeId: string) => {
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
