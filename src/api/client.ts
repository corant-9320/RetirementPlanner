import axios from 'axios'
import type { InputParameters, SimulationResult } from '../types'

const API_BASE = '/api'

export const apiClient = axios.create({
  baseURL: API_BASE,
})

export async function simulate(params: InputParameters): Promise<SimulationResult> {
  const response = await apiClient.post<SimulationResult>('/simulate', params)
  return response.data
}
