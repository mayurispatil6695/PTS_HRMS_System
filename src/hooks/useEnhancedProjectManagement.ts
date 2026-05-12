import { useState, useEffect } from 'react';
import { Project } from '../types/project';
import { User } from '../types/user';
import { toast } from '../components/ui/use-toast';
import { database } from '../firebase';
import { ref, push, set, onValue, off, get } from 'firebase/database';

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

interface UserProfile {
  name?: string;
  email?: string;
  department?: string;
  designation?: string;
  role?: string;
  status?: string;
  isActive?: boolean;
  adminUid?: string;
}

// Helper to convert Firebase user data to User type
const mapToUser = (uid: string, profile: UserProfile): User => ({
  id: uid,
  name: profile.name || '',
  email: profile.email || '',
  department: profile.department || '',
  designation: profile.designation || '',
  role: (profile.role as User['role']) || 'employee',
  isActive: profile.status === 'active',
  createdAt: '',
  phone: '',
  employeeId: '',
  profileImage: '',
});

export const useEnhancedProjectManagement = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch projects from Firebase
  useEffect(() => {
    const projectsRef = ref(database, 'projects');
    const unsubscribe = onValue(projectsRef, (snapshot) => {
      const data = snapshot.val() as Record<string, Omit<Project, 'id'>> | null;
      if (data) {
        const projectsList: Project[] = Object.entries(data).map(([id, proj]) => ({
          id,
          ...proj,
        }));
        setProjects(projectsList);
      } else {
        setProjects([]);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error fetching projects:', error);
      toast({ title: 'Error', description: 'Failed to load projects', variant: 'destructive' });
      setLoading(false);
    });
    return () => off(projectsRef);
  }, []);

  // Fetch all active employees (non‑admin, active status)
  useEffect(() => {
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const usersData = snapshot.val() as Record<string, { role?: string; profile?: UserProfile; employee?: UserProfile }> | null;
      const employeesList: User[] = [];
      if (usersData) {
        for (const [uid, userData] of Object.entries(usersData)) {
          if (userData.role === 'admin') continue;
          const profile = userData.profile || userData.employee;
          if (!profile || profile.status !== 'active') continue;
          if (profile.role === 'employee' || profile.role === 'team_leader') {
            employeesList.push(mapToUser(uid, profile));
          }
        }
      }
      setEmployees(employeesList);
    }, (error) => {
      console.error('Error fetching employees:', error);
      toast({ title: 'Error', description: 'Failed to load employees', variant: 'destructive' });
    });
    return () => off(usersRef);
  }, []);

  const sendFirebaseNotification = async (userId: string, userType: string, projectName: string) => {
    const notifRef = push(ref(database, `notifications/${userId}`));
    await set(notifRef, {
      title: userType === 'team_leader' ? 'New Project Assignment (Team Leader)' : 'New Project Assignment',
      body: `You have been assigned to project: ${projectName}`,
      type: 'project_assigned',
      read: false,
      createdAt: Date.now(),
    });
  };

  const addProject = async (projectData: ProjectFormData) => {
    if (!projectData.name.trim()) {
      toast({ title: 'Error', description: 'Project name is required', variant: 'destructive' });
      return;
    }

    const newProject: Omit<Project, 'id'> = {
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

    try {
      const newProjectRef = push(ref(database, 'projects'));
      await set(newProjectRef, newProject);

      // Send notifications
      if (projectData.assignedTeamLeader) {
        await sendFirebaseNotification(projectData.assignedTeamLeader, 'team_leader', projectData.name);
      }
      for (const employeeId of (projectData.assignedEmployees || [])) {
        await sendFirebaseNotification(employeeId, 'employee', projectData.name);
      }

      toast({
        title: "Project Created",
        description: `Project "${projectData.name}" has been created successfully.`
      });
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: "Error",
        description: "Failed to create project. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };

  return {
    projects,
    employees,
    addProject,
    loading,
  };
};