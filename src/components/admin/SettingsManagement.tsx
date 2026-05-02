// src/components/admin/SettingsManagement.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Building, Calendar, Bell, Shield, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from '../ui/use-toast';
import { ref, onValue, set, off } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { addAuditLog } from '../../utils/auditLog'; // ✅ audit log

// ========== TYPE DEFINITIONS ==========
interface CompanySettings {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  workingHours: string;
  weeklyHours: number;
  leavePolicyUrl: string;
}

interface LeaveSettings {
  casualLeaves: number;
  sickLeaves: number;
  earnedLeaves: number;
  maternityLeaves: number;
  paternityLeaves: number;
  autoApproval: boolean;                 // toggle for short casual leaves
  shortLeaveMaxDays: number;             // ✅ new field – max days for auto‑approval
  maxConsecutiveDays: number;
}

interface NotificationSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  leaveReminders: boolean;
  attendanceAlerts: boolean;
  salarySlipNotifications: boolean;
}

interface SecuritySettings {
  twoFactorAuth: boolean;
  sessionTimeout: number;
  passwordComplexity: boolean;
  loginAttempts: number;
  autoLogout: boolean;
}

// Default values
const DEFAULT_COMPANY: CompanySettings = {
  companyName: 'PTS System',
  companyEmail: 'pawartechnologyservices@gmail.com',
  companyPhone: '+91 9096649556',
  companyAddress: 'Pune, India',
  workingHours: '9:30 AM - 6:30 PM',
  weeklyHours: 40,
  leavePolicyUrl: ''
};

const DEFAULT_LEAVE: LeaveSettings = {
  casualLeaves: 12,
  sickLeaves: 12,
  earnedLeaves: 24,
  maternityLeaves: 180,
  paternityLeaves: 15,
  autoApproval: false,
  shortLeaveMaxDays: 2,                 // ✅ default 2 days
  maxConsecutiveDays: 30
};

const DEFAULT_NOTIFICATION: NotificationSettings = {
  emailNotifications: true,
  smsNotifications: false,
  pushNotifications: true,
  leaveReminders: true,
  attendanceAlerts: true,
  salarySlipNotifications: true
};

const DEFAULT_SECURITY: SecuritySettings = {
  twoFactorAuth: false,
  sessionTimeout: 30,
  passwordComplexity: true,
  loginAttempts: 3,
  autoLogout: true
};

const toNumber = (val: unknown, defaultValue: number): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
};

// ========== MAIN COMPONENT ==========
const SettingsManagement: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [company, setCompany] = useState<CompanySettings>(DEFAULT_COMPANY);
  const [leave, setLeave] = useState<LeaveSettings>(DEFAULT_LEAVE);
  const [notification, setNotification] = useState<NotificationSettings>(DEFAULT_NOTIFICATION);
  const [security, setSecurity] = useState<SecuritySettings>(DEFAULT_SECURITY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  // Fetch settings from Firebase
  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const settingsRef = ref(database, 'settings');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val() as {
        company?: CompanySettings;
        leave?: LeaveSettings;
        notification?: NotificationSettings;
        security?: SecuritySettings;
      } | null;
      if (data) {
        if (data.company) setCompany(prev => ({ ...prev, ...data.company }));
        if (data.leave) {
          setLeave(prev => ({
            ...prev,
            ...data.leave,
            casualLeaves: toNumber(data.leave.casualLeaves, DEFAULT_LEAVE.casualLeaves),
            sickLeaves: toNumber(data.leave.sickLeaves, DEFAULT_LEAVE.sickLeaves),
            earnedLeaves: toNumber(data.leave.earnedLeaves, DEFAULT_LEAVE.earnedLeaves),
            maternityLeaves: toNumber(data.leave.maternityLeaves, DEFAULT_LEAVE.maternityLeaves),
            paternityLeaves: toNumber(data.leave.paternityLeaves, DEFAULT_LEAVE.paternityLeaves),
            shortLeaveMaxDays: toNumber(data.leave.shortLeaveMaxDays, DEFAULT_LEAVE.shortLeaveMaxDays),
            maxConsecutiveDays: toNumber(data.leave.maxConsecutiveDays, DEFAULT_LEAVE.maxConsecutiveDays),
          }));
        }
        if (data.notification) setNotification(prev => ({ ...prev, ...data.notification }));
        if (data.security) {
          setSecurity(prev => ({
            ...prev,
            ...data.security,
            sessionTimeout: toNumber(data.security.sessionTimeout, DEFAULT_SECURITY.sessionTimeout),
            loginAttempts: toNumber(data.security.loginAttempts, DEFAULT_SECURITY.loginAttempts),
          }));
        }
      }
      setLoading(false);
      initialLoadDone.current = true;
    }, (error) => {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to load settings', variant: 'destructive' });
      setLoading(false);
    });
    return () => off(settingsRef);
  }, [isAdmin]);

  // Save helpers with audit logging
  const saveCompanySettings = useCallback(async () => {
    if (!isAdmin) {
      toast({ title: 'Access Denied', description: 'Only admin can change settings', variant: 'destructive' });
      return;
    }
    setSaving('company');
    try {
      await set(ref(database, 'settings/company'), company);
      await addAuditLog({
        action: 'settings_company_updated',
        performedBy: user?.id || 'unknown',
        performedByName: user?.name || 'Admin',
        details: { changedFields: Object.keys(company) },
      });
      toast({ title: 'Settings Saved', description: 'Company settings updated.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  }, [isAdmin, company, user]);

  const saveLeaveSettings = useCallback(async () => {
    if (!isAdmin) return;
    setSaving('leave');
    try {
      await set(ref(database, 'settings/leave'), leave);
      await addAuditLog({
        action: 'settings_leave_updated',
        performedBy: user?.id || 'unknown',
        performedByName: user?.name || 'Admin',
        details: {
          autoApproveShortLeaves: leave.autoApproval,
          shortLeaveMaxDays: leave.shortLeaveMaxDays,
        },
      });
      toast({ title: 'Settings Saved', description: 'Leave policy updated.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save leave settings', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  }, [isAdmin, leave, user]);

  const saveNotificationSettings = useCallback(async () => {
    if (!isAdmin) return;
    setSaving('notification');
    try {
      await set(ref(database, 'settings/notification'), notification);
      await addAuditLog({
        action: 'settings_notification_updated',
        performedBy: user?.id || 'unknown',
        performedByName: user?.name || 'Admin',
        details: { changedFields: Object.keys(notification) },
      });
      toast({ title: 'Settings Saved', description: 'Notification settings updated.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  }, [isAdmin, notification, user]);

  const saveSecuritySettings = useCallback(async () => {
    if (!isAdmin) return;
    setSaving('security');
    try {
      await set(ref(database, 'settings/security'), security);
      await addAuditLog({
        action: 'settings_security_updated',
        performedBy: user?.id || 'unknown',
        performedByName: user?.name || 'Admin',
        details: { changedFields: Object.keys(security) },
      });
      toast({ title: 'Settings Saved', description: 'Security settings updated.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  }, [isAdmin, security, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="h-12 w-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600">You do not have permission to view settings.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 px-4 pb-20 sm:px-6 sm:pb-0">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Settings Management</h1>
          <p className="text-gray-600 text-sm">Configure system settings and policies</p>
        </div>
      </motion.div>

      <Tabs defaultValue="company" className="space-y-4">
        <TabsList className="flex flex-wrap gap-2 h-auto">
          <TabsTrigger value="company" className="flex items-center gap-2 text-sm"><Building className="h-4 w-4" /> Company</TabsTrigger>
          <TabsTrigger value="leave" className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4" /> Leave Policy</TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2 text-sm"><Bell className="h-4 w-4" /> Notifications</TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2 text-sm"><Shield className="h-4 w-4" /> Security</TabsTrigger>
        </TabsList>

        {/* Company Tab */}
        <TabsContent value="company">
          <Card>
            <CardHeader><CardTitle>Company Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-sm font-medium mb-1 block">Company Name</label><Input value={company.companyName} onChange={e => setCompany({...company, companyName: e.target.value})} /></div>
                <div><label className="text-sm font-medium mb-1 block">Company Email</label><Input type="email" value={company.companyEmail} onChange={e => setCompany({...company, companyEmail: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-sm font-medium mb-1 block">Company Phone</label><Input value={company.companyPhone} onChange={e => setCompany({...company, companyPhone: e.target.value})} /></div>
                <div><label className="text-sm font-medium mb-1 block">Working Hours</label><Input value={company.workingHours} onChange={e => setCompany({...company, workingHours: e.target.value})} /></div>
              </div>
              <div><label className="text-sm font-medium mb-1 block">Company Address</label><Textarea value={company.companyAddress} onChange={e => setCompany({...company, companyAddress: e.target.value})} /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-sm font-medium mb-1 block">Weekly Hours</label><Input type="number" value={company.weeklyHours} onChange={e => setCompany({...company, weeklyHours: parseInt(e.target.value) || 0})} /></div>
                <div><label className="text-sm font-medium mb-1 block">Leave Policy URL</label><Input value={company.leavePolicyUrl} onChange={e => setCompany({...company, leavePolicyUrl: e.target.value})} /></div>
              </div>
              <Button onClick={saveCompanySettings} disabled={saving === 'company'}>{saving === 'company' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save Company Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leave Policy Tab */}
        <TabsContent value="leave">
          <Card>
            <CardHeader><CardTitle>Leave Policy Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="text-sm font-medium mb-1 block">Casual Leaves (per year)</label><Input type="number" value={leave.casualLeaves} onChange={e => setLeave({...leave, casualLeaves: parseInt(e.target.value) || 0})} /></div>
                <div><label className="text-sm font-medium mb-1 block">Sick Leaves (per year)</label><Input type="number" value={leave.sickLeaves} onChange={e => setLeave({...leave, sickLeaves: parseInt(e.target.value) || 0})} /></div>
                <div><label className="text-sm font-medium mb-1 block">Earned Leaves (per year)</label><Input type="number" value={leave.earnedLeaves} onChange={e => setLeave({...leave, earnedLeaves: parseInt(e.target.value) || 0})} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="text-sm font-medium mb-1 block">Maternity Leaves (days)</label><Input type="number" value={leave.maternityLeaves} onChange={e => setLeave({...leave, maternityLeaves: parseInt(e.target.value) || 0})} /></div>
                <div><label className="text-sm font-medium mb-1 block">Paternity Leaves (days)</label><Input type="number" value={leave.paternityLeaves} onChange={e => setLeave({...leave, paternityLeaves: parseInt(e.target.value) || 0})} /></div>
                <div><label className="text-sm font-medium mb-1 block">Max Consecutive Days</label><Input type="number" value={leave.maxConsecutiveDays} onChange={e => setLeave({...leave, maxConsecutiveDays: parseInt(e.target.value) || 0})} /></div>
              </div>

              {/* Auto‑approve short casual leaves */}
              <div className="flex items-center justify-between">
                <div><label className="text-sm font-medium">Auto‑Approve Short Casual Leaves</label><p className="text-xs text-gray-500">Automatically approve casual leaves ≤ Max Days</p></div>
                <Switch checked={leave.autoApproval} onCheckedChange={checked => setLeave({...leave, autoApproval: checked})} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                <div><label className="text-sm font-medium mb-1 block">Max Days for Auto‑Approve</label><Input type="number" min={1} max={10} value={leave.shortLeaveMaxDays} onChange={e => setLeave({...leave, shortLeaveMaxDays: parseInt(e.target.value) || 2})} /></div>
              </div>

              <Button onClick={saveLeaveSettings} disabled={saving === 'leave'}>{saving === 'leave' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save Leave Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader><CardTitle>Notification Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {[
                  { key: 'emailNotifications', label: 'Email Notifications', desc: 'Send notifications via email' },
                  { key: 'smsNotifications', label: 'SMS Notifications', desc: 'Send notifications via SMS' },
                  { key: 'pushNotifications', label: 'Push Notifications', desc: 'Send browser push notifications' },
                  { key: 'leaveReminders', label: 'Leave Reminders', desc: 'Remind about pending leave requests' },
                  { key: 'attendanceAlerts', label: 'Attendance Alerts', desc: 'Alert about attendance irregularities' },
                  { key: 'salarySlipNotifications', label: 'Salary Slip Notifications', desc: 'Notify when salary slips are generated' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div><label className="text-sm font-medium">{label}</label><p className="text-xs text-gray-500">{desc}</p></div>
                    <Switch checked={notification[key as keyof NotificationSettings] as boolean} onCheckedChange={checked => setNotification({...notification, [key]: checked})} />
                  </div>
                ))}
              </div>
              <Button onClick={saveNotificationSettings} disabled={saving === 'notification'}>{saving === 'notification' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save Notification Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader><CardTitle>Security Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {[
                  { key: 'twoFactorAuth', label: 'Two-Factor Authentication', desc: 'Require 2FA for admin accounts' },
                  { key: 'passwordComplexity', label: 'Password Complexity', desc: 'Enforce strong password requirements' },
                  { key: 'autoLogout', label: 'Auto Logout', desc: 'Automatically logout inactive sessions' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div><label className="text-sm font-medium">{label}</label><p className="text-xs text-gray-500">{desc}</p></div>
                    <Switch checked={security[key as keyof SecuritySettings] as boolean} onCheckedChange={checked => setSecurity({...security, [key]: checked})} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-sm font-medium mb-1 block">Session Timeout (minutes)</label><Input type="number" value={security.sessionTimeout} onChange={e => setSecurity({...security, sessionTimeout: parseInt(e.target.value) || 0})} /></div>
                <div><label className="text-sm font-medium mb-1 block">Max Login Attempts</label><Input type="number" value={security.loginAttempts} onChange={e => setSecurity({...security, loginAttempts: parseInt(e.target.value) || 0})} /></div>
              </div>
              <Button onClick={saveSecuritySettings} disabled={saving === 'security'}>{saving === 'security' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save Security Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsManagement;