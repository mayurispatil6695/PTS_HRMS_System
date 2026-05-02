// src/components/auth/EnhancedLoginPage.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import AdminLoginPage from './AdminLoginPage';
import LoginCard from './LoginCard';
import { useAuth } from '../../hooks/useAuth';
import { toast } from '../ui/use-toast';

const EnhancedLoginPage = () => {
  const [activeView, setActiveView] = useState<'main' | 'admin'>('main');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleEmployeeLogin = async (email: string, password: string) => {
    setLoading(true);
    const result = await login(email, password, 'employee');
    if (result.success) {
      toast({ title: "Success", description: "Login successful!" });
    } else {
      toast({ title: "Error", description: result.message || "Login failed", variant: "destructive" });
    }
    setLoading(false);
  };

  if (activeView === 'admin') {
    return <AdminLoginPage onForgotPassword={() => setActiveView('main')} />;
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
            className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2"
          >
            PTS Portal
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-gray-600 text-sm sm:text-base"
          >
            Pawar Technology Services Management System
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="px-2"
          >
            <LoginCard
              userType="admin"
              isActive={true}
              onActivate={() => {}}
              onLogin={() => setActiveView('admin')}
              onRegister={() => {}}
              loading={false}
              isButton={true}
              hideRegister={true}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="px-2"
          >
            <LoginCard
              userType="employee"
              isActive={true}
              onActivate={() => {}}
              onLogin={handleEmployeeLogin}
              onRegister={() => {}}
              loading={loading}
              isButton={false}
              hideRegister={true}
            />
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default EnhancedLoginPage;