import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { ArrowLeft, User, Mail, Building, Briefcase } from 'lucide-react';
import { database } from '../../firebase';
import { ref, get } from 'firebase/database';
import { useAuth } from '../../hooks/useAuth';

interface EmployeeData {
  name: string;
  email: string;
  department: string;
  designation: string;
  status: string;
  employeeId?: string;
  firebaseUid?: string;
  databaseKey?: string;   // the actual key under employees node
  adminId?: string;
}

// Firebase employee node (may contain extra fields)
interface FirebaseEmployee {
  name?: string;
  email?: string;
  department?: string;
  designation?: string;
  status?: string;
  employeeId?: string;
  firebaseUid?: string;
  [key: string]: unknown;
}

interface UsersSnapshot {
  [adminId: string]: {
    employees?: Record<string, FirebaseEmployee>;
  };
}

const EmployeeDetails: React.FC = () => {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmployee = async () => {
      if (!employeeId) return;
      try {
        const usersSnap = await get(ref(database, 'users'));
        const users = usersSnap.val() as UsersSnapshot | null;
        if (!users) {
          setError('No user data found');
          setLoading(false);
          return;
        }

        let found: EmployeeData | null = null;

        // Iterate through admins and their employees
        for (const [adminId, adminData] of Object.entries(users)) {
          const employeesNode = adminData?.employees;
          if (!employeesNode) continue;

          for (const [empKey, empData] of Object.entries(employeesNode)) {
            // Check if the employee's firebaseUid matches the URL parameter
            if (empData.firebaseUid === employeeId) {
              found = {
                name: empData.name || 'Unknown',
                email: empData.email || '',
                department: empData.department || 'No Department',
                designation: empData.designation || 'Employee',
                status: empData.status || 'active',
                employeeId: empData.employeeId || empKey,
                firebaseUid: empData.firebaseUid,
                databaseKey: empKey,
                adminId: adminId,
              };
              break;
            }
          }
          if (found) break;
        }

        if (found) {
          setEmployee(found);
        } else {
          setError('Employee not found');
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load employee data');
      } finally {
        setLoading(false);
      }
    };
    fetchEmployee();
  }, [employeeId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error || 'Employee not found'}</p>
        <Button onClick={() => navigate('/admin/dashboard')} className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h1 className="text-2xl font-bold">Employee Profile</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {employee.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Email:</span>
              <span>{employee.email || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Department:</span>
              <span>{employee.department}</span>
            </div>
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Designation:</span>
              <span>{employee.designation}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Status:</span>
              <span className={`px-2 py-1 rounded-full text-xs ${
                employee.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {employee.status}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Employee ID:</span>
              <span>{employee.employeeId}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeDetails;