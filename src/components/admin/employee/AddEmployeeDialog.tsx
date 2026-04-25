import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Plus, Upload, Camera, User, Phone, Calendar, DollarSign, Edit } from 'lucide-react';
import { ref, set, update, push, onValue, off, get, runTransaction } from 'firebase/database';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, database } from '../../../firebase';
import { useAuth } from '../../../hooks/useAuth';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { Calendar as CalendarComp } from '../../ui/calendar';
import { format } from 'date-fns';
import { cn } from '../../../lib/utils';
import { toast } from 'react-hot-toast';
import type { Employee as BaseEmployee } from './EmployeeList';

interface Employee extends BaseEmployee {
  role?: 'employee' | 'team_leader' | 'team_manager' | 'client';
  managerId?: string;
}

interface NewEmployee {
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  password: string;
  profileImage: string;
  joiningDate: Date | undefined;
  salary: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  address: string;
  workMode: string;
  employmentType: string;
  bankAccountNumber: string;
  bankName: string;
  ifscCode: string;
  role: 'employee' | 'team_leader' | 'team_manager' | 'client';
  managerId: string;
}

interface AddEmployeeDialogProps {
  departments: string[];
  designations: string[];
  onSuccess?: (employeeUid: string) => void;
  onAddEmployee?: (newEmployee: NewEmployee) => Promise<boolean>;
  employeeToEdit?: Employee | null;
  onEditSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface FirebaseUserData {
  role?: string;
  name?: string;
  email?: string;
  profile?: { role?: string; name?: string; [key: string]: unknown };
  employee?: { role?: string; name?: string; [key: string]: unknown };
  [key: string]: unknown;
}

// ✅ Complete department designations
const departmentDesignations: Record<string, string[]> = {
  'Web Development': [
    'Frontend Developer', 'Backend Developer', 'Full Stack Developer','web developer',
    'Web Development Intern', 'Senior Web Developer', 'WordPress Developer','web team manager'
  ],
  'Software Development': [
    'Software Developer', 'Software Engineer', 'Senior Software Developer',
    'Software Development Manager', 'Software Development Intern', 'System Analyst'
  ],
  'Digital Marketing': [
    'SEO Specialist', 'Social Media Manager', 'Content Writer',
    'Digital Marketing Head', 'PPC Analyst', 'Email Marketing Specialist'
  ],
  'Cyber Security': [
    'Security Analyst', 'Penetration Tester', 'Security Engineer',
    'Cyber Security Intern', 'Compliance Officer'
  ],
  'Sales': [
    'Sales Executive', 'Sales Manager', 'Business Development Manager',
    'Account Manager', 'Sales Intern'
  ],
  'Product Designing': [
    'UI/UX Designer', 'Product Designer', 'Graphic Designer',
    'Design Intern', 'Senior Product Designer'
  ],
  'Graphic Designing': [
    'Graphic Designer', 'Senior Graphic Designer', 'Creative Director',
    'Motion Graphics Designer', 'Design Intern'
  ],
  'Artificial Intelligence': [
    'AI Engineer', 'ML Engineer', 'Data Scientist',
    'AI Research Intern', 'NLP Engineer'
  ]
};

const AddEmployeeDialog: React.FC<AddEmployeeDialogProps> = ({
  departments,
  onSuccess,
  employeeToEdit,
  onEditSuccess,
  open: externalOpen,
  onOpenChange: externalOnOpenChange
}) => {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  
  const [formData, setFormData] = useState<NewEmployee>({
    name: '',
    email: '',
    phone: '',
    department: '',
    designation: '',
    password: '',
    profileImage: '',
    joiningDate: undefined,
    salary: '',
    emergencyContactName: '',
    emergencyContactNumber: '',
    address: '',
    workMode: 'office',
    employmentType: 'full-time',
    bankAccountNumber: '',
    bankName: '',
    ifscCode: '',
    role: 'employee',
    managerId: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [designationsList, setDesignationsList] = useState<string[]>([]);
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState('');

  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = isControlled ? externalOnOpenChange || (() => {}) : setInternalOpen;

  const workModes = ['office', 'remote', 'hybrid'];
  const employmentTypes = ['full-time', 'part-time', 'freelancing', 'internship'];

  useEffect(() => {
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const mgrs: { id: string; name: string }[] = [];
      snapshot.forEach((child) => {
        const userData = child.val() as FirebaseUserData;
        const profile = (userData.profile || userData.employee) as { role?: string; name?: string } | undefined;
        if (profile?.role === 'team_manager') {
          mgrs.push({ id: child.key || '', name: profile.name || child.key });
        }
      });
      setManagers(mgrs);
    });
    return () => off(usersRef);
  }, []);

  useEffect(() => {
    if (formData.department && departmentDesignations[formData.department]) {
      setDesignationsList(departmentDesignations[formData.department]);
      setFormData(prev => ({ ...prev, designation: '' }));
    } else {
      setDesignationsList([]);
    }
  }, [formData.department]);

  useEffect(() => {
    if (employeeToEdit) {
      setFormData({
        name: employeeToEdit.name || '',
        email: employeeToEdit.email || '',
        phone: employeeToEdit.phone || '',
        department: employeeToEdit.department || '',
        designation: employeeToEdit.designation || '',
        password: '',
        profileImage: employeeToEdit.profileImage || '',
        joiningDate: employeeToEdit.joiningDate ? new Date(employeeToEdit.joiningDate) : undefined,
        salary: employeeToEdit.salary?.toString() || '',
        emergencyContactName: employeeToEdit.emergencyContact?.name || '',
        emergencyContactNumber: employeeToEdit.emergencyContact?.phone || '',
        address: employeeToEdit.address || '',
        workMode: employeeToEdit.workMode || 'office',
        employmentType: employeeToEdit.employmentType || 'full-time',
        bankAccountNumber: employeeToEdit.bankDetails?.accountNumber || '',
        bankName: employeeToEdit.bankDetails?.bankName || '',
        ifscCode: employeeToEdit.bankDetails?.ifscCode || '',
        role: (employeeToEdit as any).role || 'employee',
        managerId: (employeeToEdit as any).managerId || ''
      });
      setSelectedManagerId((employeeToEdit as any).managerId || '');
      if (employeeToEdit.department && departmentDesignations[employeeToEdit.department]) {
        setDesignationsList(departmentDesignations[employeeToEdit.department]);
      }
    } else {
      setFormData({
        name: '', email: '', phone: '', department: '', designation: '', password: '',
        profileImage: '', joiningDate: undefined, salary: '', emergencyContactName: '',
        emergencyContactNumber: '', address: '', workMode: 'office', employmentType: 'full-time',
        bankAccountNumber: '', bankName: '', ifscCode: '', role: 'employee', managerId: ''
      });
      setSelectedManagerId('');
      setDesignationsList([]);
    }
  }, [employeeToEdit]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setFormData(prev => ({ ...prev, profileImage: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const getNextEmployeeId = async (): Promise<string> => {
    const counterRef = ref(database, 'counters/employeeId');
    const result = await runTransaction(counterRef, (current) => {
      if (current === null) return 1;
      return current + 1;
    });
    if (!result.committed) throw new Error('Failed to generate unique employee ID');
    const nextNumber = result.snapshot.val() as number;
    return `EMP-${nextNumber.toString().padStart(5, '0')}`;
  };

  const handleSubmit = async () => {
    if (!user || user.role !== 'admin') {
      setError('Only admins can add/edit employees');
      return;
    }

    const requiredFields = [
      'name', 'email', 'phone', 'department', 'designation', 'joiningDate',
      'salary', 'emergencyContactName', 'emergencyContactNumber'
    ];
    if (!employeeToEdit) requiredFields.push('password');

    const missingFields = requiredFields.filter(field => !formData[field as keyof NewEmployee]);
    if (missingFields.length > 0) {
      setError(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return;
    }
    if (!employeeToEdit && formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (formData.emergencyContactNumber && formData.emergencyContactNumber.length < 10) {
      setError('Emergency contact number must be at least 10 digits');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (employeeToEdit) {
        const employeeData = {
          name: formData.name, email: formData.email, phone: formData.phone,
          department: formData.department, designation: formData.designation,
          profileImage: formData.profileImage, joiningDate: formData.joiningDate?.toISOString(),
          salary: parseFloat(formData.salary),
          emergencyContact: { name: formData.emergencyContactName, phone: formData.emergencyContactNumber },
          address: formData.address, workMode: formData.workMode, employmentType: formData.employmentType,
          bankDetails: { accountNumber: formData.bankAccountNumber, bankName: formData.bankName, ifscCode: formData.ifscCode },
          role: formData.role, managerId: selectedManagerId, updatedAt: new Date().toISOString()
        };
        await update(ref(database, `users/${user.id}/employees/${employeeToEdit.id}`), employeeData);
        await update(ref(database, `users/${employeeToEdit.id}/profile`), employeeData);
        toast.success('Employee updated successfully!');
        onEditSuccess?.();
      } else {
        const adminEmail = auth.currentUser?.email;
        const adminPassword = prompt("Please re-enter Admin password to create employee:");
        if (!adminPassword) { setError('Admin password is required'); setLoading(false); return; }

        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        await signInWithEmailAndPassword(auth, adminEmail!, adminPassword);
        const employeeUid = userCredential.user.uid;
        const employeeId = await getNextEmployeeId();

        const employeeData = {
          employeeId, name: formData.name, email: formData.email, phone: formData.phone,
          department: formData.department, designation: formData.designation,
          profileImage: formData.profileImage, joiningDate: formData.joiningDate?.toISOString(),
          salary: parseFloat(formData.salary),
          emergencyContact: { name: formData.emergencyContactName, phone: formData.emergencyContactNumber },
          address: formData.address, workMode: formData.workMode, employmentType: formData.employmentType,
          bankDetails: { accountNumber: formData.bankAccountNumber, bankName: formData.bankName, ifscCode: formData.ifscCode },
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          role: formData.role, managerId: selectedManagerId, addedBy: user.id, status: 'active'
        };
        await set(ref(database, `users/${user.id}/employees/${employeeUid}`), { ...employeeData, adminUid: user.id });
        await set(ref(database, `users/${employeeUid}/profile`), { ...employeeData, adminUid: user.id });
        onSuccess?.(employeeUid);
        toast.success('Employee created successfully!');
      }
      setOpen(false);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : `Failed to ${employeeToEdit ? 'update' : 'create'} employee`);
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = loading || !formData.name || !formData.email ||
    (!employeeToEdit && !formData.password) || !formData.department || !formData.designation ||
    !formData.joiningDate || !formData.salary || !formData.emergencyContactName ||
    !formData.emergencyContactNumber || (!employeeToEdit && formData.password.length < 6);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-center">
              {employeeToEdit ? 'Updating employee, please wait...' : 'Creating employee, please wait...'}
            </p>
          </div>
        </div>
      )}

      {!employeeToEdit && (
        <DialogTrigger asChild>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> Add Employee
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employeeToEdit ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}

          {/* Profile picture upload */}
          <div className="flex flex-col items-center space-y-2">
            <div className="relative">
              <Avatar className="w-24 h-24 border-2 border-gray-200">
                <AvatarImage src={formData.profileImage} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl">
                  {formData.name ? formData.name.split(' ').map(n => n[0]).join('') : <Camera className="w-8 h-8" />}
                </AvatarFallback>
              </Avatar>
              <label htmlFor="profile-upload" className="absolute -bottom-2 -right-2 bg-blue-600 text-white rounded-full p-2 cursor-pointer hover:bg-blue-700">
                <Upload className="w-4 h-4" />
                <input id="profile-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>
            <p className="text-sm text-gray-500">Click to upload profile picture</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="text-sm font-medium">Name *</label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
            <div><label className="text-sm font-medium">Email *</label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
            <div><label className="text-sm font-medium">Phone *</label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
            <div><label className="text-sm font-medium">Department *</label>
              <Select value={formData.department} onValueChange={(val) => setFormData({...formData, department: val})}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">Designation *</label>
              <Select value={formData.designation} onValueChange={(val) => setFormData({...formData, designation: val})} disabled={!formData.department}>
                <SelectTrigger><SelectValue placeholder={formData.department ? "Select designation" : "Select department first"} /></SelectTrigger>
                <SelectContent>
                  {designationsList.map(des => <SelectItem key={des} value={des}>{des}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">Role</label>
              <Select value={formData.role} onValueChange={(val: any) => setFormData({...formData, role: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="team_leader">Team Lead</SelectItem>
                  <SelectItem value="team_manager">Team Manager</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">Manager (if any)</label>
              <Select value={selectedManagerId || "none"} onValueChange={(val) => setSelectedManagerId(val === "none" ? "" : val)}>
                <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {managers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">Joining Date *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.joiningDate && "text-muted-foreground")}>
                    <Calendar className="mr-2 h-4 w-4" />
                    {formData.joiningDate ? format(formData.joiningDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComp mode="single" selected={formData.joiningDate} onSelect={(date) => setFormData({...formData, joiningDate: date})} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div><label className="text-sm font-medium">Salary *</label><Input type="number" value={formData.salary} onChange={e => setFormData({...formData, salary: e.target.value})} /></div>
            <div><label className="text-sm font-medium">Emergency Contact Name *</label><Input value={formData.emergencyContactName} onChange={e => setFormData({...formData, emergencyContactName: e.target.value})} /></div>
            <div><label className="text-sm font-medium">Emergency Contact Number *</label><Input value={formData.emergencyContactNumber} onChange={e => setFormData({...formData, emergencyContactNumber: e.target.value})} /></div>
            <div className="md:col-span-2"><label className="text-sm font-medium">Address</label><Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
            <div><label className="text-sm font-medium">Work Mode</label>
              <Select value={formData.workMode} onValueChange={(val) => setFormData({...formData, workMode: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{workModes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">Employment Type</label>
              <Select value={formData.employmentType} onValueChange={(val) => setFormData({...formData, employmentType: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{employmentTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">Bank Account Number</label><Input value={formData.bankAccountNumber} onChange={e => setFormData({...formData, bankAccountNumber: e.target.value})} /></div>
            <div><label className="text-sm font-medium">Bank Name</label><Input value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} /></div>
            <div><label className="text-sm font-medium">IFSC Code</label><Input value={formData.ifscCode} onChange={e => setFormData({...formData, ifscCode: e.target.value})} /></div>
            {!employeeToEdit && <div><label className="text-sm font-medium">Password *</label><Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} /></div>}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => { setOpen(false); setError(null); }} disabled={loading}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitDisabled}>
              {loading ? (employeeToEdit ? 'Updating...' : 'Creating...') : (employeeToEdit ? 'Update Employee' : 'Create Employee')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddEmployeeDialog;