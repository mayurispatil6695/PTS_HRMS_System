
import jsPDF from 'jspdf';

interface SalarySlipData {
  employeeName: string;
  employeeId: string;
  month: string;
  year: number;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  generatedAt: string;
  companyName?: string;
  companyAddress?: string;
}

export const generateSalarySlipPDF = (data: SalarySlipData) => {
  const pdf = new jsPDF();
  
  // Company Header
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text(data.companyName || 'Company Name', 105, 20, { align: 'center' });
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.companyAddress || 'Company Address', 105, 28, { align: 'center' });
  
  // Title
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('SALARY SLIP', 105, 45, { align: 'center' });
  
  // Employee Details
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Employee Name: ${data.employeeName}`, 20, 65);
  pdf.text(`Employee ID: ${data.employeeId}`, 20, 75);
  pdf.text(`Month: ${data.month} ${data.year}`, 20, 85);
  pdf.text(`Generated Date: ${new Date(data.generatedAt).toLocaleDateString()}`, 120, 85);
  
  // Draw line
  pdf.line(20, 95, 190, 95);
  
  // Earnings Section
  pdf.setFont('helvetica', 'bold');
  pdf.text('EARNINGS', 20, 110);
  pdf.text('AMOUNT (₹)', 150, 110);
  
  pdf.setFont('helvetica', 'normal');
  let yPos = 125;
  pdf.text('Basic Salary', 20, yPos);
  pdf.text(data.basicSalary.toLocaleString('en-IN'), 160, yPos, { align: 'right' });
  
  yPos += 15;
  pdf.text('Allowances', 20, yPos);
  pdf.text(data.allowances.toLocaleString('en-IN'), 160, yPos, { align: 'right' });
  
  yPos += 20;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Total Earnings', 20, yPos);
  pdf.text((data.basicSalary + data.allowances).toLocaleString('en-IN'), 160, yPos, { align: 'right' });
  
  // Draw line
  pdf.line(20, yPos + 5, 190, yPos + 5);
  
  // Deductions Section
  yPos += 20;
  pdf.text('DEDUCTIONS', 20, yPos);
  
  pdf.setFont('helvetica', 'normal');
  yPos += 15;
  pdf.text('Tax & Other Deductions', 20, yPos);
  pdf.text(data.deductions.toLocaleString('en-IN'), 160, yPos, { align: 'right' });
  
  yPos += 20;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Total Deductions', 20, yPos);
  pdf.text(data.deductions.toLocaleString('en-IN'), 160, yPos, { align: 'right' });
  
  // Draw line
  pdf.line(20, yPos + 5, 190, yPos + 5);
  
  // Net Salary
  yPos += 20;
  pdf.setFontSize(14);
  pdf.text('NET SALARY', 20, yPos);
  pdf.text(`₹ ${data.netSalary.toLocaleString('en-IN')}`, 160, yPos, { align: 'right' });
  
  // Footer
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'italic');
  pdf.text('This is a computer-generated salary slip and does not require a signature.', 105, 270, { align: 'center' });
  
  // Save the PDF
  pdf.save(`salary-slip-${data.employeeName}-${data.month}-${data.year}.pdf`);
};
