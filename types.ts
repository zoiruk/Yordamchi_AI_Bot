
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

/**
 * Interface representing user input parameters for UK seasonal worker pay calculation.
 */
export interface UserInputs {
  hourlyRate: number;
  hoursPerWeek: number;
  weeksWorked: number;
  accommodationWeekly: number;
  travelToUK: number;
  weeklyFood: number;
  visaFee: number;
  transportationWithinUK: number;
  taxReclaim: number;
}

/**
 * Interface representing the calculated financial results for a seasonal worker.
 */
export interface CalculationResults {
  grossTotal: number;
  incomeTax: number;
  nationalInsurance: number;
  totalEarned: number;
  totalCost: number;
  totalLeft: number;
}
