import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Plus, Building, Mail, Phone, User, MapPin } from 'lucide-react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { ref, set } from 'firebase/database';
import { toast } from 'sonner';

interface AddClientDialogProps {
  onSuccess?: () => void;
}

const AddClientDialog: React.FC<AddClientDialogProps> = ({ onSuccess }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    companyName: '',
    address: '',
    password: '',
  });

  const handleSubmit = async () => {
    if (!user || user.role !== 'admin') {
      setError('Only admins can add clients');
      return;
    }

    const missing = [];
    if (!formData.name) missing.push('Name');
    if (!formData.email) missing.push('Email');
    if (!formData.phone) missing.push('Phone');
    if (!formData.companyName) missing.push('Company Name');
    if (!formData.password) missing.push('Password');

    if (missing.length > 0) {
      setError(`Please fill: ${missing.join(', ')}`);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const adminEmail = auth.currentUser?.email;
      const adminPassword = prompt('Please re-enter Admin password to create client:');
      if (!adminPassword) {
        setError('Admin password required');
        setLoading(false);
        return;
      }

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const clientUid = userCredential.user.uid;

      // Re-login as admin
      await signInWithEmailAndPassword(auth, adminEmail!, adminPassword);

      const clientData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        companyName: formData.companyName,
        address: formData.address,
        role: 'client',
        createdAt: new Date().toISOString(),
        addedBy: user.id,
        status: 'active',
      };

      // Store under admin's clients node
      await set(ref(database, `users/${user.id}/clients/${clientUid}`), clientData);
      // Store client's own profile
      await set(ref(database, `users/${clientUid}/profile`), { ...clientData, adminUid: user.id });

      toast.success('Client created successfully');
      setOpen(false);
      setFormData({ name: '', email: '', phone: '', companyName: '', address: '', password: '' });
      onSuccess?.();
    } catch (err: unknown) {
      console.error(err);
      let errorMessage = 'Failed to create client';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Client
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error && <div className="p-2 bg-red-100 text-red-700 rounded text-sm">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="John Doe"
                  className="pl-9"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  type="email"
                  placeholder="client@example.com"
                  className="pl-9"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="+1 234 567 8900"
                  className="pl-9"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <div className="relative">
                <Building className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="ABC Corp"
                  className="pl-9"
                  value={formData.companyName}
                  onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                />
              </div>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Textarea
                  placeholder="Full address"
                  className="pl-9"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Password *</Label>
              <Input
                type="password"
                placeholder="At least 6 characters"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Creating...' : 'Create Client'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddClientDialog;