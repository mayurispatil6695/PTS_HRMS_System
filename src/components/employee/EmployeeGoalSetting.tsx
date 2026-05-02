// src/components/employee/EmployeeGoalSetting.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
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
  status?: string;  // optional, but we'll filter by 'active' if present
}

// Firebase raw cycle shape
interface FirebaseCycle {
  name?: string;
  status?: string;
}

const EmployeeGoalSetting: React.FC = () => {
  const { user } = useAuth();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoal, setNewGoal] = useState({ title: '', targetDate: '', progress: 0, weight: 10 });
  const [loading, setLoading] = useState(false);

  // Fetch cycles from performanceCycles node
  useEffect(() => {
    const cyclesRef = ref(database, 'performanceCycles');
    const unsubscribe = onValue(cyclesRef, (snapshot) => {
      const data = snapshot.val() as Record<string, FirebaseCycle> | null;
      if (data) {
        const list: Cycle[] = Object.entries(data).map(([id, val]) => ({
          id,
          name: val.name || id,
          status: val.status,
        }));
        // Only keep cycles that are active (if status field exists) – otherwise keep all
        const activeCycles = list.filter(c => !c.status || c.status === 'active');
        setCycles(activeCycles);
        if (activeCycles.length > 0 && !selectedCycleId) {
          setSelectedCycleId(activeCycles[0].id);
        }
      } else {
        setCycles([]);
      }
    });
    return () => off(cyclesRef);
  }, []);

  // Fetch goals for selected cycle
  useEffect(() => {
    if (!selectedCycleId || !user?.id) return;
    const goalsRef = ref(database, `employeeGoals/${selectedCycleId}/${user.id}`);
    const unsubscribe = onValue(goalsRef, (snapshot) => {
      const data = snapshot.val() as Record<string, Omit<Goal, 'id'>> | null;
      if (data) {
        const goalList: Goal[] = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        setGoals(goalList);
      } else {
        setGoals([]);
      }
    });
    return () => off(goalsRef);
  }, [selectedCycleId, user?.id]);

  const addGoal = async () => {
    if (!newGoal.title.trim() || !newGoal.targetDate) {
      toast.error('Please enter title and target date');
      return;
    }
    setLoading(true);
    try {
      const goalsRef = ref(database, `employeeGoals/${selectedCycleId}/${user?.id}`);
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
      console.error(err);
      toast.error('Failed to add goal');
    } finally {
      setLoading(false);
    }
  };

  const updateGoalProgress = async (goalId: string, progress: number) => {
  try {
    const goalRef = ref(database, `employeeGoals/${selectedCycleId}/${user?.id}/${goalId}/progress`);
    await update(goalRef, { progress });   // ✅ pass an object, not a number
    toast.success('Progress updated');
  } catch (err) {
    console.error(err);
    toast.error('Failed to update progress');
  }
};

  const deleteGoal = async (goalId: string) => {
    if (window.confirm('Delete this goal?')) {
      try {
        await remove(ref(database, `employeeGoals/${selectedCycleId}/${user?.id}/${goalId}`));
        toast.success('Goal deleted');
      } catch (err) {
        console.error(err);
        toast.error('Failed to delete goal');
      }
    }
  };

  if (cycles.length === 0) {
    return <div className="text-center p-8 text-gray-500">No active review cycles. Please contact HR.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">My Goals</h1>
        <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select cycle" />
          </SelectTrigger>
          <SelectContent>
            {cycles.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle>Add New Goal</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Goal title"
              value={newGoal.title}
              onChange={e => setNewGoal({...newGoal, title: e.target.value})}
            />
            <Input
              type="date"
              value={newGoal.targetDate}
              onChange={e => setNewGoal({...newGoal, targetDate: e.target.value})}
            />
            <Input
              type="number"
              placeholder="Weight % (0-100)"
              value={newGoal.weight}
              onChange={e => setNewGoal({...newGoal, weight: parseInt(e.target.value) || 0})}
            />
            <Button onClick={addGoal} disabled={loading}>
              <Plus className="h-4 w-4 mr-1" /> Add Goal
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {goals.map(goal => (
          <Card key={goal.id}>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold">{goal.title}</h3>
                  <p className="text-sm text-gray-500">Due: {new Date(goal.targetDate).toLocaleDateString()}</p>
                  <p className="text-sm text-gray-500">Weight: {goal.weight}%</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => deleteGoal(goal.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
              <div className="mt-2">
                <Label>Progress: {goal.progress}%</Label>
                <Progress value={goal.progress} className="h-2 mt-1" />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={goal.progress}
                  onChange={e => updateGoalProgress(goal.id, parseInt(e.target.value))}
                  className="w-full mt-2"
                />
              </div>
            </CardContent>
          </Card>
        ))}
        {goals.length === 0 && (
          <div className="text-center text-gray-500 p-8">No goals set. Add your first goal above.</div>
        )}
      </div>
    </div>
  );
};

export default EmployeeGoalSetting;