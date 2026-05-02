import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Badge } from '../../ui/badge';
import { User, Building2 } from 'lucide-react';

// ✅ Import central Employee type
import type { Employee } from '@/types/employee';

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
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl sm:text-2xl">
            <User className="h-5 w-5" />
            {title} ({employees.length})
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Active Employees */}
          <div>
            <h3 className="text-lg font-semibold text-green-600 mb-3">Active ({activeEmployees.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {activeEmployees.map((employee) => (
                <div key={employee.id} className="p-3 sm:p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm sm:text-base">{employee.name}</h4>
                        <p className="text-xs sm:text-sm text-gray-600">{employee.designation}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Building2 className="h-3 w-3 text-gray-500" />
                          <span className="text-xs text-gray-500">{employee.department}</span>
                        </div>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-700 text-xs whitespace-nowrap">Active</Badge>
                  </div>
                  <div className="mt-2 text-xs space-y-1">
                    <p><span className="font-medium">ID:</span> {employee.employeeId}</p>
                    <p className="truncate"><span className="font-medium">Email:</span> {employee.email}</p>
                    {employee.joiningDate && (
                      <p><span className="font-medium">Joined:</span> {new Date(employee.joiningDate).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              ))}
              {activeEmployees.length === 0 && (
                <p className="text-sm text-gray-500 italic col-span-2">No active employees</p>
              )}
            </div>
          </div>

          {/* Inactive Employees */}
          {inactiveEmployees.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-red-600 mb-3">Inactive ({inactiveEmployees.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {inactiveEmployees.map((employee) => (
                  <div key={employee.id} className="p-3 sm:p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm sm:text-base">{employee.name}</h4>
                          <p className="text-xs sm:text-sm text-gray-600">{employee.designation}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Building2 className="h-3 w-3 text-gray-500" />
                            <span className="text-xs text-gray-500">{employee.department}</span>
                          </div>
                        </div>
                      </div>
                      <Badge className="bg-red-100 text-red-700 text-xs whitespace-nowrap">Inactive</Badge>
                    </div>
                    <div className="mt-2 text-xs space-y-1">
                      <p><span className="font-medium">ID:</span> {employee.employeeId}</p>
                      <p className="truncate"><span className="font-medium">Email:</span> {employee.email}</p>
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