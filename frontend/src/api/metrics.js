import apiClient from './client'

/**
 * Fetch performance metrics for department / fiscal year.
 * @param {Object} [params] - e.g. { fiscal_year, department }
 */
export async function getMetrics(params = {}) {
  const response = await apiClient.get('/metrics/', { params })
  if (Array.isArray(response.data)) {
    return response.data
  }
  return response.data?.results || []
}
