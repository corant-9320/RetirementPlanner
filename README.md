# Retirement Planner

A comprehensive retirement financial planning simulator that models various scenarios through to 2050.

## Features

- Input parameters for current financial situation
- Monte Carlo style projections for future financial outcomes
- Support for multiple currencies (EUR/GBP)
- Private pensions and state pension tracking
- Mortgage and house sale modeling
- Year-by-year financial breakdown

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Python Flask + CORS

## Setup

### Prerequisites

- Node.js 16+
- Python 3.10+

### Frontend Setup

```bash
npm install
npm run dev
```

This will start the development server on `http://localhost:5173`

### Backend Setup

```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r ../requirements.txt
python app.py
```

The backend API will be available on `http://localhost:5000`

## Input Parameters

### Exchange Rates
- EUR to GBP exchange rate

### Income
- Current net salary
- Months to continue working

### Savings
- Current savings amount
- Expected return rate (net of inflation)
- Minimum savings threshold

### Private Pensions
- Current amount
- Expected return rate (net of inflation)
- Drawdown rate

### State Pension
- Amount and start date for user and spouse
- Annual increase rate

### Mortgage
- Remaining amount
- Annual payments

### House Sale
- Expected sale year and price

## Output

Year-by-year breakdown showing:
- Income from pensions and savings interest
- Total outgoings
- Remaining pension and savings balances

## Usage

1. Enter your financial parameters in the left panel
2. Click "Run Simulation"
3. View the results in the right panel
4. Results are shown in today's terms (inflation-adjusted)

## Notes

- All interest rates should be entered net of inflation
- All monetary values are in today's terms
- The simulation runs through 2050
- EUR amounts are converted to GBP for calculations
