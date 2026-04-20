import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { database } from '../../firebase';
import { ref, get } from 'firebase/database';

const PerformanceAnalytics: React.FC = () => {
  const [cycles, setCycles] = useState<{ id: string; name: string }[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<string>('');
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchCycles = async () => {
      const snap = await get(ref(database, 'performanceCycles'));
      if (snap.val()) {
        const list = Object.entries(snap.val()).map(([id, val]: [string, any]) => ({ id, name: val.name }));
        setCycles(list);
        if (list.length) setSelectedCycle(list[0].id);
      }
    };
    fetchCycles();
  }, []);

  useEffect(() => {
    if (!selectedCycle) return;
    const fetchData = async () => {
      const reviewsSnap = await get(ref(database, `reviews/${selectedCycle}`));
      const reviews = reviewsSnap.val();
      if (!reviews) return;
      const departmentScores: Record<string, number[]> = {};
      const trendData: { name: string; score: number }[] = [];
      Object.values(reviews).forEach((review: any, idx) => {
        // In real implementation, you'd need employee department mapping
        // Simplified: assume employee object has department
      });
      const avgScore = Object.values(reviews).reduce((sum: number, r: any) => sum + (r.finalScore || 0), 0) / Object.keys(reviews).length;
      setData({ avgScore: avgScore.toFixed(1), total: Object.keys(reviews).length });
    };
    fetchData();
  }, [selectedCycle]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Performance Analytics</h1>
        <Select value={selectedCycle} onValueChange={setSelectedCycle}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {cycles.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Overall Average Score</CardTitle></CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{data?.avgScore || 0}</p>
            <p className="text-gray-500">out of 100</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Reviews Completed</CardTitle></CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{data?.total || 0}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PerformanceAnalytics;