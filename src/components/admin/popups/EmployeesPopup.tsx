
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Badge } from '../../ui/badge';
import { User, Building2 } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  department: string;
  designation: string;
  employeeId: string;
  isActive: boolean;
  email: string;
  joinDate?: string;
}

interface EmployeesPopupProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  title: string;
}

const EmployeesPopup: React.FC<EmployeesPopupProps> = ({
  isOpen,
  onClose,
  employees,
  title
}) => {
  const activeEmployees = employees.filter(emp => emp.isActive);
  const inactiveEmployees = employees.filter(emp => !emp.isActive);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {title} ({employees.length})
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Active Employees */}
          <div>
            <h3 className="text-lg font-semibold text-green-600 mb-3">Active ({activeEmployees.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeEmployees.map((employee) => (
                <div key={employee.id} className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <User className="h-8 w-8 text-green-600 bg-green-100 rounded-full p-1" />
                      <div>
                        <h4 className="font-semibold">{employee.name}</h4>
                        <p className="text-sm text-gray-600">{employee.designation}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Building2 className="h-3 w-3 text-gray-500" />
                          <span className="text-xs text-gray-500">{employee.department}</span>
                        </div>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-700">Active</Badge>
                  </div>
                  <div className="mt-2 text-xs space-y-1">
                    <p><span className="font-medium">ID:</span> {employee.employeeId}</p>
                    <p><span className="font-medium">Email:</span> {employee.email}</p>
                    {employee.joinDate && (
                      <p><span className="font-medium">Joined:</span> {new Date(employee.joinDate).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Inactive Employees */}
          {inactiveEmployees.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-red-600 mb-3">Inactive ({inactiveEmployees.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inactiveEmployees.map((employee) => (
                  <div key={employee.id} className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <User className="h-8 w-8 text-red-600 bg-red-100 rounded-full p-1" />
                        <div>
                          <h4 className="font-semibold">{employee.name}</h4>
                          <p className="text-sm text-gray-600">{employee.designation}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Building2 className="h-3 w-3 text-gray-500" />
                            <span className="text-xs text-gray-500">{employee.department}</span>
                          </div>
                        </div>
                      </div>
                      <Badge className="bg-red-100 text-red-700">Inactive</Badge>
                    </div>
                    <div className="mt-2 text-xs space-y-1">
                      <p><span className="font-medium">ID:</span> {employee.employeeId}</p>
                      <p><span className="font-medium">Email:</span> {employee.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeesPopup;
