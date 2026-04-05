
import bcrypt from 'bcryptjs';
import { User } from '../types/auth';
import { PREDEFINED_ADMINS } from '../constants/adminCredentials';

export const hashPassword = (password: string): string => {
  return bcrypt.hashSync(password, 10);
};

export const verifyPassword = (password: string, hashedPassword: string): boolean => {
  return bcrypt.compareSync(password, hashedPassword);
};

export const verifyAdminPassword = (email: string, password: string): boolean => {
  const predefinedAdmin = PREDEFINED_ADMINS.find(admin => admin.email === email);
  return predefinedAdmin ? predefinedAdmin.password === password : false;
};

export const verifyUserPassword = (user: User, currentPassword: string): boolean => {
  if (user.role === 'admin') {
    const predefinedAdmin = PREDEFINED_ADMINS.find(admin => admin.email === user.email);
    return (predefinedAdmin && predefinedAdmin.password === currentPassword) ||
           (user.hashedPassword && verifyPassword(currentPassword, user.hashedPassword));
  } else {
    return user.hashedPassword ? verifyPassword(currentPassword, user.hashedPassword) : false;
  }
};
