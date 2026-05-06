// src/components/attendance/IdleMonitoring.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, Clock, AlertTriangle, Eye, EyeOff, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { database } from '../../firebase';
import { ref, onValue, off, update, DataSnapshot } from 'firebase/database';
import { useAuth } from '../../hooks/useAuth';

interface IdleEmployee {
  id: string;
  name: string;
  email: string;
  department?: string;
  designation?: string;
  idleStartTime: number;
  idleDuration: number;
  lastActive: number;
  status: 'unread' | 'read' | 'idle';
  isIdle: boolean;
}

const getAdminUid = (user: unknown): string | null => {
  if (!user || typeof user !== 'object') return null;
  const candidate = user as Record<string, unknown>;
  const uid = candidate.adminUid ?? candidate.adminId ?? candidate.id ?? candidate.uid;
  return typeof uid === 'string' ? uid : null;
};

const IdleMonitoring: React.FC = () => {
  const { user } = useAuth();
  const [idleEmployees, setIdleEmployees] = useState<IdleEmployee[]>([]);
  const [showNotifications, setShowNotifications] = useState(true);
  const [loading, setLoading] = useState(true);

  const adminUid = useMemo(() => getAdminUid(user), [user]);

  useEffect(() => {
    if (!adminUid) {
      setLoading(false);
      return;
    }

    const idleRef = ref(database, `users/${adminUid}/idleNotifications`);
    const unsubscribe = onValue(idleRef, (snapshot: DataSnapshot) => {
      const data = snapshot.val() as Record<string, {
        isIdle?: boolean;
        idleStartTime?: number;
        idleDuration?: number;
        lastActive?: number;
        status?: string;
        employeeName?: string;
        employeeEmail?: string;
        department?: string;
        designation?: string;
      }> | null;

      const employees: IdleEmployee[] = [];
      if (data && typeof data === 'object') {
        Object.entries(data).forEach(([id, employeeData]) => {
          if (employeeData.isIdle === true) {
            employees.push({
              id,
              name: employeeData.employeeName || id,
              email: employeeData.employeeEmail || '',
              department: employeeData.department,
              designation: employeeData.designation,
              idleStartTime: employeeData.idleStartTime || Date.now(),
              idleDuration: employeeData.idleDuration || 0,
              lastActive: employeeData.lastActive || Date.now(),
              status: (employeeData.status as IdleEmployee['status']) || 'unread',
              isIdle: true,
            });
          }
        });
      }

      // ✅ Exclude the currently logged‑in user (admin) from own idle alerts
      const filtered = employees.filter(emp => emp.id !== user?.id);
      filtered.sort((a, b) => b.idleDuration - a.idleDuration);
      setIdleEmployees(filtered);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching idle notifications:', error);
      setLoading(false);
    });

    return () => off(idleRef);
  }, [adminUid, user]);

  const markAsRead = useCallback(async (employeeId: string) => {
    if (!adminUid) return;
    try {
      const notificationRef = ref(database, `users/${adminUid}/idleNotifications/${employeeId}`);
      await update(notificationRef, { status: 'read' });
      setIdleEmployees(prev =>
        prev.map(emp => (emp.id === employeeId ? { ...emp, status: 'read' } : emp))
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [adminUid]);

  const formatIdleTime = useCallback((startTime: number): string => {
    const idleSeconds = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(idleSeconds / 60);
    const seconds = idleSeconds % 60;
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }, []);

  const getAlertColor = useCallback((duration: number): string => {
    const idleSeconds = Math.floor(duration / 1000);
    if (idleSeconds >= 60) return 'bg-red-100 border-red-400 text-red-800';
    if (idleSeconds >= 30) return 'bg-orange-100 border-orange-400 text-orange-800';
    return 'bg-yellow-100 border-yellow-400 text-yellow-800';
  }, []);

  const toggleNotifications = useCallback(() => {
    setShowNotifications(prev => !prev);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (idleEmployees.length === 0) return null;

  const highestDuration = idleEmployees[0]?.idleDuration || 0;
  const alertColor = getAlertColor(highestDuration);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 px-2 sm:px-0"
    >
      <Card className={`border-2 ${alertColor}`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm sm:text-base">Idle Employee Alerts</span>
              <Badge variant="outline" className="ml-2 text-xs">
                {idleEmployees.length} {idleEmployees.length === 1 ? 'Employee' : 'Employees'}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={toggleNotifications} className="h-8 px-2">
              {showNotifications ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </CardTitle>
        </CardHeader>
        {showNotifications && (
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {idleEmployees.map(employee => {
                const idleTimeFormatted = formatIdleTime(employee.idleStartTime);
                const employeeAlertColor = getAlertColor(employee.idleDuration);
                return (
                  <motion.div
                    key={employee.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white rounded-lg border-2 ${employeeAlertColor} gap-3`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                        <Users className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 text-sm sm:text-base truncate">{employee.name}</p>
                        <p className="text-xs text-gray-500 truncate">{employee.email}</p>
                        {employee.department && (
                          <p className="text-xs text-gray-400">
                            {employee.department} • {employee.designation || 'Employee'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm font-medium">Idle: {idleTimeFormatted}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Last active: {new Date(employee.lastActive).toLocaleTimeString()}
                      </p>
                      {employee.status === 'unread' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 text-xs w-full sm:w-auto"
                          onClick={() => markAsRead(employee.id)}
                        >
                          <Bell className="h-3 w-3 mr-1" /> Dismiss
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <div className="mt-3 pt-2 border-t">
              <p className="text-xs text-gray-500">
                Employees are considered idle after 10 seconds of inactivity. 
                This helps monitor productivity and well-being.
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </motion.div>
  );
};

export default React.memo(IdleMonitoring);