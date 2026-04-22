import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { database } from '../../firebase';
import { ref, get } from 'firebase/database';

// ========== TYPES ==========
interface PerformanceCycle {
  id: string;
  name: string;
}

interface ReviewData {
  finalScore?: number | string;
  employeeId?: string;
  reviewerId?: string;
  comments?: string;
  [key: string]: unknown;
}

interface AnalyticsData {
  avgScore: number;
  total: number;
}

// Helper to convert unknown to number
const toNumber = (value: unknown, defaultValue = 0): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
};

const PerformanceAnalytics: React.FC = () => {
  const [cycles, setCycles] = useState<PerformanceCycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<string>('');
  const [data, setData] = useState<AnalyticsData | null>(null);

  // Fetch performance cycles
  useEffect(() => {
    const fetchCycles = async () => {
      const snap = await get(ref(database, 'performanceCycles'));
      const val = snap.val() as Record<string, { name: string }> | null;
      if (val) {
        const list: PerformanceCycle[] = Object.entries(val).map(([id, cycle]) => ({
          id,
          name: cycle.name,
        }));
        setCycles(list);
        if (list.length) setSelectedCycle(list[0].id);
      }
    };
    fetchCycles();
  }, []);

  // Fetch review data for selected cycle
  useEffect(() => {
    if (!selectedCycle) return;
    const fetchData = async () => {
      const reviewsSnap = await get(ref(database, `reviews/${selectedCycle}`));
      const reviews = reviewsSnap.val() as Record<string, ReviewData> | null;
      if (!reviews) {
        setData(null);
        return;
      }

      const reviewList = Object.values(reviews);
      const totalReviews = reviewList.length;

      // Calculate average final score
      let sumScores = 0;
      for (const review of reviewList) {
        const score = toNumber(review.finalScore);
        sumScores += score;
      }
      const avgScore = totalReviews > 0 ? sumScores / totalReviews : 0;

      setData({
        avgScore: avgScore,
        total: totalReviews,
      });
    };
    fetchData();
  }, [selectedCycle]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Performance Analytics</h1>
        <Select value={selectedCycle} onValueChange={setSelectedCycle}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Select cycle" /></SelectTrigger>
          <SelectContent>
            {cycles.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Overall Average Score</CardTitle></CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{data?.avgScore.toFixed(1) ?? '0.0'}</p>
            <p className="text-gray-500">out of 100</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Reviews Completed</CardTitle></CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{data?.total ?? 0}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PerformanceAnalytics;