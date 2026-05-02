import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Badge } from '../../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { 
  Mail, Phone, User, Calendar, DollarSign, Home, Briefcase,
  Banknote, Clock, Contact, FileText, ChevronDown, ChevronUp
} from 'lucide-react';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../../../firebase';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';

// ✅ Central types
import type { Employee } from '@/types/employee';
import type { SalarySlip } from '@/types/payroll';

// -------------------------------------------------------------------
// Helper functions (pure, outside component)
// -------------------------------------------------------------------
const formatDate = (dateString?: string): string => {
  if (!dateString) return 'Not available';
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatCurrency = (amount?: number): string => {
  if (!amount) return 'Not specified';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// -------------------------------------------------------------------
// SalarySlider component – loads data only when rendered (lazy)
// -------------------------------------------------------------------
const SalarySlider = memo(({ employeeId }: { employeeId: string }) => {
  const [salaryHistory, setSalaryHistory] = useState<SalarySlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    // Adjust path to your actual salary storage – change if needed
    const salaryRef = ref(database, `employees/${employeeId}/salary`);
    const unsubscribe = onValue(salaryRef, (snapshot) => {
      const data = snapshot.val();
      const slips: SalarySlip[] = [];
      if (data) {
        Object.entries(data).forEach(([key, slip]) => {
          const s = slip as Record<string, unknown>;
          slips.push({
            id: key,
            employeeId: s.employeeId as string,
            employeeName: s.employeeName as string,
            employeeEmail: s.employeeEmail as string,
            month: s.month as number,
            year: s.year as number,
            grossEarnings: (s.grossEarnings as number) || (s.basicSalary as number) + (s.allowances as number),
            totalDeductions: s.totalDeductions as number || s.deductions as number,
            netSalary: s.netSalary as number,
            breakdown: s.breakdown as Record<string, number> || {},
            pdfUrl: s.pdfUrl as string,
            generatedAt: s.generatedAt as string,
            status: s.status as 'generated' | 'sent',
            sentAt: s.sentAt as string | undefined,
          });
        });
        slips.sort((a, b) => b.year - a.year || b.month - a.month);
      }
      setSalaryHistory(slips);
      setLoading(false);
    }, (err) => { console.error(err); setLoading(false); });
    return () => off(salaryRef);
  }, [employeeId]);

  const latestSalary = useMemo(() => salaryHistory[0] || null, [salaryHistory]);

  if (loading) {
    return <div className="text-center py-4"><div className="animate-spin h-6 w-6 border-2 border-gray-900 rounded-full inline-block" /> loading salary...</div>;
  }
  if (!latestSalary && salaryHistory.length === 0) {
    return <div className="p-4 text-center text-gray-500">No salary slips generated yet</div>;
  }

  return (
    <div className="space-y-4">
      {latestSalary && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-700 flex items-center gap-2">
            <FileText className="w-5 h-5" /> Latest Salary Slip ({months[latestSalary.month]} {latestSalary.year})
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-gray-500">Basic Salary</label><p className="font-semibold">{formatCurrency(latestSalary.grossEarnings - (latestSalary.breakdown?.allowances || 0))}</p></div>
            <div><label className="text-sm font-medium text-gray-500">Allowances</label><p className="font-semibold">{formatCurrency(latestSalary.breakdown?.allowances || 0)}</p></div>
            <div><label className="text-sm font-medium text-gray-500">Deductions</label><p className="font-semibold">{formatCurrency(latestSalary.totalDeductions)}</p></div>
            <div><label className="text-sm font-medium text-gray-500">Net Salary</label><p className="font-semibold">{formatCurrency(latestSalary.netSalary)}</p></div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Status</label>
            <Badge className={latestSalary.status === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}>
              {latestSalary.status}
            </Badge>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Button variant="ghost" className="w-full flex items-center justify-between" onClick={() => setShowHistory(!showHistory)}>
          <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> Salary History</span>
          {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>

        {showHistory && salaryHistory.slice(1).map(slip => (
          <div key={slip.id} className="p-4 border rounded-lg">
            <div className="flex justify-between">
              <h4 className="font-medium">{months[slip.month]} {slip.year}</h4>
              <Badge className={slip.status === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}>
                {slip.status}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
              <div><span className="text-gray-500">Net Salary:</span><span className="font-semibold ml-1">{formatCurrency(slip.netSalary)}</span></div>
              <div><span className="text-gray-500">Generated:</span><span className="font-semibold ml-1">{new Date(slip.generatedAt).toLocaleDateString()}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

// -------------------------------------------------------------------
// Main Dialog Component
// -------------------------------------------------------------------
interface EmployeeDetailsDialogProps {
  employee: Employee | null;
  onClose: () => void;
}

const EmployeeDetailsDialog: React.FC<EmployeeDetailsDialogProps> = memo(({ employee, onClose }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [salaryLoaded, setSalaryLoaded] = useState(false);
  const { user } = useAuth();

  // Derived values
  const baseSalary = employee?.salary || 0;

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    if (value === 'salary' && !salaryLoaded && employee) {
      setSalaryLoaded(true);
    }
  }, [salaryLoaded, employee]);

  if (!employee) return null;

  return (
    <Dialog open={!!employee} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Employee Details</DialogTitle></DialogHeader>
        <div className="space-y-6">
          {/* Header */}
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
                <span className="flex items-center gap-1 text-gray-600"><User className="w-4 h-4" /> {employee.employeeId}</span>
                <span className="flex items-center gap-1 text-gray-600"><Briefcase className="w-4 h-4" /> {employee.department}</span>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="salary">Salary Details</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Personal Information */}
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-700 flex items-center gap-2"><User className="w-5 h-5" /> Personal Information</h3>
                  <div className="space-y-3">
                    <div><label className="text-sm font-medium text-gray-500 flex items-center gap-1"><Mail className="w-4 h-4" /> Email</label><p className="font-semibold">{employee.email}</p></div>
                    <div><label className="text-sm font-medium text-gray-500 flex items-center gap-1"><Phone className="w-4 h-4" /> Phone</label><p className="font-semibold">{employee.phone || 'Not provided'}</p></div>
                    <div><label className="text-sm font-medium text-gray-500 flex items-center gap-1"><Home className="w-4 h-4" /> Address</label><p className="font-semibold">{employee.address || 'Not provided'}</p></div>
                  </div>
                </div>

                {/* Employment Information */}
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-700 flex items-center gap-2"><Briefcase className="w-5 h-5" /> Employment Information</h3>
                  <div className="space-y-3">
                    <div><label className="text-sm font-medium text-gray-500 flex items-center gap-1"><Calendar className="w-4 h-4" /> Joining Date</label><p className="font-semibold">{formatDate(employee.joiningDate)}</p></div>
                    <div><label className="text-sm font-medium text-gray-500 flex items-center gap-1"><Clock className="w-4 h-4" /> Employment Type</label><p className="font-semibold">{employee.employmentType ? employee.employmentType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Not specified'}</p></div>
                    <div><label className="text-sm font-medium text-gray-500 flex items-center gap-1"><DollarSign className="w-4 h-4" /> Base Salary</label><p className="font-semibold">{formatCurrency(baseSalary)}</p></div>
                    <div><label className="text-sm font-medium text-gray-500 flex items-center gap-1"><Briefcase className="w-4 h-4" /> Work Mode</label><p className="font-semibold">{employee.workMode ? employee.workMode.charAt(0).toUpperCase() + employee.workMode.slice(1) : 'Not specified'}</p></div>
                    <div><label className="text-sm font-medium text-gray-500 flex items-center gap-1"><User className="w-4 h-4" /> Reporting Manager</label><p className="font-semibold">{employee.reportingManagerName || 'Not assigned'}</p></div>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-700 flex items-center gap-2"><Contact className="w-5 h-5" /> Emergency Contact</h3>
                  <div className="space-y-3">
                    <div><label className="text-sm font-medium text-gray-500">Contact Name</label><p className="font-semibold">{employee.emergencyContact?.name || 'Not provided'}</p></div>
                    <div><label className="text-sm font-medium text-gray-500">Contact Number</label><p className="font-semibold">{employee.emergencyContact?.phone || 'Not provided'}</p></div>
                  </div>
                </div>

                {/* Bank Details */}
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-700 flex items-center gap-2"><Banknote className="w-5 h-5" /> Bank Details</h3>
                  <div className="space-y-3">
                    <div><label className="text-sm font-medium text-gray-500">Bank Name</label><p className="font-semibold">{employee.bankDetails?.bankName || 'Not provided'}</p></div>
                    <div><label className="text-sm font-medium text-gray-500">Account Number</label><p className="font-semibold">{employee.bankDetails?.accountNumber || 'Not provided'}</p></div>
                    <div><label className="text-sm font-medium text-gray-500">IFSC Code</label><p className="font-semibold">{employee.bankDetails?.ifscCode || 'Not provided'}</p></div>
                  </div>
                </div>
              </div>
              {employee.addedBy && <div className="text-sm text-gray-500 mt-4">Added by admin ID: {employee.addedBy}</div>}
            </TabsContent>

            <TabsContent value="salary">
              {salaryLoaded ? (
                <SalarySlider employeeId={employee.id} />
              ) : (
                <div className="p-4 text-center text-gray-500">Click the “Salary Details” tab to load salary information.</div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
});

EmployeeDetailsDialog.displayName = 'EmployeeDetailsDialog';

export default EmployeeDetailsDialog;