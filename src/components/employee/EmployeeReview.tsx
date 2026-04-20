import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Star } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, onValue, off, set, get } from 'firebase/database';
import { toast } from 'react-hot-toast';

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
      const data = snapshot.val();
      if (data) {
        const active = Object.entries(data)
          .map(([id, val]: [string, any]) => ({ id, ...val }))
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
    if (!selectedCycle) return;
    const templateRef = ref(database, `reviewTemplates/${selectedCycle.id}`);
    const goalsRef = ref(database, `employeeGoals/${selectedCycle.id}/${user?.id}`);
    Promise.all([get(templateRef), get(goalsRef)]).then(([templateSnap, goalsSnap]) => {
      const template = templateSnap.val();
      if (template) {
        setCompetencies(template.competencies || []);
        setOpenQuestions(template.openQuestions || []);
      }
      const goalsData = goalsSnap.val();
      if (goalsData) setGoals(Object.values(goalsData));
      else setGoals([]);
    });
  }, [selectedCycle, user?.id]);

  // Load existing self review
  useEffect(() => {
    if (!selectedCycle || !user?.id) return;
    const reviewRef = ref(database, `reviews/${selectedCycle.id}/${user.id}/self`);
    onValue(reviewRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.ratings) {
        setRatings(data.ratings);
        setAnswers(data.answers || {});
        setSubmitted(true);
      }
    });
  }, [selectedCycle, user?.id]);

  const handleRating = (compName: string, rating: number) => {
    setRatings(prev => ({ ...prev, [compName]: rating }));
  };

  const handleAnswer = (question: string, value: string) => {
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
      toast.error('Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (cycles.length === 0) return <div className="text-center p-8">No active review cycles.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Performance Review – {selectedCycle?.name}</h1>
        <p className="text-gray-500">Rate yourself on competencies and answer open questions.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Competency Ratings</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {competencies.map(comp => (
              <div key={comp.name} className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{comp.name}</span>
                  <span className="text-sm text-gray-500 ml-2">(Weight: {comp.weight}%)</span>
                </div>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRating(comp.name, star)}
                      disabled={submitted}
                      className={`text-2xl ${ratings[comp.name] >= star ? 'text-yellow-500' : 'text-gray-300'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Open Questions</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {openQuestions.map((q, idx) => (
            <div key={idx}>
              <Label>{q}</Label>
              <Textarea
                rows={3}
                value={answers[q] || ''}
                onChange={e => handleAnswer(q, e.target.value)}
                disabled={submitted}
                placeholder="Your answer..."
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {!submitted && (
        <Button onClick={submitReview} disabled={loading}>Submit Self‑Review</Button>
      )}
      {submitted && <Badge className="bg-green-100 text-green-700">Submitted</Badge>}
    </div>
  );
};

export default EmployeeReview;