import { useState, useEffect } from 'react';
import { ref, onValue, off, DataSnapshot } from 'firebase/database';
import { database } from '../firebase';
import { ClientPayment, RawClientPayment } from '@/types/finance';

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

export const useClientPayments = (user: unknown) => {
  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot: DataSnapshot) => {
      const all: ClientPayment[] = [];
      snapshot.forEach((adminSnap) => {
        const adminId = adminSnap.key;
        const paymentsData = adminSnap.child('clientPayments').val() as Record<string, RawClientPayment> | null;
        if (paymentsData) {
          Object.entries(paymentsData).forEach(([key, value]) => {
            all.push({
              id: key,
              clientId: toString(value.clientId),
              clientName: toString(value.clientName),
              amount: toNumber(value.amount),
              date: toString(value.date),
              paymentMethod: toString(value.paymentMethod, 'Bank Transfer'),
              reference: toString(value.reference),
              description: toString(value.description),
              createdAt: toString(value.createdAt),
              createdBy: toString(value.createdBy),
              adminId: adminId || '',
            });
          });
        }
      });
      setPayments(all);
      setLoading(false);
    }, (error) => {
      console.error('useClientPayments error:', error);
      setLoading(false);
    });
    return () => off(usersRef);
  }, [user]);

  return { payments, loading };
};