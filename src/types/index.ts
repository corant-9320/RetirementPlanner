export interface InputParameters {
  eurToGbpRate: number;
  currentNetSalary: number;
  monthsToWork: number;
  currentSavings: number;
  savingsReturnRate: number;
  currentPrivatePensions: number;
  pensionReturnRate: number;
  pensionDrawdownRate: number;
  statePensionAmountUser: number;
  statePensionStartDateUser: number;
  statePensionAmountSpouse: number;
  statePensionStartDateSpouse: number;
  statePensionIncreasePerYear: number;
  mortgageRemaining: number;
  mortgagePayments: number;
  houseSaleDate: number;
  houseSalePrice: number;
  oneOffEvents: OneOffEvent[];
  savingsThreshold: number;
}

export interface OneOffEvent {
  year: number;
  amount: number;
  description: string;
  currency: 'EUR' | 'GBP';
}

export interface YearlyResult {
  year: number;
  age: number;
  incomeFromPension: number;
  incomeFromSavingsInterest: number;
  totalIncome: number;
  outgoings: number;
  totalOutgoings: number;
  pensionRemaining: number;
  savingsRemaining: number;
}

export interface SimulationResult {
  years: YearlyResult[];
  warnings: string[];
}
