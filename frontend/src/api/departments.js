import apiClient from './client'

/**
 * Fetch all departments.
 * @returns {Promise<Array<Object>>}
 */
export async function getDepartments() {
  const response = await apiClient.get('/departments/')
  if (Array.isArray(response.data)) {
    return response.data
  }
  return response.data?.results || []
}

/**
 * Fetch single department by ID.
 * @param {number|string} id
 */
export async function getDepartment(id) {
  const response = await apiClient.get(`/departments/${id}/`)
  return response.data
}

/**
 * Fetch budget history for a department across all fiscal years.
 * @param {number|string} id
 */
export async function getDepartmentBudgetHistory(id) {
  const response = await apiClient.get(`/departments/${id}/budget_history/`)
  return response.data
}
