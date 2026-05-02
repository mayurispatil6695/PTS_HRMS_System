// src/components/admin/ExpenseManagement/ClientPaymentForm.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../ui/select';
import { Button } from '../../ui/button';
import { toast } from '../../ui/use-toast';
import { ref, push, set, update } from 'firebase/database';
import { database } from '../../../firebase';
import { useAuth } from '../../../hooks/useAuth';
import { Client, ClientPayment } from '@/types/finance';
import { paymentMethods } from '../../../constants/financeConstants';
import { format } from 'date-fns';
import { getClientPendingAmount } from '../../../utils/financeHelpers';

interface Props {
  client: Client;
  payments: ClientPayment[];
  onSuccess: () => void;
  onCancel: () => void;
}

export const ClientPaymentForm: React.FC<Props> = ({ client, payments, onSuccess, onCancel }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    amount: '', date: format(new Date(), 'yyyy-MM-dd'), paymentMethod: 'Bank Transfer', reference: '', description: ''
  });
  const pending = getClientPendingAmount(client, payments);
  const maxAmount = pending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amountNum = parseFloat(formData.amount);
    if (amountNum > maxAmount) {
      toast({ title: "Invalid Amount", description: `Cannot exceed pending amount ${pending}`, variant: "destructive" });
      return;
    }
    try {
      const targetAdmin = client.adminId || user.id;
      const newPayment = {
        clientId: client.id,
        clientName: client.name,
        amount: amountNum,
        date: formData.date,
        paymentMethod: formData.paymentMethod,
        reference: formData.reference,
        description: formData.description,
        createdAt: new Date().toISOString(),
        createdBy: user.id
      };
      const newRef = push(ref(database, `users/${targetAdmin}/clientPayments`));
      await set(newRef, newPayment);
      // update client's last payment info
      await update(ref(database, `users/${targetAdmin}/clients/${client.id}`), {
        lastPaymentDate: formData.date,
        lastPaymentAmount: amountNum
      });
      toast({ title: "Payment Recorded", description: "Client payment added successfully" });
      onSuccess();
    } catch (error) {
      toast({ title: "Error", description: "Failed to record payment", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Record Payment for {client.name}</CardTitle><CardDescription>Package: {client.packageAmount} | Paid: {client.packageAmount - pending} | Pending: {pending}</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input placeholder="Amount (₹)" type="number" step="0.01" min="0" max={maxAmount} value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required />
            <Select value={formData.paymentMethod} onValueChange={v => setFormData({...formData, paymentMethod: v})} required>
              <SelectTrigger><SelectValue placeholder="Payment Method" /></SelectTrigger>
              <SelectContent>{paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
            <Input placeholder="Reference/Transaction ID" value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} />
          </div>
          <Textarea placeholder="Description / Notes" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          <div className="flex gap-2"><Button type="submit">Record Payment</Button><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button></div>
        </form>
      </CardContent>
    </Card>
  );
};