import apiClient from './client'

/**
 * Upload and import budget file (CSV or Excel).
 * @param {FormData} formData - Contains 'file' and optional 'dry_run'
 * @returns {Promise<Object>}
 */
export async function importBudgets(formData) {
  const response = await apiClient.post('/import/budgets/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

