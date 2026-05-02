import React, { useEffect, useState, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Eye, Edit, Trash2, Mail, Phone, User } from 'lucide-react';
import { ref, onValue, off, update, remove, get } from 'firebase/database';
import { database } from '../../../firebase';
import { useAuth } from '../../../hooks/useAuth';
import { toast } from 'react-hot-toast';
import EmployeeFilters from './EmployeeFilters';
import AddEmployeeDialog from './AddEmployeeDialog';
import type { Employee } from '@/types/employee';

interface FirebaseEmployeeData {
  name?: string;
  email?: string;
  phone?: string;
  department?: string;
  designation?: string;
  employeeId?: string;
  status?: string;
  createdAt?: string;
  profileImage?: string;
  addedBy?: string;
  joiningDate?: string;
  salary?: number;
  emergencyContact?: { name?: string; phone?: string };
  address?: string;
  workMode?: string;
  employmentType?: string;
  bankDetails?: { accountNumber?: string; bankName?: string; ifscCode?: string };
  managerId?: string;
  reportingManagerName?: string;
}

const EmployeeListItem = memo(({ 
  employee, 
  onView, 
  onEdit, 
  onToggleStatus, 
  onDelete 
}: { 
  employee: Employee; 
  onView: (emp: Employee) => void; 
  onEdit: (emp: Employee) => void; 
  onToggleStatus: (id: string) => void; 
  onDelete: (id: string) => void; 
}) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: 0.05 * (Number(employee.id?.slice(-2)) || 0) }}
    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
  >
    <div className="flex gap-4">
      <Avatar className="w-12 h-12">
        <AvatarImage src={employee.profileImage} />
        <AvatarFallback>{employee.name?.charAt(0)}</AvatarFallback>
      </Avatar>
      <div>
        <h3 className="font-semibold">{employee.name}</h3>
        <div className="flex flex-wrap gap-2 text-sm text-gray-600">
          <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{employee.email}</span>
          <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{employee.phone}</span>
          <span className="flex items-center gap-1"><User className="w-3 h-3" />{employee.employeeId}</span>
        </div>
        <div className="text-sm text-gray-500">{employee.designation} • {employee.department}</div>
      </div>
    </div>
    <div className="flex flex-wrap gap-2 mt-2 sm:mt-0 sm:flex-nowrap">
      <Button variant="ghost" size="icon" onClick={() => onView(employee)}><Eye className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" onClick={() => onEdit(employee)}><Edit className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" onClick={() => onToggleStatus(employee.id)}>
        {employee.isActive ? <span className="text-xs bg-yellow-100 p-1 rounded">Off</span> : <span className="text-xs bg-green-100 p-1 rounded">On</span>}
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onDelete(employee.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
    </div>
  </motion.div>
));

interface EmployeeListProps {
  onViewEmployee: (employee: Employee) => void;
}

const EmployeeList: React.FC<EmployeeListProps> = ({ onViewEmployee }) => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [departments, setDepartments] = useState<string[]>([]);
  const [designations, setDesignations] = useState<string[]>([]);
  const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    const usersRef = ref(database, "users");
    setLoading(true);
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const employeesMap = new Map<string, Employee>();
      const deptSet = new Set<string>();
      const desigSet = new Set<string>();
      snapshot.forEach((adminSnap) => {
        const adminEmployees = adminSnap.child("employees").val() as Record<string, FirebaseEmployeeData> | null;
        if (adminEmployees && typeof adminEmployees === 'object') {
          Object.entries(adminEmployees).forEach(([empId, empData]) => {
            if (empData.status === 'inactive') return;
            if (employeesMap.has(empId)) return;
            employeesMap.set(empId, {
              id: empId,
              name: empData.name || '',
              email: empData.email || '',
              phone: empData.phone || '',
              department: empData.department || '',
              designation: empData.designation || '',
              employeeId: empData.employeeId || `EMP-${empId.slice(0, 8)}`,
              isActive: empData.status === 'active',
              status: empData.status || 'active',
              createdAt: empData.createdAt || '',
              profileImage: empData.profileImage,
              addedBy: empData.addedBy,
              joiningDate: empData.joiningDate,
              salary: empData.salary,
              emergencyContact: empData.emergencyContact,
              address: empData.address,
              workMode: empData.workMode,
              employmentType: empData.employmentType,
              bankDetails: empData.bankDetails,
              managerId: empData.managerId || '',
              reportingManagerName: empData.reportingManagerName || '',
            });
            if (empData.department) deptSet.add(empData.department);
            if (empData.designation) desigSet.add(empData.designation);
          });
        }
      });
      setEmployees(Array.from(employeesMap.values()));
      setFilteredEmployees(Array.from(employeesMap.values()));
      setDepartments(Array.from(deptSet));
      setDesignations(Array.from(desigSet));
      setLoading(false);
    }, (error) => {
      console.error(error);
      setError('Failed to load employees');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    let result = [...employees];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(emp =>
        emp.name?.toLowerCase().includes(term) ||
        emp.email?.toLowerCase().includes(term) ||
        emp.employeeId?.toLowerCase().includes(term)
      );
    }
    if (filterDepartment !== 'all') result = result.filter(emp => emp.department === filterDepartment);
    if (filterStatus !== 'all') result = result.filter(emp => emp.isActive === (filterStatus === 'active'));
    setFilteredEmployees(result);
    setCurrentPage(1);
  }, [searchTerm, filterDepartment, filterStatus, employees]);

  const indexOfLastEmployee = currentPage * itemsPerPage;
  const indexOfFirstEmployee = indexOfLastEmployee - itemsPerPage;
  const currentEmployees = filteredEmployees.slice(indexOfFirstEmployee, indexOfLastEmployee);
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  const handleToggleStatus = useCallback(async (employeeId: string) => {
    if (!user) return;
    try {
      const employeeRef = ref(database, `users/${user.id}/employees/${employeeId}`);
      const employeeSelfRef = ref(database, `users/${employeeId}/employee`);
      const employee = employees.find(e => e.id === employeeId);
      if (!employee) return;
      const newStatus = employee.isActive ? 'inactive' : 'active';
      await update(employeeRef, { status: newStatus });
      await update(employeeSelfRef, { status: newStatus });
      toast.success(`Employee status updated to ${newStatus}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update employee status');
    }
  }, [user, employees]);

  const handleDeleteEmployee = useCallback(async (employeeId: string) => {
    if (!window.confirm('Delete this employee?')) return;
    try {
      const usersSnap = await get(ref(database, "users"));
      const deletePromises: Promise<void>[] = [];
      usersSnap.forEach((adminSnap) => {
        const adminId = adminSnap.key;
        deletePromises.push(remove(ref(database, `users/${adminId}/employees/${employeeId}`)));
      });
      await Promise.all(deletePromises);
      await remove(ref(database, `users/${employeeId}/employee`));
      await remove(ref(database, `users/${employeeId}/profile`));
      setEmployees(prev => prev.filter(emp => emp.id !== employeeId));
      setFilteredEmployees(prev => prev.filter(emp => emp.id !== employeeId));
      toast.success('Employee deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete employee');
    }
  }, []);

  const handleEditEmployee = useCallback((employee: Employee) => {
    setEmployeeToEdit(employee);
    setEditDialogOpen(true);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setEditDialogOpen(false);
    setEmployeeToEdit(null);
    toast.success('Employee updated successfully');
  }, []);

  if (loading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" /></div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;

  return (
    <div className="space-y-4">
      {employeeToEdit && (
        <AddEmployeeDialog
          departments={departments}
          designations={designations}
          employeeToEdit={employeeToEdit}
          onEditSuccess={handleEditSuccess}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
        />
      )}
      <EmployeeFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterDepartment={filterDepartment}
        setFilterDepartment={setFilterDepartment}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        departments={departments}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <span>Employees ({filteredEmployees.length})</span>
            <Badge variant="outline">{filteredEmployees.filter(e => e.isActive).length} Active</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEmployees.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No employees found</div>
          ) : (
            <>
              <div className="space-y-4">
                {currentEmployees.map((employee) => (
                  <EmployeeListItem
                    key={employee.id}
                    employee={employee}
                    onView={onViewEmployee}
                    onEdit={handleEditEmployee}
                    onToggleStatus={handleToggleStatus}
                    onDelete={handleDeleteEmployee}
                  />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p-1)}>Previous</Button>
                  <span className="py-2 px-3">{currentPage} / {totalPages}</span>
                  <Button variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p+1)}>Next</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeList;