// src/components/admin/ExpenseManagement/AddClientForm.tsx
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
import { packageTypes } from '../../../constants/financeConstants';
import { format } from 'date-fns';

interface Props {
  onClose: () => void;
}

export const AddClientForm: React.FC<Props> = ({ onClose }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '', contact: '', email: '', address: '', packageAmount: '',
    packageType: 'monthly', startDate: format(new Date(), 'yyyy-MM-dd'), description: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const newClient = {
        name: formData.name,
        contact: formData.contact,
        email: formData.email,
        address: formData.address,
        packageAmount: parseFloat(formData.packageAmount),
        packageType: formData.packageType,
        startDate: formData.startDate,
        description: formData.description,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        status: 'active'
      };
      const newRef = push(ref(database, `users/${user.id}/clients`));
      await set(newRef, newClient);
      toast({ title: "Client Added", description: "Client registered successfully" });
      onClose();
    } catch (error) {
      toast({ title: "Error", description: "Failed to add client", variant: "destructive" });
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader><CardTitle>Add New Client</CardTitle><CardDescription>Register a new client and package details</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input placeholder="Client Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
            <Input placeholder="Contact Number" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input placeholder="Email Address" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            <Input placeholder="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input placeholder="Package Amount (₹)" type="number" step="0.01" min="0" value={formData.packageAmount} onChange={e => setFormData({...formData, packageAmount: e.target.value})} required />
            <Select value={formData.packageType} onValueChange={v => setFormData({...formData, packageType: v})} required>
              <SelectTrigger><SelectValue placeholder="Package Type" /></SelectTrigger>
              <SelectContent>{packageTypes.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} required />
          <Textarea placeholder="Description / Services Included" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          <div className="flex gap-2"><Button type="submit">Add Client</Button><Button type="button" variant="outline" onClick={onClose}>Cancel</Button></div>
        </form>
      </CardContent>
    </Card>
  );
};