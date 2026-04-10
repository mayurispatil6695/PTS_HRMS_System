export interface SalaryStructure {
  basic: number;
  hra: number;
  allowances: number;
  fixedDeductions: number; // e.g., loan repayment
  pfApplicable: boolean;
  pfPercentage: number;    // e.g., 12
}

export interface AttendanceData {
  presentDays: number;
  totalWorkingDays: number; // e.g., 26
  lateDays?: number;
  halfDays?: number;
}

// Indian tax slabs (FY 2024-25, new regime example)
const taxSlabs = [
  { limit: 300000, rate: 0 },
  { limit: 700000, rate: 5 },
  { limit: 1000000, rate: 10 },
  { limit: 1200000, rate: 15 },
  { limit: 1500000, rate: 20 },
  { limit: Infinity, rate: 30 }
];

export function calculateMonthlyTax(annualIncome: number): number {
  let tax = 0;
  let remaining = annualIncome;
  let prevLimit = 0;
  for (const slab of taxSlabs) {
    const taxable = Math.min(remaining, slab.limit - prevLimit);
    tax += (taxable * slab.rate) / 100;
    remaining -= taxable;
    prevLimit = slab.limit;
    if (remaining <= 0) break;
  }
  return tax / 12; // monthly tax
}

export function calculateNetSalary(
  structure: SalaryStructure,
  attendance: AttendanceData
): {
  grossEarnings: number;
  totalDeductions: number;
  netSalary: number;
  breakdown: Record<string, number>;
} {
  const { basic, hra, allowances, fixedDeductions, pfApplicable, pfPercentage } = structure;
  const { presentDays, totalWorkingDays } = attendance;

  const prorateFactor = presentDays / totalWorkingDays;
  const proratedBasic = basic * prorateFactor;
  const proratedHra = hra * prorateFactor;
  const proratedAllowances = allowances * prorateFactor;

  const grossEarnings = proratedBasic + proratedHra + proratedAllowances;

  // PF deduction (12% of basic+hra)
  let pfDeduction = 0;
  if (pfApplicable) {
    pfDeduction = (basic + hra) * (pfPercentage / 100) * prorateFactor;
  }
  const professionalTax = 200; // fixed per month (adjust as needed)
  const incomeTax = calculateMonthlyTax(grossEarnings * 12);

  const totalDeductions = pfDeduction + professionalTax + incomeTax + fixedDeductions;
  const netSalary = grossEarnings - totalDeductions;

  return {
    grossEarnings,
    totalDeductions,
    netSalary,
    breakdown: {
      basic: proratedBasic,
      hra: proratedHra,
      allowances: proratedAllowances,
      pf: pfDeduction,
      professionalTax,
      incomeTax,
      fixedDeductions
    }
  };
}