// src/components/admin/DashboardCard.tsx
import React from 'react';
import { motion } from 'framer-motion';

interface DashboardCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  color?: string; // e.g., "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
  onClick?: () => void;
  delay?: number;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, subtitle, icon: Icon, color, onClick, delay = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="cursor-pointer"
      onClick={onClick}
    >
      <div className="bg-card rounded-xl p-4 shadow-sm border border-border transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <div className={`p-2 rounded-full ${color || 'bg-primary/10 text-primary'}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DashboardCard;