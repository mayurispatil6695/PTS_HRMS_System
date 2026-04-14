// src/components/admin/ClientList.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Eye, Trash2, Mail, Phone, Building } from 'lucide-react';
import { ref, onValue, off, remove } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import ClientDetailsDialog from './ClientDetailsDialog';
import ClientFilters from './ClientFilters';

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  address?: string;
  createdAt: string;
  addedBy?: string;
  status?: string;
}

interface ClientListProps {
  onViewClient: (client: Client) => void;
}

const ClientList: React.FC<ClientListProps> = ({ onViewClient }) => {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    const clientsRef = ref(database, `users/${user.id}/clients`);
    setLoading(true);

    const unsubscribe = onValue(
      clientsRef,
      (snapshot) => {
        const clientsData: Client[] = [];
        snapshot.forEach((childSnap) => {
          const clientData = childSnap.val();
          clientsData.push({
            id: childSnap.key || '',
            name: clientData.name || '',
            email: clientData.email || '',
            phone: clientData.phone || '',
            companyName: clientData.companyName || '',
            address: clientData.address || '',
            createdAt: clientData.createdAt || new Date().toISOString(),
            addedBy: clientData.addedBy,
            status: clientData.status || 'active',
          });
        });
        setClients(clientsData);
        setFilteredClients(clientsData);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError('Failed to load clients');
        setLoading(false);
      }
    );
    return () => off(clientsRef);
  }, [user]);

  useEffect(() => {
    let result = [...clients];
    if (searchTerm) {
      result = result.filter(
        c =>
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.companyName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredClients(result);
  }, [searchTerm, clients]);

  const handleDeleteClient = async (clientId: string) => {
    if (!user || !window.confirm('Delete this client? This action cannot be undone.')) return;
    try {
      const clientRef = ref(database, `users/${user.id}/clients/${clientId}`);
      await remove(clientRef);
      // Also remove the client's profile node
      const profileRef = ref(database, `users/${clientId}/profile`);
      await remove(profileRef);
      toast({
        title: "Success",
        description: "Client deleted successfully",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to delete client",
        variant: "destructive",
      });
    }
  };

  if (loading) return <div>Loading clients...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="space-y-4">
      <ClientFilters searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
      <Card>
        <CardHeader>
          <CardTitle>Clients ({filteredClients.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredClients.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No clients found</div>
          ) : (
            <div className="space-y-4">
              {filteredClients.map((client, idx) => (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarFallback className="bg-indigo-100 text-indigo-700">
                        {client.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{client.name}</div>
                      <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {client.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {client.phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3" /> {client.companyName}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onViewClient(client)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteClient(client.id)} className="text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientList;