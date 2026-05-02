import { useState, useEffect } from 'react';
import { ref, onValue, off, DataSnapshot } from 'firebase/database';
import { database } from '../firebase';
import { Client, RawClient } from '@/types/finance';

const toNumber = (val: unknown, def = 0): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? def : parsed;
  }
  return def;
};

const toString = (val: unknown, def = ''): string => {
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return val.toString();
  return def;
};

export const useClients = (user: unknown) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot: DataSnapshot) => {
      const all: Client[] = [];
      snapshot.forEach((adminSnap) => {
        const adminId = adminSnap.key;
        const clientsData = adminSnap.child('clients').val() as Record<string, RawClient> | null;
        if (clientsData) {
          Object.entries(clientsData).forEach(([key, value]) => {
            all.push({
              id: key,
              name: toString(value.name),
              contact: toString(value.contact),
              email: toString(value.email),
              address: toString(value.address),
              packageAmount: toNumber(value.packageAmount),
              packageType: toString(value.packageType, 'monthly'),
              startDate: toString(value.startDate),
              description: toString(value.description),
              createdAt: toString(value.createdAt),
              createdBy: toString(value.createdBy),
              status: toString(value.status, 'active'),
              lastPaymentDate: toString(value.lastPaymentDate),
              lastPaymentAmount: toNumber(value.lastPaymentAmount),
              adminId: adminId || '',
            });
          });
        }
      });
      setClients(all);
      setLoading(false);
    }, (error) => {
      console.error('useClients error:', error);
      setLoading(false);
    });
    return () => off(usersRef);
  }, [user]);

  return { clients, loading };
};