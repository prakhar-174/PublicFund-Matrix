import apiClient from './client'

/**
 * Fetch budget allocations with optional filters and ordering.
 * @param {Object} [params] - e.g. { fiscal_year, department, status, ordering }
 * @returns {Promise<Array<Object>|Object>}
 */
export async function getAllocations(params = {}) {
  const response = await apiClient.get('/allocations/', { params })
  return response.data
}

/**
 * Fetch single allocation by ID.
 * @param {number|string} id
 */
export async function getAllocation(id) {
  const response = await apiClient.get(`/allocations/${id}/`)
  return response.data
}

/**
 * Create a new budget allocation.
 * @param {Object} data
 */
export async function createAllocation(data) {
  const response = await apiClient.post('/allocations/', data)
  return response.data
}

/**
 * Update an existing allocation.
 * @param {number|string} id
 * @param {Object} data
 */
export async function updateAllocation(id, data) {
  const response = await apiClient.put(`/allocations/${id}/`, data)
  return response.data
}

/**
 * Delete an allocation.
 * @param {number|string} id
 */
export async function deleteAllocation(id) {
  const response = await apiClient.delete(`/allocations/${id}/`)
  return response.data
}
