import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Badge } from '../../ui/badge';
import { X, Plus } from 'lucide-react';
import { ref, onValue, off, set, push } from 'firebase/database';
import { database } from '../../../firebase';
import { useAuth } from '../../../hooks/useAuth';
import { toast } from '../../ui/use-toast';

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
  employeeName?: string;
}

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  assignedTo?: string;
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  uploadedBy: string;
  date: string;
}

interface ExtendedTask extends Task {
  subtasks?: Subtask[];
  timeSpent?: number;
  timerActive?: boolean;
  timerStart?: number | null;
  attachments?: Attachment[];
  tags?: string[];
  mentions?: string[];
  employeeName?: string;
}

interface ProjectUpdate {
  updatedBy: string;
  updatedById: string;
  changes: { field: string; oldValue: string; newValue: string }[];
  note: string;
}

interface FirebaseProjectData {
  id: string;
  name: string;
  clientName: string;
  description: string;
  startDate: string;
  endDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'active' | 'completed' | 'on_hold';
  projectType: 'common' | 'department';
  department: string;
  assignedTeamLeader: string;
  assignedEmployees: string[];
  createdAt: string;
  createdBy: string;
  tasks: Record<string, ExtendedTask>;
  updates: Record<string, ProjectUpdate>;
}

interface ProjectFormData {
  name: string;
  clientName: string;
  description: string;
  department: string;
  assignedTeamLeader: string;
  assignedEmployees: string[];
  tasks: Task[];
  startDate: string;
  endDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'active' | 'completed' | 'on_hold';
  projectType: 'common' | 'department';
  specificDepartment?: string;
}

interface EnhancedProjectFormProps {
  onSuccess?: () => void;
  onCancel: () => void;
}

const EnhancedProjectForm: React.FC<EnhancedProjectFormProps> = ({ onSuccess, onCancel }) => {
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
    clientName: '',
    description: '',
    department: '',
    assignedTeamLeader: '',
    assignedEmployees: [],
    tasks: [],
    startDate: '',
    endDate: '',
    priority: 'medium',
    status: 'active',
    projectType: 'common',
    specificDepartment: ''
  });

  const departments = ['Software Development', 'Digital Marketing','Cyber Security', 'Sales', 'Product Designing', 'Web Development', 'Graphic Designing', 'Artificial Intelligence'];

  // Fetch all employees (non-admin) from global users
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const usersRef = ref(database, 'users');
    const fetchEmployees = onValue(usersRef, (snapshot) => {
      try {
        const employeesData: Employee[] = [];
        snapshot.forEach((childSnapshot) => {
          const uid = childSnapshot.key;
          const userData = childSnapshot.val();
          if (userData.role === 'admin') return;
          const profile = userData.profile || userData.employee;
          if (!profile || !profile.name) return;
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
        console.error(err);
        setError('Failed to load employees');
        setLoading(false);
      }
    });
    return () => off(usersRef);
  }, [user]);

  useEffect(() => {
    if (formData.projectType === 'common') {
      setFilteredEmployees(employees);
    } else if (formData.projectType === 'department' && formData.specificDepartment) {
      setFilteredEmployees(employees.filter(emp => emp.department === formData.specificDepartment));
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
      status: 'todo',
      createdAt: new Date().toISOString()
    };
    setFormData(prev => ({ ...prev, tasks: [...prev.tasks, task] }));
    setNewTask({ title: '', description: '', assignedTo: '', priority: 'medium', dueDate: '' });
  };

  const removeTask = (taskId: string) => {
    setFormData(prev => ({ ...prev, tasks: prev.tasks.filter(task => task.id !== taskId) }));
  };

  const handleProjectTypeChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      projectType: value as 'common' | 'department',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const projectId = push(ref(database, 'projects')).key;
      if (!projectId) throw new Error('Failed to generate project ID');

      const projectData: FirebaseProjectData = {
        id: projectId,
        name: formData.name,
        clientName: formData.clientName,
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
            changes: [{ field: 'status', oldValue: '', newValue: 'created' }],
            note: 'Project created'
          }
        }
      };

      // Add tasks with extra fields
      formData.tasks.forEach(task => {
        const assignedEmployee = employees.find(e => e.id === task.assignedTo);
        projectData.tasks[task.id] = {
          ...task,
          employeeName: assignedEmployee?.name || '',
          subtasks: [],
          timeSpent: 0,
          timerActive: false,
          timerStart: null,
          attachments: [],
          tags: [],
          mentions: []
        };
      });

      await set(ref(database, `projects/${projectId}`), projectData);

      // Assign to employees (for their personal dashboards)
      const employeesToAssign = [...(formData.assignedTeamLeader ? [formData.assignedTeamLeader] : []), ...formData.assignedEmployees];
      await Promise.all(employeesToAssign.map(async (empId) => {
        const empProjectData = {
          ...projectData,
          tasks: Object.fromEntries(
            Object.entries(projectData.tasks).filter(([, task]) => task.assignedTo === empId)
          )
        };
        await set(ref(database, `users/${empId}/projects/${projectId}`), empProjectData);
      }));

      toast({ title: "Project Created", description: "Project created successfully" });
      onSuccess?.();
      onCancel();
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to create project" });
    }
  };

  if (loading) return <div>Loading employees...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <Card>
      <CardHeader><CardTitle>Create New Project</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Project Name</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required /></div>
            <div><Label>Client Name</Label><Input value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Project Type</Label>
              <Select value={formData.projectType} onValueChange={handleProjectTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="common">Common</SelectItem><SelectItem value="department">Department</SelectItem></SelectContent>
              </Select>
            </div>
            {formData.projectType === 'department' && (
              <div><Label>Department</Label>
                <Select value={formData.specificDepartment} onValueChange={handleDepartmentChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div><Label>Description</Label><Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Team Leader</Label>
              <Select value={formData.assignedTeamLeader} onValueChange={val => setFormData({...formData, assignedTeamLeader: val})}>
                <SelectTrigger><SelectValue placeholder="Select team leader" /></SelectTrigger>
                <SelectContent>{teamLeaders.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Priority</Label>
              <Select value={formData.priority} onValueChange={val => setFormData({...formData, priority: val as 'low' | 'medium' | 'high' | 'urgent'})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Start Date</Label><Input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} required /></div>
            <div><Label>End Date</Label><Input type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} required /></div>
          </div>
          <div><Label>Team Members</Label>
            <div className="border rounded p-2 max-h-40 overflow-auto">
              {developers.map(dev => (
                <div key={dev.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={formData.assignedEmployees.includes(dev.id)} onChange={() => handleEmployeeToggle(dev.id)} />
                  <span>{dev.name} ({dev.department})</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t pt-4"><Label className="text-lg">Tasks</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2 bg-gray-50 rounded">
              <Input placeholder="Task title" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} />
              <Input type="date" value={newTask.dueDate} onChange={e => setNewTask({...newTask, dueDate: e.target.value})} />
              <Select value={newTask.assignedTo} onValueChange={val => setNewTask({...newTask, assignedTo: val})}>
                <SelectTrigger><SelectValue placeholder="Assign to" /></SelectTrigger>
                <SelectContent>{formData.assignedEmployees.map(eid => { const emp = employees.find(e => e.id === eid); return emp ? <SelectItem key={eid} value={eid}>{emp.name}</SelectItem> : null; })}</SelectContent>
              </Select>
              <Select value={newTask.priority} onValueChange={val => setNewTask({...newTask, priority: val as 'low' | 'medium' | 'high'})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
              </Select>
              <div className="md:col-span-2"><Textarea placeholder="Task description" value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} /></div>
              <Button type="button" onClick={addTask} disabled={!newTask.title || !newTask.assignedTo || !newTask.dueDate}><Plus className="h-4 w-4" /> Add Task</Button>
            </div>
            {formData.tasks.map(task => {
              const emp = employees.find(e => e.id === task.assignedTo);
              return (
                <div key={task.id} className="flex justify-between items-center border p-2 mt-2 rounded">
                  <div><span className="font-medium">{task.title}</span> – {emp?.name}<br /><span className="text-xs">Due: {task.dueDate}</span></div>
                  <Button variant="ghost" size="sm" onClick={() => removeTask(task.id)}><X className="h-4 w-4" /></Button>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit">Create Project</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default EnhancedProjectForm;