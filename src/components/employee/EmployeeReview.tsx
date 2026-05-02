// src/components/employee/EmployeeReview.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, onValue, off, set, get } from 'firebase/database';
import { toast } from 'react-hot-toast';

// Types
interface Cycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
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

// Firebase raw cycle shape
interface FirebaseCycle {
  name?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

const EmployeeReview: React.FC = () => {
  const { user } = useAuth();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [openQuestions, setOpenQuestions] = useState<string[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch active cycles
  useEffect(() => {
    const cyclesRef = ref(database, 'performanceCycles');
    const unsubscribe = onValue(cyclesRef, (snapshot) => {
      const data = snapshot.val() as Record<string, FirebaseCycle> | null;
      if (data) {
        const active: Cycle[] = Object.entries(data)
          .map(([id, val]) => ({
            id,
            name: val.name || id,
            startDate: val.startDate || '',
            endDate: val.endDate || '',
            status: val.status || '',
          }))
          .filter(c => c.status === 'active');
        setCycles(active);
        if (active.length > 0 && !selectedCycle) setSelectedCycle(active[0]);
      }
      setLoading(false);
    });
    return () => off(cyclesRef);
  }, []);

  // Load template & goals for selected cycle
  useEffect(() => {
    if (!selectedCycle || !user?.id) return;

    const loadData = async () => {
      const templateRef = ref(database, `reviewTemplates/${selectedCycle.id}`);
      const goalsRef = ref(database, `employeeGoals/${selectedCycle.id}/${user.id}`);

      try {
        const [templateSnap, goalsSnap] = await Promise.all([get(templateRef), get(goalsRef)]);
        const template = templateSnap.val() as { competencies?: Competency[]; openQuestions?: string[] } | null;
        if (template) {
          setCompetencies(template.competencies || []);
          setOpenQuestions(template.openQuestions || []);
        } else {
          setCompetencies([]);
          setOpenQuestions([]);
        }

        const goalsData = goalsSnap.val() as Record<string, Omit<Goal, 'id'>> | null;
        if (goalsData) {
          const goalList: Goal[] = Object.entries(goalsData).map(([id, val]) => ({ id, ...val }));
          setGoals(goalList);
        } else {
          setGoals([]);
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load review data');
      }
    };

    loadData();
  }, [selectedCycle, user?.id]);

  // Load existing self review
  useEffect(() => {
    if (!selectedCycle || !user?.id) return;

    const reviewRef = ref(database, `reviews/${selectedCycle.id}/${user.id}/self`);
    const unsubscribe = onValue(reviewRef, (snapshot) => {
      const data = snapshot.val() as { ratings?: Record<string, number>; answers?: Record<string, string> } | null;
      if (data && data.ratings) {
        setRatings(data.ratings);
        setAnswers(data.answers || {});
        setSubmitted(true);
      } else {
        setSubmitted(false);
      }
    });
    return () => off(reviewRef);
  }, [selectedCycle, user?.id]);

  const handleRating = (compName: string, rating: number) => {
    if (submitted) return;
    setRatings(prev => ({ ...prev, [compName]: rating }));
  };

  const handleAnswer = (question: string, value: string) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [question]: value }));
  };

  const submitReview = async () => {
    if (!selectedCycle || !user?.id) return;
    const missingCompetency = competencies.some(c => !ratings[c.name]);
    if (missingCompetency) {
      toast.error('Please rate all competencies');
      return;
    }
    setLoading(true);
    try {
      const reviewRef = ref(database, `reviews/${selectedCycle.id}/${user.id}/self`);
      await set(reviewRef, {
        ratings,
        answers,
        submittedAt: new Date().toISOString(),
      });
      await set(ref(database, `reviews/${selectedCycle.id}/${user.id}/status`), 'self_submitted');
      toast.success('Self‑review submitted');
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (cycles.length === 0) {
    return <div className="text-center p-8 text-gray-500">No active review cycles.</div>;
  }

  return (
    <div className="space-y-6 px-4 pb-20 sm:px-6 sm:pb-0">
      <div>
        <h1 className="text-2xl font-bold">Performance Review – {selectedCycle?.name}</h1>
        <p className="text-gray-600 text-sm">Rate yourself on competencies and answer open questions.</p>
      </div>

      {/* Competencies */}
      <Card>
        <CardHeader><CardTitle>Competency Ratings</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-6">
            {competencies.map(comp => (
              <div key={comp.name} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-medium">{comp.name}</span>
                  <span className="text-sm text-gray-500 ml-2">(Weight: {comp.weight}%)</span>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRating(comp.name, star)}
                      disabled={submitted}
                      className={`text-2xl sm:text-3xl focus:outline-none transition-colors ${
                        ratings[comp.name] >= star ? 'text-yellow-500' : 'text-gray-300'
                      } ${!submitted ? 'cursor-pointer hover:scale-105' : 'cursor-default'}`}
                      aria-label={`Rate ${star} star`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {competencies.length === 0 && (
              <p className="text-gray-500 text-sm">No competencies defined for this cycle.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Open Questions */}
      <Card>
        <CardHeader><CardTitle>Open Questions</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {openQuestions.map((q, idx) => (
            <div key={idx}>
              <Label htmlFor={`q-${idx}`} className="text-base font-medium">{q}</Label>
              <Textarea
                id={`q-${idx}`}
                rows={3}
                value={answers[q] || ''}
                onChange={e => handleAnswer(q, e.target.value)}
                disabled={submitted}
                placeholder="Your answer..."
                className="mt-2"
              />
            </div>
          ))}
          {openQuestions.length === 0 && (
            <p className="text-gray-500 text-sm">No open questions configured.</p>
          )}
        </CardContent>
      </Card>

      {/* Optional: Display Goals (if needed) – you can uncomment */}
      {goals.length > 0 && (
        <Card>
          <CardHeader><CardTitle>My Goals for this Cycle</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {goals.map(goal => (
                <div key={goal.id} className="flex justify-between items-center p-2 border-b">
                  <span>{goal.title}</span>
                  <Badge variant="outline">{goal.progress}% complete</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit Button */}
      {!submitted ? (
        <Button onClick={submitReview} disabled={loading} className="w-full sm:w-auto">
          {loading ? 'Submitting...' : 'Submit Self‑Review'}
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-700">Self‑review Submitted</Badge>
          <p className="text-sm text-gray-500">Thank you for your submission.</p>
        </div>
      )}
    </div>
  );
};

export default EmployeeReview;