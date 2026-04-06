import { useState, useEffect } from 'react';
import bcrypt from 'bcryptjs';
import { useToast } from './use-toast';
import { ref, onValue, set, update, remove, get, query, orderByChild, equalTo } from "firebase/database";
import { database } from "../firebase";
import { useAuth } from './useAuth';

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
   role: 'employee' | 'team_leader' | 'team_manager' | 'client'; // ✅ new
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

  // Check if current user is admin
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

  // ✅ Load employees from Firebase (REALTIME) - Admin sees ALL employees
  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    
    if (isAdmin) {
      // ADMIN: Fetch ALL employees from the entire database
      const employeesRef = ref(database, "employees");

      const unsubscribe = onValue(employeesRef, (snapshot) => {
        const data = snapshot.val();

        if (data) {
          const employeeList: Employee[] = Object.keys(data).map((key) => ({
            id: key,
            ...data[key]
          }));
          setEmployees(employeeList);
          console.log(`✅ Admin: Loaded ${employeeList.length} employees from all admins`);
        } else {
          setEmployees([]);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      // REGULAR USER: Fetch only employees added by their admin
      const adminId = currentUser.adminUid || currentUser.id;
      const employeesRef = ref(database, `users/${adminId}/employees`);

      const unsubscribe = onValue(employeesRef, (snapshot) => {
        const data = snapshot.val();

        if (data) {
          const employeeList: Employee[] = Object.keys(data).map((key) => ({
            id: key,
            ...data[key]
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

  // ✅ Filtering logic
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

  // ✅ Add Employee (Firebase) - Admin adds to global employees
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

      const employee = {
        id,
        name: newEmployee.name,
        email: newEmployee.email,
        phone: newEmployee.phone,
        department: newEmployee.department,
        designation: newEmployee.designation,
        employeeId: empId,
      role: newEmployee.role || 'employee',      // ✅ role from form
        isActive: true,
        createdAt: new Date().toISOString(),
        hashedPassword: bcrypt.hashSync(newEmployee.password, 10),
        profileImage: newEmployee.profileImage,
        isFirstTimeLogin: true,
        addedBy: currentUser.id,
        adminId: currentUser.id,
        addedByEmail: currentUser.email
      };

      if (isAdmin) {
        // ADMIN: Save to global employees node
        await set(ref(database, `employees/${id}`), employee);
        
        // Also save to admin's employee list for backward compatibility
        await set(ref(database, `users/${currentUser.id}/employees/${id}`), employee);
      } else {
        // REGULAR USER: Save only to their admin's employee list
        const adminId = currentUser.adminUid || currentUser.id;
        await set(ref(database, `users/${adminId}/employees/${id}`), employee);
      }

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

  // ✅ Toggle Status
  const toggleEmployeeStatus = async (employeeId: string) => {
    try {
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) return;

      if (isAdmin) {
        // ADMIN: Update in global employees node
        await update(ref(database, `employees/${employeeId}`), {
          isActive: !employee.isActive
        });
        
        // Also update in admin's employee list if it exists
        const adminId = employee.addedBy || currentUser?.id;
        if (adminId) {
          await update(ref(database, `users/${adminId}/employees/${employeeId}`), {
            isActive: !employee.isActive
          }).catch(() => {}); // Ignore if not found
        }
      } else {
        // REGULAR USER: Update in their admin's employee list
        const adminId = currentUser?.adminUid || currentUser?.id;
        await update(ref(database, `users/${adminId}/employees/${employeeId}`), {
          isActive: !employee.isActive
        });
      }

      toast({
        title: "Success",
        description: "Employee status updated successfully",
      });
    } catch (error) {
      console.error('Error toggling status:', error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  // ✅ Delete Employee
  const deleteEmployee = async (employeeId: string) => {
    try {
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) return;

      if (isAdmin) {
        // ADMIN: Delete from global employees node
        await remove(ref(database, `employees/${employeeId}`));
        
        // Also delete from admin's employee list if it exists
        const adminId = employee.addedBy || currentUser?.id;
        if (adminId) {
          await remove(ref(database, `users/${adminId}/employees/${employeeId}`)).catch(() => {});
        }
      } else {
        // REGULAR USER: Delete from their admin's employee list
        const adminId = currentUser?.adminUid || currentUser?.id;
        await remove(ref(database, `users/${adminId}/employees/${employeeId}`));
      }

      toast({
        title: "Success",
        description: "Employee deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast({
        title: "Error",
        description: "Failed to delete employee",
        variant: "destructive",
      });
    }
  };

  // ✅ Update Employee
  const updateEmployee = async (employeeId: string, updatedData: Partial<Employee>) => {
    try {
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) return false;

      if (isAdmin) {
        // ADMIN: Update in global employees node
        await update(ref(database, `employees/${employeeId}`), updatedData);
        
        // Also update in admin's employee list if it exists
        const adminId = employee.addedBy || currentUser?.id;
        if (adminId) {
          await update(ref(database, `users/${adminId}/employees/${employeeId}`), updatedData).catch(() => {});
        }
      } else {
        // REGULAR USER: Update in their admin's employee list
        const adminId = currentUser?.adminUid || currentUser?.id;
        await update(ref(database, `users/${adminId}/employees/${employeeId}`), updatedData);
      }

      toast({
        title: "Success",
        description: "Employee updated successfully",
      });
      
      return true;
    } catch (error) {
      console.error('Error updating employee:', error);
      toast({
        title: "Error",
        description: "Failed to update employee",
        variant: "destructive",
      });
      return false;
    }
  };

  // ✅ Get employees by admin (for filtering in admin view)
  const getEmployeesByAdmin = () => {
    if (!isAdmin) return {};
    
    const groupedByAdmin: Record<string, Employee[]> = {};
    
    employees.forEach(employee => {
      const adminId = employee.addedBy || 'unknown';
      if (!groupedByAdmin[adminId]) {
        groupedByAdmin[adminId] = [];
      }
      groupedByAdmin[adminId].push(employee);
    });
    
    return groupedByAdmin;
  };

  // ✅ Export (with enhanced data for admin)
  const exportData = () => {
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Department', 'Designation', 'Employee ID', 'Status', 'Added By', 'Created At'],
      ...filteredEmployees.map(emp => [
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
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employees_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Employee data exported successfully",
    });
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