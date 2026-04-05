import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Receipt, Plus, Filter, Download, Trash2, FileText, Users, 
  Home, Zap, Utensils, User, Heart, PenTool, Wrench, 
  Droplet, Printer, Palette, Truck, Mail, Tag, CircleDollarSign,
  Calendar, Clock, AlertCircle, CheckCircle, PieChart, BarChart2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';
import { Progress } from '../ui/progress';
import { ref, onValue, push, set, remove, update, off } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { toast } from '../ui/use-toast';
import { generateInvoice } from '../../utils/invoiceGenerator';
import { format, parseISO, subMonths } from 'date-fns';

interface Expense {
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

interface Client {
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

interface ClientPayment {
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

const ExpenseManagement = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('office');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientPayments, setClientPayments] = useState<ClientPayment[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [timeRange, setTimeRange] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    paidTo: '',
    department: '',
    category: '',
    paymentMethod: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });
  const [clientForm, setClientForm] = useState({
    name: '',
    contact: '',
    email: '',
    address: '',
    packageAmount: '',
    packageType: 'monthly',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    description: ''
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    paymentMethod: 'Bank Transfer',
    reference: '',
    description: ''
  });

  // Expense categories with icons
  const expenseCategories = [
    { value: 'office-rent', label: 'Office Rent', icon: <Home className="h-4 w-4 mr-2" /> },
    { value: 'electricity', label: 'Electricity Bill', icon: <Zap className="h-4 w-4 mr-2" /> },
    { value: 'lunch', label: 'Employee Lunch', icon: <Utensils className="h-4 w-4 mr-2" /> },
    { value: 'salary', label: 'Employee Salary', icon: <User className="h-4 w-4 mr-2" /> },
    { value: 'medical', label: 'Medical Expenses', icon: <Heart className="h-4 w-4 mr-2" /> },
    { value: 'stationery', label: 'Stationery', icon: <PenTool className="h-4 w-4 mr-2" /> },
    { value: 'servant', label: 'Servant Charge', icon: <User className="h-4 w-4 mr-2" /> },
    { value: 'housekeeping', label: 'Housekeeping', icon: <Wrench className="h-4 w-4 mr-2" /> },
    { value: 'equipment', label: 'Office Equipment', icon: <Wrench className="h-4 w-4 mr-2" /> },
    { value: 'water', label: 'Water Bill', icon: <Droplet className="h-4 w-4 mr-2" /> },
    { value: 'software', label: 'Software Subscription', icon: <FileText className="h-4 w-4 mr-2" /> },
    { value: 'printing', label: 'Printing & Photocopy', icon: <Printer className="h-4 w-4 mr-2" /> },
    { value: 'decor', label: 'Office Decor', icon: <Palette className="h-4 w-4 mr-2" /> },
    { value: 'travel', label: 'Local Traveling', icon: <Truck className="h-4 w-4 mr-2" /> },
    { value: 'courier', label: 'Courier', icon: <Mail className="h-4 w-4 mr-2" /> },
    { value: 'tax', label: 'Tax', icon: <CircleDollarSign className="h-4 w-4 mr-2" /> },
    { value: 'advertising', label: 'Advertising', icon: <Tag className="h-4 w-4 mr-2" /> },
    { value: 'other', label: 'Other Expenses', icon: <Receipt className="h-4 w-4 mr-2" /> }
  ];

  const departments = ['Software', 'Digital Marketing', 'Sales', 'Product Designing', 'Web Development', 'Graphic Designing', 'Office', 'HR', 'Finance'];
  const paymentMethods = ['Cash', 'Bank Transfer', 'Credit Card', 'UPI', 'Cheque', 'Online Payment'];
  const packageTypes = ['monthly', 'quarterly', 'half-yearly', 'yearly', 'custom'];
  const timeRanges = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
    { value: 'last-month', label: 'Last Month' },
    { value: 'last-quarter', label: 'Last Quarter' },
    { value: 'last-year', label: 'Last Year' }
  ];

  // Fetch ALL expenses from all admins
  useEffect(() => {
    if (!user) return;

    const usersRef = ref(database, "users");
    const allExpenses: Expense[] = [];

    const unsubscribeExpenses = onValue(usersRef, (snapshot) => {
      allExpenses.length = 0;

      if (snapshot.exists()) {
        snapshot.forEach((adminSnap) => {
          const adminId = adminSnap.key;
          const expensesData = adminSnap.child("expenses").val();

          if (expensesData && typeof expensesData === 'object') {
            Object.entries(expensesData).forEach(([key, value]) => {
              const expense = value as any;
              allExpenses.push({
                id: key,
                ...expense,
                adminId: adminId || ''
              });
            });
          }
        });
      }

      setExpenses([...allExpenses].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
      setLoading(false);
    }, (error) => {
      console.error('Error fetching expenses:', error);
      setLoading(false);
    });

    return () => {
      off(usersRef);
    };
  }, [user]);

  // Fetch ALL clients from all admins
  useEffect(() => {
    if (!user) return;

    const usersRef = ref(database, "users");
    const allClients: Client[] = [];

    const unsubscribeClients = onValue(usersRef, (snapshot) => {
      allClients.length = 0;

      if (snapshot.exists()) {
        snapshot.forEach((adminSnap) => {
          const adminId = adminSnap.key;
          const clientsData = adminSnap.child("clients").val();

          if (clientsData && typeof clientsData === 'object') {
            Object.entries(clientsData).forEach(([key, value]) => {
              const client = value as any;
              allClients.push({
                id: key,
                ...client,
                adminId: adminId || ''
              });
            });
          }
        });
      }

      setClients([...allClients]);
    }, (error) => {
      console.error('Error fetching clients:', error);
    });

    return () => {
      off(usersRef);
    };
  }, [user]);

  // Fetch ALL client payments from all admins
  useEffect(() => {
    if (!user) return;

    const usersRef = ref(database, "users");
    const allPayments: ClientPayment[] = [];

    const unsubscribePayments = onValue(usersRef, (snapshot) => {
      allPayments.length = 0;

      if (snapshot.exists()) {
        snapshot.forEach((adminSnap) => {
          const adminId = adminSnap.key;
          const paymentsData = adminSnap.child("clientPayments").val();

          if (paymentsData && typeof paymentsData === 'object') {
            Object.entries(paymentsData).forEach(([key, value]) => {
              const payment = value as any;
              allPayments.push({
                id: key,
                ...payment,
                adminId: adminId || ''
              });
            });
          }
        });
      }

      setClientPayments([...allPayments]);
    }, (error) => {
      console.error('Error fetching payments:', error);
    });

    return () => {
      off(usersRef);
    };
  }, [user]);

  // Apply filters to expenses
  useEffect(() => {
    let filtered = [...expenses];

    // Apply time range filter
    if (timeRange !== 'all') {
      const now = new Date();
      filtered = filtered.filter(expense => {
        const expenseDate = parseISO(expense.date);
        
        switch (timeRange) {
          case 'today': {
            return format(expenseDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
          }
          case 'week': {
            return expenseDate > subMonths(now, 1);
          }
          case 'month': {
            return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
          }
          case 'quarter': {
            const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
            const expenseQuarter = Math.floor(expenseDate.getMonth() / 3) + 1;
            return expenseQuarter === currentQuarter && expenseDate.getFullYear() === now.getFullYear();
          }
          case 'year': {
            return expenseDate.getFullYear() === now.getFullYear();
          }
          case 'last-month': {
            const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
            const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
            return expenseDate.getMonth() === lastMonth && expenseDate.getFullYear() === lastMonthYear;
          }
          case 'last-quarter': {
            const currentQuarter2 = Math.floor(now.getMonth() / 3) + 1;
            const lastQuarter = currentQuarter2 === 1 ? 4 : currentQuarter2 - 1;
            const lastQuarterYear = currentQuarter2 === 1 ? now.getFullYear() - 1 : now.getFullYear();
            const expenseQuarter2 = Math.floor(expenseDate.getMonth() / 3) + 1;
            return expenseQuarter2 === lastQuarter && expenseDate.getFullYear() === lastQuarterYear;
          }
          case 'last-year': {
            return expenseDate.getFullYear() === now.getFullYear() - 1;
          }
          default: {
            return true;
          }
        }
      });
    }

    // Apply department filter
    if (filterDepartment !== 'all') {
      filtered = filtered.filter(expense => expense.department === filterDepartment);
    }

    // Apply category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(expense => expense.category === filterCategory);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(expense => 
        expense.title.toLowerCase().includes(query) || 
        expense.paidTo.toLowerCase().includes(query) ||
        expense.description.toLowerCase().includes(query)
      );
    }

    setFilteredExpenses(filtered);
  }, [filterDepartment, filterCategory, timeRange, searchQuery, expenses]);

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const newExpense = {
        ...formData,
        amount: parseFloat(formData.amount),
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        type: 'office'
      };

      // Push new expense to current user's expenses
      const newExpenseRef = push(ref(database, `users/${user.id}/expenses`));
      await set(newExpenseRef, newExpense);

      toast({
        title: "Expense Added",
        description: "Expense has been successfully recorded"
      });

      setFormData({
        title: '',
        amount: '',
        paidTo: '',
        department: '',
        category: '',
        paymentMethod: '',
        description: '',
        date: format(new Date(), 'yyyy-MM-dd')
      });
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding expense:', error);
      toast({
        variant: 'destructive',
        title: "Error",
        description: "Failed to add expense"
      });
    }
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const newClient = {
        ...clientForm,
        packageAmount: parseFloat(clientForm.packageAmount),
        startDate: clientForm.startDate,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        status: 'active'
      };

      // Push new client to current user's clients
      const newClientRef = push(ref(database, `users/${user.id}/clients`));
      await set(newClientRef, newClient);

      toast({
        title: "Client Added",
        description: "Client has been successfully added"
      });

      setClientForm({
        name: '',
        contact: '',
        email: '',
        address: '',
        packageAmount: '',
        packageType: 'monthly',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        description: ''
      });
      setShowClientForm(false);
    } catch (error) {
      console.error('Error adding client:', error);
      toast({
        variant: 'destructive',
        title: "Error",
        description: "Failed to add client"
      });
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedClient) return;

    try {
      const paymentAmount = parseFloat(paymentForm.amount);
      const newPayment = {
        ...paymentForm,
        amount: paymentAmount,
        date: paymentForm.date,
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        createdAt: new Date().toISOString(),
        createdBy: user.id
      };

      // Find which admin this client belongs to
      const clientAdmin = clients.find(c => c.id === selectedClient.id)?.adminId;
      const targetAdmin = clientAdmin || user.id;

      // Push new payment to the appropriate admin's clientPayments
      const newPaymentRef = push(ref(database, `users/${targetAdmin}/clientPayments`));
      await set(newPaymentRef, newPayment);

      // Update client's last payment date
      const clientRef = ref(database, `users/${targetAdmin}/clients/${selectedClient.id}`);
      await update(clientRef, {
        lastPaymentDate: paymentForm.date,
        lastPaymentAmount: paymentAmount
      });

      toast({
        title: "Payment Recorded",
        description: "Client payment has been successfully recorded"
      });

      setPaymentForm({
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        paymentMethod: 'Bank Transfer',
        reference: '',
        description: ''
      });
      setShowPaymentForm(false);
      setSelectedClient(null);
    } catch (error) {
      console.error('Error adding payment:', error);
      toast({
        variant: 'destructive',
        title: "Error",
        description: "Failed to record payment"
      });
    }
  };

  const handleDelete = async (type: string, id: string, adminId?: string) => {
    if (!user) return;
    
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return;

    try {
      const targetAdmin = adminId || user.id;
      await remove(ref(database, `users/${targetAdmin}/${type}/${id}`));
      toast({
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Deleted`,
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} has been successfully removed`
      });
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      toast({
        variant: 'destructive',
        title: "Error",
        description: `Failed to delete ${type}`
      });
    }
  };

  const getTotalExpenses = () => {
    return filteredExpenses.reduce((total, expense) => total + parseFloat(expense.amount || 0), 0);
  };

  const getCategoryTotal = (category: string) => {
    return expenses
      .filter(expense => expense.category === category)
      .reduce((total, expense) => total + parseFloat(expense.amount || 0), 0);
  };

  const getClientTotalPayments = (clientId: string) => {
    return clientPayments
      .filter(payment => payment.clientId === clientId)
      .reduce((total, payment) => total + parseFloat(payment.amount || 0), 0);
  };

  const getClientPendingAmount = (client: Client) => {
    const totalPaid = getClientTotalPayments(client.id);
    return parseFloat(client.packageAmount as any) - totalPaid;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(parseISO(dateString), 'dd MMM yyyy');
  };

  const generateExpenseReport = () => {
    const csvContent = [
      ['Date', 'Title', 'Amount', 'Paid To', 'Department', 'Category', 'Payment Method', 'Description'],
      ...filteredExpenses.map(expense => [
        formatDate(expense.date),
        expense.title,
        expense.amount,
        expense.paidTo,
        expense.department,
        expense.category,
        expense.paymentMethod,
        expense.description
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const generateClientReport = () => {
    const csvContent = [
      ['Client Name', 'Contact', 'Package Amount', 'Package Type', 'Total Paid', 'Pending Amount', 'Status'],
      ...clients.map(client => {
        const totalPaid = getClientTotalPayments(client.id);
        const pending = parseFloat(client.packageAmount as any) - totalPaid;
        return [
          client.name,
          client.contact,
          client.packageAmount,
          client.packageType,
          totalPaid,
          pending,
          pending <= 0 ? 'Paid' : 'Pending'
        ];
      })
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clients-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const generateInvoiceForClient = (client: Client) => {
    const payments = clientPayments.filter(p => p.clientId === client.id);
    generateInvoice(client, payments);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Expense Management</h1>
          <p className="text-gray-600">Track and manage company expenses and client payments</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => activeTab === 'office' ? setShowAddForm(true) : setShowClientForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {activeTab === 'office' ? 'Add Expense' : 'Add Client'}
          </Button>
        </div>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="office">
            <Home className="h-4 w-4 mr-2" />
            Office Expenses
          </TabsTrigger>
          <TabsTrigger value="clients">
            <Users className="h-4 w-4 mr-2" />
            Client Management
          </TabsTrigger>
        </TabsList>

        {/* Office Expenses Tab */}
        <TabsContent value="office" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Expenses</p>
                    <p className="text-lg font-bold">{formatCurrency(getTotalExpenses())}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">This Month</p>
                    <p className="text-lg font-bold">{formatCurrency(
                      expenses
                        .filter(e => {
                          const expenseDate = parseISO(e.date);
                          const now = new Date();
                          return expenseDate.getMonth() === now.getMonth() && 
                                 expenseDate.getFullYear() === now.getFullYear();
                        })
                        .reduce((total, e) => total + parseFloat(e.amount || 0), 0)
                    )}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-sm text-gray-600">Highest Category</p>
                    <p className="text-lg font-bold">
                      {expenseCategories.reduce((max, cat) => {
                        const catTotal = getCategoryTotal(cat.value);
                        return catTotal > max.amount ? 
                          { name: cat.label, amount: catTotal } : max;
                      }, { name: '', amount: 0 }).name}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-purple-600" />
                  <div>
                    <p className="text-sm text-gray-600">Transactions</p>
                    <p className="text-lg font-bold">{filteredExpenses.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Add Expense Form */}
          <AnimatePresence>
            {showAddForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Add New Expense</CardTitle>
                    <CardDescription>Record your company expenses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleExpenseSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          placeholder="Expense Title"
                          value={formData.title}
                          onChange={(e) => setFormData({...formData, title: e.target.value})}
                          required
                        />
                        <Input
                          placeholder="Amount (₹)"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.amount}
                          onChange={(e) => setFormData({...formData, amount: e.target.value})}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          placeholder="Paid To"
                          value={formData.paidTo}
                          onChange={(e) => setFormData({...formData, paidTo: e.target.value})}
                          required
                        />
                        <Select 
                          value={formData.department} 
                          onValueChange={(value) => setFormData({...formData, department: value})}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map(dept => (
                              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select 
                          value={formData.category} 
                          onValueChange={(value) => setFormData({...formData, category: value})}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Category" />
                          </SelectTrigger>
                          <SelectContent>
                            {expenseCategories.map(cat => (
                              <SelectItem key={cat.value} value={cat.value}>
                                <div className="flex items-center">
                                  {cat.icon}
                                  {cat.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select 
                          value={formData.paymentMethod} 
                          onValueChange={(value) => setFormData({...formData, paymentMethod: value})}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Payment Method" />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentMethods.map(method => (
                              <SelectItem key={method} value={method}>{method}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          type="date"
                          value={formData.date}
                          onChange={(e) => setFormData({...formData, date: e.target.value})}
                          required
                        />
                      </div>

                      <Textarea
                        placeholder="Description"
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                      />

                      <div className="flex gap-2">
                        <Button type="submit">Add Expense</Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setShowAddForm(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full">
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Time Range" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeRanges.map(range => (
                        <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                    <SelectTrigger>
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map(dept => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {expenseCategories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex items-center">
                            {cat.icon}
                            {cat.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Search expenses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button onClick={generateExpenseReport} className="md:ml-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Expenses List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Expenses ({filteredExpenses.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredExpenses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No expenses found matching your criteria
                </div>
              ) : (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExpenses.map((expense) => {
                        const category = expenseCategories.find(c => c.value === expense.category);
                        return (
                          <TableRow key={expense.id}>
                            <TableCell>{formatDate(expense.date)}</TableCell>
                            <TableCell>
                              <div className="font-medium">{expense.title}</div>
                              <div className="text-sm text-gray-500">{expense.paidTo}</div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(expense.amount)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="flex items-center gap-1">
                                {category?.icon}
                                {category?.label || expense.category}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{expense.department}</Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete('expenses', expense.id, expense.adminId)}
                                className="text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expense Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                Expense Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {expenseCategories.map(category => {
                  const total = getCategoryTotal(category.value);
                  if (total <= 0) return null;
                  const percentage = (total / getTotalExpenses()) * 100;
                  
                  return (
                    <div key={category.value} className="space-y-1">
                      <div className="flex justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          {category.icon}
                          <span>{category.label}</span>
                        </div>
                        <span className="text-sm font-medium">
                          {formatCurrency(total)} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clients Tab */}
        <TabsContent value="clients" className="space-y-6">
          {/* Client Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Clients</p>
                    <p className="text-lg font-bold">{clients.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Package Value</p>
                    <p className="text-lg font-bold">{formatCurrency(
                      clients.reduce((total, client) => total + parseFloat(client.packageAmount as any || 0), 0)
                    )}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-purple-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Received</p>
                    <p className="text-lg font-bold">{formatCurrency(
                      clientPayments.reduce((total, payment) => total + parseFloat(payment.amount || 0), 0)
                    )}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-sm text-gray-600">Pending Amount</p>
                    <p className="text-lg font-bold">{formatCurrency(
                      clients.reduce((total, client) => {
                        const paid = getClientTotalPayments(client.id);
                        return total + (parseFloat(client.packageAmount as any) - paid);
                      }, 0)
                    )}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Add Client Form */}
          <AnimatePresence>
            {showClientForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Add New Client</CardTitle>
                    <CardDescription>Register a new client and their package details</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleClientSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          placeholder="Client Name"
                          value={clientForm.name}
                          onChange={(e) => setClientForm({...clientForm, name: e.target.value})}
                          required
                        />
                        <Input
                          placeholder="Contact Number"
                          value={clientForm.contact}
                          onChange={(e) => setClientForm({...clientForm, contact: e.target.value})}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          placeholder="Email Address"
                          type="email"
                          value={clientForm.email}
                          onChange={(e) => setClientForm({...clientForm, email: e.target.value})}
                        />
                        <Input
                          placeholder="Address"
                          value={clientForm.address}
                          onChange={(e) => setClientForm({...clientForm, address: e.target.value})}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          placeholder="Package Amount (₹)"
                          type="number"
                          step="0.01"
                          min="0"
                          value={clientForm.packageAmount}
                          onChange={(e) => setClientForm({...clientForm, packageAmount: e.target.value})}
                          required
                        />
                        <Select 
                          value={clientForm.packageType} 
                          onValueChange={(value) => setClientForm({...clientForm, packageType: value})}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Package Type" />
                          </SelectTrigger>
                          <SelectContent>
                            {packageTypes.map(type => (
                              <SelectItem key={type} value={type}>
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          type="date"
                          value={clientForm.startDate}
                          onChange={(e) => setClientForm({...clientForm, startDate: e.target.value})}
                          required
                        />
                      </div>

                      <Textarea
                        placeholder="Description / Services Included"
                        value={clientForm.description}
                        onChange={(e) => setClientForm({...clientForm, description: e.target.value})}
                      />

                      <div className="flex gap-2">
                        <Button type="submit">Add Client</Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setShowClientForm(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Add Payment Form */}
          <AnimatePresence>
            {showPaymentForm && selectedClient && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Record Payment for {selectedClient.name}</CardTitle>
                    <CardDescription>
                      Package: {formatCurrency(selectedClient.packageAmount)} ({selectedClient.packageType}) | 
                      Paid: {formatCurrency(getClientTotalPayments(selectedClient.id))} | 
                      Pending: {formatCurrency(getClientPendingAmount(selectedClient))}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handlePaymentSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          placeholder="Amount (₹)"
                          type="number"
                          step="0.01"
                          min="0"
                          max={getClientPendingAmount(selectedClient)}
                          value={paymentForm.amount}
                          onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                          required
                        />
                        <Select 
                          value={paymentForm.paymentMethod} 
                          onValueChange={(value) => setPaymentForm({...paymentForm, paymentMethod: value})}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Payment Method" />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentMethods.map(method => (
                              <SelectItem key={method} value={method}>{method}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          type="date"
                          value={paymentForm.date}
                          onChange={(e) => setPaymentForm({...paymentForm, date: e.target.value})}
                          required
                        />
                        <Input
                          placeholder="Reference/Transaction ID"
                          value={paymentForm.reference}
                          onChange={(e) => setPaymentForm({...paymentForm, reference: e.target.value})}
                        />
                      </div>

                      <Textarea
                        placeholder="Description / Notes"
                        value={paymentForm.description}
                        onChange={(e) => setPaymentForm({...paymentForm, description: e.target.value})}
                      />

                      <div className="flex gap-2">
                        <Button type="submit">Record Payment</Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => {
                            setShowPaymentForm(false);
                            setSelectedClient(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Clients List */}
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Clients ({clients.length})
                  </CardTitle>
                  <CardDescription>Manage your clients and their payments</CardDescription>
                </div>
                <Button onClick={generateClientReport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Clients
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {clients.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No clients found. Add your first client to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Payments</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map(client => {
                      const totalPaid = getClientTotalPayments(client.id);
                      const pendingAmount = getClientPendingAmount(client);
                      const paymentPercentage = (totalPaid / parseFloat(client.packageAmount as any)) * 100;
                      
                      return (
                        <TableRow key={client.id}>
                          <TableCell>
                            <div className="font-medium">{client.name}</div>
                            <div className="text-sm text-gray-500">{client.contact}</div>
                            <div className="text-sm text-gray-500">{client.email}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{formatCurrency(client.packageAmount)}</div>
                            <div className="text-sm text-gray-500 capitalize">{client.packageType}</div>
                            <div className="text-sm text-gray-500">Since {formatDate(client.startDate)}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={paymentPercentage} className="h-2 w-24" />
                              <span className="text-sm">
                                {paymentPercentage.toFixed(0)}%
                              </span>
                            </div>
                            <div className="text-sm">
                              Paid: {formatCurrency(totalPaid)}
                            </div>
                            <div className={`text-sm ${
                              pendingAmount > 0 ? 'text-orange-600' : 'text-green-600'
                            }`}>
                              {pendingAmount > 0 ? 
                                `Pending: ${formatCurrency(pendingAmount)}` : 
                                'Fully Paid'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={pendingAmount > 0 ? 'secondary' : 'default'}>
                              {pendingAmount > 0 ? 'Pending' : 'Paid'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedClient(client);
                                  setShowPaymentForm(true);
                                }}
                              >
                                <CircleDollarSign className="h-3 w-3 mr-1" />
                                Payment
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => generateInvoiceForClient(client)}
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                Invoice
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => handleDelete('clients', client.id, client.adminId)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Client Payments */}
          {selectedClient && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CircleDollarSign className="h-4 w-4" />
                  Payment History for {selectedClient.name}
                </CardTitle>
                <CardDescription>
                  Package: {formatCurrency(selectedClient.packageAmount)} ({selectedClient.packageType}) | 
                  Total Paid: {formatCurrency(getClientTotalPayments(selectedClient.id))} | 
                  Pending: {formatCurrency(getClientPendingAmount(selectedClient))}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {clientPayments.filter(p => p.clientId === selectedClient.id).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No payments recorded for this client
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientPayments
                        .filter(p => p.clientId === selectedClient.id)
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map(payment => (
                          <TableRow key={payment.id}>
                            <TableCell>{formatDate(payment.date)}</TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(payment.amount)}
                            </TableCell>
                            <TableCell>{payment.paymentMethod}</TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {payment.reference}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => handleDelete('clientPayments', payment.id, payment.adminId)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ExpenseManagement;