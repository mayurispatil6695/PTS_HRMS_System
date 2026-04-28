import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { motion } from 'framer-motion';
import { useToast } from '../../hooks/use-toast';
import { useAuth } from '../../hooks/useAuth';

interface LoginFormProps {
  userType: 'admin' | 'employee';
  onSuccess?: (identifier: string, password: string) => void;  // ✅ accept credentials
  loading?: boolean;
}

const LoginForm: React.FC<LoginFormProps> = ({ userType, onSuccess, loading: externalLoading }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [internalLoading, setInternalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { login } = useAuth();

  const loading = externalLoading !== undefined ? externalLoading : internalLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (externalLoading === undefined) setInternalLoading(true);
    setError(null);
    try {
      // If onSuccess is provided, call it directly (for parent‑managed login)
      if (onSuccess) {
        await onSuccess(identifier, password);
      } else {
        // Otherwise use the auth hook directly
        const result = await login(identifier, password, userType);
        if (!result.success) throw new Error(result.message || 'Login failed');
        toast({ title: "Login Successful", description: `Welcome back!` });
      }
    } catch (err: unknown) {
      console.error('Login error:', err);
      let errorMessage = 'Login failed. Please try again.';
      if (err instanceof Error) errorMessage = err.message;
      setError(errorMessage);
      toast({ title: "Login Failed", description: errorMessage, variant: "destructive" });
    } finally {
      if (externalLoading === undefined) setInternalLoading(false);
    }
  };

  const labelText = userType === 'admin' ? 'Email' : 'Email or Employee ID';
  const placeholderText = userType === 'admin' ? 'admin@company.com' : 'email@company.com or EMP-00002';

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-md">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="identifier" className="text-sm font-medium text-gray-700">
          {labelText}
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            id="identifier"
            type="text"
            placeholder={placeholderText}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="pl-10"
            required
            autoComplete="off"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-gray-700">Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-10 pr-10"
            required
            minLength={6}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        className={`w-full mt-6 ${userType === 'admin' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'} transition-colors`}
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Signing in...
          </span>
        ) : (
          `Sign In as ${userType === 'admin' ? 'Admin' : 'Employee'}`
        )}
      </Button>
    </motion.form>
  );
};

export default LoginForm;