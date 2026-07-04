# Quick Start Guide

## 1. Install Frontend Dependencies

```powershell
npm install
```

## 2. Set Up Backend

```powershell
# Create virtual environment
python -m venv venv

# Activate virtual environment
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## 3. Start Backend

In a PowerShell terminal:

```powershell
cd backend
python app.py
```

The backend will run on `http://localhost:5000`

## 4. Start Frontend

In a separate PowerShell terminal:

```powershell
npm run dev
```

The frontend will run on `http://localhost:5173`

## 5. Open in Browser

Navigate to `http://localhost:5173` in your browser.

## Using the Application

1. **Input Panel (Left)**: Enter your financial parameters
   - Exchange rates, current salary, savings, pensions, etc.
   - Adjust the default values as needed for your scenario

2. **Click "Run Simulation"**: Starts the retirement projection

3. **Results Panel (Right)**: See year-by-year breakdown
   - Income from pensions and savings interest
   - Annual outgoings (mortgage, etc.)
   - Remaining pension and savings balances
   - Warnings for potential issues (negative balance, low savings)

## Example Scenario

The default values represent:
- Current age: 25 (adjustable via calculations)
- Monthly net salary: €50,000 → £42,500
- 10 years of work remaining
- Savings: £100,000 growing at 3% annual return
- Private pension: £200,000 growing at 4% return
- State pension: £12,000/year starting 2038
- House sale expected 2040 for £500,000

## Interpreting Results

- **Income from Pension**: Amount drawn from private pensions
- **Interest on Savings**: Investment returns on savings balance
- **Total Outgoings**: Mortgage payments and other expenses
- **Balances**: Remaining funds in pensions and savings accounts
- **Warnings**: Alert for savings below threshold or negative balances

## Notes

- All values shown are in today's terms (inflation-adjusted)
- Interest rates are already net of inflation
- EUR amounts automatically convert to GBP using the exchange rate
- Simulation projects through 2050
