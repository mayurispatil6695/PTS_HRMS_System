import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Briefcase, Clock, TrendingUp, ChevronDown, ChevronRight,
  BarChart3, Zap, AlertCircle, CheckCircle, Search
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Input } from '../ui/input';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, get } from 'firebase/database';

// ==================== TYPES ====================
interface Employee {
  id: string;
  name: string;
  department: string;
}

interface WorkloadData {
  employeeId: string;
  employeeName: string;
  department: string;
  taskCount: number;
  loggedHours: number;
  colorIntensity: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
}

interface FirebaseTimeLog {
  durationMs?: number;
  loggedAt?: number;
  startTime?: number;
}

interface FirebaseTask {
  assignedTo?: string;
  title?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  dueDate?: string;
  timeLogs?: Record<string, FirebaseTimeLog>;
}

interface FirebaseProject {
  tasks?: Record<string, FirebaseTask>;
}

interface FirebaseUserData {
  role?: string;
  profile?: {
    name?: string;
    department?: string;
    role?: string;
  };
  employee?: {
    name?: string;
    department?: string;
    role?: string;
  };
  employees?: Record<string, { dailyTasks?: Record<string, FirebaseTask> }>;
}

// ==================== HELPER COMPONENTS ====================
const SkeletonCard = () => (
  <div className="relative overflow-hidden rounded-xl bg-card border border-border animate-pulse">
    <div className="p-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-muted" />
        <div className="flex-1">
          <div className="h-4 bg-muted rounded w-24 mb-2" />
          <div className="h-3 bg-muted rounded w-32" />
        </div>
      </div>
      <div className="mt-4 h-8 bg-muted rounded w-20" />
      <div className="mt-3 h-2 bg-muted rounded-full" />
    </div>
  </div>
);

const RadialProgress = ({ value, size = 56, strokeWidth = 6 }: { value: number; size?: number; strokeWidth?: number }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value > 70 ? '#ef4444' : value > 40 ? '#f59e0b' : '#10b981';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />
      <text
        x="50%" y="50%" textAnchor="middle" dy="0.35em" fill="currentColor"
        fontSize={size * 0.22} fontWeight="bold" className="text-gray-800 dark:text-white"
        transform={`rotate(90, ${size / 2}, ${size / 2})`}
      >
        {value}%
      </text>
    </svg>
  );
};

const QuickDatePreset = ({ onSelect, active }: { onSelect: (days: number) => void; active: number }) => {
  const presets = [
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'This month', days: 0 },
  ];
  return (
    <div className="flex gap-2">
      {presets.map(preset => (
        <Button
          key={preset.label}
          variant={active === preset.days ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelect(preset.days)}
          className="rounded-full px-4 text-sm"
        >
          {preset.label}
        </Button>
      ))}
    </div>
  );
};

// ==================== MAIN COMPONENT ====================
const WorkloadHeatmap = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [mode, setMode] = useState<'taskCount' | 'loggedHours'>('taskCount');
  const [datePreset, setDatePreset] = useState(7);
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch employees from Firebase
  useEffect(() => {
    const fetchEmployees = async () => {
      const usersSnap = await get(ref(database, 'users'));
      const empList: Employee[] = [];
      usersSnap.forEach((userSnap) => {
        const userData = userSnap.val() as FirebaseUserData;
        if (userData.role === 'admin') return;
        const profile = userData.profile || userData.employee;
        if (profile?.name) {
          empList.push({
            id: userSnap.key || '',
            name: profile.name,
            department: profile.department || 'General',
          });
        }
      });
      setEmployees(empList);
    };
    fetchEmployees();
  }, []);

  // Compute workload from Firebase tasks
  const workloadData = useMemo<WorkloadData[]>(() => {
    if (!employees.length) return [];

    const startTimestamp = datePreset === 0
      ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
      : Date.now() - datePreset * 24 * 60 * 60 * 1000;
    const endTimestamp = Date.now();

    const map = new Map<string, WorkloadData>();
    employees.forEach(emp => {
      map.set(emp.id, {
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department,
        taskCount: 0,
        loggedHours: 0,
        colorIntensity: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        overdueTasks: 0,
      });
    });

    const fetchAllTasks = async () => {
      // 1. Fetch project tasks (global projects node)
      const projectsSnap = await get(ref(database, 'projects'));
      const projects = projectsSnap.val() as Record<string, FirebaseProject> | null;
      if (projects) {
        for (const proj of Object.values(projects)) {
          const tasks = proj.tasks;
          if (!tasks) continue;
          for (const task of Object.values(tasks)) {
            const assignedTo = task.assignedTo;
            if (!assignedTo) continue;
            const empData = map.get(assignedTo);
            if (!empData) continue;

            const createdAt = task.createdAt ? new Date(task.createdAt).getTime() : 0;
            const completedAt = task.status === 'completed' && task.updatedAt ? new Date(task.updatedAt).getTime() : null;
            if (createdAt <= endTimestamp && (completedAt === null || completedAt >= startTimestamp)) {
              empData.taskCount += 1;
              if (task.status === 'completed') empData.completedTasks += 1;
              if (task.status === 'in_progress') empData.inProgressTasks += 1;
              if (task.dueDate && new Date(task.dueDate).getTime() < Date.now() && task.status !== 'completed') {
                empData.overdueTasks += 1;
              }
            }
            if (task.timeLogs) {
              for (const log of Object.values(task.timeLogs)) {
                const loggedAt = log.loggedAt || log.startTime;
                if (loggedAt && loggedAt >= startTimestamp && loggedAt <= endTimestamp) {
                  empData.loggedHours += (log.durationMs || 0) / (1000 * 60 * 60);
                }
              }
            }
          }
        }
      }

      // 2. Fetch standalone tasks (dailyTasks)
      const usersSnap = await get(ref(database, 'users'));
      const usersData = usersSnap.val() as Record<string, FirebaseUserData> | null;
      if (usersData) {
        for (const adminData of Object.values(usersData)) {
          if (adminData.employees) {
            for (const [empId, empTasks] of Object.entries(adminData.employees)) {
              const dailyTasks = empTasks.dailyTasks;
              if (!dailyTasks) continue;
              const empData = map.get(empId);
              if (!empData) continue;
              for (const task of Object.values(dailyTasks)) {
                const createdAt = task.createdAt ? new Date(task.createdAt).getTime() : 0;
                const completedAt = task.status === 'completed' && task.updatedAt ? new Date(task.updatedAt).getTime() : null;
                if (createdAt <= endTimestamp && (completedAt === null || completedAt >= startTimestamp)) {
                  empData.taskCount += 1;
                  if (task.status === 'completed') empData.completedTasks += 1;
                  if (task.status === 'in_progress') empData.inProgressTasks += 1;
                  if (task.dueDate && new Date(task.dueDate).getTime() < Date.now() && task.status !== 'completed') {
                    empData.overdueTasks += 1;
                  }
                }
                if (task.timeLogs) {
                  for (const log of Object.values(task.timeLogs)) {
                    const loggedAt = log.loggedAt || log.startTime;
                    if (loggedAt && loggedAt >= startTimestamp && loggedAt <= endTimestamp) {
                      empData.loggedHours += (log.durationMs || 0) / (1000 * 60 * 60);
                    }
                  }
                }
              }
            }
          }
        }
      }
    };

    const compute = async () => {
      await fetchAllTasks();
      let maxValue = 0;
      map.forEach(d => {
        const v = mode === 'taskCount' ? d.taskCount : d.loggedHours;
        if (v > maxValue) maxValue = v;
      });
      map.forEach(d => {
        const v = mode === 'taskCount' ? d.taskCount : d.loggedHours;
        d.colorIntensity = maxValue === 0 ? 0 : Math.min(100, Math.round((v / maxValue) * 100));
      });
      setLoading(false);
    };

    compute();
    return Array.from(map.values());
  }, [employees, mode, datePreset]);

  const toggleDepartment = (dept: string) => {
    setExpandedDepts(prev => ({ ...prev, [dept]: !prev[dept] }));
  };

  const getLoadLabel = (intensity: number) => {
    if (intensity === 0) return { label: 'Idle', icon: CheckCircle, variant: 'text-gray-500' };
    if (intensity < 30) return { label: 'Light', icon: Zap, variant: 'text-green-500' };
    if (intensity < 60) return { label: 'Moderate', icon: BarChart3, variant: 'text-yellow-500' };
    if (intensity < 80) return { label: 'Heavy', icon: AlertCircle, variant: 'text-orange-500' };
    return { label: 'Critical', icon: AlertCircle, variant: 'text-red-500' };
  };

  const isManager = user?.role === 'team_manager';
  const filteredByDept = (items: WorkloadData[]) => {
    if (isManager) return items.filter(item => item.department === user?.department);
    if (!searchTerm) return items;
    return items.filter(item => item.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) || item.department.toLowerCase().includes(searchTerm.toLowerCase()));
  };

  const groupedByDept = workloadData.reduce((acc, curr) => {
    const filtered = filteredByDept([curr]);
    if (filtered.length === 0) return acc;
    if (!acc[curr.department]) acc[curr.department] = [];
    acc[curr.department].push(curr);
    return acc;
  }, {} as Record<string, WorkloadData[]>);

  const totalTasks = workloadData.reduce((s, d) => s + d.taskCount, 0);
  const totalHours = workloadData.reduce((s, d) => s + d.loggedHours, 0);
  const avgLoad = workloadData.length
    ? (mode === 'taskCount' ? totalTasks / workloadData.length : totalHours / workloadData.length)
    : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><div className="h-8 w-48 bg-gray-200 rounded animate-pulse" /><div className="h-4 w-64 bg-gray-200 rounded mt-2 animate-pulse" /></div>
          <div className="h-6 w-24 bg-gray-200 rounded-full animate-pulse" />
        </div>
        <Card><CardContent className="p-5"><div className="h-32 w-full bg-gray-200 rounded animate-pulse" /></div></Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Workload Intelligence</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time team capacity & task distribution</p>
        </div>
        <Badge variant="outline" className="gap-1.5 px-3 py-1">
          <Zap className="w-3 h-3 text-yellow-500" />
          <span className="text-xs">Autopilot Active</span>
        </Badge>
      </div>

      {/* Filters & Stats */}
      <Card className="border-gray-200">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <QuickDatePreset onSelect={setDatePreset} active={datePreset} />
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search employee..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-48 h-9 text-sm rounded-full"
                />
              </div>
              <Select value={mode} onValueChange={(v: 'taskCount' | 'loggedHours') => setMode(v)}>
                <SelectTrigger className="w-40 rounded-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="taskCount">Task Count</SelectItem>
                  <SelectItem value="loggedHours">Logged Hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Users, label: 'Employees', value: String(workloadData.length), color: 'text-blue-600' },
              { icon: Briefcase, label: 'Total Tasks', value: String(totalTasks), color: 'text-green-600' },
              { icon: Clock, label: 'Logged Hours', value: totalHours.toFixed(1), color: 'text-yellow-600' },
              { icon: TrendingUp, label: 'Avg Load', value: `${avgLoad.toFixed(1)} ${mode === 'taskCount' ? 'tasks' : 'hrs'}`, color: 'text-orange-600' },
            ].map(stat => (
              <div key={stat.label} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
                <div>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className="text-lg font-bold text-gray-800 leading-6">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Department Sections */}
      {Object.entries(groupedByDept).map(([dept, members]) => {
        const isExpanded = expandedDepts[dept] ?? false;
        const deptTotalTasks = members.reduce((s, m) => s + m.taskCount, 0);
        const deptAvgIntensity = members.reduce((s, m) => s + m.colorIntensity, 0) / (members.length || 1);

        return (
          <Card key={dept} className="border-gray-200 overflow-hidden">
            <button
              onClick={() => toggleDepartment(dept)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                <h3 className="text-sm font-semibold text-gray-800">{dept}</h3>
                <Badge variant="secondary" className="text-xs">{members.length} members</Badge>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-500">{deptTotalTasks} tasks</span>
                <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-600 rounded-full transition-all duration-500" style={{ width: `${deptAvgIntensity}%` }} />
                </div>
              </div>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  {members.map(item => {
                    const value = mode === 'taskCount' ? item.taskCount : Number(item.loggedHours.toFixed(1));
                    const load = getLoadLabel(item.colorIntensity);
                    const LoadIcon = load.icon;
                    return (
                      <motion.div
                        key={item.employeeId}
                        initial={{ scale: 0.97, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        whileHover={{ y: -2 }}
                        className="group rounded-xl border border-gray-200 bg-white hover:shadow-md transition-all duration-200"
                      >
                        <div className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 border border-gray-200">
                                <AvatarFallback className="bg-gray-100 text-gray-700 font-semibold text-sm">
                                  {item.employeeName.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <h4 className="text-sm font-semibold text-gray-800">{item.employeeName}</h4>
                                <p className="text-xs text-gray-500">{item.department}</p>
                              </div>
                            </div>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 cursor-help">
                                  <LoadIcon className={`h-3.5 w-3.5 ${load.variant}`} />
                                  <span className={`text-xs font-medium ${load.variant}`}>{load.label}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                <p className="text-xs">Load intensity: {item.colorIntensity}%</p>
                                {item.overdueTasks > 0 && <p className="text-xs text-red-500">{item.overdueTasks} overdue tasks</p>}
                              </TooltipContent>
                            </Tooltip>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <div>
                              <span className="text-xl font-bold text-gray-800">{value}</span>
                              <span className="text-xs text-gray-500 ml-1">{mode === 'taskCount' ? 'tasks' : 'hrs'}</span>
                            </div>
                            <RadialProgress value={item.colorIntensity} size={44} strokeWidth={4} />
                          </div>

                          <div className="mt-2 flex justify-between text-xs text-gray-500 border-t border-gray-100 pt-2">
                            <span>Done: {item.completedTasks}</span>
                            <span>Active: {item.inProgressTasks}</span>
                            {item.overdueTasks > 0 && <span className="text-red-500 font-medium">Overdue: {item.overdueTasks}</span>}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        );
      })}

      {Object.keys(groupedByDept).length === 0 && (
        <Card className="border-gray-200">
          <CardContent className="py-12 text-center text-gray-500">
            No workload data found for the selected period.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WorkloadHeatmap;