// src/utils/financeHelpers.ts
import { Expense, Client, ClientPayment } from '@/types/finance';

export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

export const formatDate = (dateStr: string): string => {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

export const getTotalExpenses = (expenses: Expense[]): number =>
  expenses.reduce((sum, e) => sum + e.amount, 0);

export const getCategoryTotal = (category: string, expenses: Expense[]): number =>
  expenses.filter(e => e.category === category).reduce((sum, e) => sum + e.amount, 0);

export const getClientTotalPayments = (clientId: string, payments: ClientPayment[]): number =>
  payments.filter(p => p.clientId === clientId).reduce((sum, p) => sum + p.amount, 0);

export const getClientPendingAmount = (client: Client, payments: ClientPayment[]): number =>
  client.packageAmount - getClientTotalPayments(client.id, payments);