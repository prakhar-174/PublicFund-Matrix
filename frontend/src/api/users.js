import apiClient from './client'

/**
 * Fetch users list (admin only).
 * @param {Object} [params] - optional query filters
 * @returns {Promise<Array<Object>|Object>}
 */
export async function getUsers(params = {}) {
  const response = await apiClient.get('/auth/users/', { params })
  return response.data
}

/**
 * Register/invite a new user.
 * @param {Object} data - { email, role, department?, username?, password?, password_confirm? }
 * @returns {Promise<Object>}
 */
export async function registerUser(data) {
  const response = await apiClient.post('/auth/register/', data)
  return response.data
}

/**
 * Update user attributes such as role, department, or active status (admin only).
 * @param {number|string} id - User ID
 * @param {Object} data - fields to update, e.g. { role, is_active, department }
 * @returns {Promise<Object>}
 */
export async function updateUser(id, data) {
  const response = await apiClient.patch(`/auth/users/${id}/`, data)
  return response.data
}

/**
 * Deactivate a user.
 * @param {number|string} id - User ID
 * @returns {Promise<Object>}
 */
export async function deactivateUser(id) {
  return updateUser(id, { is_active: false })
}

