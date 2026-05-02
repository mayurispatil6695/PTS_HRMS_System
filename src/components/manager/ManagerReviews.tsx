// src/components/manager/ManagerReview.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Progress } from '../ui/progress';
import { Star, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, onValue, off, set, get, update, push } from 'firebase/database';
import { toast } from 'react-hot-toast';

// ========== TYPES ==========
interface Cycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface Employee {
  id: string;
  name: string;
  department: string;
}

interface Competency {
  name: string;
  weight: number;
}

interface Goal {
  id: string;
  title: string;
  progress: number;
  weight: number;
}

interface SelfReviewData {
  ratings?: Record<string, number>;
  answers?: Record<string, string>;
  submittedAt?: string;
}

interface PiPTask {
  title: string;
  dueDate: string;
}

// Firebase raw shapes
interface FirebaseCycle {
  name?: string;
  startDate?: string;
  endDate?: string;
}

interface FirebaseEmployee {
  name?: string;
  department?: string;
  designation?: string;
  status?: string;
  [key: string]: unknown;
}

interface FirebaseTemplate {
  competencies?: Competency[];
  openQuestions?: string[];
}

interface FirebaseProject {
  tasks?: Record<string, FirebaseTask>;
}

interface FirebaseTask {
  assignedTo?: string;
  status?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

interface FirebaseDailyTask {
  status?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

interface FirebaseAttendanceRecord {
  date?: string;
  status?: string;
}

// ========== COMPONENT ==========
const ManagerReview: React.FC = () => {
  const { user } = useAuth();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [openQuestions, setOpenQuestions] = useState<string[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selfReview, setSelfReview] = useState<SelfReviewData | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showPIP, setShowPIP] = useState(false);
  const [pipTasks, setPipTasks] = useState<PiPTask[]>([]);
  const [newPipTask, setNewPipTask] = useState({ title: '', dueDate: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch cycles
  useEffect(() => {
    const cyclesRef = ref(database, 'performanceCycles');
    const unsubscribe = onValue(
      cyclesRef,
      (snapshot) => {
        const data = snapshot.val() as Record<string, FirebaseCycle> | null;
        if (data) {
          const list: Cycle[] = Object.entries(data).map(([id, val]) => ({
            id,
            name: val.name || id,
            startDate: val.startDate || '',
            endDate: val.endDate || '',
          }));
          setCycles(list);
          if (list.length > 0 && !selectedCycleId) setSelectedCycleId(list[0].id);
        } else {
          setCycles([]);
        }
        setError(null);
      },
      (err) => {
        console.error(err);
        setError('Failed to load cycles');
      }
    );
    return () => off(cyclesRef);
  }, []);

  // Fetch employees (non-team‑lead, active)
  useEffect(() => {
    if (!user?.adminUid) return;
    const teamRef = ref(database, `users/${user.adminUid}/employees`);
    const unsubscribe = onValue(
      teamRef,
      (snapshot) => {
        const data = snapshot.val() as Record<string, FirebaseEmployee> | null;
        if (data) {
          const empList: Employee[] = Object.entries(data)
            .filter(
              ([, val]) => val.designation !== 'Team Lead' && val.status === 'active'
            )
            .map(([id, val]) => ({
              id,
              name: val.name || id,
              department: val.department || '',
            }));
          setEmployees(empList);
        } else {
          setEmployees([]);
        }
      },
      (err) => {
        console.error(err);
        toast.error('Failed to load employees');
      }
    );
    return () => off(teamRef);
  }, [user?.adminUid]);

  // Load template, goals, self‑review, existing manager review
  useEffect(() => {
    if (!selectedCycleId || !selectedEmployee) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Template
        const templateRef = ref(database, `reviewTemplates/${selectedCycleId}`);
        const templateSnap = await get(templateRef);
        const template = templateSnap.val() as FirebaseTemplate | null;
        if (template) {
          setCompetencies(template.competencies || []);
          setOpenQuestions(template.openQuestions || []);
        } else {
          setCompetencies([]);
          setOpenQuestions([]);
        }

        // Goals
        const goalsRef = ref(database, `employeeGoals/${selectedCycleId}/${selectedEmployee.id}`);
        const goalsSnap = await get(goalsRef);
        const goalsData = goalsSnap.val() as Record<string, Omit<Goal, 'id'>> | null;
        if (goalsData) {
          const goalList: Goal[] = Object.entries(goalsData).map(([id, val]) => ({ id, ...val }));
          setGoals(goalList);
        } else {
          setGoals([]);
        }

        // Self review
        const selfRef = ref(database, `reviews/${selectedCycleId}/${selectedEmployee.id}/self`);
        const selfSnap = await get(selfRef);
        const selfVal = selfSnap.val() as SelfReviewData | null;
        setSelfReview(selfVal);

        // Manager's existing review
        const mgrRef = ref(database, `reviews/${selectedCycleId}/${selectedEmployee.id}/manager`);
        const mgrSnap = await get(mgrRef);
        if (mgrSnap.exists()) {
          const mgrData = mgrSnap.val() as {
            ratings?: Record<string, number>;
            answers?: Record<string, string>;
            pip?: { tasks?: PiPTask[] };
          };
          setRatings(mgrData.ratings || {});
          setAnswers(mgrData.answers || {});
          setSubmitted(true);
          if (mgrData.pip?.tasks) setPipTasks(mgrData.pip.tasks);
          setShowPIP(!!mgrData.pip);
        } else {
          setRatings({});
          setAnswers({});
          setSubmitted(false);
          setShowPIP(false);
          setPipTasks([]);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load review data');
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [selectedCycleId, selectedEmployee]);

  // Helper: fetch task completion percentage during cycle
  const fetchTaskCompletion = async (employeeId: string): Promise<number> => {
    const cycle = cycles.find(c => c.id === selectedCycleId);
    if (!cycle) return 100;
    const startDate = new Date(cycle.startDate);
    const endDate = new Date(cycle.endDate);
    let completedCount = 0;
    let totalAssignedCount = 0;

    // 1. Project tasks
    const projectsSnap = await get(ref(database, 'projects'));
    const projects = projectsSnap.val() as Record<string, FirebaseProject> | null;
    if (projects) {
      for (const proj of Object.values(projects)) {
        if (proj.tasks) {
          for (const task of Object.values(proj.tasks)) {
            if (task.assignedTo === employeeId) {
              totalAssignedCount++;
              if (task.status === 'completed') {
                const completedAt = task.updatedAt ? new Date(task.updatedAt) : null;
                if (completedAt && completedAt >= startDate && completedAt <= endDate) {
                  completedCount++;
                }
              }
            }
          }
        }
      }
    }

    // 2. Standalone daily tasks
    const adminId = user?.adminUid;
    if (adminId) {
      const dailyTasksRef = ref(database, `users/${adminId}/employees/${employeeId}/dailyTasks`);
      const snap = await get(dailyTasksRef);
      const dailyTasks = snap.val() as Record<string, FirebaseDailyTask> | null;
      if (dailyTasks) {
        for (const task of Object.values(dailyTasks)) {
          totalAssignedCount++;
          if (task.status === 'completed') {
            const completedAt = task.updatedAt ? new Date(task.updatedAt) : null;
            if (completedAt && completedAt >= startDate && completedAt <= endDate) {
              completedCount++;
            }
          }
        }
      }
    }

    if (totalAssignedCount === 0) return 100; // no tasks → full score
    return (completedCount / totalAssignedCount) * 100;
  };

  // Helper: fetch attendance percentage during cycle
  const fetchAttendance = async (employeeId: string): Promise<number> => {
    const cycle = cycles.find(c => c.id === selectedCycleId);
    if (!cycle) return 100;
    const startDate = new Date(cycle.startDate);
    const endDate = new Date(cycle.endDate);
    const adminId = user?.adminUid;
    if (!adminId) return 0;

    const attendanceRef = ref(database, `users/${adminId}/employees/${employeeId}/punching`);
    const snap = await get(attendanceRef);
    const records = snap.val() as Record<string, FirebaseAttendanceRecord> | null;
    if (!records) return 0;

    // Working days (Monday‑Friday, exclude weekends)
    const workingDays: string[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays.push(current.toISOString().split('T')[0]);
      }
      current.setDate(current.getDate() + 1);
    }

    let presentCount = 0;
    for (const rec of Object.values(records)) {
      const recordDate = rec.date?.split('T')[0];
      if (recordDate && workingDays.includes(recordDate) && (rec.status === 'present' || rec.status === 'late' || rec.status === 'half-day')) {
        presentCount++;
      }
    }

    if (workingDays.length === 0) return 100;
    return (presentCount / workingDays.length) * 100;
  };

  const handleRating = (compName: string, rating: number) => {
    setRatings(prev => ({ ...prev, [compName]: rating }));
  };

  const handleAnswer = (question: string, value: string) => {
    setAnswers(prev => ({ ...prev, [question]: value }));
  };

  const calculateFinalScore = async (): Promise<number> => {
    if (!selectedEmployee) return 0;
    // Competency weighted average
    let compScore = 0;
    let totalWeight = 0;
    for (const comp of competencies) {
      const rating = ratings[comp.name] || 0;
      compScore += (rating / 5) * comp.weight;
      totalWeight += comp.weight;
    }
    compScore = totalWeight > 0 ? (compScore / totalWeight) * 100 : 0;

    // Goals contribution (max 20%)
    let goalScore = 0;
    for (const goal of goals) {
      goalScore += (goal.progress / 100) * goal.weight;
    }
    goalScore = Math.min(goalScore, 20);

    // Task completion & attendance (5% each)
    const taskCompletion = await fetchTaskCompletion(selectedEmployee.id);
    const attendance = await fetchAttendance(selectedEmployee.id);

    // Final composition: 70% competencies, 20% goals, 5% task, 5% attendance
    const final = compScore * 0.7 + goalScore + taskCompletion * 0.05 + attendance * 0.05;
    return Math.round(final);
  };

  const getGrade = (score: number) => {
    if (score >= 90) return 'A (Outstanding)';
    if (score >= 75) return 'B (Exceeds)';
    if (score >= 60) return 'C (Meets)';
    if (score >= 40) return 'D (Needs Improvement)';
    return 'E (Unacceptable)';
  };

  const submitManagerReview = async () => {
    if (!selectedCycleId || !selectedEmployee) return;
    const missing = competencies.some(c => !ratings[c.name]);
    if (missing) {
      toast.error('Please rate all competencies');
      return;
    }
    const finalScore = await calculateFinalScore();
    const grade = getGrade(finalScore);
    setLoading(true);
    try {
      const reviewRef = ref(database, `reviews/${selectedCycleId}/${selectedEmployee.id}/manager`);
      await set(reviewRef, {
        ratings,
        answers,
        finalScore,
        grade,
        submittedAt: new Date().toISOString(),
        managerId: user?.id,
        managerName: user?.name,
        pip: showPIP ? { tasks: pipTasks, active: true, startDate: new Date().toISOString() } : null,
      });
      await set(ref(database, `reviews/${selectedCycleId}/${selectedEmployee.id}/status`), 'manager_submitted');
      toast.success(`Review submitted. Final score: ${finalScore} (${grade})`);
      setSubmitted(true);
      // Notify employee
      const notifRef = push(ref(database, `notifications/${selectedEmployee.id}`));
      await set(notifRef, {
        title: 'Performance Review Completed',
        body: `Your manager has completed your review. Score: ${finalScore} (${grade})`,
        type: 'review_completed',
        read: false,
        createdAt: Date.now(),
      });
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  const addPipTask = () => {
    if (!newPipTask.title || !newPipTask.dueDate) {
      toast.error('Please enter title and due date');
      return;
    }
    setPipTasks([...pipTasks, { title: newPipTask.title, dueDate: newPipTask.dueDate }]);
    setNewPipTask({ title: '', dueDate: '' });
  };

  const removePipTask = (idx: number) => {
    setPipTasks(pipTasks.filter((_, i) => i !== idx));
  };

  // Memoize cycles to avoid unnecessary re‑renders (optional)
  const cycleOptions = useMemo(() => cycles, [cycles]);

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        <p>{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  if (loading && !selectedEmployee) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Team Performance Reviews</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Review Cycle</Label>
          <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
            <SelectTrigger><SelectValue placeholder="Select cycle" /></SelectTrigger>
            <SelectContent>
              {cycleOptions.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Employee</Label>
          <Select
            value={selectedEmployee?.id || ''}
            onValueChange={(id) => setSelectedEmployee(employees.find(e => e.id === id) || null)}
          >
            <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
            <SelectContent>
              {employees.map(emp => (
                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedEmployee && (
        <>
          {selfReview && (
            <Card>
              <CardHeader><CardTitle>Employee Self‑Review</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(selfReview.ratings || {}).map(([comp, rating]) => (
                    <div key={comp} className="flex justify-between">
                      <span>{comp}</span>
                      <span>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>
                    </div>
                  ))}
                  {Object.entries(selfReview.answers || {}).map(([q, a]) => (
                    <div key={q}>
                      <p className="font-medium">{q}</p>
                      <p className="text-gray-600">{a as string}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Manager Assessment</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold">Competency Ratings</h3>
                {competencies.map(comp => (
                  <div key={comp.name} className="flex items-center justify-between">
                    <div><span>{comp.name}</span> <span className="text-sm text-gray-500">(Weight: {comp.weight}%)</span></div>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => handleRating(comp.name, star)}
                          disabled={submitted}
                          className="focus:outline-none"
                        >
                          <Star className={`h-5 w-5 ${ratings[comp.name] >= star ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Goal Progress</h3>
                {goals.map(goal => (
                  <div key={goal.id}>
                    <div className="flex justify-between">
                      <span>{goal.title}</span>
                      <span>{goal.progress}% (Weight: {goal.weight}%)</span>
                    </div>
                    <Progress value={goal.progress} className="h-2" />
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Open Questions</h3>
                {openQuestions.map((q, idx) => (
                  <div key={idx}>
                    <Label>{q}</Label>
                    <Textarea
                      value={answers[q] || ''}
                      onChange={e => handleAnswer(q, e.target.value)}
                      disabled={submitted}
                    />
                  </div>
                ))}
              </div>

              {!submitted && (
                <>
                  <Button variant="outline" onClick={() => setShowPIP(!showPIP)}>
                    <AlertTriangle className="h-4 w-4 mr-1" /> {showPIP ? 'Hide' : 'Create'} Performance Improvement Plan
                  </Button>

                  {showPIP && (
                    <Card>
                      <CardHeader><CardTitle>Performance Improvement Plan (PIP)</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Task title"
                            value={newPipTask.title}
                            onChange={e => setNewPipTask({ ...newPipTask, title: e.target.value })}
                          />
                          <Input
                            type="date"
                            value={newPipTask.dueDate}
                            onChange={e => setNewPipTask({ ...newPipTask, dueDate: e.target.value })}
                          />
                          <Button onClick={addPipTask}>Add</Button>
                        </div>
                        {pipTasks.map((task, idx) => (
                          <div key={idx} className="flex justify-between items-center p-2 border-b">
                            <span>{task.title} – Due {task.dueDate}</span>
                            <Button variant="ghost" size="sm" onClick={() => removePipTask(idx)}>
                              ✕
                            </Button>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button onClick={submitManagerReview} disabled={loading}>
                      {loading ? 'Submitting...' : 'Submit Review'}
                    </Button>
                  </div>
                </>
              )}

              {submitted && (
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="font-semibold">Review Submitted</p>
                  <p>Final Score: { /* no finalScore stored? we could recalc? */ } —</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ManagerReview;