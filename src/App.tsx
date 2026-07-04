import { useState } from 'react'
import { InputPanel } from './components/InputPanel'
import { ResultsPanel } from './components/ResultsPanel'
import { simulate } from './api/client'
import type { InputParameters, SimulationResult, YearlyResult } from './types'

function App() {
  const [results, setResults] = useState<YearlyResult[] | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSimulate = async (params: InputParameters) => {
    setIsLoading(true)
    setError(null)
    try {
      const result: SimulationResult = await simulate(params)
      setResults(result.years)
      setWarnings(result.warnings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run simulation')
      setResults(null)
      setWarnings([])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container">
      <InputPanel onSimulate={handleSimulate} isLoading={isLoading} />
      {error && (
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: '#f8d7da',
          border: '1px solid #f5c6cb',
          color: '#721c24',
          padding: '12px',
          borderRadius: '4px',
        }}>
          {error}
        </div>
      )}
      <ResultsPanel results={results} isLoading={isLoading} warnings={warnings} />
    </div>
  )
}

export default App
