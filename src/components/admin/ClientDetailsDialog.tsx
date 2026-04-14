import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Mail, Phone, Building, MapPin, Calendar } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  address?: string;
  createdAt: string;
  status?: string;
}

interface ClientDetailsDialogProps {
  client: Client | null;
  onClose: () => void;
}

const ClientDetailsDialog: React.FC<ClientDetailsDialogProps> = ({ client, onClose }) => {
  if (!client) return null;

  return (
    <Dialog open={!!client} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Client Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xl">
                {client.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold">{client.name}</h2>
              <Badge variant="outline">Client</Badge>
            </div>
          </div>
          <div className="grid gap-3">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-500" />
              <span>{client.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-500" />
              <span>{client.phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-gray-500" />
              <span>{client.companyName}</span>
            </div>
            {client.address && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span>{client.address}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span>Added on: {new Date(client.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClientDetailsDialog;