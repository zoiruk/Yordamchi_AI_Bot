
import { UserInputs, CalculationResults } from '../types';

/**
 * Calculates net pay and profit for UK seasonal workers based on projected 2026/27 rates.
 */
export const calculatePay = (inputs: UserInputs): CalculationResults => {
  const {
    hourlyRate,
    hoursPerWeek,
    weeksWorked,
    accommodationWeekly,
    travelToUK,
    weeklyFood,
    visaFee,
    transportationWithinUK,
    taxReclaim
  } = inputs;

  const grossWeekly = hourlyRate * hoursPerWeek;
  const grossTotal = grossWeekly * weeksWorked;

  // Projected 2026/27 Thresholds (Estimates based on current trajectories)
  // Personal Allowance usually £12,570 (frozen or slightly adjusted)
  const personalAllowanceWeekly = 12570 / 52;
  // National Insurance Lower Earnings Limit
  const niThresholdWeekly = 242;

  // Statutory Deductions
  const taxableWeekly = Math.max(0, grossWeekly - personalAllowanceWeekly);
  const weeklyIncomeTax = taxableWeekly * 0.20;
  const incomeTax = weeklyIncomeTax * weeksWorked;

  const niableWeekly = Math.max(0, grossWeekly - niThresholdWeekly);
  // NI Rate projected at 8% for employees
  const weeklyNI = niableWeekly * 0.08;
  const nationalInsurance = weeklyNI * weeksWorked;

  // Total Earned (Net Pay after taxes)
  const totalEarned = grossTotal - incomeTax - nationalInsurance;

  // Personal Costs
  const totalCost = (accommodationWeekly * weeksWorked) + 
                    (weeklyFood * weeksWorked) + 
                    (transportationWithinUK * weeksWorked) + 
                    visaFee + 
                    travelToUK;

  // Final Profit
  const totalLeft = totalEarned - totalCost + taxReclaim;

  return {
    grossTotal,
    incomeTax,
    nationalInsurance,
    totalEarned,
    totalCost,
    totalLeft
  };
};

export const FORMATTER = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});
