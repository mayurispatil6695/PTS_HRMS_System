import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { Plus, Trash2, Save } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, onValue, off, set, push, update, remove } from 'firebase/database';
import { toast } from 'react-hot-toast';

interface Goal {
  id: string;
  title: string;
  targetDate: string;
  progress: number;
  weight: number;
  status: 'on_track' | 'at_risk' | 'completed';
}

interface Cycle {
  id: string;
  name: string;
}

const EmployeeGoalSetting: React.FC = () => {
  const { user } = useAuth();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoal, setNewGoal] = useState({ title: '', targetDate: '', progress: 0, weight: 10 });
  const [loading, setLoading] = useState(false);

  // Fetch active cycles
  useEffect(() => {
    const cyclesRef = ref(database, 'performanceCycles');
    const unsubscribe = onValue(cyclesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data)
          .map(([id, val]: [string, any]) => ({ id, name: val.name }))
          .filter(c => cycles.find(cc => cc.id === c.id)?.status === 'active');
        setCycles(list);
        if (list.length > 0 && !selectedCycleId) setSelectedCycleId(list[0].id);
      }
    });
    return () => off(cyclesRef);
  }, []);

  // Fetch goals for selected cycle
  useEffect(() => {
    if (!selectedCycleId || !user?.id) return;
    const goalsRef = ref(database, `employeeGoals/${selectedCycleId}/${user.id}`);
    const unsubscribe = onValue(goalsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const goalList = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        setGoals(goalList);
      } else setGoals([]);
    });
    return () => off(goalsRef);
  }, [selectedCycleId, user?.id]);

  const addGoal = async () => {
    if (!newGoal.title.trim() || !newGoal.targetDate) return;
    setLoading(true);
    try {
      const goalsRef = ref(database, `employeeGoals/${selectedCycleId}/${user.id}`);
      const newGoalRef = push(goalsRef);
      await set(newGoalRef, {
        title: newGoal.title,
        targetDate: newGoal.targetDate,
        progress: 0,
        weight: newGoal.weight,
        status: 'on_track'
      });
      setNewGoal({ title: '', targetDate: '', progress: 0, weight: 10 });
      toast.success('Goal added');
    } catch (err) {
      toast.error('Failed to add goal');
    } finally {
      setLoading(false);
    }
  };

  const updateGoalProgress = async (goalId: string, progress: number) => {
    const goalRef = ref(database, `employeeGoals/${selectedCycleId}/${user.id}/${goalId}/progress`);
    await update(goalRef, progress);
    toast.success('Progress updated');
  };

  const deleteGoal = async (goalId: string) => {
    if (confirm('Delete this goal?')) {
      await remove(ref(database, `employeeGoals/${selectedCycleId}/${user.id}/${goalId}`));
      toast.success('Goal deleted');
    }
  };

  if (cycles.length === 0) return <div className="text-center p-8">No active review cycles.</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">My Goals</h1>
        <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {cycles.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle>Add New Goal</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input placeholder="Goal title" value={newGoal.title} onChange={e => setNewGoal({...newGoal, title: e.target.value})} />
            <Input type="date" value={newGoal.targetDate} onChange={e => setNewGoal({...newGoal, targetDate: e.target.value})} />
            <Input type="number" placeholder="Weight % (0-100)" value={newGoal.weight} onChange={e => setNewGoal({...newGoal, weight: parseInt(e.target.value) || 0})} />
            <Button onClick={addGoal} disabled={loading}><Plus className="h-4 w-4 mr-1" /> Add Goal</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {goals.map(goal => (
          <Card key={goal.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{goal.title}</h3>
                  <p className="text-sm text-gray-500">Due: {new Date(goal.targetDate).toLocaleDateString()}</p>
                  <p className="text-sm text-gray-500">Weight: {goal.weight}%</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => deleteGoal(goal.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </div>
              <div className="mt-2">
                <Label>Progress: {goal.progress}%</Label>
                <Progress value={goal.progress} className="h-2 mt-1" />
                <Input type="range" min="0" max="100" value={goal.progress} onChange={e => updateGoalProgress(goal.id, parseInt(e.target.value))} className="mt-2" />
              </div>
            </CardContent>
          </Card>
        ))}
        {goals.length === 0 && <div className="text-center text-gray-500">No goals set. Add your first goal above.</div>}
      </div>
    </div>
  );
};

export default EmployeeGoalSetting;