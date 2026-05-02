import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { update, ref, onValue, off, push, set, remove } from 'firebase/database';
import { database } from '../../../firebase';
import { Calendar, Clock, User, Search, Filter, Save, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../hooks/useAuth';

// ✅ Central types
import type { Employee } from '@/types/employee';
import type { Task as CentralTask } from '@/types/project';

// ✅ Extended view‑specific task (adds fields not in central Task)
interface ListViewTask extends CentralTask {
  assignedToId: string;
  projectName: string;
  projectId: string;
  assignedTo: string;       // employee name for display
  dependsOn?: string[];
}

// Firebase raw task shape (matches what we get from projects.tasks)
interface FirebaseTaskData {
  id: string;
  title: string;
  assignedTo?: string;
  status: string;
  priority: string;
  dueDate?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  dependsOn?: string[];
}

interface ListViewProject {
  id: string;
  name: string;
  tasks?: Record<string, FirebaseTaskData>;
}

interface ListViewProps {
  projects: ListViewProject[];
  employees: Employee[];
  readOnly?: boolean;
  onTaskUpdate?: () => void;
}

// Saved filter type
interface SavedFilter {
  id: string;
  name: string;
  filters: {
    searchQuery: string;
    filterStatus: string;
    filterPriority: string;
    filterDueDate: string;
    showMyTasksOnly: boolean;
  };
}

// Type for Firebase update values (no `any`)
type FirebaseUpdateValue = string | number | boolean | null | Record<string, unknown>;

// Helper: format duration (unused here, but kept for consistency)
const formatDuration = (ms: number): string => {
  if (!ms) return '0m';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

// Helper: get priority badge color
const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-700';
    case 'high': return 'bg-orange-100 text-orange-700';
    case 'medium': return 'bg-yellow-100 text-yellow-700';
    case 'low': return 'bg-green-100 text-green-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const ListView: React.FC<ListViewProps> = ({ projects, employees, readOnly = false, onTaskUpdate }) => {
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id;

  const [allTasks, setAllTasks] = useState<ListViewTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<ListViewTask | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPriority, setEditPriority] = useState<ListViewTask['priority']>('medium');
  const [editStatus, setEditStatus] = useState<ListViewTask['status']>('pending');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [editDependsOn, setEditDependsOn] = useState<string[]>([]);
  const [projectTasks, setProjectTasks] = useState<ListViewTask[]>([]);

  // Bulk selection
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterDueDate, setFilterDueDate] = useState('all'); // 'all', 'overdue', 'today', 'week'
  const [showMyTasksOnly, setShowMyTasksOnly] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState('');

  // Format dates
  const formatDate = useCallback((dateString?: string) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return format(date, 'MMM dd, yyyy');
  }, []);

  const formatDateTime = useCallback((dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return format(date, 'MMM dd, yyyy hh:mm a');
  }, []);

  // Build tasks list from projects
  useEffect(() => {
    const tasksList: ListViewTask[] = [];
    projects.forEach(project => {
      if (project.tasks) {
        Object.values(project.tasks).forEach((task) => {
          const assignedEmployee = employees.find(emp => emp.id === task.assignedTo);
          const assignedToName = assignedEmployee?.name || task.assignedTo || 'Unassigned';
          tasksList.push({
            id: task.id,
            title: task.title,
            assignedTo: assignedToName,
            assignedToId: task.assignedTo || '',
            status: task.status as ListViewTask['status'],
            priority: task.priority as ListViewTask['priority'],
            dueDate: task.dueDate || '',
            projectName: project.name,
            projectId: project.id,
            description: task.description,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
            dependsOn: task.dependsOn || [],
          });
        });
      }
    });
    setAllTasks(tasksList);
  }, [projects, employees]);

  // Load saved filters from Firebase
  useEffect(() => {
    if (!currentUserId) return;
    const filtersRef = ref(database, `users/${currentUserId}/savedFilters`);
    const unsubscribe = onValue(filtersRef, (snapshot) => {
      const data = snapshot.val() as Record<string, Omit<SavedFilter, 'id'>> | null;
      if (data) {
        const filtersList: SavedFilter[] = Object.entries(data).map(([id, filter]) => ({
          id,
          name: filter.name,
          filters: filter.filters,
        }));
        setSavedFilters(filtersList);
      } else {
        setSavedFilters([]);
      }
    });
    return () => off(filtersRef);
  }, [currentUserId]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let result = allTasks;

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(task =>
        task.title.toLowerCase().includes(lowerQuery) ||
        (task.description && task.description.toLowerCase().includes(lowerQuery)) ||
        task.assignedTo.toLowerCase().includes(lowerQuery)
      );
    }

    if (filterStatus !== 'all') {
      result = result.filter(task => task.status === filterStatus);
    }

    if (filterPriority !== 'all') {
      result = result.filter(task => task.priority === filterPriority);
    }

    const today = new Date().toISOString().slice(0, 10);
    const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (filterDueDate === 'overdue') {
      result = result.filter(task => task.dueDate && task.dueDate < today && task.status !== 'completed');
    } else if (filterDueDate === 'today') {
      result = result.filter(task => task.dueDate === today);
    } else if (filterDueDate === 'week') {
      result = result.filter(task => task.dueDate && task.dueDate >= today && task.dueDate <= weekLater);
    }

    if (showMyTasksOnly && currentUserId) {
      result = result.filter(task => task.assignedToId === currentUserId);
    }

    return result;
  }, [allTasks, searchQuery, filterStatus, filterPriority, filterDueDate, showMyTasksOnly, currentUserId]);

  // Save current filter
  const saveCurrentFilter = useCallback(async () => {
    if (!saveFilterName.trim() || !currentUserId) return;
    const filterConfig = {
      name: saveFilterName,
      filters: {
        searchQuery,
        filterStatus,
        filterPriority,
        filterDueDate,
        showMyTasksOnly,
      },
      createdAt: Date.now(),
    };
    const newFilterRef = push(ref(database, `users/${currentUserId}/savedFilters`));
    await set(newFilterRef, filterConfig);
    toast.success(`Filter "${saveFilterName}" saved`);
    setShowSaveDialog(false);
    setSaveFilterName('');
  }, [saveFilterName, currentUserId, searchQuery, filterStatus, filterPriority, filterDueDate, showMyTasksOnly]);

  const applySavedFilter = useCallback((filter: SavedFilter) => {
    setSearchQuery(filter.filters.searchQuery || '');
    setFilterStatus(filter.filters.filterStatus || 'all');
    setFilterPriority(filter.filters.filterPriority || 'all');
    setFilterDueDate(filter.filters.filterDueDate || 'all');
    setShowMyTasksOnly(filter.filters.showMyTasksOnly || false);
    toast.success(`Applied filter: ${filter.name}`);
  }, []);

  const deleteSavedFilter = useCallback(async (filterId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserId) return;
    await remove(ref(database, `users/${currentUserId}/savedFilters/${filterId}`));
    toast.success('Filter deleted');
  }, [currentUserId]);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setFilterStatus('all');
    setFilterPriority('all');
    setFilterDueDate('all');
    setShowMyTasksOnly(false);
  }, []);

  const openEditModal = useCallback((task: ListViewTask) => {
    setSelectedTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditDueDate(task.dueDate?.split('T')[0] || '');
    setEditPriority(task.priority);
    setEditStatus(task.status);
    setEditAssignedTo(task.assignedToId || '');
    setEditDependsOn(task.dependsOn || []);

    const sameProjectTasks = allTasks.filter(t => t.projectId === task.projectId && t.id !== task.id);
    setProjectTasks(sameProjectTasks);

    setEditMode(true);
    setModalOpen(true);
  }, [allTasks]);

  const saveTaskChanges = useCallback(async () => {
    if (!selectedTask) return;
    try {
      const taskRef = ref(database, `projects/${selectedTask.projectId}/tasks/${selectedTask.id}`);
      await update(taskRef, {
        title: editTitle,
        description: editDescription,
        dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
        priority: editPriority,
        status: editStatus,
        assignedTo: editAssignedTo || null,
        dependsOn: editDependsOn,
        updatedAt: new Date().toISOString(),
      });
      // Update local state
      setAllTasks(prev =>
        prev.map(t =>
          t.id === selectedTask.id
            ? {
                ...t,
                title: editTitle,
                description: editDescription,
                dueDate: editDueDate,
                priority: editPriority,
                status: editStatus,
                assignedTo: employees.find(e => e.id === editAssignedTo)?.name || 'Unassigned',
                assignedToId: editAssignedTo,
                dependsOn: editDependsOn,
              }
            : t
        )
      );
      toast.success('Task updated');
      setEditMode(false);
      setModalOpen(false);
      onTaskUpdate?.();
    } catch (error) {
      console.error(error);
      toast.error('Failed to update task');
    }
  }, [selectedTask, editTitle, editDescription, editDueDate, editPriority, editStatus, editAssignedTo, editDependsOn, employees, onTaskUpdate]);

  // Bulk operations – no `any`, using specific record type
  const handleBulkStatusChange = useCallback(async (newStatus: string) => {
    setBulkActionLoading(true);
    try {
      const updates: Record<string, FirebaseUpdateValue> = {};
      for (const taskId of selectedTaskIds) {
        const task = allTasks.find(t => t.id === taskId);
        if (task) {
          updates[`projects/${task.projectId}/tasks/${taskId}/status`] = newStatus;
          updates[`projects/${task.projectId}/tasks/${taskId}/updatedAt`] = new Date().toISOString();
        }
      }
      await update(ref(database), updates);
      toast.success(`Status updated for ${selectedTaskIds.size} tasks`);
      setSelectedTaskIds(new Set());
      onTaskUpdate?.();
    } catch (err) {
      console.error(err);
      toast.error('Bulk update failed');
    } finally {
      setBulkActionLoading(false);
    }
  }, [selectedTaskIds, allTasks, onTaskUpdate]);

  const handleBulkAssign = useCallback(async (employeeId: string) => {
    setBulkActionLoading(true);
    try {
      const updates: Record<string, FirebaseUpdateValue> = {};
      for (const taskId of selectedTaskIds) {
        const task = allTasks.find(t => t.id === taskId);
        if (task) {
          updates[`projects/${task.projectId}/tasks/${taskId}/assignedTo`] = employeeId === 'unassigned' ? null : employeeId;
          updates[`projects/${task.projectId}/tasks/${taskId}/updatedAt`] = new Date().toISOString();
        }
      }
      await update(ref(database), updates);
      toast.success(`Assigned ${selectedTaskIds.size} tasks`);
      setSelectedTaskIds(new Set());
      onTaskUpdate?.();
    } catch (err) {
      console.error(err);
      toast.error('Bulk assign failed');
    } finally {
      setBulkActionLoading(false);
    }
  }, [selectedTaskIds, allTasks, onTaskUpdate]);

  const handleBulkDelete = useCallback(async () => {
    if (!confirm(`Delete ${selectedTaskIds.size} tasks? This action cannot be undone.`)) return;
    setBulkActionLoading(true);
    try {
      const updates: Record<string, null> = {};
      for (const taskId of selectedTaskIds) {
        const task = allTasks.find(t => t.id === taskId);
        if (task) {
          updates[`projects/${task.projectId}/tasks/${taskId}`] = null;
        }
      }
      await update(ref(database), updates);
      toast.success(`Deleted ${selectedTaskIds.size} tasks`);
      setSelectedTaskIds(new Set());
      onTaskUpdate?.();
    } catch (err) {
      console.error(err);
      toast.error('Bulk delete failed');
    } finally {
      setBulkActionLoading(false);
    }
  }, [selectedTaskIds, allTasks, onTaskUpdate]);

  // Handlers for select changes (convert string to correct union)
  const handlePriorityChange = useCallback((value: string) => {
    setEditPriority(value as ListViewTask['priority']);
  }, []);

  const handleStatusChange = useCallback((value: string) => {
    setEditStatus(value as ListViewTask['status']);
  }, []);

  const handleAssignedToChange = useCallback((value: string) => {
    setEditAssignedTo(value);
  }, []);

  return (
    <>
      {/* Search & Filter Bar */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by title, description, or assignee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setFilterPanelOpen(!filterPanelOpen)}>
            <Filter className="h-4 w-4 mr-1" /> Filters
          </Button>
          <div className="relative">
            <Select onValueChange={(value) => {
              const selected = savedFilters.find(f => f.id === value);
              if (selected) applySavedFilter(selected);
            }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Saved filters" />
              </SelectTrigger>
              <SelectContent>
                {savedFilters.map(filter => (
                  <div key={filter.id} className="flex items-center justify-between px-2 py-1">
                    <span className="text-sm">{filter.name}</span>
                    <button
                      onClick={(e) => deleteSavedFilter(filter.id, e)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {savedFilters.length === 0 && <div className="px-2 py-1 text-sm text-gray-400">No saved filters</div>}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(true)} disabled={!searchQuery && filterStatus === 'all' && filterPriority === 'all' && filterDueDate === 'all' && !showMyTasksOnly}>
            <Save className="h-4 w-4 mr-1" /> Save current
          </Button>
          <Button variant="ghost" size="sm" onClick={resetFilters}>Reset</Button>
        </div>

        {filterPanelOpen && (
          <div className="bg-gray-50 p-3 rounded-lg border flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-xs font-medium block mb-1">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Priority</label>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Due Date</label>
              <Select value={filterDueDate} onValueChange={setFilterDueDate}>
                <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Next 7 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="myTasks"
                checked={showMyTasksOnly}
                onChange={(e) => setShowMyTasksOnly(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="myTasks" className="text-sm">My tasks only</label>
            </div>
          </div>
        )}
      </div>

      {/* Save Filter Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save current filter</DialogTitle>
            <DialogDescription>Give this filter a name to reuse later.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="e.g., My overdue high priority tasks"
              value={saveFilterName}
              onChange={(e) => setSaveFilterName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
              <Button onClick={saveCurrentFilter}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk operations toolbar */}
      {selectedTaskIds.size > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">{selectedTaskIds.size} task(s) selected</span>
          <div className="flex flex-wrap gap-2">
            <Select onValueChange={handleBulkStatusChange} disabled={bulkActionLoading}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Change status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select onValueChange={handleBulkAssign} disabled={bulkActionLoading}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Assign to" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="destructive"
              size="sm"
              disabled={bulkActionLoading}
              onClick={handleBulkDelete}
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Tasks Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <input
                  type="checkbox"
                  checked={filteredTasks.length > 0 && selectedTaskIds.size === filteredTasks.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)));
                    } else {
                      setSelectedTaskIds(new Set());
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Depends On</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-500">No tasks match your filters</TableCell>
              </TableRow>
            ) : (
              filteredTasks.map(task => (
                <TableRow key={task.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openEditModal(task)}>
                  <TableCell className="w-8" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.has(task.id)}
                      onChange={(e) => {
                        const newSet = new Set(selectedTaskIds);
                        if (e.target.checked) {
                          newSet.add(task.id);
                        } else {
                          newSet.delete(task.id);
                        }
                        setSelectedTaskIds(newSet);
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </TableCell>
                  <TableCell className="font-medium">{task.title}</TableCell>
                  <TableCell>{task.projectName}</TableCell>
                  <TableCell>{task.assignedTo}</TableCell>
                  <TableCell><Badge>{task.status}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={getPriorityColor(task.priority)}>{task.priority}</Badge></TableCell>
                  <TableCell>{formatDate(task.dueDate)}</TableCell>
                  <TableCell>
                    {task.dependsOn && task.dependsOn.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {task.dependsOn.map(depId => {
                          const depTask = allTasks.find(t => t.id === depId);
                          return (
                            <Badge key={depId} variant="outline" className="text-xs bg-yellow-50">
                              {depTask?.title || depId}
                            </Badge>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Task Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) setEditMode(false); setModalOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editMode ? 'Edit Task' : selectedTask?.title}</DialogTitle>
            <DialogDescription className="sr-only">
              Task details and dependencies
            </DialogDescription>
          </DialogHeader>
          {selectedTask && (
            editMode ? (
              <div className="space-y-4">
                <div><Label>Title</Label><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></div>
                <div><Label>Description</Label><Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Due Date</Label><Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} /></div>
                  <div><Label>Priority</Label>
                    <Select value={editPriority} onValueChange={handlePriorityChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Status</Label>
                    <Select value={editStatus} onValueChange={handleStatusChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="review">Review</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Assigned To</Label>
                    <Select value={editAssignedTo || "unassigned"} onValueChange={handleAssignedToChange}>
                      <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {employees.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Dependencies Multi-Select */}
                <div className="space-y-2">
                  <Label>Depends on (tasks that must be completed first)</Label>
                  <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                    {projectTasks.length === 0 ? (
                      <p className="text-sm text-gray-400">No other tasks in this project</p>
                    ) : (
                      projectTasks.map(t => (
                        <label key={t.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editDependsOn.includes(t.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditDependsOn([...editDependsOn, t.id]);
                              } else {
                                setEditDependsOn(editDependsOn.filter(id => id !== t.id));
                              }
                            }}
                          />
                          {t.title} ({t.status})
                        </label>
                      ))
                    )}
                  </div>
                  {editDependsOn.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {editDependsOn.map(depId => {
                        const depTask = projectTasks.find(t => t.id === depId);
                        const title = depTask?.title || depId;
                        return (
                          <Badge key={depId} variant="secondary" className="text-xs">
                            {title}
                            <button
                              className="ml-1 text-red-500 hover:text-red-700"
                              onClick={() => setEditDependsOn(editDependsOn.filter(id => id !== depId))}
                            >×</button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                  <Button onClick={saveTaskChanges}>Save Changes</Button>
                </div>
              </div>
            ) : (
              // View mode
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Badge className={getPriorityColor(selectedTask.priority)}>{selectedTask.priority}</Badge>
                  <Badge className="bg-blue-100 text-blue-700">{selectedTask.status.replace('_', ' ')}</Badge>
                </div>
                <p className="text-gray-600">{selectedTask.description || 'No description'}</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2"><User className="h-4 w-4 text-gray-500" /><span>Assigned to: {selectedTask.assignedTo || 'Unassigned'}</span></div>
                  <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-gray-500" /><span>Due: {formatDate(selectedTask.dueDate)}</span></div>
                  <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-gray-500" /><span>Created: {formatDateTime(selectedTask.createdAt)}</span></div>
                  {selectedTask.updatedAt && <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-gray-500" /><span>Updated: {formatDateTime(selectedTask.updatedAt)}</span></div>}
                </div>
                {selectedTask.dependsOn && selectedTask.dependsOn.length > 0 && (
                  <div className="border-t pt-3"><h4 className="text-sm font-medium mb-2">Depends on</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTask.dependsOn.map(depId => {
                        const depTask = allTasks.find(t => t.id === depId);
                        return <Badge key={depId} variant="outline" className="bg-yellow-50">{depTask?.title || depId}</Badge>;
                      })}
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  {!readOnly && <Button onClick={() => openEditModal(selectedTask)}>Edit Task</Button>}
                  <Button variant="outline" onClick={() => setModalOpen(false)} className="ml-2">Close</Button>
                </div>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ListView;