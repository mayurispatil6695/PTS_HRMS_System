import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Plus, Upload, Camera, User, Phone, Calendar, DollarSign, Edit } from 'lucide-react';
import { getDatabase, ref, set, update ,push,onValue} from 'firebase/database';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, database } from '../../../firebase';
import { useAuth } from '../../../hooks/useAuth';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { Calendar as CalendarComp } from '../../ui/calendar';
import { format } from 'date-fns';
import { cn } from '../../../lib/utils';
import { toast } from 'sonner';
import type { Employee } from './EmployeeList'; // adjust path if needed



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
  role: 'employee' | 'team_leader' | 'team_manager' | 'client';   // ✅ new
}

interface AddEmployeeDialogProps {
  departments: string[];
  designations: string[]; // ✅ add this
  onSuccess?: (employeeUid: string) => void;
  onAddEmployee?: (newEmployee: NewEmployee) => Promise<boolean>;
  employeeToEdit?: Employee|null;
  onEditSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const departmentDesignations = {
  'Web Development': [
    'Web Development Intern',
    'Web Development Trainee',
    'Web Developer',
    'Frontend Developer',
    'Backend Developer',
    'Full Stack Developer',
    'Team Lead',
    'Web Development Manager',
    'Senior Web Developer',
    'Lead Web Developer',
    'UI/UX Developer'
  ],
  'Software Development': [
    'Software Developer Intern',
    'Software Developer Trainee',
    'Junior Software Developer',
    'Software Developer',
    'Senior Software Developer',
    'Team Lead',
    'Software Development Manager',
    'Lead Software Developer',
    'DevOps Engineer',
    'QA Engineer'
  ],
  'Cyber Security': [
    'Cyber Security Intern',
    'Cyber Security Trainee',
    'Junior Cyber Security Specialist',
    'Cyber Security Specialist',
    'Cyber Senior Security Specialist',
    'Cyber Team Lead',
    'Cyber Security Manager',
    'Lead Cyber Security Specialist',
    'Cyber Security DevOps Engineer',
    'Cyber Security QA Engineer'
  ],
  'Artificial Intelligence': [
    'AI Intern',
    'AI Trainee',
    'Machine Learning Engineer',
    'Data Scientist',
    'AI Researcher',
    'Team Lead',
    'AI Manager',
    'Senior AI Engineer',
    'Computer Vision Engineer',
    'NLP Specialist'
  ],
  'Product Designing': [
    'Product Design Intern',
    'Product Design Trainee',
    'Junior Product Designer',
    'Product Designer',
    'Senior Product Designer',
    'UX Designer',
    'UI Designer',
    'Team Lead',
    'Product Design Manager',
    'Lead Product Designer'
  ],
  'Graphic Designing': [
    'Graphic Design Intern',
    'Graphic Design Trainee',
    'Junior Graphic Designer',
    'Graphic Designer',
    'Senior Graphic Designer',
    'Illustrator',
    'Motion Graphics Designer',
    'Team Lead',
    'Creative Director',
    'Art Director'
  ],
  'Digital Marketing': [
    'Digital Marketing Intern',
    'Digital Marketing Trainee',
    'Digital Marketing Executive',
    'Digital Marketing Head',
    'Digital Growth and Strategy Intern',
    'SEO Specialist',
    'Social Media Manager',
    'Content Marketer',
    'PPC Specialist',
    'Team Lead',
    'Digital Marketing Manager',
    'Growth Hacker'
  ],
  'Sales': [
    'Sales Intern',
    'Sales Trainee',
    'Sales Executive',
    'Account Executive',
    'Business Development Representative',
    'Team Lead',
    'Sales Manager',
    'Regional Sales Manager',
    'Director of Sales',
    'VP of Sales'
  ]
}

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
    role: 'employee' 
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [designations, setDesignations] = useState<string[]>([]);

  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = isControlled ? externalOnOpenChange || (() => {}) : setInternalOpen;

  const workModes = ['office', 'remote', 'hybrid'];
  const employmentTypes = ['full-time', 'part-time', 'freelancing', 'internship'];

  useEffect(() => {
    if (formData.department && departmentDesignations[formData.department as keyof typeof departmentDesignations]) {
      setDesignations(departmentDesignations[formData.department as keyof typeof departmentDesignations]);
      setFormData(prev => ({ ...prev, designation: '' }));
    } else {
      setDesignations([]);
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
          role: employeeToEdit.role || 'employee'
      });

      if (employeeToEdit.department && departmentDesignations[employeeToEdit.department as keyof typeof departmentDesignations]) {
        setDesignations(departmentDesignations[employeeToEdit.department as keyof typeof departmentDesignations]);
      }
    } else {
      setFormData({
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
         role: 'employee'
      });
      setDesignations([]);
    }
  }, [employeeToEdit]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setFormData(prev => ({ ...prev, profileImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!user || user.role !== 'admin') {
      setError('Only admins can add/edit employees');
      return;
    }

    const requiredFields = [
      'name', 'email', 'phone', 
      'department', 'designation', 'joiningDate',
      'salary', 'emergencyContactName', 'emergencyContactNumber'
    ];

    if (!employeeToEdit) {
      requiredFields.push('password');
    }

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
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          department: formData.department,
          designation: formData.designation,
          profileImage: formData.profileImage,
          joiningDate: formData.joiningDate?.toISOString(),
          salary: parseFloat(formData.salary),
          emergencyContact: {
            name: formData.emergencyContactName,
            phone: formData.emergencyContactNumber
          },
          address: formData.address,
          workMode: formData.workMode,
          employmentType: formData.employmentType,
          bankDetails: {
            accountNumber: formData.bankAccountNumber,
            bankName: formData.bankName,
            ifscCode: formData.ifscCode
          },
           role: formData.role,
          updatedAt: new Date().toISOString()
        };

      const employeeRef = ref(database, `users/${user.id}/employees/${employeeToEdit.id}`);
await update(employeeRef, employeeData);
        const employeeSelfRef = ref(database, `users/${employeeToEdit.id}/profile`);
await update(employeeSelfRef, employeeData);

        toast.success('Employee updated successfully!');
        if (onEditSuccess) onEditSuccess();
      } else {
        const adminEmail = auth.currentUser?.email;
        const adminPassword = prompt("Please re-enter Admin password to create employee:");

        if (!adminPassword) {
          setError('Admin password is required');
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );

        await signInWithEmailAndPassword(auth, adminEmail!, adminPassword);
        const employeeUid = userCredential.user.uid;

        const employeeData = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          department: formData.department,
          designation: formData.designation,
          profileImage: formData.profileImage,
          joiningDate: formData.joiningDate?.toISOString(),
          salary: parseFloat(formData.salary),
          emergencyContact: {
            name: formData.emergencyContactName,
            phone: formData.emergencyContactNumber
          },
          address: formData.address,
          workMode: formData.workMode,
          employmentType: formData.employmentType,
          bankDetails: {
            accountNumber: formData.bankAccountNumber,
            bankName: formData.bankName,
            ifscCode: formData.ifscCode
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          role: formData.role,  
          addedBy: user.id,
          status: 'active'
        };

       
const employeeRef = ref(database, `users/${user.id}/employees/${employeeUid}`);

await set(employeeRef, {
  ...employeeData,
  adminUid: user.id   // 🔥 VERY IMPORTANT for login
});
const employeeSelfRef = ref(database, `users/${employeeUid}/profile`);
await set(employeeSelfRef, {
  ...employeeData,
  adminUid: user.id   // 🔥 IMPORTANT
});
       
        if (onSuccess) onSuccess(employeeUid);
        toast.success('Employee created successfully!');
      }

      setOpen(false);
    } catch (err: unknown) {
  console.error('Error adding/updating employee:', err);

  if (err instanceof Error) {
    setError(err.message);
  } else {
    setError(`Failed to ${employeeToEdit ? 'update' : 'create'} employee account`);
  }
  } finally {
  setLoading(false);   // 🔥 THIS FIXES YOUR ISSUE
}
};

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
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employeeToEdit ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-col items-center space-y-2">
            <div className="relative">
              <Avatar className="w-24 h-24 border-2 border-gray-200">
                <AvatarImage src={formData.profileImage} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl">
                  {formData.name ? 
                    formData.name.split(' ').map(n => n[0]).join('')
                   : (
                    <Camera className="w-8 h-8" />
                  )}
                </AvatarFallback>
              </Avatar>
              <label
                htmlFor="profile-upload"
                className="absolute -bottom-2 -right-2 bg-blue-600 text-white rounded-full p-2 cursor-pointer hover:bg-blue-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                <input
                  id="profile-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-sm text-gray-500">Click to upload profile picture</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Full Name *</label>
              <Input
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Email *</label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                disabled={loading || !!employeeToEdit}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Phone *</label>
              <Input
                placeholder="+1 (555) 123-4567"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                disabled={loading}
              />
            </div>

            {!employeeToEdit && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Password *</label>
                <Input
                  type="password"
                  placeholder="At least 6 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  disabled={loading}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Department *</label>
              <Select
                value={formData.department}
                onValueChange={(value) => setFormData({...formData, department: value})}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Designation *</label>
              <Select
                value={formData.designation}
                onValueChange={(value) => setFormData({...formData, designation: value})}
                disabled={loading || !formData.department}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.department ? "Select designation" : "Select department first"} />
                </SelectTrigger>
                <SelectContent>
                  {designations.map((des) => (
                    <SelectItem key={des} value={des}>{des}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Joining Date *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.joiningDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {formData.joiningDate ? (
                     format(formData.joiningDate, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComp
                    mode="single"
                    selected={formData.joiningDate}
                    onSelect={(date) => setFormData({...formData, joiningDate: date})}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Salary (Monthly) *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">
                  <DollarSign className="h-4 w-4" />
                </span>
                <Input
                  type="number"
                  placeholder="50000"
                  className="pl-8"
                  value={formData.salary}
                  onChange={(e) => setFormData({...formData, salary: e.target.value})}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Work Mode</label>
              <Select
                value={formData.workMode}
                onValueChange={(value) => setFormData({...formData, workMode: value})}
                disabled={loading}
              >
                <SelectTrigger>
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Employment Type</label>
              <Select
                value={formData.employmentType}
                onValueChange={(value) => setFormData({...formData, employmentType: value})}
                disabled={loading}
              >
                <SelectTrigger>
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
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Role *</label>
              <Select value={formData.role} onValueChange={(value: any) => setFormData({...formData, role: value})} disabled={loading}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="team_leader">Team Leader</SelectItem>
                  <SelectItem value="team_manager">Team Manager</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Emergency Contact Name *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">
                  <User className="h-4 w-4" />
                </span>
                <Input
                  placeholder="Emergency contact name"
                  className="pl-8"
                  value={formData.emergencyContactName}
                  onChange={(e) => setFormData({...formData, emergencyContactName: e.target.value})}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Emergency Contact Number *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">
                  <Phone className="h-4 w-4" />
                </span>
                <Input
                  placeholder="Emergency contact number"
                  className="pl-8"
                  value={formData.emergencyContactNumber}
                  onChange={(e) => setFormData({...formData, emergencyContactNumber: e.target.value})}
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Address</label>
            <Input
              placeholder="Full address"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Bank Name</label>
              <Input
                placeholder="Bank name"
                value={formData.bankName}
                onChange={(e) => setFormData({...formData, bankName: e.target.value})}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Account Number</label>
              <Input
                placeholder="Bank account number"
                value={formData.bankAccountNumber}
                onChange={(e) => setFormData({...formData, bankAccountNumber: e.target.value})}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">IFSC Code</label>
              <Input
                placeholder="IFSC code"
                value={formData.ifscCode}
                onChange={(e) => setFormData({...formData, ifscCode: e.target.value})}
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                loading ||
                !formData.name ||
                !formData.email ||
                (!employeeToEdit && !formData.password) ||
                !formData.department ||
                !formData.designation ||
                !formData.joiningDate ||
                !formData.salary ||
                !formData.emergencyContactName ||
                !formData.emergencyContactNumber ||
                (!employeeToEdit && formData.password.length < 6)
              }
            >
              {loading ? (
               <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {employeeToEdit ? 'Updating...' : 'Creating...'}
                </>
              ) : employeeToEdit ? 'Update Employee' : 'Create Employee'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddEmployeeDialog;