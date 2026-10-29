import { useQuery } from '@tanstack/react-query'
import { getMetrics } from '../metrics'

/**
 * Query hook for performance metrics.
 */
export function useMetrics(params = {}, options = {}) {
  return useQuery({
    queryKey: ['metrics', params],
    queryFn: () => getMetrics(params),
    staleTime: 30 * 1000,
    ...options,
  })
}

export default useMetrics
