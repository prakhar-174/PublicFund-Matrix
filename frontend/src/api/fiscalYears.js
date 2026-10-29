import apiClient from './client'

/**
 * Fetch all fiscal years.
 * @returns {Promise<Array<Object>>} List of fiscal year records
 */
export async function getFiscalYears() {
  const response = await apiClient.get('/fiscal-years/')
  if (Array.isArray(response.data)) {
    return response.data
  }
  return response.data?.results || []
}

/**
 * Fetch summary totals for a given fiscal year.
 * @param {number|string} id - Fiscal year ID
 * @returns {Promise<Object>} Summary data including total_allocated, total_spent, etc.
 */
export async function getFiscalYearSummary(id) {
  const response = await apiClient.get(`/fiscal-years/${id}/summary/`)
  return response.data
}
