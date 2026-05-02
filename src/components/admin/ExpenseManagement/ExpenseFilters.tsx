// src/components/admin/ExpenseManagement/ExpenseFilters.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Filter, Download } from 'lucide-react';
import { Input } from '../../ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../ui/select';
import { Button } from '../../ui/button';
import { expenseCategories, departments, timeRanges } from '../../../constants/financeConstants';

interface Props {
  timeRange: string;
  setTimeRange: (val: string) => void;
  department: string;
  setDepartment: (val: string) => void;
  category: string;
  setCategory: (val: string) => void;
  search: string;
  setSearch: (val: string) => void;
  onExport: () => void;
}

export const ExpenseFilters: React.FC<Props> = ({
  timeRange, setTimeRange,
  department, setDepartment,
  category, setCategory,
  search, setSearch,
  onExport
}) => {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Filter className="h-4 w-4" /> Filters</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 flex-1">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger><SelectValue placeholder="Time Range" /></SelectTrigger>
              <SelectContent>
                {timeRanges.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {expenseCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Search expenses..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button onClick={onExport}><Download className="h-4 w-4 mr-2" /> Export</Button>
        </div>
      </CardContent>
    </Card>
  );
};