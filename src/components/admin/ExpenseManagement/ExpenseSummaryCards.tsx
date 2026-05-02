// src/components/admin/ExpenseManagement/ExpenseSummaryCards.tsx
import React from 'react';
import { Card, CardContent } from '../../ui/card';
import { Receipt, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { Expense } from '@/types/finance';
import { formatCurrency, getTotalExpenses } from '../../../utils/financeHelpers';

interface Props {
  expenses: Expense[];
}

export const ExpenseSummaryCards: React.FC<Props> = ({ expenses }) => {
  const total = getTotalExpenses(expenses);
  const thisMonth = expenses.filter(e => {
    const d = new Date(e.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((sum, e) => sum + e.amount, 0);

  const highestCategory = expenses.reduce((max, e) => {
    const catTotal = expenses.filter(x => x.category === e.category).reduce((s, x) => s + x.amount, 0);
    return catTotal > max.amount ? { name: e.category, amount: catTotal } : max;
  }, { name: '', amount: 0 });

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-xs text-gray-600">Total Expenses</p>
              <p className="text-base font-bold">{formatCurrency(total)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-xs text-gray-600">This Month</p>
              <p className="text-base font-bold">{formatCurrency(thisMonth)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <div>
              <p className="text-xs text-gray-600">Top Category</p>
              <p className="text-base font-bold truncate">{highestCategory.name || 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-purple-600" />
            <div>
              <p className="text-xs text-gray-600">Transactions</p>
              <p className="text-base font-bold">{expenses.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};