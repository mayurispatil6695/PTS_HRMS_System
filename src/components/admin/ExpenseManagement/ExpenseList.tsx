// src/components/admin/ExpenseManagement/ExpenseList.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../ui/table';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Trash2 } from 'lucide-react';
import { Expense } from '@/types/finance';
import { formatCurrency, formatDate } from '../../../utils/financeHelpers';
import { expenseCategories } from '../../../constants/financeConstants';

interface Props {
  expenses: Expense[];
  onDelete: (id: string, adminId?: string) => void;
}

export const ExpenseList: React.FC<Props> = ({ expenses, onDelete }) => {
  const getCategoryLabel = (value: string) => {
    const cat = expenseCategories.find(c => c.value === value);
    return cat?.label || value;
  };

  return (
    <Card>
      <CardHeader><CardTitle>Expenses ({expenses.length})</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="hidden sm:table-cell">Dept</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map(exp => (
                <TableRow key={exp.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(exp.date)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{exp.title}</div>
                    <div className="text-xs text-gray-500">{exp.paidTo}</div>
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(exp.amount)}</TableCell>
                  <TableCell><Badge variant="outline">{getCategoryLabel(exp.category)}</Badge></TableCell>
                  <TableCell className="hidden sm:table-cell"><Badge variant="secondary">{exp.department}</Badge></TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(exp.id, exp.adminId)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {expenses.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No expenses found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};