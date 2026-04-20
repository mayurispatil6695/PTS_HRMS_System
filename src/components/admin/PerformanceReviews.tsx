import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Plus, Trash2, Save, TrendingUp, Users, Settings } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, push, set, onValue, off, update, remove, get } from 'firebase/database';
import { toast } from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

interface Cycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'closed';
}

interface Competency {
  name: string;
  weight: number;
}

const PerformanceReviews: React.FC = () => {
  const { user } = useAuth();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [openQuestions, setOpenQuestions] = useState<string[]>([]);
  const [newCompName, setNewCompName] = useState('');
  const [newCompWeight, setNewCompWeight] = useState(0);
  const [newQuestion, setNewQuestion] = useState('');
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Fetch cycles
  useEffect(() => {
    const cyclesRef = ref(database, 'performanceCycles');
    const unsubscribe = onValue(cyclesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const cyclesList = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        setCycles(cyclesList);
        if (cyclesList.length > 0 && !selectedCycleId) setSelectedCycleId(cyclesList[0].id);
      } else setCycles([]);
    });
    return () => off(cyclesRef);
  }, []);

  // Fetch template for selected cycle
  useEffect(() => {
    if (!selectedCycleId) return;
    const templateRef = ref(database, `reviewTemplates/${selectedCycleId}`);
    const unsubscribe = onValue(templateRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCompetencies(data.competencies || []);
        setOpenQuestions(data.openQuestions || []);
      } else {
        setCompetencies([]);
        setOpenQuestions([]);
      }
    });
    return () => off(templateRef);
  }, [selectedCycleId]);

  // Load analytics for selected cycle
  useEffect(() => {
    if (!selectedCycleId) return;
    const fetchAnalytics = async () => {
      const reviewsRef = ref(database, `reviews/${selectedCycleId}`);
      const snapshot = await get(reviewsRef);
      const reviews = snapshot.val();
      if (!reviews) return;
      const scores = Object.values(reviews).map((r: any) => r.finalScore).filter(s => s);
      const avg = scores.reduce((a,b) => a+b, 0) / (scores.length || 1);
      const distribution = { A:0, B:0, C:0, D:0, E:0 };
      Object.values(reviews).forEach((r: any) => {
        const grade = r.grade;
        if (grade === 'A') distribution.A++;
        else if (grade === 'B') distribution.B++;
        else if (grade === 'C') distribution.C++;
        else if (grade === 'D') distribution.D++;
        else if (grade === 'E') distribution.E++;
      });
      setAnalyticsData({ avgScore: avg.toFixed(1), distribution, totalReviews: scores.length });
    };
    fetchAnalytics();
  }, [selectedCycleId]);

  const createCycle = async () => {
    const name = prompt('Cycle name (e.g., Q1 2026)');
    if (!name) return;
    const startDate = prompt('Start date (YYYY-MM-DD)');
    const endDate = prompt('End date (YYYY-MM-DD)');
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const newCycleRef = push(ref(database, 'performanceCycles'));
      await set(newCycleRef, { name, startDate, endDate, status: 'active' });
      toast.success('Cycle created');
    } catch (err) {
      toast.error('Failed to create cycle');
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async () => {
    if (!selectedCycleId) return;
    setLoading(true);
    try {
      await set(ref(database, `reviewTemplates/${selectedCycleId}`), { competencies, openQuestions });
      toast.success('Template saved');
    } catch (err) {
      toast.error('Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const addCompetency = () => {
    if (!newCompName || newCompWeight <= 0) return;
    setCompetencies([...competencies, { name: newCompName, weight: newCompWeight }]);
    setNewCompName('');
    setNewCompWeight(0);
  };

  const removeCompetency = (index: number) => {
    const updated = [...competencies];
    updated.splice(index, 1);
    setCompetencies(updated);
  };

  const addQuestion = () => {
    if (!newQuestion.trim()) return;
    setOpenQuestions([...openQuestions, newQuestion.trim()]);
    setNewQuestion('');
  };

  const removeQuestion = (index: number) => {
    const updated = [...openQuestions];
    updated.splice(index, 1);
    setOpenQuestions(updated);
  };

  const toggleCycleStatus = async (cycleId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'closed' : 'active';
    await update(ref(database, `performanceCycles/${cycleId}`), { status: newStatus });
    toast.success(`Cycle ${newStatus === 'active' ? 'activated' : 'closed'}`);
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#FF4444'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Performance Reviews</h1>
        <Button onClick={createCycle} disabled={loading}>+ New Cycle</Button>
      </div>

      {/* Cycle selector */}
      <div className="flex gap-4 items-center">
        <label className="font-medium">Select Cycle:</label>
        <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Choose cycle" /></SelectTrigger>
          <SelectContent>
            {cycles.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name} ({c.status})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedCycleId && (
          <Button variant="outline" size="sm" onClick={() => toggleCycleStatus(selectedCycleId, cycles.find(c => c.id === selectedCycleId)?.status || 'active')}>
            {cycles.find(c => c.id === selectedCycleId)?.status === 'active' ? 'Close Cycle' : 'Activate Cycle'}
          </Button>
        )}
      </div>

      {selectedCycleId && (
        <Tabs defaultValue="template">
          <TabsList>
            <TabsTrigger value="template">Template</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* TEMPLATE TAB */}
          <TabsContent value="template" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Competencies (Weighted)</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input placeholder="Competency name" value={newCompName} onChange={e => setNewCompName(e.target.value)} />
                    <Input type="number" placeholder="Weight %" value={newCompWeight} onChange={e => setNewCompWeight(parseInt(e.target.value) || 0)} className="w-28" />
                    <Button onClick={addCompetency}><Plus className="h-4 w-4" /> Add</Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Competency</TableHead><TableHead>Weight</TableHead><TableHead></TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {competencies.map((c, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{c.name}</TableCell>
                          <TableCell>{c.weight}%</TableCell>
                          <TableCell><Button variant="ghost" size="sm" onClick={() => removeCompetency(idx)}><Trash2 className="h-4 w-4 text-red-500" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="text-right">
                    <Button onClick={saveTemplate} disabled={loading}>Save Template</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Open‑ended Questions</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Input placeholder="Question text" value={newQuestion} onChange={e => setNewQuestion(e.target.value)} />
                  <Button onClick={addQuestion}><Plus className="h-4 w-4" /> Add</Button>
                </div>
                {openQuestions.map((q, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 border-b">
                    <span>{q}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeQuestion(idx)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ANALYTICS TAB */}
          <TabsContent value="analytics">
            {analyticsData ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle>Overall Statistics</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold">{analyticsData.totalReviews}</p>
                        <p className="text-sm text-gray-600">Reviews Completed</p>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <p className="text-2xl font-bold">{analyticsData.avgScore}</p>
                        <p className="text-sm text-gray-600">Average Score</p>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <p className="text-2xl font-bold">{Object.keys(cycles.find(c => c.id === selectedCycleId)?.reviews || {}).length || 0}</p>
                        <p className="text-sm text-gray-600">Pending Reviews</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Grade Distribution</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={Object.entries(analyticsData.distribution).map(([name, value]) => ({ name, value }))} cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="value" label>
                          {Object.entries(analyticsData.distribution).map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center p-8 text-gray-500">No data yet. Complete some reviews first.</div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default PerformanceReviews;