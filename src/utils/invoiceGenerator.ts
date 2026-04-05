import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '../assets/company-logo.png';

export const generateInvoice = (client, payments) => {
  // Initialize PDF with better settings
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    filters: ['ASCIIHexEncode']
  });

  // Set default font
  doc.setFont('helvetica');

  // Add decorative border
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.rect(10, 10, 190, 277);

  // Add decorative header with gradient
  doc.setFillColor(41, 128, 185);
  doc.rect(10, 10, 190, 20, 'F');
  
  // Add wave pattern in header
  doc.setDrawColor(255, 255, 255, 50);
  doc.setLineWidth(0.3);
  for (let i = 0; i < 190; i += 5) {
    doc.line(10 + i, 15, 15 + i, 25);
  }

  // Add company logo with white border
  try {
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(1);
    doc.roundedRect(15, 15, 40, 15, 2, 2, 'S');
    doc.addImage(logo, 'PNG', 16, 16, 38, 13);
  } catch (err) {
    console.warn('Logo could not be added:', err);
  }

  // Company Information with better styling
  doc.setFontSize(12);
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  const companyYStart = 18;
  const rightAlignX = 190;
  
  const companyInfo = [
    'Pawar Technology Services',
    'Office No A1002 Boulevard Towers',
    'Sadhu Vaswani Chowk, Camp,Pune,Maharashtra,411001,India',
    'Phone: +91 909-664-9556',
    'Email: pawartechnologyservices@gmail.com',
    'GSTIN: 22AAAAA0000A1Z5'
  ];
  
  companyInfo.forEach((text, i) => {
    doc.text(text, rightAlignX, companyYStart + i * 5, { align: 'right' });
  });

  // Invoice title with decorative elements
  doc.setFontSize(24);
  doc.setTextColor(41, 128, 185);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', 105, 50, { align: 'center' });
  
  // Add decorative lines around title
  doc.setDrawColor(41, 128, 185);
  doc.setLineWidth(0.5);
  doc.line(70, 52, 140, 52);
  doc.line(70, 54, 140, 54);

  // Invoice details section with background
  doc.setFillColor(245, 245, 245);
  doc.rect(15, 60, 180, 15, 'F');
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  doc.text(`Invoice #: ${invoiceNumber}`, 20, 68);
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 80, 68);
  doc.text(`Due Date: ${new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')}`, 140, 68);

  // Client info with decorative border
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
  const clientY = 95;
  const clientInfo = [
    client.name,
    client.address,
    `Contact: ${client.contact}`,
    client.email ? `Email: ${client.email}` : null,
    client.gstin ? `GSTIN: ${client.gstin}` : null
  ].filter(Boolean);

  clientInfo.forEach((text, i) => {
    doc.text(text, 20, clientY + i * 5);
  });

  // Package details with icons (using text as icons for simplicity)
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
  doc.text(`✓ Duration: ${client.duration || 'N/A'}`, 115, 116);

  // Payment Summary with modern design
  const summaryY = 130;
  const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const totalPackage = parseFloat(client.packageAmount) || 0;
  const pendingAmount = totalPackage - totalPaid;
  
  // Summary header
  doc.setFillColor(41, 128, 185);
  doc.roundedRect(15, summaryY, 180, 8, 3, 3, 'F');
  doc.setTextColor(255);
  doc.setFontSize(10);
  doc.text('Payment Summary', 105, summaryY + 5.5, { align: 'center' });
  
  // Summary content
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(15, summaryY + 8, 180, 25, 3, 3, 'FD');
  doc.setDrawColor(200, 200, 200);
  doc.roundedRect(15, summaryY + 8, 180, 25, 3, 3, 'S');
  
  doc.setTextColor(80);
  doc.setFontSize(10);
  
  // Grid lines
  doc.setDrawColor(230, 230, 230);
  doc.line(15, summaryY + 16, 195, summaryY + 16);
  doc.line(15, summaryY + 24, 195, summaryY + 24);
  doc.line(105, summaryY + 8, 105, summaryY + 33);
  
  // Labels
  doc.setFont('helvetica', 'bold');
  doc.text('Total Package:', 30, summaryY + 14);
  doc.text('Total Paid:', 30, summaryY + 22);
  doc.text('Pending Amount:', 30, summaryY + 30);
  
  // Values
  doc.setTextColor(41, 128, 185);
  doc.text(formatCurrency(totalPackage), 150, summaryY + 14, { align: 'right' });
  doc.text(formatCurrency(totalPaid), 150, summaryY + 22, { align: 'right' });
  
  // Highlight pending amount based on value
  if (pendingAmount > 0) {
    doc.setTextColor(231, 76, 60);
  } else {
    doc.setTextColor(39, 174, 96);
  }
  doc.text(formatCurrency(pendingAmount), 150, summaryY + 30, { align: 'right' });

  // Payment History Table with enhanced styling
  let nextY = summaryY + 45;
  if (payments.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(41, 128, 185);
    doc.setFont('helvetica', 'bold');
    doc.text('Payment History:', 15, nextY);
    
    const paymentData = payments.map(payment => [
      formatDate(payment.date),
      formatCurrency(payment.amount),
      payment.paymentMethod || '-',
      payment.reference || '-',
      payment.status ? '✅' : '❌',
      payment.description || '-'
    ]);

    autoTable(doc, {
      startY: nextY + 5,
      head: [['Date', 'Amount', 'Method', 'Reference', 'Status', 'Description']],
      body: paymentData,
      theme: 'grid',
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 25, halign: 'right' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 35, halign: 'center' },
        4: { cellWidth: 15, halign: 'center' },
        5: { cellWidth: 'auto', halign: 'left' }
      },
      styles: {
        fontSize: 9,
        cellPadding: 2,
        overflow: 'linebreak',
        valign: 'middle'
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      },
      margin: { left: 15, right: 15 },
      tableWidth: 'auto',
      didDrawPage: function (data) {
        // Add page number
        const pageCount = doc.internal.getNumberOfPages();
        if (data.pageNumber === pageCount) {
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(`Page ${data.pageNumber} of ${pageCount}`, 105, 285, { align: 'center' });
        }
      }
    });

    nextY = doc.lastAutoTable.finalY + 10;
  }

  // Terms & Conditions with decorative bullet points
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
    'Services may be suspended for accounts past due by 30 days or more.'
  ];
  
  terms.forEach((line, i) => {
    // Custom bullet points
    doc.setFillColor(41, 128, 185);
    doc.circle(18, nextY + 5 + i * 5 - 1, 1, 'F');
    doc.text(line, 22, nextY + 5 + i * 5);
  });

  // QR Code for payment (placeholder - in a real app, generate actual QR)
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Scan to Pay:', 150, nextY);
  
  // QR code placeholder box
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(150, nextY + 3, 35, 35, 3, 3, 'FD');
  doc.roundedRect(150, nextY + 3, 35, 35, 3, 3, 'S');
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(20);
  doc.text('QR', 167.5, nextY + 20, { align: 'center' });

  // Footer with decorative elements
  doc.setFillColor(41, 128, 185);
  doc.rect(10, 275, 190, 5, 'F');
  
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Thank you for your business!', 105, 285, { align: 'center' });
  doc.text('This is a computer generated invoice and does not require signature.', 105, 288, { align: 'center' });
  
  // Add company website and contact
  doc.setTextColor(100);
  doc.text('www.yourcompany.com | support@yourcompany.com | +91 1234567890', 105, 291, { align: 'center' });

  // Save with better filename
  const fileName = `Invoice_${invoiceNumber}_${client.name.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
};

// Enhanced Helpers
const formatCurrency = (amount) => {
  const num = parseFloat(amount);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(isNaN(num) ? 0 : num);
};

const formatDate = (date) => {
  try {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return '-';
  }
};

const capitalize = (text) => {
  if (!text) return '-';
  return text.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};