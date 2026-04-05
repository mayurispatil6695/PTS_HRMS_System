
const API_KEY = 'e3527447-5244-11f0-a562-0200cd936042';

export interface SMSMessage {
  to: string;
  message: string;
  from?: string;
}

export class SMSService {
  private static apiKey = API_KEY;

  static async sendSMS(smsData: SMSMessage): Promise<boolean> {
    try {
      console.log('SMS Service - Sending message:', {
        to: smsData.to,
        message: smsData.message,
        apiKey: this.apiKey
      });

      // Replace this with your actual SMS API endpoint
      // Example implementations for different SMS providers:
      
      // For Twilio:
      /*
      const response = await fetch('https://api.twilio.com/2010-04-01/Accounts/YOUR_ACCOUNT_SID/Messages.json', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${ACCOUNT_SID}:${this.apiKey}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: smsData.to,
          From: smsData.from || 'HRMS',
          Body: smsData.message
        })
      });
      */

      // For SMS API services:
      /*
      const response = await fetch('https://api.smsservice.com/v1/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: smsData.to,
          message: smsData.message,
          from: smsData.from || 'HRMS'
        }),
      });
      */

      // For demo purposes, simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate success response
      return true;

    } catch (error) {
      console.error('SMS Service Error:', error);
      return false;
    }
  }

  static async sendOTPNotification(adminPhone: string, employeeName: string, employeeId: string, otp: string): Promise<boolean> {
    const message = `🔐 PTS System OTP Alert\n\nEmployee: ${employeeName}\nID: ${employeeId}\nOTP: ${otp}\n\nUse this OTP to approve employee access.\n\nExpires in 5 minutes.`;
    
    return await this.sendSMS({
      to: adminPhone,
      message: message,
      from: 'HRMS-System'
    });
  }

  static async sendApprovalNotification(employeePhone: string, employeeName: string, employeeId: string): Promise<boolean> {
    const message = `🎉 Welcome to HRMS!\n\nHi ${employeeName},\n\nYour account (${employeeId}) has been approved by admin.\n\nYou can now login using the OTP sent to you.\n\nWelcome aboard!`;
    
    return await this.sendSMS({
      to: employeePhone,
      message: message,
      from: 'HRMS-System'
    });
  }
}
