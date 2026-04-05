import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '../../hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Users, Mail, Lock, Eye, EyeOff, UserPlus, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface AdminLoginPageProps {
  onForgotPassword: () => void;
}

type AuthMode = 'login' | 'signup';

const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onForgotPassword }) => {
  const navigate = useNavigate();
  const { user, login, signup } = useAuth();
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [justSignedUp, setJustSignedUp] = useState(false);
  
  // Hooks
  const { toast } = useToast();

  // Redirect if user is already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await login(email, password, 'admin');
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Admin login successful!",
        });
      } else {
        toast({
          title: "Error",
          description: result.message || "Login failed",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Login failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !confirmPassword || !name) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords don't match",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await signup(email, password, {
        name,
        email,
        role: 'admin',
        isActive: true,
      });
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Admin account created successfully! Please login.",
        });
        setJustSignedUp(true);
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      } else {
        toast({
          title: "Error",
          description: result.message || "Signup failed",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      toast({
        title: "Error",
        description: error.message || "Signup failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    if (mode === 'signup' && !justSignedUp) {
      setEmail('');
    }
    setPassword('');
    setConfirmPassword('');
    if (mode === 'login') {
      setName('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">
              {mode === 'login' ? 'Admin Login' : 'Admin Sign Up'}
            </CardTitle>
            <CardDescription>
              {mode === 'login' 
                ? 'Access the admin dashboard' 
                : 'Create a new admin account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {justSignedUp && (
              <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-md text-sm">
                Account created successfully! Please login with your credentials.
              </div>
            )}
            <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-4">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={mode === 'login' ? "Enter password" : "Create password (min 6 chars)"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
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

              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 transition-colors"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                  </span>
                ) : mode === 'login' ? 'Sign In as Admin' : 'Create Admin Account'}
              </Button>
            </form>
            
            <div className="mt-4 text-center space-y-2">
              <button
                onClick={toggleMode}
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors flex items-center justify-center w-full"
              >
                {mode === 'login' ? (
                  <>
                    <UserPlus className="w-4 h-4 mr-1" />
                    Need an admin account? Sign up
                  </>
                ) : (
                  <>
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back to login
                  </>
                )}
              </button>

              {mode === 'login' && (
                <button
                  onClick={onForgotPassword}
                  className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Forgot Password?
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default AdminLoginPage;
// import React, { useState, useEffect } from 'react';
// import { motion } from 'framer-motion';
// import { useToast } from '../../hooks/use-toast';
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
// import { Button } from '../ui/button';
// import { Input } from '../ui/input';
// import { Label } from '../ui/label';
// import { Users, Mail, Lock, Eye, EyeOff } from 'lucide-react';
// import { useAuth } from '../../hooks/useAuth';
// import { useNavigate } from 'react-router-dom';

// interface AdminLoginPageProps {
//   onForgotPassword: () => void;
// }

// const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onForgotPassword }) => {
//   const navigate = useNavigate();
//   const { user, login } = useAuth();

//   // Form state
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [showPassword, setShowPassword] = useState(false);

//   // UI state
//   const [loading, setLoading] = useState(false);

//   const { toast } = useToast();

//   // ✅ Allowed Admin Emails
//   const allowedAdmins = [
//     "rahulpawar.ceo@gmail.com",
//     "swapnilgunke.pm@gmail.com"
//   ];

//   // Redirect if already logged in
//   useEffect(() => {
//     if (user) {
//       navigate('/dashboard');
//     }
//   }, [user, navigate]);

//   const handleLogin = async (e: React.FormEvent) => {
//     e.preventDefault();

//     if (!email || !password) {
//       toast({
//         title: "Error",
//         description: "Please fill in all fields",
//         variant: "destructive",
//       });
//       return;
//     }

//     // 🚨 Restrict Admin Access
//     if (!allowedAdmins.includes(email)) {
//       toast({
//         title: "Access Denied",
//         description: "You are not authorized as admin",
//         variant: "destructive",
//       });
//       return;
//     }

//     setLoading(true);
//     try {
//       const result = await login(email, password, 'admin');

//       if (result.success) {
//         toast({
//           title: "Success",
//           description: "Admin login successful!",
//         });
//       } else {
//         toast({
//           title: "Error",
//           description: result.message || "Login failed",
//           variant: "destructive",
//         });
//       }
//     } catch (error: any) {
//       toast({
//         title: "Error",
//         description: error.message || "Login failed",
//         variant: "destructive",
//       });
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
//       <motion.div
//         initial={{ opacity: 0, y: 20 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ duration: 0.6 }}
//         className="w-full max-w-md"
//       >
//         <Card>
//           <CardHeader className="text-center">
//             <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
//               <Users className="w-8 h-8 text-blue-600" />
//             </div>
//             <CardTitle className="text-2xl">
//               Admin Login
//             </CardTitle>
//             <CardDescription>
//               Access the admin dashboard
//             </CardDescription>
//           </CardHeader>

//           <CardContent>
//             <form onSubmit={handleLogin} className="space-y-4">

//               <div className="space-y-2">
//                 <Label htmlFor="email">Email</Label>
//                 <div className="relative">
//                   <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
//                   <Input
//                     id="email"
//                     type="email"
//                     placeholder="admin@company.com"
//                     value={email}
//                     onChange={(e) => setEmail(e.target.value)}
//                     className="pl-10"
//                   />
//                 </div>
//               </div>

//               <div className="space-y-2">
//                 <Label htmlFor="password">Password</Label>
//                 <div className="relative">
//                   <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
//                   <Input
//                     id="password"
//                     type={showPassword ? "text" : "password"}
//                     placeholder="Enter password"
//                     value={password}
//                     onChange={(e) => setPassword(e.target.value)}
//                     className="pl-10 pr-10"
//                   />
//                   <button
//                     type="button"
//                     onClick={() => setShowPassword(!showPassword)}
//                     className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
//                   >
//                     {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
//                   </button>
//                 </div>
//               </div>

//               <Button
//                 type="submit"
//                 className="w-full bg-blue-600 hover:bg-blue-700 transition-colors"
//                 disabled={loading}
//               >
//                 {loading ? (
//                   <span className="flex items-center justify-center">
//                     <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
//                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
//                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
//                     </svg>
//                     Signing in...
//                   </span>
//                 ) : 'Sign In as Admin'}
//               </Button>
//             </form>

//             <div className="mt-4 text-center">
//               <button
//                 onClick={onForgotPassword}
//                 className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
//               >
//                 Forgot Password?
//               </button>
//             </div>

//           </CardContent>
//         </Card>
//       </motion.div>
//     </div>
//   );
// };

// export default AdminLoginPage;