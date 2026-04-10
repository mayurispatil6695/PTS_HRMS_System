import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 12, fontFamily: 'Helvetica' },
  header: { fontSize: 20, marginBottom: 20, textAlign: 'center', fontWeight: 'bold' },
  section: { marginBottom: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  bold: { fontWeight: 'bold' },
  totalRow: { marginTop: 10, borderTopWidth: 1, paddingTop: 5, flexDirection: 'row', justifyContent: 'space-between' },
  company: { textAlign: 'center', marginBottom: 10, fontSize: 10, color: 'gray' }
});

interface PayslipPDFProps {
  data: {
    employeeName: string;
    employeeId: string;
    month: string;
    year: number;
    grossEarnings: number;
    totalDeductions: number;
    netSalary: number;
    breakdown: Record<string, number>;
    companyName: string;
    generatedDate: string;
  };
}

export const PayslipPDF = ({ data }: PayslipPDFProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.company}>{data.companyName}</Text>
      <Text style={styles.header}>Salary Slip</Text>
      <View style={styles.section}>
        <Text>Employee: {data.employeeName}</Text>
        <Text>Employee ID: {data.employeeId}</Text>
        <Text>Period: {data.month} {data.year}</Text>
        <Text>Generated: {data.generatedDate}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.bold}>Earnings</Text>
        {Object.entries(data.breakdown).map(([key, value]) => {
          if (['pf', 'professionalTax', 'incomeTax', 'fixedDeductions'].includes(key)) return null;
          return (
            <View key={key} style={styles.row}>
              <Text>{key.toUpperCase()}</Text>
              <Text>₹{value.toFixed(2)}</Text>
            </View>
          );
        })}
        <View style={styles.row}>
          <Text style={styles.bold}>Gross Earnings</Text>
          <Text>₹{data.grossEarnings.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.bold}>Deductions</Text>
        {Object.entries(data.breakdown).map(([key, value]) => {
          if (['basic', 'hra', 'allowances'].includes(key)) return null;
          return (
            <View key={key} style={styles.row}>
              <Text>{key.toUpperCase()}</Text>
              <Text>₹{value.toFixed(2)}</Text>
            </View>
          );
        })}
        <View style={styles.row}>
          <Text style={styles.bold}>Total Deductions</Text>
          <Text>₹{data.totalDeductions.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.bold}>Net Salary</Text>
        <Text style={styles.bold}>₹{data.netSalary.toFixed(2)}</Text>
      </View>
    </Page>
  </Document>
);