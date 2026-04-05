
import { User } from '../types/auth';
import { PREDEFINED_ADMINS } from '../constants/adminCredentials';
import { verifyPassword, verifyAdminPassword, hashPassword } from '../utils/passwordUtils';

export const authenticateAdmin = (email: string, password: string): User | null => {
  if (!verifyAdminPassword(email, password)) {
    return null;
  }
  
  const users = JSON.parse(localStorage.getItem('hrms_users') || '[]');
  return users.find((u: User) => u.email === email && u.role === 'admin') || null;
};

export const authenticateEmployee = async (
  email: string, 
  password: string
): Promise<{ success: boolean; message?: string; user?: User }> => {
  const users = JSON.parse(localStorage.getItem('hrms_users') || '[]');
  const foundUser = users.find((u: User) => u.email === email && u.role === 'employee');
  
  if (!foundUser) {
    return { success: false, message: 'No account found with this email address' };
  }
  
  if (!foundUser.hashedPassword || !verifyPassword(password, foundUser.hashedPassword)) {
    return { success: false, message: 'Invalid password' };
  }
  
  if (!foundUser.isActive) {
    return { success: false, message: 'Your account is pending admin activation. Please contact your administrator.' };
  }
  
  return { success: true, user: foundUser };
};

export const resetUserPassword = (email: string, newPassword: string, otp: string): boolean => {
  try {
    const users = JSON.parse(localStorage.getItem('hrms_users') || '[]');
    const updatedUsers = users.map((u: User) => {
      if (u.email === email) {
        return { ...u, hashedPassword: hashPassword(newPassword) };
      }
      return u;
    });
    
    localStorage.setItem('hrms_users', JSON.stringify(updatedUsers));
    
    return true;
  } catch (error) {
    console.error('Reset password error:', error);
    return false;
  }
};
