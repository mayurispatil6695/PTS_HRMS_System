
import React from 'react';
import { useEmployeeApproval } from '../../hooks/useEmployeeApproval';
import ApprovalHeader from './approval/ApprovalHeader';
import PendingEmployeesList from './approval/PendingEmployeesList';

const EmployeeApprovalManagement = () => {
  const {
    pendingEmployees,
    otpInputs,
    sendingOtp,
    approveEmployee,
    rejectEmployee,
    handleOtpChange,
    autoGenerateAndSendOtp
  } = useEmployeeApproval();

  return (
    <div className="space-y-6">
      <ApprovalHeader pendingCount={pendingEmployees.length} />
      <PendingEmployeesList
        pendingEmployees={pendingEmployees}
        otpInputs={otpInputs}
        sendingOtp={sendingOtp}
        onOtpChange={handleOtpChange}
        onGenerateOtp={autoGenerateAndSendOtp}
        onApprove={approveEmployee}
        onReject={rejectEmployee}
      />
    </div>
  );
};

export default EmployeeApprovalManagement;
