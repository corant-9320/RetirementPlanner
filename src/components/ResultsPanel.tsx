import React, { useState } from 'react'
import type { YearlyResult } from '../types'

interface ResultsPanelProps {
  results: YearlyResult[] | null
  isLoading: boolean
  warnings: string[]
}

export function ResultsPanel({ results, isLoading, warnings }: ResultsPanelProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  const toggleRow = (year: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(year)) {
      newExpanded.delete(year)
    } else {
      newExpanded.add(year)
    }
    setExpandedRows(newExpanded)
  }

  if (isLoading) {
    return (
      <div className="right-panel">
        <div className="loading">Loading simulation results...</div>
      </div>
    )
  }

  if (!results || results.length === 0) {
    return (
      <div className="right-panel">
        <div style={{ color: '#999', textAlign: 'center', paddingTop: '40px' }}>
          Run a simulation to see results
        </div>
      </div>
    )
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <div className="right-panel">
      {warnings.length > 0 && (
        <div style={{ 
          background: '#fff3cd', 
          border: '1px solid #ffc107',
          borderRadius: '4px',
          padding: '12px',
          marginBottom: '20px'
        }}>
          <strong>Warnings:</strong>
          <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
            {warnings.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <table className="results-table">
        <thead>
          <tr>
            <th>Year</th>
            <th className="text-right">Age</th>
            <th className="text-right">Income from Pension</th>
            <th className="text-right">Interest on Savings</th>
            <th className="text-right">Total Outgoings</th>
            <th className="text-right">Pension Remaining</th>
            <th className="text-right">Savings Remaining</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr key={result.year} onClick={() => toggleRow(result.year)} style={{ cursor: 'pointer' }}>
              <td>{result.year}</td>
              <td className="text-right">{result.age}</td>
              <td className="text-right">{formatCurrency(result.incomeFromPension)}</td>
              <td className="text-right">{formatCurrency(result.incomeFromSavingsInterest)}</td>
              <td className="text-right">{formatCurrency(result.totalOutgoings)}</td>
              <td className="text-right">
                <span className="currency-gbp">{formatCurrency(result.pensionRemaining)}</span>
              </td>
              <td className="text-right">
                <span className={result.savingsRemaining < 0 ? 'error-message' : 'currency-gbp'}>
                  {formatCurrency(result.savingsRemaining)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
