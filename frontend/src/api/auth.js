import apiClient from './client'

/**
 * Authenticate user credentials and retrieve JWT tokens + profile.
 * @param {Object} data - Credentials containing email/username and password
 * @returns {Promise<Object>} Authentication response with access, refresh, and user
 */
export async function loginUser(data) {
  const payload = {
    username: data.username || data.email,
    password: data.password,
  }
  if (data.email) {
    payload.email = data.email
  }
  const response = await apiClient.post('/auth/login/', payload)
  return response.data
}

/**
 * Blacklist current refresh token on the server and log out.
 * @returns {Promise<Object>} Logout confirmation
 */
export async function logoutUser() {
  const refreshKey = import.meta.env.VITE_REFRESH_KEY || 'budget_refresh'
  const refresh = localStorage.getItem(refreshKey) || ''
  const response = await apiClient.post('/auth/logout/', { refresh })
  return response.data
}

/**
 * Fetch profile data for the authenticated user.
 * @returns {Promise<Object>} User profile object
 */
export async function getProfile() {
  const response = await apiClient.get('/auth/profile/')
  return response.data
}

/**
 * Obtain a new access token using a refresh token.
 * @param {string} token - Refresh token
 * @returns {Promise<Object>} Response containing new access token
 */
export async function refreshToken(token) {
  const response = await apiClient.post('/auth/token/refresh/', { refresh: token })
  return response.data
}
