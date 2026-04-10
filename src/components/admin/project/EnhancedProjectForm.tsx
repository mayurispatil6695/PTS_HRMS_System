import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Badge } from '../../ui/badge';
import { X, Plus } from 'lucide-react';
import { ref, onValue, off, set, push, get } from 'firebase/database';
import { database } from '../../../firebase';
import { useAuth } from '../../../hooks/useAuth';
import { toast } from '../../ui/use-toast';

interface StoredTask extends Task {
  updates: Record<string, {
    updatedBy: string;
    updatedById: string;
    changes: {
      field: string;
      oldValue: string;
      newValue: string;
    }[];
    note: string;
  }>;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  isActive: boolean;
}

interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  status: string;
  createdAt: string;
}

interface ProjectFormData {
  name: string;
  description: string;
  department: string;
  assignedTeamLeader: string;
  assignedEmployees: string[];
  tasks: Task[];
  startDate: string;
  endDate: string;
  priority: string;
  status: string;
  projectType: string;
  specificDepartment?: string;
}

interface EnhancedProjectFormProps {
  onSuccess?: () => void;
  onCancel: () => void;
}

const EnhancedProjectForm: React.FC<EnhancedProjectFormProps> = ({
  onSuccess = () => {},
  onCancel
}) => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignedTo: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    dueDate: ''
  });

  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: '',
    department: '',
    assignedTeamLeader: '',
    assignedEmployees: [],
    tasks: [],
    startDate: '',
    endDate: '',
    priority: 'medium',
    status: 'planned',
    projectType: 'common',
    specificDepartment: ''
  });

  const departments = ['Software Development', 'Digital Marketing','Cyber Security', 'Sales', 'Product Designing', 'Web Development', 'Graphic Designing', ' Artificial Intelligence'];

 useEffect(() => {
  if (!user) return;

  setLoading(true);
  setError(null);

  const usersRef = ref(database, 'users');

  const fetchEmployees = onValue(usersRef, (snapshot) => {
    try {
      const employeesData: Employee[] = [];
      
      snapshot.forEach((childSnapshot) => {
        const uid = childSnapshot.key;
        const userData = childSnapshot.val();

        // Skip if user is an admin
        if (userData.role === 'admin') return;

        // Get employee profile (stored in 'profile' or 'employee' node)
        const profile = userData.profile || userData.employee;
        if (!profile || !profile.name) return;

        // Only include active employees
        if (profile.status !== 'active') return;

        employeesData.push({
          id: uid || '',
          name: profile.name || '',
          email: profile.email || '',
          department: profile.department || '',
          designation: profile.designation || '',
          isActive: true,
        });
      });

      setEmployees(employeesData);
      setLoading(false);
    } catch (err) {
      console.error('Error processing employee data:', err);
      setError('Failed to process employee data');
      setLoading(false);
    }
  }, (error) => {
    console.error('Error fetching employees:', error);
    setError('Failed to load employees');
    setLoading(false);
  });

  return () => off(usersRef);
}, [user]);
  useEffect(() => {
    if (formData.projectType === 'common') {
      setFilteredEmployees(employees);
    } else if (formData.projectType === 'department' && formData.specificDepartment) {
      const deptEmployees = employees.filter(emp => 
        emp.department === formData.specificDepartment
      );
      setFilteredEmployees(deptEmployees);
    } else {
      setFilteredEmployees([]);
    }
  }, [employees, formData.projectType, formData.specificDepartment]);

  const teamLeaders = filteredEmployees.filter(emp => emp.designation === 'Team Lead');
  const developers = filteredEmployees.filter(emp => emp.designation !== 'Team Lead');

  const handleEmployeeToggle = (employeeId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedEmployees: prev.assignedEmployees.includes(employeeId)
        ? prev.assignedEmployees.filter(id => id !== employeeId)
        : [...prev.assignedEmployees, employeeId]
    }));
  };

  const addTask = () => {
    if (!newTask.title || !newTask.assignedTo || !newTask.dueDate) return;
    
    const task: Task = {
      id: Date.now().toString(),
      ...newTask,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    setFormData(prev => ({
      ...prev,
      tasks: [...prev.tasks, task]
    }));
    
    setNewTask({
      title: '',
      description: '',
      assignedTo: '',
      priority: 'medium',
      dueDate: ''
    });
  };

  const removeTask = (taskId: string) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.filter(task => task.id !== taskId)
    }));
  };

  const handleProjectTypeChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      projectType: value,
      specificDepartment: value === 'common' ? '' : prev.specificDepartment,
      assignedTeamLeader: '',
      assignedEmployees: [],
      tasks: []
    }));
  };

  const handleDepartmentChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      specificDepartment: value,
      assignedTeamLeader: '',
      assignedEmployees: [],
      tasks: []
    }));
  };

  const getTypeColor = (type: string) => {
    return type === 'common' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      // Create project ID
      const projectId = push(ref(database, `users/${user.id}/projects`)).key;
      if (!projectId) throw new Error('Failed to generate project ID');

      // Prepare base project data
      const projectData = {
        id: projectId,
        name: formData.name,
        description: formData.description,
        startDate: formData.startDate,
        endDate: formData.endDate,
        priority: formData.priority,
        status: formData.status,
        projectType: formData.projectType,
        department: formData.specificDepartment || 'common',
        assignedTeamLeader: formData.assignedTeamLeader,
        assignedEmployees: formData.assignedEmployees,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        tasks: {},
        updates: {
          [Date.now().toString()]: {
            updatedBy: user.name || 'Admin',
            updatedById: user.id,
            changes: [{
              field: 'status',
              oldValue: '',
              newValue: 'created'
            }],
            note: 'Project created'
          }
        }
      };

      // Add tasks to project data
      formData.tasks.forEach(task => {
        projectData.tasks[task.id] = {
          ...task,
          updates: {
            [Date.now().toString()]: {
              updatedBy: user.name || 'Admin',
              updatedById: user.id,
              changes: [{
                field: 'status',
                oldValue: '',
                newValue: task.status
              }],
              note: 'Task created'
            }
          }
        };
      });

     
      await set(ref(database, `projects/${projectId}`), projectData);
      // Prepare employees to assign (team leader + assigned employees)
    // In the handleSubmit function, modify the employee assignment logic:
const employeesToAssign = [
  ...(formData.assignedTeamLeader ? [formData.assignedTeamLeader] : []),
  ...formData.assignedEmployees
].filter((value, index, self) => self.indexOf(value) === index);

await Promise.all(
  employeesToAssign.map(async (employeeId) => {
    const isTeamLead = employees.find(e => e.id === employeeId)?.designation === 'Team Lead';
    const tasksToAssign = isTeamLead 
      ? formData.tasks 
      : formData.tasks.filter(task => task.assignedTo === employeeId);

    const employeeProjectData = {
      ...projectData,
      tasks: tasksToAssign.reduce((acc, task) => {
        acc[task.id] = {
          ...task,
          updates: {
            [Date.now().toString()]: {
              updatedBy: user.name || 'Admin',
              updatedById: user.id,
              changes: [{ field: 'status', oldValue: '', newValue: task.status }],
              note: 'Task created'
            }
          }
        };
        return acc;
      }, {} as Record<string, any>)
    };

    // 1. Store in admin's employee sub‑node (for admin overview)
    await set(
      ref(database, `users/${user.id}/employees/${employeeId}/projects/${projectId}`),
      employeeProjectData
    );

    // ✅ 2. Store in employee's own projects node (for employee dashboard)
    await set(
      ref(database, `users/${employeeId}/projects/${projectId}`),
      employeeProjectData
    );
  })
);

      toast({
        title: "Project Created",
        description: "Project has been successfully created and assigned",
      });

      onSuccess();
      onCancel();
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create project. Please try again.",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading employees...</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Project</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter project name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label>Project Type</Label>
              <Select 
                value={formData.projectType} 
                onValueChange={handleProjectTypeChange}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="common">Common Project</SelectItem>
                  <SelectItem value="department">Department Project</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.projectType === 'department' && (
            <div className="space-y-2">
              <Label>Department</Label>
              <Select 
                value={formData.specificDepartment || ''} 
                onValueChange={handleDepartmentChange}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter project description"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="teamLeader">Team Leader</Label>
              <Select 
                value={formData.assignedTeamLeader} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, assignedTeamLeader: value }))}
                disabled={!formData.projectType || (formData.projectType === 'department' && !formData.specificDepartment)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select team leader" />
                </SelectTrigger>
                <SelectContent>
                  {teamLeaders.length > 0 ? (
                    teamLeaders.map(leader => (
                      <SelectItem key={leader.id} value={leader.id}>
                        {leader.name} - {leader.department}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-leaders" disabled>
                      No available team leaders
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Assign Team Members</Label>
            <div className="flex items-center gap-2 mb-2">
              <Badge className={getTypeColor(formData.projectType)}>
                {formData.projectType === 'common' ? 'Common Project' : formData.specificDepartment}
              </Badge>
              <span className="text-sm text-gray-500">
                {formData.assignedEmployees.length} members selected
              </span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 border rounded">
              {developers.length > 0 ? (
                developers.map(developer => (
                  <div key={developer.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`dev-${developer.id}`}
                      checked={formData.assignedEmployees.includes(developer.id)}
                      onChange={() => handleEmployeeToggle(developer.id)}
                      className="rounded"
                    />
                    <label htmlFor={`dev-${developer.id}`} className="text-sm">
                      {developer.name} ({developer.department})
                    </label>
                  </div>
                ))
              ) : (
                <div className="col-span-3 text-center text-sm text-gray-500 py-2">
                  {formData.projectType === 'department' && !formData.specificDepartment 
                    ? 'Please select a department first'
                    : 'No employees available for the selected project type/department'}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {formData.assignedEmployees.map(empId => {
                const emp = employees.find(e => e.id === empId);
                return emp ? (
                  <Badge key={empId} variant="secondary" className="text-xs">
                    {emp.name} ({emp.department})
                  </Badge>
                ) : null;
              })}
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <Label className="text-lg font-semibold">Project Tasks</Label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <Input
                placeholder="Task title"
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
              />
              <Input
                type="date"
                value={newTask.dueDate}
                onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
              />
              <Select 
                value={newTask.assignedTo} 
                onValueChange={(value) => setNewTask(prev => ({ ...prev, assignedTo: value }))}
                disabled={formData.assignedEmployees.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Assign to team member" />
                </SelectTrigger>
                <SelectContent>
                  {formData.assignedEmployees.length > 0 ? (
                    formData.assignedEmployees.map(empId => {
                      const emp = employees.find(e => e.id === empId);
                      return emp ? (
                        <SelectItem key={empId} value={empId}>{emp.name}</SelectItem>
                      ) : null;
                    })
                  ) : (
                    <SelectItem value="no-members" disabled>
                      No team members assigned
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Select value={newTask.priority} onValueChange={(value) => setNewTask(prev => ({ ...prev, priority: value as 'low' | 'medium' | 'high' }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Task priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <div className="md:col-span-2">
                <Textarea
                  placeholder="Task description"
                  value={newTask.description}
                  onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <Button 
                type="button" 
                onClick={addTask} 
                className="flex items-center gap-2"
                disabled={!newTask.title || !newTask.assignedTo || !newTask.dueDate}
              >
                <Plus className="h-4 w-4" />
                Add Task
              </Button>
            </div>

            {formData.tasks.length > 0 && (
              <div className="space-y-2">
                <Label>Added Tasks ({formData.tasks.length})</Label>
                {formData.tasks.map(task => {
                  const assignedEmployee = employees.find(e => e.id === task.assignedTo);
                  return (
                    <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{task.title}</span>
                          <Badge className={
                            task.priority === 'high' ? 'bg-red-100 text-red-700' :
                            task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }>
                            {task.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{task.description}</p>
                        <p className="text-xs text-gray-500">
                          Assigned to: {assignedEmployee?.name} | Due: {new Date(task.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTask(task.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={
                !formData.name || 
                !formData.description || 
                !formData.projectType || 
                (formData.projectType === 'department' && !formData.specificDepartment) || 
                !formData.assignedTeamLeader || 
                !formData.startDate || 
                !formData.endDate
              }
            >
              Create Project
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default EnhancedProjectForm;