// src/constants/financeConstants.ts
import { 
  Home, Zap, Utensils, User, Heart, PenTool, Wrench, Droplet, 
  FileText, Printer, Palette, Truck, Mail, Tag, CircleDollarSign, Receipt 
} from 'lucide-react';

export const expenseCategories = [
  { value: 'office-rent', label: 'Office Rent', icon: Home },
  { value: 'electricity', label: 'Electricity Bill', icon: Zap },
  { value: 'lunch', label: 'Employee Lunch', icon: Utensils },
  { value: 'salary', label: 'Employee Salary', icon: User },
  { value: 'medical', label: 'Medical Expenses', icon: Heart },
  { value: 'stationery', label: 'Stationery', icon: PenTool },
  { value: 'servant', label: 'Servant Charge', icon: User },
  { value: 'housekeeping', label: 'Housekeeping', icon: Wrench },
  { value: 'equipment', label: 'Office Equipment', icon: Wrench },
  { value: 'water', label: 'Water Bill', icon: Droplet },
  { value: 'software', label: 'Software Subscription', icon: FileText },
  { value: 'printing', label: 'Printing & Photocopy', icon: Printer },
  { value: 'decor', label: 'Office Decor', icon: Palette },
  { value: 'travel', label: 'Local Traveling', icon: Truck },
  { value: 'courier', label: 'Courier', icon: Mail },
  { value: 'tax', label: 'Tax', icon: Tag },
  { value: 'advertising', label: 'Advertising', icon: Tag },
  { value: 'other', label: 'Other Expenses', icon: Receipt }
];

export const departments = [
  'Software', 'Digital Marketing', 'Sales', 'Product Designing', 
  'Web Development', 'Graphic Designing', 'Office', 'HR', 'Finance'
];

export const paymentMethods = ['Cash', 'Bank Transfer', 'Credit Card', 'UPI', 'Cheque', 'Online Payment'];

export const packageTypes = ['monthly', 'quarterly', 'half-yearly', 'yearly', 'custom'];

export const timeRanges = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'last-quarter', label: 'Last Quarter' },
  { value: 'last-year', label: 'Last Year' }
];