
import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { UserCheck, UserX, Send, Calendar, Mail, User, Phone } from 'lucide-react';

interface PendingEmployee {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  joinDate: string;
  appliedAt: string;
  status: string;
}

interface PendingEmployeeCardProps {
  employee: PendingEmployee;
  index: number;
  otpValue: string;
  sendingOtp: boolean;
  onOtpChange: (value: string) => void;
  onGenerateOtp: () => void;
  onApprove: () => void;
  onReject: () => void;
}

const PendingEmployeeCard: React.FC<PendingEmployeeCardProps> = ({
  employee,
  index,
  otpValue,
  sendingOtp,
  onOtpChange,
  onGenerateOtp,
  onApprove,
  onReject
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-500" />
            <span className="font-semibold">{employee.name}</span>
            <Badge className="bg-blue-100 text-blue-700">
              {employee.employeeId}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Mail className="h-4 w-4" />
            {employee.email}
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone className="h-4 w-4" />
            {employee.phone}
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="h-4 w-4" />
            Joining: {new Date(employee.joinDate).toLocaleDateString()}
          </div>
          
          <div className="text-sm text-gray-500">
            Applied: {new Date(employee.appliedAt).toLocaleDateString()}
          </div>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Generate & Send OTP to Admin Phone
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="6-digit OTP"
                value={otpValue}
                onChange={(e) => onOtpChange(e.target.value)}
                className="text-center font-mono"
                maxLength={6}
              />
              <Button
                onClick={onGenerateOtp}
                variant="outline"
                size="sm"
                disabled={sendingOtp}
              >
                {sendingOtp ? (
                  <div className="h-4 w-4 animate-spin border-2 border-blue-600 border-t-transparent rounded-full" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <Phone className="h-3 w-3" />
              SMS will be sent to admin & employee
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={onApprove}
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={!otpValue || otpValue.length !== 6}
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Approve & Notify
            </Button>
            
            <Button
              onClick={onReject}
              variant="destructive"
              className="flex-1"
            >
              <UserX className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PendingEmployeeCard;
