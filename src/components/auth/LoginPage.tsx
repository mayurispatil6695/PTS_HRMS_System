
import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { motion } from 'framer-motion';
import { useToast } from '../../hooks/use-toast';
import RegisterForm from './RegisterForm';
import AdminRegisterForm from './AdminRegisterForm';
import LoginCard from './LoginCard';

const LoginPage = () => {
  const [activeTab, setActiveTab] = useState<'admin' | 'employee'>('admin');
  const [showRegister, setShowRegister] = useState(false);
  const [showAdminRegister, setShowAdminRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const handleLogin = async (email: string, password: string) => {
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const success = await login(email, password, activeTab);
    setLoading(false);

    if (success) {
      toast({
        title: "Success",
        description: "Login successful!",
      });
    } else {
      toast({
        title: "Error",
        description: "Invalid credentials or inactive account",
        variant: "destructive",
      });
    }
  };

  if (showRegister) {
    return <RegisterForm onBack={() => setShowRegister(false)} />;
  }

  if (showAdminRegister) {
    return <AdminRegisterForm onBack={() => setShowAdminRegister(false)} />;
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
            PTS Management System
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
              isActive={activeTab === 'admin'}
              onActivate={() => setActiveTab('admin')}
              onLogin={handleLogin}
              onRegister={() => setShowAdminRegister(true)}
              loading={loading}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <LoginCard
              userType="employee"
              isActive={activeTab === 'employee'}
              onActivate={() => setActiveTab('employee')}
              onLogin={handleLogin}
              onRegister={() => setShowRegister(true)}
              loading={loading}
            />
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
