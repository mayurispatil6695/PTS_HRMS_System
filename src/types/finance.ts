// src/types/finance.ts
export interface Expense {
  id: string;
  title: string;
  amount: number;
  paidTo: string;
  department: string;
  category: string;
  paymentMethod: string;
  description: string;
  date: string;
  createdAt: string;
  createdBy: string;
  type: string;
  adminId?: string;
}

export interface Client {
  id: string;
  name: string;
  contact: string;
  email: string;
  address: string;
  packageAmount: number;
  packageType: string;
  startDate: string;
  description: string;
  createdAt: string;
  createdBy: string;
  status: string;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  adminId?: string;
}

export interface ClientPayment {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  date: string;
  paymentMethod: string;
  reference: string;
  description: string;
  createdAt: string;
  createdBy: string;
  adminId?: string;
}

// Raw Firebase shapes (used in hooks)
export interface RawExpense {
  title?: string;
  amount?: number | string;
  paidTo?: string;
  department?: string;
  category?: string;
  paymentMethod?: string;
  description?: string;
  date?: string;
  createdAt?: string;
  createdBy?: string;
  type?: string;
}

export interface RawClient {
  name?: string;
  contact?: string;
  email?: string;
  address?: string;
  packageAmount?: number | string;
  packageType?: string;
  startDate?: string;
  description?: string;
  createdAt?: string;
  createdBy?: string;
  status?: string;
  lastPaymentDate?: string;
  lastPaymentAmount?: number | string;
}

export interface RawClientPayment {
  clientId?: string;
  clientName?: string;
  amount?: number | string;
  date?: string;
  paymentMethod?: string;
  reference?: string;
  description?: string;
  createdAt?: string;
  createdBy?: string;
}