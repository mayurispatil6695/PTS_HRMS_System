// src/components/admin/ExpenseManagement/ExpenseAnalysis.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Progress } from '../../ui/progress';
import { PieChart } from 'lucide-react';
import { Expense } from '@/types/finance';
import { formatCurrency, getTotalExpenses, getCategoryTotal } from '../../../utils/financeHelpers';
import { expenseCategories } from '../../../constants/financeConstants';

interface Props {
  expenses: Expense[];
}

export const ExpenseAnalysis: React.FC<Props> = ({ expenses }) => {
  const total = getTotalExpenses(expenses);
  if (total === 0) return null;

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><PieChart className="h-4 w-4" /> Expense Analysis</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {expenseCategories.map(cat => {
          const amount = getCategoryTotal(cat.value, expenses);
          if (amount === 0) return null;
          const percentage = (amount / total) * 100;
          return (
            <div key={cat.value} className="space-y-1">
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-2"><cat.icon className="h-4 w-4" /> {cat.label}</div>
                <span className="font-medium">{formatCurrency(amount)} ({percentage.toFixed(1)}%)</span>
              </div>
              <Progress value={percentage} className="h-2" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};