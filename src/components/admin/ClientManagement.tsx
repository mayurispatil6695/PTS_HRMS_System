import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { Button } from '../ui/button';
import AddClientDialog from './AddClientDialog';
import ClientList from './ClientList';
import ClientDetailsDialog from './ClientDetailsDialog';
import { Client } from './ClientList';

const ClientManagement = () => {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const refresh = () => {
    // Refresh list – the list component will re-fetch automatically
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Management</h1>
          <p className="text-gray-600">Manage your company's clients</p>
        </div>
        <div className="flex gap-3">
          <AddClientDialog onSuccess={refresh} />
        </div>
      </motion.div>
      <ClientList onViewClient={setSelectedClient} />
      <ClientDetailsDialog client={selectedClient} onClose={() => setSelectedClient(null)} />
    </div>
  );
};

export default ClientManagement;