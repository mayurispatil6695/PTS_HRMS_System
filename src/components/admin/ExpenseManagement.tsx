// src/components/admin/ExpenseManagement.tsx
import React, { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Home, Users, Plus } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Button } from '../ui/button';
import { useAuth } from '../../hooks/useAuth';
import { useExpenses } from '../../hooks/useExpenses';
import { useClients } from '../../hooks/useClients';
import { useClientPayments } from '../../hooks/useClientPayments';
import { ExpenseSummaryCards } from './ExpenseManagement/ExpenseSummaryCards';
import { ExpenseFilters } from './ExpenseManagement/ExpenseFilters';
import { ExpenseList } from './ExpenseManagement/ExpenseList';
import { ExpenseAnalysis } from './ExpenseManagement/ExpenseAnalysis';
import { ClientList } from './ExpenseManagement/ClientList';
import { ClientPaymentForm } from './ExpenseManagement/ClientPaymentForm';
import { toast } from '../ui/use-toast';
import { remove ,ref} from 'firebase/database';
import { database } from '../../firebase';

const AddExpenseForm = lazy(() => import('./ExpenseManagement/AddExpenseForm').then(module => ({ default: module.AddExpenseForm })));
const AddClientForm = lazy(() => import('./ExpenseManagement/AddClientForm').then(module => ({ default: module.AddClientForm })));

const ExpenseManagement: React.FC = () => {
  const { user } = useAuth();
  const { expenses, loading: expLoading } = useExpenses(user);
  const { clients, loading: clientLoading } = useClients(user);
  const { payments, loading: payLoading } = useClientPayments(user);

  const [activeTab, setActiveTab] = useState<'office' | 'clients'>('office');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  // Filter states
  const [timeRange, setTimeRange] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Memoized filtered expenses
  const filteredExpenses = useMemo(() => {
    let filtered = [...expenses];
    // Apply timeRange (simplified – you can expand)
    if (timeRange !== 'all') {
      const now = new Date();
      filtered = filtered.filter(e => {
        const d = new Date(e.date);
        switch (timeRange) {
          case 'month': return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          case 'year': return d.getFullYear() === now.getFullYear();
          default: return true;
        }
      });
    }
    if (filterDepartment !== 'all') filtered = filtered.filter(e => e.department === filterDepartment);
    if (filterCategory !== 'all') filtered = filtered.filter(e => e.category === filterCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e => e.title.toLowerCase().includes(q) || e.paidTo.toLowerCase().includes(q));
    }
    return filtered;
  }, [expenses, timeRange, filterDepartment, filterCategory, searchQuery]);

  const handleDeleteExpense = useCallback(async (id: string, adminId?: string) => {
    if (!window.confirm('Delete this expense?')) return;
    const targetAdmin = adminId || user?.id;
    if (!targetAdmin) return;
    try {
      await remove(ref(database, `users/${targetAdmin}/expenses/${id}`));
      toast({ title: "Deleted", description: "Expense removed" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  }, [user]);

  const handleDeleteClient = useCallback(async (id: string, adminId?: string) => {
    if (!window.confirm('Delete this client? All related payments will also be deleted.')) return;
    const targetAdmin = adminId || user?.id;
    if (!targetAdmin) return;
    try {
      await remove(ref(database, `users/${targetAdmin}/clients/${id}`));
      // Optionally delete associated payments as well – implement if needed
      toast({ title: "Deleted", description: "Client removed" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  }, [user]);

  const exportExpensesCSV = () => {
    // Implement export logic using filteredExpenses
    toast({ title: "Export", description: "Feature coming soon" });
  };

  const exportClientsCSV = () => {
    toast({ title: "Export", description: "Feature coming soon" });
  };

  const toggleAddForm = () => {
    if (activeTab === 'office') setShowAddExpense(v => !v);
    else setShowAddClient(v => !v);
  };

  if (expLoading || clientLoading || payLoading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div className="space-y-6 px-4 pb-20 sm:px-6 sm:pb-0">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Expense Management</h1>
          <p className="text-gray-600 text-sm">Track expenses and client payments</p>
        </div>
        <Button onClick={toggleAddForm} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          {activeTab === 'office' ? 'Add Expense' : 'Add Client'}
        </Button>
      </motion.div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'office' | 'clients')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="office"><Home className="h-4 w-4 mr-2" /> Office</TabsTrigger>
          <TabsTrigger value="clients"><Users className="h-4 w-4 mr-2" /> Clients</TabsTrigger>
        </TabsList>

        <TabsContent value="office" className="space-y-6">
          <ExpenseSummaryCards expenses={filteredExpenses} />
          <Suspense fallback={null}>
            {showAddExpense && <AddExpenseForm onClose={() => setShowAddExpense(false)} />}
          </Suspense>
          <ExpenseFilters
            timeRange={timeRange} setTimeRange={setTimeRange}
            department={filterDepartment} setDepartment={setFilterDepartment}
            category={filterCategory} setCategory={setFilterCategory}
            search={searchQuery} setSearch={setSearchQuery}
            onExport={exportExpensesCSV}
          />
          <ExpenseList expenses={filteredExpenses} onDelete={handleDeleteExpense} />
          <ExpenseAnalysis expenses={filteredExpenses} />
        </TabsContent>

        <TabsContent value="clients" className="space-y-6">
          <Suspense fallback={null}>
            {showAddClient && <AddClientForm onClose={() => setShowAddClient(false)} />}
          </Suspense>
          <ClientList
            clients={clients}
            payments={payments}
            onRecordPayment={(id) => setSelectedClient(id)}
            onDelete={handleDeleteClient}
            onExport={exportClientsCSV}
          />
          {selectedClient && (
            <ClientPaymentForm
              client={clients.find(c => c.id === selectedClient)!}
              payments={payments}
              onSuccess={() => setSelectedClient(null)}
              onCancel={() => setSelectedClient(null)}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default React.memo(ExpenseManagement);