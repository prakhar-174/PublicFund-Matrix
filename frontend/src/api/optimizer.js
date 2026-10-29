import apiClient from './client'

/**
 * Run deterministic budget recommendation engine.
 * @param {Object} payload - { fiscal_year_id, total_budget, max_change_pct?, save? }
 * @returns {Promise<Object>}
 */
export async function runRecommendations(payload) {
  const response = await apiClient.post('/optimizer/recommend/', payload)
  return response.data
}

/**
 * Run scenario optimization with manual department overrides.
 * @param {Object} payload - { fiscal_year_id, overrides: {}, total_budget?, max_change_pct?, save? }
 * @returns {Promise<Object>}
 */
export async function runScenario(payload) {
  const response = await apiClient.post('/optimizer/scenario/', payload)
  return response.data
}

