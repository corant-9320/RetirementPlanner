import React, { useState } from 'react'
import type { InputParameters, OneOffEvent } from '../types'

interface InputPanelProps {
  onSimulate: (params: InputParameters) => void
  isLoading: boolean
}

const defaultParams: InputParameters = {
  eurToGbpRate: 0.85,
  currentNetSalary: 50000,
  monthsToWork: 120,
  currentSavings: 100000,
  savingsReturnRate: 0.03,
  currentPrivatePensions: 200000,
  pensionReturnRate: 0.04,
  pensionDrawdownRate: 0.05,
  statePensionAmountUser: 12000,
  statePensionStartDateUser: 2038,
  statePensionAmountSpouse: 12000,
  statePensionStartDateSpouse: 2038,
  statePensionIncreasePerYear: 0.02,
  mortgageRemaining: 150000,
  mortgagePayments: 12000,
  houseSaleDate: 2040,
  houseSalePrice: 500000,
  oneOffEvents: [],
  savingsThreshold: 20000,
}

export function InputPanel({ onSimulate, isLoading }: InputPanelProps) {
  const [params, setParams] = useState<InputParameters>(defaultParams)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleChange = (field: keyof Omit<InputParameters, 'oneOffEvents'>, value: number | string) => {
    setParams(prev => ({
      ...prev,
      [field]: typeof value === 'string' ? parseFloat(value) : value,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSimulate(params)
  }

  return (
    <div className="left-panel">
      <h1 style={{ fontSize: '18px', marginBottom: '20px', color: '#000' }}>Retirement Planner</h1>
      <form onSubmit={handleSubmit}>
        {/* Exchange Rates */}
        <div className="form-section">
          <h3>Exchange Rates</h3>
          <div className="form-group">
            <label>EUR to GBP Rate</label>
            <input
              type="number"
              step="0.001"
              value={params.eurToGbpRate}
              onChange={(e) => handleChange('eurToGbpRate', e.target.value)}
            />
          </div>
        </div>

        {/* Income */}
        <div className="form-section">
          <h3>Income</h3>
          <div className="form-group">
            <label>Current Net Salary (EUR)</label>
            <input
              type="number"
              step="1000"
              value={params.currentNetSalary}
              onChange={(e) => handleChange('currentNetSalary', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Months to Continue Working</label>
            <input
              type="number"
              step="1"
              value={params.monthsToWork}
              onChange={(e) => handleChange('monthsToWork', e.target.value)}
            />
          </div>
        </div>

        {/* Savings */}
        <div className="form-section">
          <h3>Savings</h3>
          <div className="form-group">
            <label>Current Savings (GBP)</label>
            <input
              type="number"
              step="5000"
              value={params.currentSavings}
              onChange={(e) => handleChange('currentSavings', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Expected Return Rate (%)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="20"
              value={params.savingsReturnRate * 100}
              onChange={(e) => handleChange('savingsReturnRate', parseFloat(e.target.value) / 100)}
            />
          </div>
          <div className="form-group">
            <label>Minimum Savings Threshold (GBP)</label>
            <input
              type="number"
              step="5000"
              value={params.savingsThreshold}
              onChange={(e) => handleChange('savingsThreshold', e.target.value)}
            />
          </div>
        </div>

        {/* Private Pensions */}
        <div className="form-section">
          <h3>Private Pensions</h3>
          <div className="form-group">
            <label>Current Amount (GBP)</label>
            <input
              type="number"
              step="5000"
              value={params.currentPrivatePensions}
              onChange={(e) => handleChange('currentPrivatePensions', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Expected Return Rate (%)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="20"
              value={params.pensionReturnRate * 100}
              onChange={(e) => handleChange('pensionReturnRate', parseFloat(e.target.value) / 100)}
            />
          </div>
          <div className="form-group">
            <label>Drawdown Rate (%)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="20"
              value={params.pensionDrawdownRate * 100}
              onChange={(e) => handleChange('pensionDrawdownRate', parseFloat(e.target.value) / 100)}
            />
          </div>
        </div>

        {/* State Pensions */}
        <div className="form-section">
          <h3>State Pension</h3>
          <div className="form-group">
            <label>User Amount (GBP/year)</label>
            <input
              type="number"
              step="1000"
              value={params.statePensionAmountUser}
              onChange={(e) => handleChange('statePensionAmountUser', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>User Start Year</label>
            <input
              type="number"
              step="1"
              value={params.statePensionStartDateUser}
              onChange={(e) => handleChange('statePensionStartDateUser', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Spouse Amount (GBP/year)</label>
            <input
              type="number"
              step="1000"
              value={params.statePensionAmountSpouse}
              onChange={(e) => handleChange('statePensionAmountSpouse', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Spouse Start Year</label>
            <input
              type="number"
              step="1"
              value={params.statePensionStartDateSpouse}
              onChange={(e) => handleChange('statePensionStartDateSpouse', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Annual Increase (%)</label>
            <input
              type="number"
              step="0.1"
              value={params.statePensionIncreasePerYear * 100}
              onChange={(e) => handleChange('statePensionIncreasePerYear', parseFloat(e.target.value) / 100)}
            />
          </div>
        </div>

        {/* Mortgage */}
        <div className="form-section">
          <h3>Mortgage</h3>
          <div className="form-group">
            <label>Remaining Amount (GBP)</label>
            <input
              type="number"
              step="5000"
              value={params.mortgageRemaining}
              onChange={(e) => handleChange('mortgageRemaining', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Annual Payments (GBP)</label>
            <input
              type="number"
              step="1000"
              value={params.mortgagePayments}
              onChange={(e) => handleChange('mortgagePayments', e.target.value)}
            />
          </div>
        </div>

        {/* House Sale */}
        <div className="form-section">
          <h3>House Sale</h3>
          <div className="form-group">
            <label>Expected Sale Year</label>
            <input
              type="number"
              step="1"
              value={params.houseSaleDate}
              onChange={(e) => handleChange('houseSaleDate', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Expected Sale Price (GBP)</label>
            <input
              type="number"
              step="10000"
              value={params.houseSalePrice}
              onChange={(e) => handleChange('houseSalePrice', e.target.value)}
            />
          </div>
        </div>

        <button type="submit" disabled={isLoading} style={{ width: '100%', marginTop: '20px' }}>
          {isLoading ? 'Simulating...' : 'Run Simulation'}
        </button>
      </form>
    </div>
  )
}
