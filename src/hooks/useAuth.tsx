// @refresh reset
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updatePassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { ref, get, set, update } from 'firebase/database';
import { auth, database } from '../firebase';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'employee' | 'team_manager' | 'team_leader' | 'client';
  createdAt: string;
  profileImage?: string;
  department?: string;
  designation?: string;
  status?: string;
  managedBy?: string;
  adminUid?: string;
  employeeId?: string;
  lastActive?: number;
  companyName?: string; // ✅ for clients
}
interface EmployeeRecord {
  email: string;
  employeeId?: string;
  name?: string;
  createdAt?: string;
  profileImage?: string;
  department?: string;
  designation?: string;
  status?: string;
  managedBy?: string;
  role?: 'employee' | 'team_manager' | 'team_leader';
}



interface ClientRecord {
  email: string;
  name?: string;
  phone?: string;
  companyName?: string;
  address?: string;
  createdAt?: string;
  profileImage?: string; // ✅ add this line
  status?: string;
  addedBy?: string;
}

interface AdminNode {
  employees?: Record<string, EmployeeRecord>;
  clients?: Record<string, ClientRecord>;
  [key: string]: unknown;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, role: string) => Promise<{ success: boolean; message?: string }>;
  signup: (email: string, password: string, userData: Partial<User>) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  loading: boolean;
  resetPassword: (email: string) => Promise<{ success: boolean; message?: string }>;
  changePassword: (newPassword: string) => Promise<{ success: boolean; message?: string }>;
  updateUserStatus: (status: 'active' | 'inactive') => Promise<void>;
}

interface FirebaseUserData {
  role?: 'admin' | 'employee' | 'team_manager' | 'team_leader' | 'client';
  email?: string;
  name?: string;
  createdAt?: string;
  profileImage?: string;
  department?: string;
  designation?: string;
  status?: string;
  adminUid?: string;
  employeeId?: string;
  managedBy?: string;
  lastLogin?: string;
  lastActive?: number;
}

interface EmployeeData {
  email: string;
  employeeId?: string;
  name?: string;
  createdAt?: string;
  profileImage?: string;
  department?: string;
  designation?: string;
  status?: string;
  managedBy?: string;
  role?: 'employee' | 'team_manager' | 'team_leader' | 'client';
}

interface AdminData {
  employees?: Record<string, EmployeeData>;
  [key: string]: unknown;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const updateUserStatus = async (status: 'active' | 'inactive') => {
    if (!user) return;
    try {
      await set(ref(database, `users/${user.id}/status`), status);
      await set(ref(database, `users/${user.id}/lastActive`), Date.now());
      setUser(prev => prev ? { ...prev, status } : null);
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  // Add these interfaces before fetchUserData (if not already present)
interface EmployeeRecord {
  email: string;
  employeeId?: string;
  name?: string;
  createdAt?: string;
  profileImage?: string;
  department?: string;
  designation?: string;
  status?: string;
  managedBy?: string;
  role?: 'employee' | 'team_manager' | 'team_leader';
}

interface ClientRecord {
  email: string;
  name?: string;
  phone?: string;
  companyName?: string;
  address?: string;
  createdAt?: string;
  status?: string;
  addedBy?: string;
}

interface AdminNode {
  employees?: Record<string, EmployeeRecord>;
  clients?: Record<string, ClientRecord>;
  [key: string]: unknown;
}

// Then the corrected fetchUserData:
const fetchUserData = async (firebaseUser: FirebaseUser): Promise<User | null> => {
  try {
    const userRef = ref(database, `users/${firebaseUser.uid}`);
    const userSnapshot = await get(userRef);

    // 1. If direct profile exists (admin or previously stored)
    if (userSnapshot.exists()) {
      const userData = userSnapshot.val() as FirebaseUserData;
      
      if (userData.role === 'admin') {
        return {
          id: firebaseUser.uid,
          email: firebaseUser.email || userData.email || '',
          name: userData.name || firebaseUser.email?.split('@')[0] || 'Admin',
          role: 'admin',
          createdAt: userData.createdAt || new Date().toISOString(),
          profileImage: userData.profileImage,
          department: userData.department || 'Management',
          designation: userData.designation || 'Administrator',
          status: userData.status || 'active',
        };
      }
      
      // For employees, team leaders, managers, or clients with direct profile
      if (userData.role === 'employee' || userData.role === 'team_leader' || 
          userData.role === 'team_manager' || userData.role === 'client') {
        return {
          id: firebaseUser.uid,
          email: firebaseUser.email || userData.email || '',
          name: userData.name || firebaseUser.email?.split('@')[0] || 'User',
          role: userData.role,
          createdAt: userData.createdAt || new Date().toISOString(),
          profileImage: userData.profileImage,
          department: userData.department,
          designation: userData.designation,
          status: userData.status || 'active',
          adminUid: userData.adminUid,
          employeeId: userData.employeeId,
        };
      }
    }

    // 2. Search for employee or client under all admins
    const snapshot = await get(ref(database, 'users'));
    if (snapshot.exists()) {
      let foundData: EmployeeRecord | ClientRecord | null = null;
      let adminUid = '';
      let role: User['role'] = 'employee';

      for (const [adminId, adminValue] of Object.entries(snapshot.val())) {
        const adminData = adminValue as AdminNode;
        
        // Search in employees
        if (adminData.employees) {
          for (const [empId, emp] of Object.entries(adminData.employees)) {
            if (emp.email === firebaseUser.email) {
              foundData = emp;
              adminUid = adminId;
              role = emp.role || 'employee';
              break;
            }
          }
        }
        
        // If not found, search in clients
        if (!foundData && adminData.clients) {
          for (const [clientId, client] of Object.entries(adminData.clients)) {
            if (client.email === firebaseUser.email) {
              foundData = client;
              adminUid = adminId;
              role = 'client';
              break;
            }
          }
        }
        
        if (foundData) break;
      }

      if (foundData) {
        if (role === 'client') {
          const clientData = foundData as ClientRecord;
          return {
            id: firebaseUser.uid,
            email: firebaseUser.email || clientData.email,
            name: clientData.name || firebaseUser.email?.split('@')[0] || 'Client',
            role: 'client',
            createdAt: clientData.createdAt || new Date().toISOString(),
            profileImage: clientData.profileImage,
            status: clientData.status || 'active',
            adminUid: adminUid,
            companyName: clientData.companyName,
          };
        } else {
          const empData = foundData as EmployeeRecord;
          return {
            id: firebaseUser.uid,
            email: firebaseUser.email || empData.email,
            name: empData.name || firebaseUser.email?.split('@')[0] || 'Employee',
            role: role,
            createdAt: empData.createdAt || new Date().toISOString(),
            profileImage: empData.profileImage,
            department: empData.department,
            designation: empData.designation,
            status: empData.status || 'active',
            adminUid: adminUid,
            employeeId: empData.employeeId,
          };
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching user data:', error);
    return null;
  }
};
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userData = await fetchUserData(firebaseUser);
        setUser(userData);
        if (userData) {
          await set(ref(database, `users/${userData.id}/lastActive`), Date.now());
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    let presenceInterval: NodeJS.Timeout;
    if (user) {
      presenceInterval = setInterval(async () => {
        await set(ref(database, `users/${user.id}/lastActive`), Date.now());
      }, 30000);
    }

    return () => {
      unsubscribe();
      if (presenceInterval) clearInterval(presenceInterval);
    };
  }, [user?.id]); // ✅ add dependency to avoid stale closure

  const login = async (identifier: string, password: string, _role: string) => {
    setLoading(true);
    try {
      let email = identifier;
      if (identifier.startsWith("EMP-")) {
        const snapshot = await get(ref(database, "users"));
        let foundEmail = "";
        if (snapshot.exists()) {
          snapshot.forEach((adminSnap) => {
            const employees = adminSnap.child("employees").val() as Record<string, EmployeeData> | undefined;
            if (employees) {
              Object.values(employees).forEach((emp) => {
                if (emp.employeeId === identifier) foundEmail = emp.email;
              });
            }
          });
        }
        if (!foundEmail) return { success: false, message: "Employee ID not found" };
        email = foundEmail;
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userData = await fetchUserData(userCredential.user);
      if (!userData) {
        await signOut(auth);
        return { success: false, message: 'User data not found' };
      }
      if (userData.status === 'inactive') {
        await signOut(auth);
        return { success: false, message: 'Your account is inactive. Please contact administrator.' };
      }
      setUser(userData);
      await update(ref(database, `users/${userData.id}`), {
        lastLogin: new Date().toISOString(),
        status: 'active',
        lastActive: Date.now()
      });
      return { success: true };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      let errorMessage = 'Login failed';
      if (err.code === 'auth/user-not-found') errorMessage = 'User not found';
      else if (err.code === 'auth/wrong-password') errorMessage = 'Incorrect password';
      else if (err.code === 'auth/invalid-email') errorMessage = 'Invalid email or employee ID';
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, password: string, userData: Partial<User>) => {
    setLoading(true);
    try {
      let userCredential;
      try {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } catch (error) {
        const err = error as { code?: string };
        if (err.code === 'auth/email-already-in-use') {
          userCredential = await signInWithEmailAndPassword(auth, email, password);
        } else {
          throw error;
        }
      }
      const uid = userCredential.user.uid;
      await set(ref(database, `users/${uid}`), {
        ...userData,
        email,
        name: userData.name || email.split('@')[0],
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        status: 'active',
      });
      const completeUserData = await fetchUserData(userCredential.user);
      setUser(completeUserData);
      return { success: true };
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, message: 'Signup failed' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (user) {
        await update(ref(database, `users/${user.id}`), { lastActive: Date.now() });
      }
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error: unknown) {
    console.error('Reset password error:', error);
    let message = 'Failed to send reset email';
    if (error instanceof Error) {
      if (error.message.includes('auth/user-not-found')) {
        message = 'No account found with this email address';
      } else if (error.message.includes('auth/invalid-email')) {
        message = 'Invalid email address';
      } else {
        message = error.message;
      }
    }
    return { success: false, message };
  }
};

  const changePassword = async (newPassword: string) => {
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        return { success: true };
      }
      return { success: false, message: 'No authenticated user' };
    } catch (error) {
      const err = error as { message?: string };
      return { success: false, message: err.message || 'Password change failed' };
    }
  };

  // ✅ Memoize context value to prevent unnecessary re-renders and help Fast Refresh
  const contextValue = useMemo(() => ({
    user,
    login,
    signup,
    logout,
    loading,
    resetPassword,
    changePassword,
    updateUserStatus,
  }), [user, loading]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};