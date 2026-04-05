import { useState, useEffect } from 'react';
import { toast } from '../components/ui/use-toast';
import { SMSService } from '../utils/smsService';
import { ref, onValue, update, remove } from "firebase/database";
import { database } from "../firebase";

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

export const useEmployeeApproval = () => {
  const [pendingEmployees, setPendingEmployees] = useState<PendingEmployee[]>([]);
  const [otpInputs, setOtpInputs] = useState<{ [key: string]: string }>({});
  const [sendingOtp, setSendingOtp] = useState<{ [key: string]: boolean }>({});

  // ✅ LOAD FROM FIREBASE
  useEffect(() => {
    const pendingRef = ref(database, "pendingEmployees");

    const unsubscribe = onValue(pendingRef, (snapshot) => {
      const data = snapshot.val();

      if (data) {
        const list = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));

        setPendingEmployees(
          list.filter((emp: PendingEmployee) => emp.status === "pending")
        );
      } else {
        setPendingEmployees([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // ✅ GENERATE OTP
  const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // ✅ APPROVE EMPLOYEE (FIREBASE)
  const approveEmployee = async (employeeId: string) => {
    const otpCode = otpInputs[employeeId];

    if (!otpCode || otpCode.length !== 6) {
      toast({
        title: "Error",
        description: "Please enter a 6-digit OTP",
        variant: "destructive",
      });
      return;
    }

    const employee = pendingEmployees.find(emp => emp.employeeId === employeeId);
    if (!employee) return;

    try {
      // 🔥 1. Move to main employees collection
      const employeeRef = ref(database, `employees/${employee.id}`);
      await update(employeeRef, {
        ...employee,
        isActive: true,
        otp: otpCode,
        otpExpiry: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        needsOtpVerification: true,
        approvedAt: new Date().toISOString(),
        status: "active"
      });

      // 🔥 2. Remove from pending
      const pendingRef = ref(database, `pendingEmployees/${employee.id}`);
      await remove(pendingRef);

      // 🔥 3. Send SMS
      if (employee.phone) {
        await SMSService.sendApprovalNotification(
          employee.phone,
          employee.name,
          employee.employeeId
        );
      }

      toast({
        title: "Employee Approved",
        description: `${employee.name} approved successfully`,
      });

      setOtpInputs(prev => ({ ...prev, [employeeId]: "" }));

    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Approval failed",
        variant: "destructive",
      });
    }
  };

  // ✅ REJECT EMPLOYEE
  const rejectEmployee = async (employeeId: string) => {
    const employee = pendingEmployees.find(emp => emp.employeeId === employeeId);
    if (!employee) return;

    try {
      const pendingRef = ref(database, `pendingEmployees/${employee.id}`);
      await remove(pendingRef);

      toast({
        title: "Employee Rejected",
        description: `Employee ${employee.employeeId} rejected`,
        variant: "destructive",
      });

    } catch (error) {
      console.error(error);
    }
  };

  // ✅ OTP INPUT
  const handleOtpChange = (employeeId: string, value: string) => {
    const numericValue = value.replace(/\D/g, "").slice(0, 6);
    setOtpInputs(prev => ({ ...prev, [employeeId]: numericValue }));
  };

  // ✅ SEND OTP TO ADMIN PHONE
  const autoGenerateAndSendOtp = async (employeeId: string) => {
    const employee = pendingEmployees.find(emp => emp.employeeId === employeeId);
    if (!employee) return;

    setSendingOtp(prev => ({ ...prev, [employeeId]: true }));

    try {
      const otp = generateOtp();

      setOtpInputs(prev => ({ ...prev, [employeeId]: otp }));

      // 🔥 you can replace with real admin phone later
      const adminPhone = "+919096649556";

      const success = await SMSService.sendOTPNotification(
        adminPhone,
        employee.name,
        employee.employeeId,
        otp
      );

      if (success) {
        toast({
          title: "OTP Sent",
          description: `OTP sent to admin`,
        });
      } else {
        toast({
          title: "SMS Failed",
          description: "Using manual OTP",
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error(error);
    } finally {
      setSendingOtp(prev => ({ ...prev, [employeeId]: false }));
    }
  };

  return {
    pendingEmployees,
    otpInputs,
    sendingOtp,
    approveEmployee,
    rejectEmployee,
    handleOtpChange,
    autoGenerateAndSendOtp,
  };
};