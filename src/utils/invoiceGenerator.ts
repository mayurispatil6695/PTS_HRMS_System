// src/utils/invoiceGenerator.ts
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Client, ClientPayment } from '@/types/finance';
import { formatCurrency, formatDate } from './financeHelpers';
import logo from '../assets/company-logo.png'; // ensure the logo file exists or remove

// Helper: capitalize first letter of each word
const capitalize = (text: string | undefined): string => {
  if (!text) return '-';
  return text
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Extend jsPDF to include the property added by autoTable
interface jsPDFWithAutoTable extends jsPDF {
  lastAutoTable: { finalY: number };
}

export const generateInvoice = (client: Client, payments: ClientPayment[]): void => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as jsPDFWithAutoTable;

  doc.setFont('helvetica');

  // Decorative border
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.rect(10, 10, 190, 277);

  // Header background
  doc.setFillColor(41, 128, 185);
  doc.rect(10, 10, 190, 20, 'F');

  // Add company logo (optional, safe fallback)
  try {
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(1);
    doc.roundedRect(15, 15, 40, 15, 2, 2, 'S');
    doc.addImage(logo, 'PNG', 16, 16, 38, 13);
  } catch (err) {
    console.warn('Logo could not be added:', err);
  }

  // Company information (right‑aligned)
  doc.setFontSize(12);
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  const companyInfo = [
    'Pawar Technology Services',
    'Office No A1002 Boulevard Towers',
    'Sadhu Vaswani Chowk, Camp,Pune,Maharashtra,411001,India',
    'Phone: +91 909-664-9556',
    'Email: pawartechnologyservices@gmail.com',
    'GSTIN: 22AAAAA0000A1Z5',
  ];
  companyInfo.forEach((text, i) => {
    doc.text(text, 190, 18 + i * 5, { align: 'right' });
  });

  // Invoice title
  doc.setFontSize(24);
  doc.setTextColor(41, 128, 185);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', 105, 50, { align: 'center' });
  doc.setDrawColor(41, 128, 185);
  doc.setLineWidth(0.5);
  doc.line(70, 52, 140, 52);
  doc.line(70, 54, 140, 54);

  // Invoice details
  doc.setFillColor(245, 245, 245);
  doc.rect(15, 60, 180, 15, 'F');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')}`;
  doc.text(`Invoice #: ${invoiceNumber}`, 20, 68);
  doc.text(`Date: ${formatDate(new Date().toISOString())}`, 80, 68);
  const dueDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
  doc.text(`Due Date: ${formatDate(dueDate.toISOString())}`, 140, 68);

  // Client info
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(15, 80, 85, 40, 3, 3, 'FD');
  doc.setDrawColor(200, 200, 200);
  doc.roundedRect(15, 80, 85, 40, 3, 3, 'S');
  doc.setFontSize(12);
  doc.setTextColor(41, 128, 185);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', 20, 88);
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.setFont('helvetica', 'normal');
  const clientInfo = [
    client.name,
    client.address,
    `Contact: ${client.contact}`,
    client.email ? `Email: ${client.email}` : null,
  ].filter(Boolean);
  clientInfo.forEach((text, i) => {
    doc.text(text as string, 20, 95 + i * 5);
  });

  // Package details
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(110, 80, 85, 40, 3, 3, 'FD');
  doc.setDrawColor(200, 200, 200);
  doc.roundedRect(110, 80, 85, 40, 3, 3, 'S');
  doc.setFontSize(12);
  doc.setTextColor(41, 128, 185);
  doc.setFont('helvetica', 'bold');
  doc.text('Package Details:', 115, 88);
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.setFont('helvetica', 'normal');
  doc.text(`✓ Package Amount: ${formatCurrency(client.packageAmount)}`, 115, 95);
  doc.text(`✓ Package Type: ${capitalize(client.packageType)}`, 115, 102);
  doc.text(`✓ Start Date: ${formatDate(client.startDate)}`, 115, 109);

  // Payment summary
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalPackage = client.packageAmount;
  const pendingAmount = totalPackage - totalPaid;

  const summaryY = 130;
  doc.setFillColor(41, 128, 185);
  doc.roundedRect(15, summaryY, 180, 8, 3, 3, 'F');
  doc.setTextColor(255);
  doc.setFontSize(10);
  doc.text('Payment Summary', 105, summaryY + 5.5, { align: 'center' });

  doc.setFillColor(250, 250, 250);
  doc.roundedRect(15, summaryY + 8, 180, 25, 3, 3, 'FD');
  doc.setDrawColor(200, 200, 200);
  doc.roundedRect(15, summaryY + 8, 180, 25, 3, 3, 'S');
  doc.setTextColor(80);
  doc.setFontSize(10);
  doc.setDrawColor(230, 230, 230);
  doc.line(15, summaryY + 16, 195, summaryY + 16);
  doc.line(15, summaryY + 24, 195, summaryY + 24);
  doc.line(105, summaryY + 8, 105, summaryY + 33);

  doc.setFont('helvetica', 'bold');
  doc.text('Total Package:', 30, summaryY + 14);
  doc.text('Total Paid:', 30, summaryY + 22);
  doc.text('Pending Amount:', 30, summaryY + 30);
  doc.setTextColor(41, 128, 185);
  doc.text(formatCurrency(totalPackage), 150, summaryY + 14, { align: 'right' });
  doc.text(formatCurrency(totalPaid), 150, summaryY + 22, { align: 'right' });
  if (pendingAmount > 0) doc.setTextColor(231, 76, 60);
  else doc.setTextColor(39, 174, 96);
  doc.text(formatCurrency(pendingAmount), 150, summaryY + 30, { align: 'right' });

  // Payment history table
  let nextY = summaryY + 45;
  if (payments.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(41, 128, 185);
    doc.setFont('helvetica', 'bold');
    doc.text('Payment History:', 15, nextY);

    const paymentData = payments.map(p => [
      formatDate(p.date),
      formatCurrency(p.amount),
      p.paymentMethod,
      p.reference || '-',
      p.description || '-',
    ]);

    // Draw the table – it will set doc.lastAutoTable
    autoTable(doc, {
      startY: nextY + 5,
      head: [['Date', 'Amount', 'Method', 'Reference', 'Description']],
      body: paymentData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { left: 15, right: 15 },
    });
    nextY = doc.lastAutoTable.finalY + 10;
  }

  // Terms & Conditions
  doc.setFontSize(10);
  doc.setTextColor(41, 128, 185);
  doc.setFont('helvetica', 'bold');
  doc.text('Terms & Conditions:', 15, nextY);
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.setFont('helvetica', 'normal');
  const terms = [
    'Payment is due within 15 days of invoice date.',
    'Late payments are subject to a 1.5% monthly interest charge.',
    'All amounts are in INR and inclusive of GST where applicable.',
    'Please include the invoice number with your payment.',
    'For any discrepancies, please contact us within 7 days.',
    'Services may be suspended for accounts past due by 30 days or more.',
  ];
  terms.forEach((line, i) => {
    doc.setFillColor(41, 128, 185);
    doc.circle(18, nextY + 5 + i * 5 - 1, 1, 'F');
    doc.text(line, 22, nextY + 5 + i * 5);
  });

  // QR code placeholder
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Scan to Pay:', 150, nextY);
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(150, nextY + 3, 35, 35, 3, 3, 'FD');
  doc.roundedRect(150, nextY + 3, 35, 35, 3, 3, 'S');
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(20);
  doc.text('QR', 167.5, nextY + 20, { align: 'center' });

  // Footer
  doc.setFillColor(41, 128, 185);
  doc.rect(10, 275, 190, 5, 'F');
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Thank you for your business!', 105, 282, { align: 'center' });
  doc.text('This is a computer generated invoice and does not require signature.', 105, 285, { align: 'center' });
  doc.text('www.yourcompany.com | support@yourcompany.com | +91 1234567890', 105, 288, { align: 'center' });

  // Save PDF
  const fileName = `Invoice_${invoiceNumber}_${client.name.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
};