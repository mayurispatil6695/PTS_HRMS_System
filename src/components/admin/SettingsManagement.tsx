
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Users, Calendar, Building, Shield, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from '../ui/use-toast';

const SettingsManagement = () => {
  const [companySettings, setCompanySettings] = useState({
    companyName: 'PTS System',
    companyEmail: 'pawartechnologyservices@gmail.com',
    companyPhone: '+91 9096649556',
    companyAddress: 'Pune, India',
    workingHours: '9:00 AM - 6:00 PM',
    weeklyHours: 40,
    leavePolicyUrl: ''
  });

  const [leaveSettings, setLeaveSettings] = useState({
    casualLeaves: 12,
    sickLeaves: 12,
    earnedLeaves: 24,
    maternityLeaves: 180,
    paternityLeaves: 15,
    autoApproval: false,
    maxConsecutiveDays: 30
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    leaveReminders: true,
    attendanceAlerts: true,
    salarySlipNotifications: true
  });

  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    sessionTimeout: 30,
    passwordComplexity: true,
    loginAttempts: 3,
    autoLogout: true
  });

  useEffect(() => {
    // Load settings from localStorage
    const savedCompanySettings = localStorage.getItem('company_settings');
    const savedLeaveSettings = localStorage.getItem('leave_settings');
    const savedNotificationSettings = localStorage.getItem('notification_settings');
    const savedSecuritySettings = localStorage.getItem('security_settings');

    if (savedCompanySettings) {
      setCompanySettings(JSON.parse(savedCompanySettings));
    }
    if (savedLeaveSettings) {
      setLeaveSettings(JSON.parse(savedLeaveSettings));
    }
    if (savedNotificationSettings) {
      setNotificationSettings(JSON.parse(savedNotificationSettings));
    }
    if (savedSecuritySettings) {
      setSecuritySettings(JSON.parse(savedSecuritySettings));
    }
  }, []);

  const saveCompanySettings = () => {
    localStorage.setItem('company_settings', JSON.stringify(companySettings));
    toast({
      title: "Settings Saved",
      description: "Company settings have been updated successfully."
    });
  };

  const saveLeaveSettings = () => {
    localStorage.setItem('leave_settings', JSON.stringify(leaveSettings));
    toast({
      title: "Settings Saved",
      description: "Leave policy settings have been updated successfully."
    });
  };

  const saveNotificationSettings = () => {
    localStorage.setItem('notification_settings', JSON.stringify(notificationSettings));
    toast({
      title: "Settings Saved",
      description: "Notification settings have been updated successfully."
    });
  };

  const saveSecuritySettings = () => {
    localStorage.setItem('security_settings', JSON.stringify(securitySettings));
    toast({
      title: "Settings Saved",
      description: "Security settings have been updated successfully."
    });
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Settings Management</h1>
          <p className="text-gray-600">Configure system settings and policies</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Tabs defaultValue="company" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="company" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Company
            </TabsTrigger>
            <TabsTrigger value="leave" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Leave Policy
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Company Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Company Name</label>
                    <Input
                      value={companySettings.companyName}
                      onChange={(e) => setCompanySettings({...companySettings, companyName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Company Email</label>
                    <Input
                      type="email"
                      value={companySettings.companyEmail}
                      onChange={(e) => setCompanySettings({...companySettings, companyEmail: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Company Phone</label>
                    <Input
                      value={companySettings.companyPhone}
                      onChange={(e) => setCompanySettings({...companySettings, companyPhone: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Working Hours</label>
                    <Input
                      value={companySettings.workingHours}
                      onChange={(e) => setCompanySettings({...companySettings, workingHours: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Company Address</label>
                  <Textarea
                    value={companySettings.companyAddress}
                    onChange={(e) => setCompanySettings({...companySettings, companyAddress: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Weekly Hours</label>
                    <Input
                      type="number"
                      value={companySettings.weeklyHours}
                      onChange={(e) => setCompanySettings({...companySettings, weeklyHours: parseInt(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Leave Policy URL</label>
                    <Input
                      value={companySettings.leavePolicyUrl}
                      onChange={(e) => setCompanySettings({...companySettings, leavePolicyUrl: e.target.value})}
                    />
                  </div>
                </div>

                <Button onClick={saveCompanySettings}>
                  Save Company Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leave">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Leave Policy Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Casual Leaves (per year)</label>
                    <Input
                      type="number"
                      value={leaveSettings.casualLeaves}
                      onChange={(e) => setLeaveSettings({...leaveSettings, casualLeaves: parseInt(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Sick Leaves (per year)</label>
                    <Input
                      type="number"
                      value={leaveSettings.sickLeaves}
                      onChange={(e) => setLeaveSettings({...leaveSettings, sickLeaves: parseInt(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Earned Leaves (per year)</label>
                    <Input
                      type="number"
                      value={leaveSettings.earnedLeaves}
                      onChange={(e) => setLeaveSettings({...leaveSettings, earnedLeaves: parseInt(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Maternity Leaves (days)</label>
                    <Input
                      type="number"
                      value={leaveSettings.maternityLeaves}
                      onChange={(e) => setLeaveSettings({...leaveSettings, maternityLeaves: parseInt(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Paternity Leaves (days)</label>
                    <Input
                      type="number"
                      value={leaveSettings.paternityLeaves}
                      onChange={(e) => setLeaveSettings({...leaveSettings, paternityLeaves: parseInt(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Max Consecutive Days</label>
                    <Input
                      type="number"
                      value={leaveSettings.maxConsecutiveDays}
                      onChange={(e) => setLeaveSettings({...leaveSettings, maxConsecutiveDays: parseInt(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={leaveSettings.autoApproval}
                    onCheckedChange={(checked) => setLeaveSettings({...leaveSettings, autoApproval: checked})}
                  />
                  <label className="text-sm font-medium">Enable Auto Approval for Short Leaves</label>
                </div>

                <Button onClick={saveLeaveSettings}>
                  Save Leave Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Notification Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Email Notifications</label>
                      <p className="text-xs text-gray-500">Send notifications via email</p>
                    </div>
                    <Switch
                      checked={notificationSettings.emailNotifications}
                      onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, emailNotifications: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">SMS Notifications</label>
                      <p className="text-xs text-gray-500">Send notifications via SMS</p>
                    </div>
                    <Switch
                      checked={notificationSettings.smsNotifications}
                      onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, smsNotifications: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Push Notifications</label>
                      <p className="text-xs text-gray-500">Send browser push notifications</p>
                    </div>
                    <Switch
                      checked={notificationSettings.pushNotifications}
                      onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, pushNotifications: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Leave Reminders</label>
                      <p className="text-xs text-gray-500">Remind about pending leave requests</p>
                    </div>
                    <Switch
                      checked={notificationSettings.leaveReminders}
                      onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, leaveReminders: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Attendance Alerts</label>
                      <p className="text-xs text-gray-500">Alert about attendance irregularities</p>
                    </div>
                    <Switch
                      checked={notificationSettings.attendanceAlerts}
                      onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, attendanceAlerts: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Salary Slip Notifications</label>
                      <p className="text-xs text-gray-500">Notify when salary slips are generated</p>
                    </div>
                    <Switch
                      checked={notificationSettings.salarySlipNotifications}
                      onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, salarySlipNotifications: checked})}
                    />
                  </div>
                </div>

                <Button onClick={saveNotificationSettings}>
                  Save Notification Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Security Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Two-Factor Authentication</label>
                      <p className="text-xs text-gray-500">Require 2FA for admin accounts</p>
                    </div>
                    <Switch
                      checked={securitySettings.twoFactorAuth}
                      onCheckedChange={(checked) => setSecuritySettings({...securitySettings, twoFactorAuth: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Password Complexity</label>
                      <p className="text-xs text-gray-500">Enforce strong password requirements</p>
                    </div>
                    <Switch
                      checked={securitySettings.passwordComplexity}
                      onCheckedChange={(checked) => setSecuritySettings({...securitySettings, passwordComplexity: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Auto Logout</label>
                      <p className="text-xs text-gray-500">Automatically logout inactive sessions</p>
                    </div>
                    <Switch
                      checked={securitySettings.autoLogout}
                      onCheckedChange={(checked) => setSecuritySettings({...securitySettings, autoLogout: checked})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Session Timeout (minutes)</label>
                    <Input
                      type="number"
                      value={securitySettings.sessionTimeout}
                      onChange={(e) => setSecuritySettings({...securitySettings, sessionTimeout: parseInt(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Max Login Attempts</label>
                    <Input
                      type="number"
                      value={securitySettings.loginAttempts}
                      onChange={(e) => setSecuritySettings({...securitySettings, loginAttempts: parseInt(e.target.value)})}
                    />
                  </div>
                </div>

                <Button onClick={saveSecuritySettings}>
                  Save Security Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
};

export default SettingsManagement;
