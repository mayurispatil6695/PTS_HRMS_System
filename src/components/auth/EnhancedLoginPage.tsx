
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import AdminLoginPage from './AdminLoginPage';
import LoginCard from './LoginCard';
import EmployeeRegistrationForm from './EmployeeRegistrationForm';
import ForgotPasswordForm from './ForgotPasswordForm';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/use-toast';

const EnhancedLoginPage = () => {
  const [activeView, setActiveView] = useState<'main' | 'admin' | 'employee-register' | 'forgot-password'>('main');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const handleEmployeeLogin = async (email: string, password: string) => {
    setLoading(true);
    
    const result = await login(email, password, 'employee');
    
    if (result.success) {
      toast({
        title: "Success",
        description: "Login successful!",
      });
    } else {
      toast({
        title: "Error",
        description: result.message || "Login failed",
        variant: "destructive",
      });
    }
    
    setLoading(false);
  };

  if (activeView === 'admin') {
    return <AdminLoginPage onForgotPassword={() => setActiveView('forgot-password')} />;
  }

  if (activeView === 'employee-register') {
    return (
      <EmployeeRegistrationForm 
        onBack={() => setActiveView('main')} 
      />
    );
  }

  if (activeView === 'forgot-password') {
    return (
      <ForgotPasswordForm
        onBack={() => setActiveView('main')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-4xl mx-auto"
      >
        <div className="text-center mb-8">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl font-bold text-gray-900 mb-2"
          >
            PTS Portal
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-gray-600"
          >
            Pawar Technology Services Management System
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <LoginCard
              userType="admin"
              isActive={true}
              onActivate={() => {}}
              onLogin={() => setActiveView('admin')}
              onRegister={() => {
                toast({
                  title: "Admin Registration Disabled",
                  description: "Admin accounts are pre-configured. Please contact system administrator.",
                  variant: "destructive",
                });
              }}
              loading={false}
              isButton={true}
              hideRegister={true}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <LoginCard
              userType="employee"
              isActive={true}
              onActivate={() => {}}
              onLogin={handleEmployeeLogin}
              onRegister={() => setActiveView('employee-register')}
              loading={loading}
              isButton={false}
            />
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default EnhancedLoginPage;
