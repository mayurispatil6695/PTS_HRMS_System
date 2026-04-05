import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Badge } from '../../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { 
  Mail, 
  Phone, 
  User, 
  Calendar, 
  DollarSign, 
  Home, 
  Briefcase,
  CreditCard,
  Banknote,
  Clock,
  Contact,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../../../firebase';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';

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
  joiningDate?: string;
  salary?: number;
  emergencyContact?: {
    name: string;
    phone: string;
  };
  address?: string;
  workMode?: string;
  employmentType?: string;
  bankDetails?: {
    accountNumber: string;
    bankName: string;
    ifscCode: string;
  };
  addedBy?: string;
  status?: string;
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

interface EmployeeDetailsDialogProps {
  employee: Employee | null;
  onClose: () => void;
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const EmployeeDetailsDialog: React.FC<EmployeeDetailsDialogProps> = ({
  employee,
  onClose
}) => {
  const { user } = useAuth();
  const [salaryHistory, setSalaryHistory] = useState<SalarySlip[]>([]);
  const [loadingSalaries, setLoadingSalaries] = useState(false);
  const [showSalaryHistory, setShowSalaryHistory] = useState(false);

  useEffect(() => {
    if (!employee || !user) return;

    setLoadingSalaries(true);
    const salaryRef = ref(database, `employees/${employee.id}/salary`);

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

      // Sort by year and month (newest first)
      salaryData.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });

      setSalaryHistory(salaryData);
      setLoadingSalaries(false);
    }, (error) => {
      console.error('Error fetching salary history:', error);
      setLoadingSalaries(false);
    });

    return () => {
      off(salaryRef);
    };
  }, [employee, user]);

  if (!employee) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not available';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'Not specified';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getLatestSalarySlip = () => {
    if (salaryHistory.length === 0) return null;
    return salaryHistory[0];
  };

  const latestSalary = getLatestSalarySlip();

  // Get the base salary - first try from latest salary slip, then from employee data
  const baseSalary = latestSalary?.basicSalary || employee.salary;

  return (
    <Dialog open={!!employee} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Employee Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Profile Header */}
          <div className="flex items-start gap-4">
            <Avatar className="w-20 h-20 border-2 border-gray-200">
              <AvatarImage src={employee.profileImage} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl">
                {employee.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{employee.name}</h2>
                  <p className="text-gray-600">{employee.designation}</p>
                </div>
                <Badge variant={employee.isActive ? "default" : "secondary"}>
                  {employee.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <span className="flex items-center gap-1 text-gray-600">
                  <User className="w-4 h-4" />
                  {employee.employeeId}
                </span>
                <span className="flex items-center gap-1 text-gray-600">
                  <Briefcase className="w-4 h-4" />
                  {employee.department}
                </span>
              </div>
            </div>
          </div>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="salary">Salary Details</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              {/* Main Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Personal Information */}
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-700 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Personal Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        Email
                      </label>
                      <p className="font-semibold">{employee.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        Phone
                      </label>
                      <p className="font-semibold">{employee.phone || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
                        <Home className="w-4 h-4" />
                        Address
                      </label>
                      <p className="font-semibold">{employee.address || 'Not provided'}</p>
                    </div>
                  </div>
                </div>

                {/* Employment Information */}
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-700 flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    Employment Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Joining Date
                      </label>
                      <p className="font-semibold">{formatDate(employee.joiningDate)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Employment Type
                      </label>
                      <p className="font-semibold">
                        {employee.employmentType ? 
                          employee.employmentType.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('-') 
                          : 'Not specified'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        Base Salary
                      </label>
                      <p className="font-semibold">{formatCurrency(baseSalary)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
                        <Briefcase className="w-4 h-4" />
                        Work Mode
                      </label>
                      <p className="font-semibold">
                        {employee.workMode ? 
                          employee.workMode.charAt(0).toUpperCase() + employee.workMode.slice(1) 
                          : 'Not specified'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-700 flex items-center gap-2">
                    <Contact className="w-5 h-5" />
                    Emergency Contact
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Contact Name</label>
                      <p className="font-semibold">
                        {employee.emergencyContact?.name || 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Contact Number</label>
                      <p className="font-semibold">
                        {employee.emergencyContact?.phone || 'Not provided'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bank Details */}
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-700 flex items-center gap-2">
                    <Banknote className="w-5 h-5" />
                    Bank Details
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Bank Name</label>
                      <p className="font-semibold">
                        {employee.bankDetails?.bankName || 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Account Number</label>
                      <p className="font-semibold">
                        {employee.bankDetails?.accountNumber || 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">IFSC Code</label>
                      <p className="font-semibold">
                        {employee.bankDetails?.ifscCode || 'Not provided'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              {employee.addedBy && (
                <div className="text-sm text-gray-500">
                  Added by admin ID: {employee.addedBy}
                </div>
              )}
            </TabsContent>

            <TabsContent value="salary">
              <div className="space-y-4">
                {/* Latest Salary Slip */}
                {latestSalary ? (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium text-gray-700 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Latest Salary Slip ({months[latestSalary.month]} {latestSalary.year})
                    </h3>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Basic Salary</label>
                          <p className="font-semibold">{formatCurrency(latestSalary.basicSalary)}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Allowances</label>
                          <p className="font-semibold">{formatCurrency(latestSalary.allowances)}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Deductions</label>
                          <p className="font-semibold">{formatCurrency(latestSalary.deductions)}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Net Salary</label>
                          <p className="font-semibold">{formatCurrency(latestSalary.netSalary)}</p>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Status</label>
                        <Badge 
                          className={latestSalary.status === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}
                        >
                          {latestSalary.status}
                        </Badge>
                        {latestSalary.status === 'sent' && (
                          <p className="text-xs text-gray-500 mt-1">
                            Sent on: {formatDate(latestSalary.sentAt)}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Generated On</label>
                        <p className="font-semibold">{formatDate(latestSalary.generatedAt)}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
                    No salary slips generated yet
                  </div>
                )}

                {/* Salary History */}
                <div className="space-y-2">
                  <Button 
                    variant="ghost" 
                    className="w-full flex items-center justify-between"
                    onClick={() => setShowSalaryHistory(!showSalaryHistory)}
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Salary History
                    </span>
                    {showSalaryHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>

                  {showSalaryHistory && (
                    <div className="space-y-3">
                      {loadingSalaries ? (
                        <div className="flex justify-center py-4">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                        </div>
                      ) : salaryHistory.length > 0 ? (
                        salaryHistory.map((slip) => (
                          <div key={slip.id} className="p-4 border rounded-lg">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">
                                {months[slip.month]} {slip.year}
                              </h4>
                              <Badge 
                                className={slip.status === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}
                              >
                                {slip.status}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                              <div>
                                <span className="text-gray-500">Net Salary:</span>
                                <span className="font-semibold ml-1">{formatCurrency(slip.netSalary)}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Generated:</span>
                                <span className="font-semibold ml-1">
                                  {new Date(slip.generatedAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-gray-500">
                          No salary history available
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeDetailsDialog;