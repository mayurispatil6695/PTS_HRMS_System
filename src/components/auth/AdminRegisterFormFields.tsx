
import React from 'react';
import { User, Mail, Phone, Building, UserCog, Shield } from 'lucide-react';
import { Input } from '../ui/input';

interface FormData {
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  companyName: string;
  password: string;
  confirmPassword: string;
}

interface AdminRegisterFormFieldsProps {
  formData: FormData;
  onChange: (field: keyof FormData, value: string) => void;
}

const AdminRegisterFormFields: React.FC<AdminRegisterFormFieldsProps> = ({
  formData,
  onChange
}) => {
  return (
    <>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Full Name</label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Enter full name"
              value={formData.name}
              onChange={(e) => onChange('name', e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              type="email"
              placeholder="admin@company.com"
              value={formData.email}
              onChange={(e) => onChange('email', e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Phone Number</label>
          <div className="relative">
            <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              type="tel"
              placeholder="Enter phone number"
              value={formData.phone}
              onChange={(e) => onChange('phone', e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Company Name</label>
          <div className="relative">
            <Building className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Enter company name"
              value={formData.companyName}
              onChange={(e) => onChange('companyName', e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Department</label>
          <div className="relative">
            <UserCog className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              value={formData.department}
              onChange={(e) => onChange('department', e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Designation</label>
          <div className="relative">
            <Shield className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              value={formData.designation}
              onChange={(e) => onChange('designation', e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Password</label>
          <Input
            type="password"
            placeholder="Create password (min 6 chars)"
            value={formData.password}
            onChange={(e) => onChange('password', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Confirm Password</label>
          <Input
            type="password"
            placeholder="Confirm password"
            value={formData.confirmPassword}
            onChange={(e) => onChange('confirmPassword', e.target.value)}
            required
          />
        </div>
      </div>
    </>
  );
};

export default AdminRegisterFormFields;
