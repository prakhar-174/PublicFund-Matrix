import { useQuery } from '@tanstack/react-query'
import { getComparison, getTrend, getYoy, getUnderfunded } from '../analytics'

/**
 * Query hook for department comparison metrics for a fiscal year.
 * Cache TTL: 30 seconds for live analytics.
 */
export function useComparison(fiscalYearId, options = {}) {
  return useQuery({
    queryKey: ['analytics', 'comparison', fiscalYearId],
    queryFn: () => getComparison({ fiscal_year_id: fiscalYearId }),
    enabled: Boolean(fiscalYearId),
    staleTime: 30 * 1000,
    ...options,
  })
}

/**
 * Query hook for spending trend progression for a fiscal year.
 * Cache TTL: 30 seconds for live analytics.
 */
export function useTrend(fiscalYearId, options = {}) {
  return useQuery({
    queryKey: ['analytics', 'trend', fiscalYearId],
    queryFn: () => getTrend({ fiscal_year_id: fiscalYearId }),
    enabled: Boolean(fiscalYearId),
    staleTime: 30 * 1000,
    ...options,
  })
}

/**
 * Query hook for Year-over-Year history for a department.
 */
export function useYoy(departmentId, options = {}) {
  return useQuery({
    queryKey: ['analytics', 'yoy', departmentId],
    queryFn: () => getYoy({ department_id: departmentId }),
    enabled: Boolean(departmentId),
    staleTime: 30 * 1000,
    ...options,
  })
}

/**
 * Query hook for underfunded departments.
 */
export function useUnderfunded(fiscalYearId, threshold = 0.8, options = {}) {
  return useQuery({
    queryKey: ['analytics', 'underfunded', fiscalYearId, threshold],
    queryFn: () => getUnderfunded({ fiscal_year_id: fiscalYearId, threshold }),
    enabled: Boolean(fiscalYearId),
    staleTime: 30 * 1000,
    ...options,
  })
}
