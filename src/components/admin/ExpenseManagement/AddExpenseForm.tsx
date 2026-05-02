// src/components/admin/ExpenseManagement/AddExpenseForm.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../ui/select';
import { Button } from '../../ui/button';
import { toast } from '../../ui/use-toast';
import { ref, push, set } from 'firebase/database';
import { database } from '../../../firebase';
import { useAuth } from '../../../hooks/useAuth';
import { expenseCategories, departments, paymentMethods } from '../../../constants/financeConstants';
import { format } from 'date-fns';

interface Props {
  onClose: () => void;
}

export const AddExpenseForm: React.FC<Props> = ({ onClose }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '', amount: '', paidTo: '', department: '', category: '',
    paymentMethod: '', description: '', date: format(new Date(), 'yyyy-MM-dd')
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const newExpense = {
        title: formData.title,
        amount: parseFloat(formData.amount),
        paidTo: formData.paidTo,
        department: formData.department,
        category: formData.category,
        paymentMethod: formData.paymentMethod,
        description: formData.description,
        date: formData.date,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        type: 'office'
      };
      const newRef = push(ref(database, `users/${user.id}/expenses`));
      await set(newRef, newExpense);
      toast({ title: "Expense Added", description: "Expense recorded successfully" });
      onClose();
    } catch (error) {
      toast({ title: "Error", description: "Failed to add expense", variant: "destructive" });
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader><CardTitle>Add New Expense</CardTitle><CardDescription>Record your company expenses</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input placeholder="Expense Title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
            <Input placeholder="Amount (₹)" type="number" step="0.01" min="0" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input placeholder="Paid To" value={formData.paidTo} onChange={e => setFormData({...formData, paidTo: e.target.value})} required />
            <Select value={formData.department} onValueChange={v => setFormData({...formData, department: v})} required>
              <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})} required>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>{expenseCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={formData.paymentMethod} onValueChange={v => setFormData({...formData, paymentMethod: v})} required>
              <SelectTrigger><SelectValue placeholder="Payment Method" /></SelectTrigger>
              <SelectContent>{paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
          <Textarea placeholder="Description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          <div className="flex gap-2"><Button type="submit">Add Expense</Button><Button type="button" variant="outline" onClick={onClose}>Cancel</Button></div>
        </form>
      </CardContent>
    </Card>
  );
};