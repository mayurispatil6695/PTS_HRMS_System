import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Phone, MapPin, Building, Calendar, Edit, Save, X, AlertCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, get, update } from 'firebase/database';
import { toast } from 'react-hot-toast';

interface EmployeeData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  emergencyContact?: string | { name: string; phone: string };
  emergencyPhone?: string;
  designation: string;
  department: string;
  employeeId: string;
  isActive: boolean;
  joiningDate?: string | number | { seconds: number; nanoseconds: number };
  workMode?: string;
  reportingManager?: string;
  profileImage?: string;
  createdAt?: number;
  updatedAt?: number;
}

const EmployeeInfo = () => {
  const { user } = useAuth();
  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null);
  const [editableData, setEditableData] = useState({
    phone: '',
    address: '',
    emergencyContact: '',
    emergencyPhone: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !user?.adminUid) {
      console.error("User ID or Admin UID not available");
      setLoading(false);
      return;
    }

    const fetchEmployeeData = async () => {
      try {
        setLoading(true);
        const employeeRef = ref(database, `users/${user.adminUid}/employees/${user.id}`);
        const snapshot = await get(employeeRef);

        if (snapshot.exists()) {
          const data = snapshot.val();
          setEmployeeData({
            id: user.id,
            ...data
          });
          setEditableData({
            phone: data.phone || '',
            address: data.address || '',
            emergencyContact: typeof data.emergencyContact === 'object' 
              ? data.emergencyContact.name 
              : data.emergencyContact || '',
            emergencyPhone: typeof data.emergencyContact === 'object'
              ? data.emergencyContact.phone
              : data.emergencyPhone || ''
          });
        } else {
          setEmployeeData(null);
        }
      } catch (error) {
        console.error('Error fetching employee data:', error);
        toast.error("Failed to load employee information");
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeeData();
  }, [user]);

  const formatDate = (date: any): string => {
    if (!date) return 'Not available';
    
    try {
      // Handle Firebase timestamp objects
      if (typeof date === 'object' && 'seconds' in date) {
        return new Date(date.seconds * 1000).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      // Handle string or number timestamps
      if (typeof date === 'string' || typeof date === 'number') {
        return new Date(date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      return 'Invalid date';
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  const handleSave = async () => {
    if (!user || !employeeData) return;

    try {
      const updates = {
        phone: editableData.phone,
        address: editableData.address,
        emergencyContact: {
          name: editableData.emergencyContact,
          phone: editableData.emergencyPhone
        },
        updatedAt: Date.now()
      };

      const employeeRef = ref(database, `users/${user.adminUid}/employees/${user.id}`);
      await update(employeeRef, updates);

      setEmployeeData(prev => ({
        ...prev!,
        phone: editableData.phone,
        address: editableData.address,
        emergencyContact: {
          name: editableData.emergencyContact,
          phone: editableData.emergencyPhone
        }
      }));

      toast.success("Profile updated successfully");
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating employee data:', error);
      toast.error("Failed to update profile");
    }
  };

  const handleCancel = () => {
    if (!employeeData) return;
    
    setEditableData({
      phone: employeeData.phone || '',
      address: employeeData.address || '',
      emergencyContact: typeof employeeData.emergencyContact === 'object' 
        ? employeeData.emergencyContact.name 
        : employeeData.emergencyContact || '',
      emergencyPhone: typeof employeeData.emergencyContact === 'object'
        ? employeeData.emergencyContact.phone
        : employeeData.emergencyPhone || ''
    });
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!employeeData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertCircle className="h-12 w-12 text-gray-400" />
        <p className="text-lg text-gray-600">No employee data found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
          <p className="text-gray-600">View and manage your personal information</p>
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
            <Button variant="outline" onClick={handleCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        )}
      </motion.div>

      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                  {employeeData.name.split(' ').map(n => n[0]).join('')}
                </div>
                {/* <Badge 
                  className={`absolute -bottom-2 -right-2 ${employeeData.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                >
                  {employeeData.isActive ? 'Active' : 'Inactive'}
                </Badge> */}
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl font-bold text-gray-800">{employeeData.name}</h2>
                <p className="text-lg text-gray-600">{employeeData.designation}</p>
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3">
                  <Badge variant="secondary" className="text-blue-600">
                    <Building className="h-3 w-3 mr-1" />
                    {employeeData.department}
                  </Badge>
                  <Badge variant="secondary" className="text-purple-600">
                    <User className="h-3 w-3 mr-1" />
                    {employeeData.employeeId}
                  </Badge>
                  <Badge variant="secondary" className="text-green-600">
                    <Clock className="h-3 w-3 mr-1" />
                    Joined {formatDate(employeeData.joiningDate)}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Personal Information */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Full Name</label>
                  <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <User className="h-5 w-5 text-gray-400" />
                    <span className="text-gray-800">{employeeData.name}</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Email Address</label>
                  <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <Mail className="h-5 w-5 text-gray-400" />
                    <span className="text-gray-800">{employeeData.email}</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Phone Number</label>
                  {isEditing ? (
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-gray-400" />
                      <Input
                        value={editableData.phone}
                        onChange={(e) => setEditableData({...editableData, phone: e.target.value})}
                        placeholder="Enter phone number"
                        className="flex-1"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                      <Phone className="h-5 w-5 text-gray-400" />
                      <span className="text-gray-800">
                        {editableData.phone || 'Not provided'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Employee ID</label>
                  <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <Building className="h-5 w-5 text-gray-400" />
                    <span className="text-gray-800">{employeeData.employeeId}</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Department</label>
                  <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <Building className="h-5 w-5 text-gray-400" />
                    <span className="text-gray-800">{employeeData.department}</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Designation</label>
                  <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <User className="h-5 w-5 text-gray-400" />
                    <span className="text-gray-800">{employeeData.designation}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-600 mb-1">Address</label>
              {isEditing ? (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-gray-400 mt-3" />
                  <Input
                    value={editableData.address}
                    onChange={(e) => setEditableData({...editableData, address: e.target.value})}
                    placeholder="Enter your address"
                    className="flex-1"
                  />
                </div>
              ) : (
                <div className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg">
                  <MapPin className="h-5 w-5 text-gray-400 mt-1" />
                  <span className="text-gray-800">
                    {editableData.address || 'Not provided'}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Emergency Contact */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Emergency Contact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Contact Name</label>
                {isEditing ? (
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-gray-400" />
                    <Input
                      value={editableData.emergencyContact}
                      onChange={(e) => setEditableData({...editableData, emergencyContact: e.target.value})}
                      placeholder="Emergency contact name"
                      className="flex-1"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <User className="h-5 w-5 text-gray-400" />
                    <span className="text-gray-800">
                      {editableData.emergencyContact || 'Not provided'}
                    </span>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Contact Phone</label>
                {isEditing ? (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <Input
                      value={editableData.emergencyPhone}
                      onChange={(e) => setEditableData({...editableData, emergencyPhone: e.target.value})}
                      placeholder="Emergency contact phone"
                      className="flex-1"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <span className="text-gray-800">
                      {editableData.emergencyPhone || 'Not provided'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Work Information */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-indigo-600" />
              Work Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Join Date</label>
                <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <span className="text-gray-800">
                    {formatDate(employeeData.joiningDate)}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Work Mode</label>
                <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <MapPin className="h-5 w-5 text-gray-400" />
                  <Badge variant="outline" className="capitalize">
                    {employeeData.workMode || 'office'}
                  </Badge>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Reporting Manager</label>
                <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <User className="h-5 w-5 text-gray-400" />
                  <span className="text-gray-800">
                    {employeeData.reportingManager || 'Not assigned'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default EmployeeInfo;