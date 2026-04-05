
import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { UserCheck } from 'lucide-react';
import PendingEmployeeCard from './PendingEmployeeCard';

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

interface PendingEmployeesListProps {
  pendingEmployees: PendingEmployee[];
  otpInputs: {[key: string]: string};
  sendingOtp: {[key: string]: boolean};
  onOtpChange: (employeeId: string, value: string) => void;
  onGenerateOtp: (employeeId: string) => void;
  onApprove: (employeeId: string) => void;
  onReject: (employeeId: string) => void;
}

const PendingEmployeesList: React.FC<PendingEmployeesListProps> = ({
  pendingEmployees,
  otpInputs,
  sendingOtp,
  onOtpChange,
  onGenerateOtp,
  onApprove,
  onReject
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Pending Registrations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingEmployees.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No pending employee registrations
            </div>
          ) : (
            <div className="space-y-4">
              {pendingEmployees.map((employee, index) => (
                <PendingEmployeeCard
                  key={employee.id}
                  employee={employee}
                  index={index}
                  otpValue={otpInputs[employee.employeeId] || ''}
                  sendingOtp={sendingOtp[employee.employeeId] || false}
                  onOtpChange={(value) => onOtpChange(employee.employeeId, value)}
                  onGenerateOtp={() => onGenerateOtp(employee.employeeId)}
                  onApprove={() => onApprove(employee.employeeId)}
                  onReject={() => onReject(employee.employeeId)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default PendingEmployeesList;
