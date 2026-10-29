import apiClient from './client'

/**
 * Fetch department comparison and utilization rankings for a fiscal year.
 * @param {Object} params - { fiscal_year_id }
 * @returns {Promise<Object>}
 */
export async function getComparison(params) {
  const response = await apiClient.get('/analytics/comparison/', { params })
  return response.data
}

/**
 * Fetch monthly and quarterly spending trends for a fiscal year.
 * @param {Object} params - { fiscal_year_id }
 * @returns {Promise<Object>}
 */
export async function getTrend(params) {
  const response = await apiClient.get('/analytics/trend/', { params })
  return response.data
}

/**
 * Fetch multi-year allocation and spending history for a department.
 * @param {Object} params - { department_id }
 * @returns {Promise<Object>}
 */
export async function getYoy(params) {
  const response = await apiClient.get('/analytics/yoy/', { params })
  return response.data
}

/**
 * Fetch departments with funding gaps below the requested threshold.
 * @param {Object} params - { fiscal_year_id, threshold? }
 * @returns {Promise<Object>}
 */
export async function getUnderfunded(params) {
  const response = await apiClient.get('/analytics/underfunded/', { params })
  return response.data
}
