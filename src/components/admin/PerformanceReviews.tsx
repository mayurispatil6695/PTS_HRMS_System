import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Plus, Trash2, Save, TrendingUp, Users, Settings } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, push, set, onValue, off, update, remove, get } from 'firebase/database';
import { toast } from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

// ==================== TYPES ====================

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

interface ReviewRating {
  competencyName: string;
  rating: number; // 1-5
}

interface Review {
  id?: string;
  employeeId: string;
  employeeName: string;
  department: string;
  cycleId: string;
  reviewerId: string;
  reviewerName: string;
  ratings: ReviewRating[];
  answers: string[]; // answers to open questions
  finalScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  comments?: string;
  createdAt: string;
}

interface FirebaseReviewData {
  employeeId: string;
  employeeName: string;
  department: string;
  cycleId: string;
  reviewerId: string;
  reviewerName: string;
  ratings: ReviewRating[];
  answers: string[];
  finalScore: number;
  grade: string;
  comments?: string;
  createdAt: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  adminId: string;
}

interface PerformanceReviewsProps {
  role?: 'admin' | 'manager';
  userId?: string;
  department?: string;
}

// ✅ Type for user data fetched from Firebase (can have either 'profile' or 'employee')
interface FirebaseUserData {
  role?: string;
  profile?: {
    status?: string;
    department?: string;
    name?: string;
    email?: string;
    adminUid?: string;
  };
  employee?: {
    status?: string;
    department?: string;
    name?: string;
    email?: string;
    adminUid?: string;
  };
}

// ==================== COMPONENT ====================

const PerformanceReviews: React.FC<PerformanceReviewsProps> = ({
  role: propRole,
  userId: propUserId,
  department: propDepartment,
}) => {
  const { user: authUser } = useAuth();
  const effectiveRole = propRole || authUser?.role || 'admin';
  const effectiveUserId = propUserId || authUser?.id || '';
  const effectiveDepartment = propDepartment || authUser?.department || '';

  const isAdmin = effectiveRole === 'admin';
  const isManager = effectiveRole === 'manager';

  // State
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [openQuestions, setOpenQuestions] = useState<string[]>([]);
  const [newCompName, setNewCompName] = useState('');
  const [newCompWeight, setNewCompWeight] = useState(0);
  const [newQuestion, setNewQuestion] = useState('');
  const [analyticsData, setAnalyticsData] = useState<{
    avgScore: string;
    distribution: { A: number; B: number; C: number; D: number; E: number };
    totalReviews: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [ratings, setRatings] = useState<ReviewRating[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [existingReview, setExistingReview] = useState<Review | null>(null);

  // Fetch cycles (same for admin & manager)
  useEffect(() => {
    const cyclesRef = ref(database, 'performanceCycles');
    const unsubscribe = onValue(cyclesRef, (snapshot) => {
      const data = snapshot.val() as Record<string, Omit<Cycle, 'id'>> | null;
      if (data) {
        const cyclesList: Cycle[] = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        setCycles(cyclesList);
        if (cyclesList.length > 0 && !selectedCycleId) setSelectedCycleId(cyclesList[0].id);
      } else {
        setCycles([]);
      }
    });
    return () => off(cyclesRef);
  }, []);

  // Fetch template for selected cycle
  useEffect(() => {
    if (!selectedCycleId) return;
    const templateRef = ref(database, `reviewTemplates/${selectedCycleId}`);
    const unsubscribe = onValue(templateRef, (snapshot) => {
      const data = snapshot.val() as { competencies?: Competency[]; openQuestions?: string[] } | null;
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

  // Fetch employees (for manager – only their department) – FIXED type
  useEffect(() => {
    if (!isManager) return;
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const employeesList: Employee[] = [];
      snapshot.forEach((child) => {
        const userData = child.val() as FirebaseUserData;
        if (userData.role === 'admin') return;
        // Use either profile or employee
        const profile = userData.profile || userData.employee;
        if (!profile || profile.status !== 'active') return;
        if (profile.department !== effectiveDepartment) return;
        employeesList.push({
          id: child.key || '',
          name: profile.name || '',
          email: profile.email || '',
          department: profile.department || '',
          adminId: profile.adminUid || '',
        });
      });
      setEmployees(employeesList);
    });
    return () => off(usersRef);
  }, [isManager, effectiveDepartment]);

  // Fetch existing review for selected employee & cycle
  useEffect(() => {
    if (!selectedCycleId || !selectedEmployeeId) {
      setExistingReview(null);
      return;
    }
    const reviewRef = ref(database, `reviews/${selectedCycleId}/${selectedEmployeeId}`);
    const unsubscribe = onValue(reviewRef, (snapshot) => {
      const data = snapshot.val() as FirebaseReviewData | null;
      if (data) {
        setExistingReview({
          id: selectedEmployeeId,
          ...data,
          grade: data.grade as 'A' | 'B' | 'C' | 'D' | 'E',
        });
        setRatings(data.ratings || []);
        setAnswers(data.answers || []);
        setComments(data.comments || '');
      } else {
        setExistingReview(null);
        // Reset form with default ratings
        setRatings(competencies.map(c => ({ competencyName: c.name, rating: 3 })));
        setAnswers(openQuestions.map(() => ''));
        setComments('');
      }
    });
    return () => off(reviewRef);
  }, [selectedCycleId, selectedEmployeeId, competencies, openQuestions]);

  // Load analytics for selected cycle (filtered by department for manager)
  useEffect(() => {
    if (!selectedCycleId) return;
    const fetchAnalytics = async () => {
      const reviewsRef = ref(database, `reviews/${selectedCycleId}`);
      const snapshot = await get(reviewsRef);
      const reviews = snapshot.val() as Record<string, FirebaseReviewData> | null;
      if (!reviews) {
        setAnalyticsData(null);
        return;
      }
      let filteredReviews = Object.values(reviews);
      if (isManager && effectiveDepartment) {
        filteredReviews = filteredReviews.filter(r => r.department === effectiveDepartment);
      }
      const scores = filteredReviews.map(r => r.finalScore).filter(s => typeof s === 'number');
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const distribution = { A: 0, B: 0, C: 0, D: 0, E: 0 };
      filteredReviews.forEach(r => {
        const grade = r.grade;
        if (grade === 'A') distribution.A++;
        else if (grade === 'B') distribution.B++;
        else if (grade === 'C') distribution.C++;
        else if (grade === 'D') distribution.D++;
        else if (grade === 'E') distribution.E++;
      });
      setAnalyticsData({
        avgScore: avg.toFixed(1),
        distribution,
        totalReviews: scores.length,
      });
    };
    fetchAnalytics();
  }, [selectedCycleId, isManager, effectiveDepartment]);

  // Admin: create new cycle
  const createCycle = async () => {
    if (!isAdmin) {
      toast.error('Only admin can create cycles');
      return;
    }
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

  // Admin: save template (competencies & questions)
  const saveTemplate = async () => {
    if (!isAdmin) {
      toast.error('Only admin can edit templates');
      return;
    }
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
    if (!isAdmin) {
      toast.error('Only admin can change cycle status');
      return;
    }
    const newStatus = currentStatus === 'active' ? 'closed' : 'active';
    await update(ref(database, `performanceCycles/${cycleId}`), { status: newStatus });
    toast.success(`Cycle ${newStatus === 'active' ? 'activated' : 'closed'}`);
  };

  // Submit review (manager or admin)
  const handleSubmitReview = async () => {
    if (!selectedCycleId || !selectedEmployeeId) {
      toast.error('Select an employee first');
      return;
    }
    if (ratings.some(r => r.rating < 1 || r.rating > 5)) {
      toast.error('All ratings must be between 1 and 5');
      return;
    }
    // Calculate final score
    let totalWeight = 0;
    let weightedSum = 0;
    competencies.forEach((comp, idx) => {
      const rating = ratings[idx]?.rating || 3;
      weightedSum += rating * comp.weight;
      totalWeight += comp.weight;
    });
    const finalScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    let grade: 'A' | 'B' | 'C' | 'D' | 'E';
    if (finalScore >= 4.5) grade = 'A';
    else if (finalScore >= 3.5) grade = 'B';
    else if (finalScore >= 2.5) grade = 'C';
    else if (finalScore >= 1.5) grade = 'D';
    else grade = 'E';

    const reviewData: FirebaseReviewData = {
      employeeId: selectedEmployeeId,
      employeeName: employees.find(e => e.id === selectedEmployeeId)?.name || '',
      department: effectiveDepartment,
      cycleId: selectedCycleId,
      reviewerId: effectiveUserId,
      reviewerName: authUser?.name || 'Manager',
      ratings,
      answers,
      finalScore,
      grade,
      comments,
      createdAt: new Date().toISOString(),
    };

    setSubmitting(true);
    try {
      await set(ref(database, `reviews/${selectedCycleId}/${selectedEmployeeId}`), reviewData);
      toast.success('Review submitted successfully');
    } catch (err) {
      toast.error('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#FF4444'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Performance Reviews</h1>
        {isAdmin && <Button onClick={createCycle} disabled={loading}>+ New Cycle</Button>}
      </div>

      {/* Cycle selector */}
      <div className="flex gap-4 items-center flex-wrap">
        <label className="font-medium">Select Cycle:</label>
        <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Choose cycle" /></SelectTrigger>
          <SelectContent>
            {cycles.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name} ({c.status})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin && selectedCycleId && (
          <Button variant="outline" size="sm" onClick={() => toggleCycleStatus(selectedCycleId, cycles.find(c => c.id === selectedCycleId)?.status || 'active')}>
            {cycles.find(c => c.id === selectedCycleId)?.status === 'active' ? 'Close Cycle' : 'Activate Cycle'}
          </Button>
        )}
      </div>

      {selectedCycleId && (
        <Tabs defaultValue={isAdmin ? "template" : "conduct"}>
          <TabsList>
            {isAdmin && <TabsTrigger value="template">Template</TabsTrigger>}
            {(isAdmin || isManager) && <TabsTrigger value="conduct">Conduct Reviews</TabsTrigger>}
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* TEMPLATE TAB – admin only */}
          {isAdmin && (
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
          )}

          {/* CONDUCT REVIEWS TAB – for admin & manager */}
          {(isAdmin || isManager) && (
            <TabsContent value="conduct" className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Submit Performance Review</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label>Select Employee</Label>
                      <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                        <SelectTrigger><SelectValue placeholder="Choose employee" /></SelectTrigger>
                        <SelectContent>
                          {employees.map(emp => (
                            <SelectItem key={emp.id} value={emp.id}>{emp.name} - {emp.department}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedEmployeeId && existingReview && (
                      <div className="bg-yellow-50 p-3 rounded text-sm">
                        ⚠️ This employee already has a review for this cycle. Submitting will overwrite it.
                      </div>
                    )}

                    {competencies.map((comp, idx) => (
                      <div key={idx} className="space-y-1">
                        <Label>{comp.name} (Weight: {comp.weight}%)</Label>
                        <Select
                          value={ratings[idx]?.rating?.toString() || '3'}
                          onValueChange={(val) => {
                            const newRatings = [...ratings];
                            newRatings[idx] = { competencyName: comp.name, rating: parseInt(val) };
                            setRatings(newRatings);
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="Rate 1-5" /></SelectTrigger>
                          <SelectContent>
                            {[1,2,3,4,5].map(r => <SelectItem key={r} value={r.toString()}>{r} - {r===1?'Poor':r===2?'Below Average':r===3?'Average':r===4?'Good':'Excellent'}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}

                    {openQuestions.map((q, idx) => (
                      <div key={idx} className="space-y-1">
                        <Label>{q}</Label>
                        <Textarea
                          value={answers[idx] || ''}
                          onChange={(e) => {
                            const newAnswers = [...answers];
                            newAnswers[idx] = e.target.value;
                            setAnswers(newAnswers);
                          }}
                          rows={3}
                        />
                      </div>
                    ))}

                    <div className="space-y-1">
                      <Label>Additional Comments (optional)</Label>
                      <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} />
                    </div>

                    <Button onClick={handleSubmitReview} disabled={submitting || !selectedEmployeeId}>
                      {submitting ? 'Submitting...' : existingReview ? 'Update Review' : 'Submit Review'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ANALYTICS TAB – filtered for manager */}
          <TabsContent value="analytics">
            {analyticsData ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle>Overall Statistics {isManager ? `(${effectiveDepartment})` : ''}</CardTitle></CardHeader>
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
                        <p className="text-2xl font-bold">{employees.length}</p>
                        <p className="text-sm text-gray-600">{isManager ? 'Team Members' : 'Employees'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Grade Distribution</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={Object.entries(analyticsData.distribution).map(([name, value]) => ({ name, value }))}
                          cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="value" label
                        >
                          {Object.entries(analyticsData.distribution).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
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