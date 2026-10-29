import { useMutation } from '@tanstack/react-query'
import { runRecommendations, runScenario } from '../optimizer'

/**
 * Mutation hook for running the recommendation engine.
 * @param {Object} [options]
 */
export function useRunRecommendations(options = {}) {
  return useMutation({
    mutationFn: (payload) => runRecommendations(payload),
    ...options,
  })
}

/**
 * Mutation hook for running scenario optimization with overrides.
 * @param {Object} [options]
 */
export function useRunScenario(options = {}) {
  return useMutation({
    mutationFn: (payload) => runScenario(payload),
    ...options,
  })
}

