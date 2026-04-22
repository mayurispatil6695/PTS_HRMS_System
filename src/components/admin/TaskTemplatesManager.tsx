// src/components/admin/TaskTemplatesManager.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { ref, set, push, remove, onValue, off } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, Edit } from 'lucide-react';

export interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  estimatedHours: number;
  subtasks: string[];
  dueDateOffsetDays: number;
  createdBy: string;
  createdAt: string;
}

export const TaskTemplatesManager = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // ✅ Explicitly typed formData state to avoid 'priority' literal type issue
  const [formData, setFormData] = useState<{
    name: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    estimatedHours: number;
    subtasks: string[];
    dueDateOffsetDays: number;
  }>({
    name: '',
    title: '',
    description: '',
    priority: 'medium',
    estimatedHours: 1,
    subtasks: [''],
    dueDateOffsetDays: 1,
  });

  useEffect(() => {
    const templatesRef = ref(database, 'taskTemplates');
    const unsubscribe = onValue(templatesRef, (snapshot) => {
      const data = snapshot.val() as Record<string, Omit<TaskTemplate, 'id'>> | null;
      if (data && typeof data === 'object') {
        const list: TaskTemplate[] = Object.entries(data).map(([id, val]) => ({
          id,
          ...val,
        }));
        setTemplates(list);
      } else {
        setTemplates([]);
      }
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });
    return () => off(templatesRef);
  }, []);

  const saveTemplate = async () => {
    if (!user || user.role !== 'admin') {
      toast.error('Only admin can manage templates');
      return;
    }
    const templateData: Omit<TaskTemplate, 'id'> = {
      name: formData.name,
      title: formData.title,
      description: formData.description,
      priority: formData.priority,
      estimatedHours: formData.estimatedHours,
      subtasks: formData.subtasks.filter(s => s.trim()),
      dueDateOffsetDays: formData.dueDateOffsetDays,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    try {
      if (editingId) {
        await set(ref(database, `taskTemplates/${editingId}`), templateData);
        toast.success('Template updated');
      } else {
        const newRef = push(ref(database, 'taskTemplates'));
        await set(newRef, templateData);
        toast.success('Template created');
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({
        name: '',
        title: '',
        description: '',
        priority: 'medium',
        estimatedHours: 1,
        subtasks: [''],
        dueDateOffsetDays: 1,
      });
    } catch (err) {
      toast.error('Failed to save template');
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await remove(ref(database, `taskTemplates/${id}`));
    toast.success('Template deleted');
  };

  const addSubtaskField = () => {
    setFormData({ ...formData, subtasks: [...formData.subtasks, ''] });
  };

  const updateSubtask = (idx: number, value: string) => {
    const newSubtasks = [...formData.subtasks];
    newSubtasks[idx] = value;
    setFormData({ ...formData, subtasks: newSubtasks });
  };

  const removeSubtask = (idx: number) => {
    const newSubtasks = formData.subtasks.filter((_, i) => i !== idx);
    setFormData({ ...formData, subtasks: newSubtasks });
  };

  if (loading) return <div>Loading templates...</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle>Task Templates</CardTitle>
        <Button onClick={() => { setShowForm(true); setEditingId(null); }}>
          <Plus className="h-4 w-4 mr-1" /> New Template
        </Button>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <p className="text-gray-500">No templates yet. Create one to speed up task creation.</p>
        ) : (
          <div className="space-y-2">
            {templates.map(t => (
              <div key={t.id} className="flex justify-between items-center p-3 border rounded-lg">
                <div>
                  <h3 className="font-medium">{t.name}</h3>
                  <p className="text-sm text-gray-500">{t.title} – {t.priority} priority, {t.estimatedHours}h est.</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    setEditingId(t.id);
                    setFormData({
                      name: t.name,
                      title: t.title,
                      description: t.description,
                      priority: t.priority,
                      estimatedHours: t.estimatedHours,
                      subtasks: t.subtasks.length ? t.subtasks : [''],
                      dueDateOffsetDays: t.dueDateOffsetDays,
                    });
                    setShowForm(true);
                  }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => deleteTemplate(t.id)} className="text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Template Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
              <h2 className="text-xl font-bold mb-4">{editingId ? 'Edit' : 'Create'} Template</h2>
              <div className="space-y-4">
                <Input placeholder="Template name (e.g., Bug Fix)" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                <Input placeholder="Task title template" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                <Textarea placeholder="Description template" rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                <Select value={formData.priority} onValueChange={(v: 'low' | 'medium' | 'high') => setFormData({...formData, priority: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" step="0.5" placeholder="Estimated hours" value={formData.estimatedHours} onChange={e => setFormData({...formData, estimatedHours: parseFloat(e.target.value) || 0})} />
                <Input type="number" placeholder="Due date offset (days from today)" value={formData.dueDateOffsetDays} onChange={e => setFormData({...formData, dueDateOffsetDays: parseInt(e.target.value) || 0})} />
                <div>
                  <label className="font-medium">Subtasks (optional)</label>
                  {formData.subtasks.map((sub, idx) => (
                    <div key={idx} className="flex gap-2 mt-2">
                      <Input value={sub} onChange={e => updateSubtask(idx, e.target.value)} placeholder="Subtask" />
                      <Button variant="outline" size="sm" onClick={() => removeSubtask(idx)}>✖</Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addSubtaskField} className="mt-2">+ Add subtask</Button>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button onClick={saveTemplate}>Save</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};