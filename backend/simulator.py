from dataclasses import dataclass
from typing import List, Dict, Any
from datetime import datetime

@dataclass
class YearlyResult:
    year: int
    age: int
    income_from_pension: float
    income_from_savings_interest: float
    total_income: float
    outgoings: float
    total_outgoings: float
    pension_remaining: float
    savings_remaining: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'year': self.year,
            'age': self.age,
            'incomeFromPension': self.income_from_pension,
            'incomeFromSavingsInterest': self.income_from_savings_interest,
            'totalIncome': self.total_income,
            'outgoings': self.outgoings,
            'totalOutgoings': self.total_outgoings,
            'pensionRemaining': self.pension_remaining,
            'savingsRemaining': self.savings_remaining,
        }

class RetirementSimulator:
    def __init__(
        self,
        eur_to_gbp_rate: float,
        current_net_salary: float,
        months_to_work: int,
        current_savings: float,
        savings_return_rate: float,
        current_private_pensions: float,
        pension_return_rate: float,
        pension_drawdown_rate: float,
        state_pension_amount_user: float,
        state_pension_start_date_user: int,
        state_pension_amount_spouse: float,
        state_pension_start_date_spouse: int,
        state_pension_increase_per_year: float,
        mortgage_remaining: float,
        mortgage_payments: float,
        house_sale_date: int,
        house_sale_price: float,
        savings_threshold: float
    ):
        self.eur_to_gbp_rate = eur_to_gbp_rate
        self.current_net_salary = current_net_salary
        self.months_to_work = months_to_work
        self.current_savings = current_savings
        self.savings_return_rate = savings_return_rate
        self.current_private_pensions = current_private_pensions
        self.pension_return_rate = pension_return_rate
        self.pension_drawdown_rate = pension_drawdown_rate
        self.state_pension_amount_user = state_pension_amount_user
        self.state_pension_start_date_user = state_pension_start_date_user
        self.state_pension_amount_spouse = state_pension_amount_spouse
        self.state_pension_start_date_spouse = state_pension_start_date_spouse
        self.state_pension_increase_per_year = state_pension_increase_per_year
        self.mortgage_remaining = mortgage_remaining
        self.mortgage_payments = mortgage_payments
        self.house_sale_date = house_sale_date
        self.house_sale_price = house_sale_price
        self.savings_threshold = savings_threshold
        
        self.current_year = datetime.now().year
        self.start_year = self.current_year
        self.end_year = 2050
        
    def run_simulation(self) -> Dict[str, Any]:
        results: List[YearlyResult] = []
        warnings: List[str] = []
        
        pension_balance = self.current_private_pensions
        savings_balance = self.current_savings
        salary_years_remaining = self.months_to_work / 12
        mortgage_remaining = self.mortgage_remaining
        
        for year in range(self.start_year, self.end_year + 1):
            years_into_retirement = year - self.start_year - salary_years_remaining
            age = 25 + (year - self.start_year)  # Assume starting age 25 for simplicity
            
            # Calculate income
            salary_income = 0.0
            if years_into_retirement < 0:
                # Still working
                salary_income = (self.current_net_salary * self.eur_to_gbp_rate) / 12 * 12
            
            # Private pension drawdown
            pension_income = max(0, pension_balance * self.pension_drawdown_rate)
            
            # State pension income
            state_pension_income = 0.0
            if year >= self.state_pension_start_date_user:
                years_from_start = year - self.state_pension_start_date_user
                state_pension_income += self.state_pension_amount_user * (1 + self.state_pension_increase_per_year) ** years_from_start
            
            if year >= self.state_pension_start_date_spouse:
                years_from_start = year - self.state_pension_start_date_spouse
                state_pension_income += self.state_pension_amount_spouse * (1 + self.state_pension_increase_per_year) ** years_from_start
            
            total_income = salary_income + pension_income + state_pension_income
            
            # Calculate outgoings
            outgoings = 0.0
            
            # Mortgage payments
            if mortgage_remaining > 0:
                outgoings += self.mortgage_payments
                mortgage_remaining = max(0, mortgage_remaining - self.mortgage_payments)
            
            # House sale proceeds
            if year == self.house_sale_date:
                savings_balance += self.house_sale_price
            
            # Interest on savings
            savings_interest = savings_balance * self.savings_return_rate
            
            # Interest on pension
            pension_interest = pension_balance * self.pension_return_rate
            pension_balance = pension_balance + pension_interest - pension_income
            
            # Update savings
            total_outgoings = outgoings
            savings_balance = savings_balance + salary_income + savings_interest + state_pension_income - total_outgoings
            
            if savings_balance < 0 and total_income > 0:
                warnings.append(f"Year {year}: Negative savings balance (£{savings_balance:.2f})")
            
            if savings_balance < self.savings_threshold:
                warnings.append(f"Year {year}: Savings below minimum threshold")
            
            result = YearlyResult(
                year=year,
                age=age,
                income_from_pension=pension_income,
                income_from_savings_interest=savings_interest,
                total_income=total_income,
                outgoings=outgoings,
                total_outgoings=total_outgoings,
                pension_remaining=max(0, pension_balance),
                savings_remaining=savings_balance
            )
            
            results.append(result)
        
        return {
            'years': [r.to_dict() for r in results],
            'warnings': warnings
        }
