import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Download, Send, Users, Settings, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { toast } from '../ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Label } from '../ui/label';
import { ref, onValue, off, set, push, update, remove } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { generateSalarySlipPDF } from '../../utils/pdfGenerator';

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  employeeId: string;
  isActive: boolean;
  createdAt: string;
  profileImage?: string;
  salary?: number;
  workMode?: string;
  employmentType?: string;
}

interface SalarySlip {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  month: number;
  year: number;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  generatedAt: string;
  status: 'generated' | 'sent';
  sentAt?: string;
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SalaryManagement: React.FC = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salarySlips, setSalarySlips] = useState<SalarySlip[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [editingSlip, setEditingSlip] = useState<SalarySlip | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editData, setEditData] = useState({
    basicSalary: 0,
    allowances: 0,
    deductions: 0
  });
  const [employeeEditData, setEmployeeEditData] = useState({
    name: '',
    designation: '',
    salary: 0,
    workMode: 'office',
    employmentType: 'full-time'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const workModes = ['office', 'remote', 'hybrid'];
  const employmentTypes = ['full-time', 'part-time', 'contract', 'internship'];

  // Fetch employees from Firebase
  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    setLoading(true);
    const employeesRef = ref(database, `users/${user.id}/employees`);
    
    const fetchEmployees = onValue(employeesRef, (snapshot) => {
      const employeesData: Employee[] = [];
      snapshot.forEach((childSnapshot) => {
        const employee = childSnapshot.val();
        employeesData.push({
          id: childSnapshot.key || '',
          name: employee.name,
          email: employee.email,
          phone: employee.phone,
          department: employee.department,
          designation: employee.designation,
          employeeId: employee.employeeId || `EMP-${childSnapshot.key?.slice(0, 8)}`,
          isActive: employee.status === 'active',
          createdAt: employee.createdAt,
          profileImage: employee.profileImage,
          salary: employee.salary,
          workMode: employee.workMode || 'office',
          employmentType: employee.employmentType || 'full-time'
        });
      });

      setEmployees(employeesData.filter(emp => emp.isActive));
      setLoading(false);
    }, (error) => {
      console.error('Error fetching employees:', error);
      setError('Failed to load employees');
      setLoading(false);
    });

    return () => {
      off(employeesRef);
    };
  }, [user]);

  // Fetch salary slips from Firebase
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const salaryRef = ref(database, `users/${user.id}/salaries`);
    
    const fetchSalaries = onValue(salaryRef, (snapshot) => {
      const salaryData: SalarySlip[] = [];
      snapshot.forEach((childSnapshot) => {
        const slip = childSnapshot.val();
        salaryData.push({
          id: childSnapshot.key || '',
          employeeId: slip.employeeId,
          employeeName: slip.employeeName,
          employeeEmail: slip.employeeEmail,
          month: slip.month,
          year: slip.year,
          basicSalary: slip.basicSalary,
          allowances: slip.allowances,
          deductions: slip.deductions,
          netSalary: slip.netSalary,
          generatedAt: slip.generatedAt,
          status: slip.status,
          sentAt: slip.sentAt
        });
      });

      setSalarySlips(salaryData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching salaries:', error);
      setError('Failed to load salary data');
      setLoading(false);
    });

    return () => {
      off(salaryRef);
    };
  }, [user]);

  const currentMonthSlips = salarySlips.filter(slip => 
    slip.month === selectedMonth && slip.year === selectedYear
  );

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  // Function to get the latest basic salary for an employee
  const getEmployeeBasicSalary = (employeeId: string): number => {
    const employeeSlips = salarySlips
      .filter(slip => slip.employeeId === employeeId)
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });

    if (employeeSlips.length > 0) {
      return employeeSlips[0].basicSalary;
    }

    // Fallback to employee's salary if no slips exist
    const employee = employees.find(e => e.employeeId === employeeId);
    return employee?.salary || 0;
  };

  const generateSalarySlip = async (employee: Employee) => {
    if (!user) return;

    try {
      // Use the latest basic salary or fallback to employee's salary
      const basicSalary = getEmployeeBasicSalary(employee.employeeId) || employee.salary || 0;
      const allowances = basicSalary * 0.3; // 30% of basic salary
      const deductions = basicSalary * 0.12; // 12% of basic salary
      const netSalary = basicSalary + allowances - deductions;

      const newSlipRef = push(ref(database, `users/${user.id}/salaries`));
      const newSlipId = newSlipRef.key;

      const salarySlip: SalarySlip = {
        id: newSlipId || '',
        employeeId: employee.employeeId,
        employeeName: employee.name,
        employeeEmail: employee.email,
        month: selectedMonth,
        year: selectedYear,
        basicSalary,
        allowances,
        deductions,
        netSalary,
        generatedAt: new Date().toISOString(),
        status: 'generated'
      };

      await set(newSlipRef, salarySlip);
      await set(ref(database, `users/${user.id}/employees/${employee.id}/salary/${newSlipId}`), salarySlip);

      toast({
        title: "Salary Slip Generated",
        description: `Salary slip generated for ${employee.name}`,
        variant: "success"
      });
    } catch (err) {
      console.error('Error generating salary slip:', err);
      setError('Failed to generate salary slip');
      toast({
        title: "Error",
        description: "Failed to generate salary slip",
        variant: "destructive"
      });
    }
  };

  const sendSalarySlip = async (slip: SalarySlip) => {
    if (!user) return;

    try {
      const employee = employees.find(e => e.employeeId === slip.employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      const updates: Record<string, any> = {};
      const sentAt = new Date().toISOString();
      
      updates[`users/${user.id}/salaries/${slip.id}/status`] = 'sent';
      updates[`users/${user.id}/salaries/${slip.id}/sentAt`] = sentAt;
      updates[`users/${user.id}/employees/${employee.id}/salary/${slip.id}/status`] = 'sent';
      updates[`users/${user.id}/employees/${employee.id}/salary/${slip.id}/sentAt`] = sentAt;

      await update(ref(database), updates);

      toast({
        title: "Salary Slip Sent",
        description: `Salary slip sent to ${slip.employeeName} via email`,
        variant: "success"
      });
    } catch (err) {
      console.error('Error sending salary slip:', err);
      setError('Failed to send salary slip');
      toast({
        title: "Error",
        description: "Failed to send salary slip",
        variant: "destructive"
      });
    }
  };

  const downloadSlipAsPDF = (slip: SalarySlip) => {
    try {
      const pdfData = {
        employeeName: slip.employeeName,
        employeeId: slip.employeeId,
        month: months[slip.month],
        year: slip.year,
        basicSalary: slip.basicSalary,
        allowances: slip.allowances,
        deductions: slip.deductions,
        netSalary: slip.netSalary,
        generatedAt: slip.generatedAt,
        companyName: 'Your Company Name',
        companyAddress: 'Your Company Address'
      };
      
      generateSalarySlipPDF(pdfData);
      
      toast({
        title: "PDF Downloaded",
        description: `Salary slip PDF downloaded for ${slip.employeeName}`,
        variant: "success"
      });
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive"
      });
    }
  };

  const editSalarySlip = (slip: SalarySlip) => {
    setEditingSlip(slip);
    setEditData({
      basicSalary: slip.basicSalary,
      allowances: slip.allowances,
      deductions: slip.deductions
    });
  };

  const editEmployeeData = (employee: Employee) => {
    setEditingEmployee(employee);
    setEmployeeEditData({
      name: employee.name,
      designation: employee.designation,
      salary: employee.salary || 0,
      workMode: employee.workMode || 'office',
      employmentType: employee.employmentType || 'full-time'
    });
  };

  const handleEmployeeEditSave = async () => {
    if (!user || !editingEmployee) return;

    try {
      const updates: Record<string, any> = {};
      updates[`users/${user.id}/employees/${editingEmployee.id}/name`] = employeeEditData.name;
      updates[`users/${user.id}/employees/${editingEmployee.id}/designation`] = employeeEditData.designation;
      updates[`users/${user.id}/employees/${editingEmployee.id}/salary`] = employeeEditData.salary;
      updates[`users/${user.id}/employees/${editingEmployee.id}/workMode`] = employeeEditData.workMode;
      updates[`users/${user.id}/employees/${editingEmployee.id}/employmentType`] = employeeEditData.employmentType;

      await update(ref(database), updates);
      
      setEditingEmployee(null);
      
      toast({
        title: "Employee Data Updated",
        description: "Employee information has been updated successfully",
        variant: "success"
      });
    } catch (err) {
      console.error('Error updating employee:', err);
      setError('Failed to update employee data');
      toast({
        title: "Error",
        description: "Failed to update employee data",
        variant: "destructive"
      });
    }
  };

  const handleEditSave = async () => {
    if (!user || !editingSlip) return;

    try {
      const netSalary = editData.basicSalary + editData.allowances - editData.deductions;
      
      const updates: Record<string, any> = {};
      
      updates[`users/${user.id}/salaries/${editingSlip.id}/basicSalary`] = editData.basicSalary;
      updates[`users/${user.id}/salaries/${editingSlip.id}/allowances`] = editData.allowances;
      updates[`users/${user.id}/salaries/${editingSlip.id}/deductions`] = editData.deductions;
      updates[`users/${user.id}/salaries/${editingSlip.id}/netSalary`] = netSalary;
      updates[`users/${user.id}/salaries/${editingSlip.id}/lastUpdated`] = new Date().toISOString();
      
      const employee = employees.find(e => e.employeeId === editingSlip.employeeId);
      if (employee) {
        updates[`users/${user.id}/employees/${employee.id}/salary/${editingSlip.id}/basicSalary`] = editData.basicSalary;
        updates[`users/${user.id}/employees/${employee.id}/salary/${editingSlip.id}/allowances`] = editData.allowances;
        updates[`users/${user.id}/employees/${employee.id}/salary/${editingSlip.id}/deductions`] = editData.deductions;
        updates[`users/${user.id}/employees/${employee.id}/salary/${editingSlip.id}/netSalary`] = netSalary;
        updates[`users/${user.id}/employees/${employee.id}/salary/${editingSlip.id}/lastUpdated`] = new Date().toISOString();
      }

      await update(ref(database), updates);
      
      setEditingSlip(null);
      
      toast({
        title: "Salary Slip Updated",
        description: "Salary slip has been updated successfully",
        variant: "success"
      });
    } catch (err) {
      console.error('Error updating salary slip:', err);
      setError('Failed to update salary slip');
      toast({
        title: "Error",
        description: "Failed to update salary slip",
        variant: "destructive"
      });
    }
  };

  const deleteSalarySlip = async (slipId: string) => {
    if (!user || !window.confirm('Are you sure you want to delete this salary slip?')) return;
    
    try {
      const slip = salarySlips.find(s => s.id === slipId);
      if (!slip) return;

      const updates: Record<string, null> = {};
      
      updates[`users/${user.id}/salaries/${slipId}`] = null;
      
      const employee = employees.find(e => e.employeeId === slip.employeeId);
      if (employee) {
        updates[`users/${user.id}/employees/${employee.id}/salary/${slipId}`] = null;
      }

      await update(ref(database), updates);
      
      toast({
        title: "Salary Slip Deleted",
        description: "Salary slip has been deleted successfully",
        variant: "success"
      });
    } catch (err) {
      console.error('Error deleting salary slip:', err);
      setError('Failed to delete salary slip');
      toast({
        title: "Error",
        description: "Failed to delete salary slip",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading salary data...</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500">{error}</div>
          <Button 
            variant="outline" 
            onClick={() => setError(null)}
            className="mt-4"
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 px-2 sm:px-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Salary Management</h1>
          <p className="text-sm sm:text-base text-gray-600">Generate and manage employee salary slips</p>
        </div>
      </motion.div>

      <Tabs defaultValue="manage" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manage" className="flex items-center gap-2 text-xs sm:text-sm">
            <CreditCard className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="truncate">Manage Salaries</span>
          </TabsTrigger>
          <TabsTrigger value="template" className="flex items-center gap-2 text-xs sm:text-sm">
            <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="truncate">Salary Templates</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manage" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Select Period</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                  <Select 
                    value={selectedMonth.toString()} 
                    onValueChange={(value) => setSelectedMonth(parseInt(value))}
                  >
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Select Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month, index) => (
                        <SelectItem key={index} value={index.toString()}>{month}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select 
                    value={selectedYear.toString()} 
                    onValueChange={(value) => setSelectedYear(parseInt(value))}
                  >
                    <SelectTrigger className="w-full sm:w-32">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {[2023, 2024, 2025].map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Users className="h-4 w-4" />
                  <span className="truncate">Generate Salary Slips - {months[selectedMonth]} {selectedYear}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {employees.map((employee, index) => {
                    const hasSlip = currentMonthSlips.some(slip => slip.employeeId === employee.employeeId);
                    const basicSalary = getEmployeeBasicSalary(employee.employeeId);
                    
                    return (
                      <motion.div
                        key={employee.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-gray-50 transition-colors gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">{employee.name}</h3>
                            {hasSlip && <Badge className="bg-green-100 text-green-700 text-xs">Generated</Badge>}
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600 truncate">{employee.employeeId} • {employee.designation}</p>
                          <p className="text-xs sm:text-sm text-gray-600">Basic Salary: {formatCurrency(basicSalary)}</p>
                          <p className="text-xs text-gray-500 truncate">
                            Work Mode: {employee.workMode} • {employee.employmentType}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => editEmployeeData(employee)}
                                className="text-xs sm:text-sm h-8"
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Edit Employee Data - {employee.name}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="employee-name">Employee Name</Label>
                                  <Input
                                    id="employee-name"
                                    value={employeeEditData.name}
                                    onChange={(e) => setEmployeeEditData({...employeeEditData, name: e.target.value})}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="employee-designation">Designation</Label>
                                  <Input
                                    id="employee-designation"
                                    value={employeeEditData.designation}
                                    onChange={(e) => setEmployeeEditData({...employeeEditData, designation: e.target.value})}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="employee-salary">Salary</Label>
                                  <Input
                                    id="employee-salary"
                                    type="number"
                                    value={employeeEditData.salary}
                                    onChange={(e) => setEmployeeEditData({...employeeEditData, salary: parseInt(e.target.value) || 0})}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="work-mode">Work Mode</Label>
                                  <Select
                                    value={employeeEditData.workMode}
                                    onValueChange={(value) => setEmployeeEditData({...employeeEditData, workMode: value})}
                                  >
                                    <SelectTrigger id="work-mode">
                                      <SelectValue placeholder="Select work mode" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {workModes.map((mode) => (
                                        <SelectItem key={mode} value={mode}>
                                          {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label htmlFor="employment-type">Employment Type</Label>
                                  <Select
                                    value={employeeEditData.employmentType}
                                    onValueChange={(value) => setEmployeeEditData({...employeeEditData, employmentType: value})}
                                  >
                                    <SelectTrigger id="employment-type">
                                      <SelectValue placeholder="Select employment type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {employmentTypes.map((type) => (
                                        <SelectItem key={type} value={type}>
                                          {type.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('-')}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex gap-2 pt-2">
                                  <Button onClick={handleEmployeeEditSave} className="flex-1">Save</Button>
                                  <Button 
                                    variant="outline" 
                                    onClick={() => setEditingEmployee(null)} 
                                    className="flex-1"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Button
                            onClick={() => generateSalarySlip(employee)}
                            disabled={hasSlip}
                            size="sm"
                            className="text-xs sm:text-sm h-8"
                          >
                            <CreditCard className="h-3 w-3 mr-1" />
                            {hasSlip ? 'Generated' : 'Generate'}
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                  {employees.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No active employees found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Download className="h-4 w-4" />
                  <span>Generated Salary Slips ({currentMonthSlips.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {currentMonthSlips.map((slip, index) => (
                    <motion.div
                      key={slip.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-gray-50 transition-colors gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{slip.employeeName}</h3>
                          <Badge className={`text-xs ${slip.status === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {slip.status}
                          </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">{slip.employeeId}</p>
                        <p className="text-xs sm:text-sm text-gray-600">Net Salary: {formatCurrency(slip.netSalary)}</p>
                        <p className="text-xs text-gray-500 truncate">
                          Generated: {new Date(slip.generatedAt).toLocaleDateString()}
                          {slip.status === 'sent' && ` • Sent: ${new Date(slip.sentAt!).toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => editSalarySlip(slip)}
                              className="text-xs sm:text-sm h-8"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Edit Salary Slip - {slip.employeeName}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="basic-salary">Basic Salary</Label>
                                <Input
                                  id="basic-salary"
                                  type="number"
                                  value={editData.basicSalary}
                                  onChange={(e) => setEditData({...editData, basicSalary: parseInt(e.target.value) || 0})}
                                />
                              </div>
                              <div>
                                <Label htmlFor="allowances">Allowances</Label>
                                <Input
                                  id="allowances"
                                  type="number"
                                  value={editData.allowances}
                                  onChange={(e) => setEditData({...editData, allowances: parseInt(e.target.value) || 0})}
                                />
                              </div>
                              <div>
                                <Label htmlFor="deductions">Deductions</Label>
                                <Input
                                  id="deductions"
                                  type="number"
                                  value={editData.deductions}
                                  onChange={(e) => setEditData({...editData, deductions: parseInt(e.target.value) || 0})}
                                />
                              </div>
                              <div className="flex gap-2 pt-2">
                                <Button onClick={handleEditSave} className="flex-1">Save</Button>
                                <Button 
                                  variant="outline" 
                                  onClick={() => setEditingSlip(null)} 
                                  className="flex-1"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => downloadSlipAsPDF(slip)}
                          className="text-xs sm:text-sm h-8"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          PDF
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => sendSalarySlip(slip)}
                          disabled={slip.status === 'sent'}
                          className="text-xs sm:text-sm h-8"
                        >
                          <Send className="h-3 w-3 mr-1" />
                          {slip.status === 'sent' ? 'Sent' : 'Send'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteSalarySlip(slip.id)}
                          className="text-red-600 hover:bg-red-50 text-xs sm:text-sm h-8"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                  {currentMonthSlips.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No salary slips generated for this period
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="template">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Settings className="h-4 w-4" />
                Salary Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-3 sm:p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2 text-sm sm:text-base">Salary Structure</h3>
                  <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                    Basic Salary + 30% Allowances - 12% Deductions = Net Salary
                  </p>
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-md">
                    <div className="flex justify-between mb-1 text-xs sm:text-sm">
                      <span>Basic Salary:</span>
                      <span>{formatCurrency(50000)}</span>
                    </div>
                    <div className="flex justify-between mb-1 text-xs sm:text-sm">
                      <span>Allowances (30%):</span>
                      <span>+ {formatCurrency(15000)}</span>
                    </div>
                    <div className="flex justify-between mb-1 text-xs sm:text-sm">
                      <span>Deductions (12%):</span>
                      <span>- {formatCurrency(6000)}</span>
                    </div>
                    <div className="border-t border-gray-200 my-2"></div>
                    <div className="flex justify-between font-semibold text-xs sm:text-sm">
                      <span>Net Salary:</span>
                      <span>{formatCurrency(59000)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SalaryManagement;