// src/hooks/useEmployeeManagement.ts
import { useState, useEffect } from 'react';
import bcrypt from 'bcryptjs';
import { useToast } from './use-toast';
import { ref, onValue, set, update, remove, get } from "firebase/database";
import { database } from "../firebase";
import { useAuth } from './useAuth';
import { addAuditLog } from '../utils/auditLog';

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
  role?: 'employee' | 'team_leader' | 'team_manager' | 'client';
  addedBy?: string;
  adminId?: string;
}

interface NewEmployee {
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  password: string;
  profileImage: string;
  role: 'employee' | 'team_leader' | 'team_manager' | 'client';
}

export const useEmployeeManagement = () => {
  const { user: currentUser } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const isAdmin = currentUser?.role === 'admin';

  const departments = [
    'Software Development',
    'Digital Marketing',
    'Cyber Security',
    'Sales',
    'Product Designing',
    'Web Development',
    'Graphic Designing', 
    'Artificial Intelligence'
  ];

  const designations = [
    'Junior Developer',
    'Senior Developer',
    'Team Lead',
    'Marketing Executive',
    'Sales Executive',
    'Designer',
    'Manager'
  ];

  // Load employees – admin reads from global "employees" node, others from their admin's sub‑node
  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    
    if (isAdmin) {
      const employeesRef = ref(database, "employees");
      const unsubscribe = onValue(employeesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const employeeList: Employee[] = Object.entries(data).map(([id, emp]) => ({
            id,
            ...(emp as Omit<Employee, 'id'>)
          }));
          setEmployees(employeeList);
          console.log(`✅ Admin: Loaded ${employeeList.length} employees from global node`);
        } else {
          setEmployees([]);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      const adminId = currentUser.adminUid || currentUser.id;
      const employeesRef = ref(database, `users/${adminId}/employees`);
      const unsubscribe = onValue(employeesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const employeeList: Employee[] = Object.entries(data).map(([id, emp]) => ({
            id,
            ...(emp as Omit<Employee, 'id'>)
          }));
          setEmployees(employeeList);
          console.log(`✅ Regular user: Loaded ${employeeList.length} employees`);
        } else {
          setEmployees([]);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [currentUser, isAdmin]);

  // Filtering logic
  useEffect(() => {
    let filtered = employees;

    if (searchTerm) {
      filtered = filtered.filter(emp => 
        emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employeeId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterDepartment !== 'all') {
      filtered = filtered.filter(emp => emp.department === filterDepartment);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(emp => 
        filterStatus === 'active' ? emp.isActive : !emp.isActive
      );
    }

    setFilteredEmployees(filtered);
  }, [employees, searchTerm, filterDepartment, filterStatus]);

  // Add Employee
  const addEmployee = async (newEmployee: NewEmployee) => {
    if (!newEmployee.name || !newEmployee.email || !newEmployee.phone || 
        !newEmployee.department || !newEmployee.designation || !newEmployee.password) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return false;
    }

    if (!currentUser) {
      toast({
        title: "Error",
        description: "You must be logged in to add employees",
        variant: "destructive",
      });
      return false;
    }

    try {
      const empId = `EMP${Date.now().toString().slice(-6)}`;
      const id = Date.now().toString();

      const employee: Employee = {
        id,
        name: newEmployee.name,
        email: newEmployee.email,
        phone: newEmployee.phone,
        department: newEmployee.department,
        designation: newEmployee.designation,
        employeeId: empId,
        role: newEmployee.role || 'employee',
        isActive: true,
        createdAt: new Date().toISOString(),
        profileImage: newEmployee.profileImage,
        addedBy: currentUser.id,
        adminId: currentUser.id,
      };

      const hashedPassword = bcrypt.hashSync(newEmployee.password, 10);
      const isFirstTimeLogin = true;

      if (isAdmin) {
        await set(ref(database, `employees/${id}`), employee);
        await set(ref(database, `employees/${id}/hashedPassword`), hashedPassword);
        await set(ref(database, `employees/${id}/isFirstTimeLogin`), isFirstTimeLogin);
        await set(ref(database, `users/${currentUser.id}/employees/${id}`), employee);
      } else {
        const adminId = currentUser.adminUid || currentUser.id;
        await set(ref(database, `users/${adminId}/employees/${id}`), employee);
        await set(ref(database, `users/${adminId}/employees/${id}/hashedPassword`), hashedPassword);
        await set(ref(database, `users/${adminId}/employees/${id}/isFirstTimeLogin`), isFirstTimeLogin);
      }

      // ✅ Audit log: employee added
      await addAuditLog({
        action: 'employee_added',
        performedBy: currentUser.id,
        performedByName: currentUser.name || 'Admin',
        targetId: id,
        details: {
          name: newEmployee.name,
          email: newEmployee.email,
          role: newEmployee.role,
          department: newEmployee.department,
          designation: newEmployee.designation,
        },
      });

      toast({
        title: "Success",
        description: `Employee added successfully. ID: ${empId}`,
      });
      return true;
    } catch (error) {
      console.error('Error adding employee:', error);
      toast({
        title: "Error",
        description: "Failed to add employee",
        variant: "destructive",
      });
      return false;
    }
  };

  // Toggle Status
  const toggleEmployeeStatus = async (employeeId: string) => {
    try {
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) return;

      const newStatus = !employee.isActive;
      if (isAdmin) {
        await update(ref(database, `employees/${employeeId}`), { isActive: newStatus });
        const adminId = employee.addedBy || currentUser?.id;
        if (adminId) {
          await update(ref(database, `users/${adminId}/employees/${employeeId}`), { isActive: newStatus }).catch(() => {});
        }
      } else {
        const adminId = currentUser?.adminUid || currentUser?.id;
        await update(ref(database, `users/${adminId}/employees/${employeeId}`), { isActive: newStatus });
      }

      // ✅ Audit log: status toggled
      await addAuditLog({
        action: 'employee_status_toggled',
        performedBy: currentUser?.id || 'unknown',
        performedByName: currentUser?.name || 'System',
        targetId: employeeId,
        details: {
          employeeName: employee.name,
          oldStatus: employee.isActive ? 'active' : 'inactive',
          newStatus: newStatus ? 'active' : 'inactive',
        },
      });

      toast({ title: "Success", description: "Employee status updated successfully" });
    } catch (error) {
      console.error('Error toggling status:', error);
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  // Delete Employee
  const deleteEmployee = async (employeeId: string) => {
    try {
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) return;

      if (isAdmin) {
        await remove(ref(database, `employees/${employeeId}`));
        const adminId = employee.addedBy || currentUser?.id;
        if (adminId) {
          await remove(ref(database, `users/${adminId}/employees/${employeeId}`)).catch(() => {});
        }
      } else {
        const adminId = currentUser?.adminUid || currentUser?.id;
        await remove(ref(database, `users/${adminId}/employees/${employeeId}`));
      }

      // ✅ Audit log: employee deleted
      await addAuditLog({
        action: 'employee_deleted',
        performedBy: currentUser?.id || 'unknown',
        performedByName: currentUser?.name || 'System',
        targetId: employeeId,
        details: {
          employeeName: employee.name,
          email: employee.email,
          role: employee.role,
        },
      });

      toast({ title: "Success", description: "Employee deleted successfully" });
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast({ title: "Error", description: "Failed to delete employee", variant: "destructive" });
    }
  };

  // Update Employee
  const updateEmployee = async (employeeId: string, updatedData: Partial<Employee>) => {
    try {
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) return false;

      if (isAdmin) {
        await update(ref(database, `employees/${employeeId}`), updatedData);
        const adminId = employee.addedBy || currentUser?.id;
        if (adminId) {
          await update(ref(database, `users/${adminId}/employees/${employeeId}`), updatedData).catch(() => {});
        }
      } else {
        const adminId = currentUser?.adminUid || currentUser?.id;
        await update(ref(database, `users/${adminId}/employees/${employeeId}`), updatedData);
      }

      toast({ title: "Success", description: "Employee updated successfully" });
      return true;
    } catch (error) {
      console.error('Error updating employee:', error);
      toast({ title: "Error", description: "Failed to update employee", variant: "destructive" });
      return false;
    }
  };

  // Get employees by admin (admin only)
  const getEmployeesByAdmin = () => {
    if (!isAdmin) return {};
    const groupedByAdmin: Record<string, Employee[]> = {};
    employees.forEach(employee => {
      const adminId = employee.addedBy || 'unknown';
      if (!groupedByAdmin[adminId]) groupedByAdmin[adminId] = [];
      groupedByAdmin[adminId].push(employee);
    });
    return groupedByAdmin;
  };

  // Export
  const exportData = () => {
    const headers = ['Name', 'Email', 'Phone', 'Department', 'Designation', 'Employee ID', 'Role', 'Status', 'Added By', 'Created At'];
    const rows = filteredEmployees.map(emp => [
      emp.name,
      emp.email,
      emp.phone,
      emp.department,
      emp.designation,
      emp.employeeId,
      emp.role || 'employee',
      emp.isActive ? 'Active' : 'Inactive',
      emp.addedBy || 'System',
      new Date(emp.createdAt).toLocaleDateString()
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employees_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({ title: "Success", description: "Employee data exported successfully" });
  };

  return {
    employees,
    filteredEmployees,
    searchTerm,
    setSearchTerm,
    filterDepartment,
    setFilterDepartment,
    filterStatus,
    setFilterStatus,
    selectedEmployee,
    setSelectedEmployee,
    currentPage,
    setCurrentPage,
    departments,
    designations,
    addEmployee,
    toggleEmployeeStatus,
    deleteEmployee,
    updateEmployee,
    exportData,
    getEmployeesByAdmin,
    loading,
    isAdmin,
    totalEmployees: employees.length,
    activeEmployees: employees.filter(emp => emp.isActive).length,
    inactiveEmployees: employees.filter(emp => !emp.isActive).length
  };
};