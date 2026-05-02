import { useState, useEffect } from 'react';
import { ref, onValue, off, DataSnapshot } from 'firebase/database';
import { database } from '../firebase';
import { Expense, RawExpense } from '@/types/finance';

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

export const useExpenses = (user: unknown) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot: DataSnapshot) => {
      const all: Expense[] = [];
      snapshot.forEach((adminSnap) => {
        const adminId = adminSnap.key;
        const expensesData = adminSnap.child('expenses').val() as Record<string, RawExpense> | null;
        if (expensesData) {
          Object.entries(expensesData).forEach(([key, value]) => {
            all.push({
              id: key,
              title: toString(value.title),
              amount: toNumber(value.amount),
              paidTo: toString(value.paidTo),
              department: toString(value.department),
              category: toString(value.category),
              paymentMethod: toString(value.paymentMethod),
              description: toString(value.description),
              date: toString(value.date),
              createdAt: toString(value.createdAt),
              createdBy: toString(value.createdBy),
              type: toString(value.type, 'office'),
              adminId: adminId || '',
            });
          });
        }
      });
      setExpenses(all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setLoading(false);
    }, (error) => {
      console.error('useExpenses error:', error);
      setLoading(false);
    });
    return () => off(usersRef);
  }, [user]);

  return { expenses, loading };
};