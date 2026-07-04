# Retirement Planner - Project Structure

## Overview
A full-stack retirement planning application that models financial scenarios through 2050. The frontend is a React/TypeScript UI, and the backend is a Python Flask API.

## Directory Structure

```
RetirementPlanner/
├── src/                          # Frontend source code
│   ├── App.tsx                   # Main application component
│   ├── main.tsx                  # React entry point
│   ├── index.css                 # Global styles
│   ├── api/
│   │   └── client.ts             # API client for backend communication
│   ├── components/
│   │   ├── InputPanel.tsx        # Left panel - input form
│   │   └── ResultsPanel.tsx      # Right panel - results table
│   └── types/
│       └── index.ts              # TypeScript type definitions
├── backend/                      # Backend source code
│   ├── app.py                    # Flask application & API endpoints
│   └── simulator.py              # Retirement simulation logic
├── index.html                    # HTML template
├── package.json                  # Frontend dependencies
├── requirements.txt              # Python dependencies
├── tsconfig.json                 # TypeScript configuration
├── vite.config.ts                # Vite bundler configuration
├── README.md                     # Full documentation
├── QUICKSTART.md                 # Quick start guide
└── .gitignore                    # Git ignore rules

```

## Key Features Implemented

### Input Parameters (Left Panel)
- Exchange rate (EUR to GBP)
- Current net salary and work duration
- Savings: current amount, return rate, threshold
- Private pensions: amount, return rate, drawdown rate
- State pensions: both user and spouse amounts/dates, annual increases
- Mortgage: remaining amount and annual payments
- House sale: expected date and price

### Simulation Engine (Backend)
- Year-by-year financial projection to 2050
- Support for multiple income sources (salary, pensions, savings interest)
- Multi-currency handling (EUR converted to GBP)
- Mortgage and house sale modeling
- State pension inflation adjustments
- Pension drawdown calculations
- Savings balance tracking

### Output (Right Panel)
- Interactive yearly table with columns:
  - Year and age
  - Income from pension
  - Interest on savings
  - Total outgoings
  - Remaining pension balance
  - Remaining savings balance
- Warnings for financial risks:
  - Negative savings balance
  - Savings below minimum threshold

### User Interface
- Two-panel layout: inputs on left, results on right
- Responsive form with organized sections
- Expandable rows (infrastructure ready)
- Currency formatting for all monetary values
- Color-coded currency indicators (EUR/GBP)
- Error handling and loading states
- Real-time simulation execution

## Technology Stack

### Frontend
- **React 18.2**: UI framework
- **TypeScript 5.3**: Type-safe JavaScript
- **Vite 5.0**: Fast development server and build tool
- **Axios**: HTTP client for API calls

### Backend
- **Python 3.10**: Runtime
- **Flask 3.0**: Web framework
- **Flask-CORS 4.0**: Cross-origin support
- **NumPy/Pandas**: Data processing (configured, ready for enhancement)

## API Endpoints

### POST /api/simulate
Runs the retirement simulation with provided parameters.

**Request:**
```json
{
  "eurToGbpRate": 0.85,
  "currentNetSalary": 50000,
  "monthsToWork": 120,
  ...
}
```

**Response:**
```json
{
  "years": [
    {
      "year": 2026,
      "age": 25,
      "incomeFromPension": 10000,
      "incomeFromSavingsInterest": 3000,
      ...
    }
  ],
  "warnings": ["Year 2045: Savings below minimum threshold"]
}
```

### GET /api/health
Health check endpoint returns `{"status": "ok"}`

## Component Architecture

### InputPanel.tsx
- Renders form with grouped sections
- Manages state for all input parameters
- Converts percentages to decimals
- Validates input on submission
- Handles form submission to trigger simulation

### ResultsPanel.tsx
- Displays simulation results in a table
- Shows financial warnings
- Formats currency values
- Expandable row infrastructure for future quarterly breakdown
- Handles loading and empty states

### Simulator.py
- `RetirementSimulator` class encapsulates all calculation logic
- Tracks balances year-by-year
- Calculates income from all sources
- Models outgoings (mortgage, etc.)
- Generates warnings for financial risks
- Returns structured results

## Configuration

### Environment Variables
None required for basic operation. Optional Flask settings in `.env`:
- `FLASK_ENV`: Set to 'development'
- `FLASK_DEBUG`: Set to '1' for debug mode

### Proxy Configuration
Vite is configured to proxy `/api/*` requests to Flask backend at `http://localhost:5000`

## Future Enhancement Opportunities

1. **Quarterly Breakdown**: Expand rows to show quarterly details
2. **Scenario Comparison**: Side-by-side comparison of multiple scenarios
3. **Chart Visualization**: Graphs for savings/pension trends
4. **One-off Events**: UI for adding irregular expenses/income
5. **Monte Carlo Analysis**: Multiple simulations for probability ranges
6. **Export Functionality**: PDF/CSV export of results
7. **Persistence**: Save/load scenario configurations
8. **Advanced Assumptions**: More detailed expense modeling

## Getting Started

See `QUICKSTART.md` for detailed setup and run instructions.
