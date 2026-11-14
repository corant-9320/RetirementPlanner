---
inclusion: fileMatch
fileMatchPattern: 'src/{simulation,utils,annual,validation}.js'
---

# Financial Model Rules

- Fractional years are quarter-aligned: `.0` Q1, `.25` Q2, `.5` Q3, `.75` Q4.
- Rates are annual real decimal rates in the domain and use equivalent quarterly compounding.
- Salary and target spend are annual amounts divided by four; the final working quarter is prorated.
- Savings interest uses the opening balance; negative balances use the borrowing rate.
- Property sale occurs once at the first quarter on/after its date, before growth that quarter, and transfers net equity including negative equity.
- Purchase occurs once and rent runs after sale until purchase.
- UK tax years run April–March. Liability is cumulative within each tax year and quarterly tax is the change from the prior cumulative position.
- Person 1 owns private drawdown and owner state pensions; person 2 owns spouse pension; positive savings interest is split.
- Every quarter must satisfy `endingSavings = openingSavings + totalIncome - totalOutgoings` within floating tolerance.
- Annual flow fields sum quarters. Opening balances come from the first included quarter and closing balances from the last.
- The projection horizon is inclusive. Empty and single-quarter projections are valid rendering inputs.
