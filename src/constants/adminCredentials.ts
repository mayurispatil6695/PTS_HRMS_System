
import { PredefinedAdmin } from '../types/auth';

// Predefined admin credentials - DO NOT ALLOW REGISTRATION
export const PREDEFINED_ADMINS: PredefinedAdmin[] = [
  {
    id: 'admin-001',
    email: 'rahulpawar.ceo@gmail.com',
    password: 'RP2025',
    name: 'Rahul Pawar',
    designation: 'CEO',
    phone: '+919096649556' // Admin's registered mobile number
  },
  {
    id: 'admin-002', 
    email: 'swapnilgunke.pm@gmail.com',
    password: 'Swapnil2025',
    name: 'Swapnil Gunke',
    designation: 'Product Manager',
    phone: '+919096649556' // Admin's registered mobile number
  }
];
