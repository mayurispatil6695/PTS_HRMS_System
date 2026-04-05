
import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '../../ui/badge';

interface ApprovalHeaderProps {
  pendingCount: number;
}

const ApprovalHeader: React.FC<ApprovalHeaderProps> = ({ pendingCount }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between"
    >
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Employee Approval</h1>
        <p className="text-gray-600">Review and approve pending employee registrations</p>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="secondary" className="text-xs">
            API Integrated
          </Badge>
          <p className="text-sm text-blue-600">OTP notifications sent to admin phone</p>
        </div>
      </div>
      <Badge variant="outline" className="text-lg px-3 py-1">
        {pendingCount} Pending
      </Badge>
    </motion.div>
  );
};

export default ApprovalHeader;
