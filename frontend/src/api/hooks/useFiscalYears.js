import { useQuery } from '@tanstack/react-query'
import { getFiscalYears, getFiscalYearSummary } from '../fiscalYears'

/**
 * Query hook for retrieving all fiscal years.
 * Cache key: ['fiscal-years']
 * Stale time: 5 minutes (300,000 ms)
 *
 * @param {Object} [options] - Additional useQuery options
 */
export function useFiscalYears(options = {}) {
  return useQuery({
    queryKey: ['fiscal-years'],
    queryFn: getFiscalYears,
    staleTime: 5 * 60 * 1000,
    ...options,
  })
}

/**
 * Query hook for retrieving summary details for a single fiscal year.
 * Cache key: ['fiscal-years', 'summary', id]
 * Stale time: 5 minutes (300,000 ms)
 *
 * @param {number|string} id - Fiscal year ID
 * @param {Object} [options] - Additional useQuery options
 */
export function useFiscalYearSummary(id, options = {}) {
  return useQuery({
    queryKey: ['fiscal-years', 'summary', id],
    queryFn: () => getFiscalYearSummary(id),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
    ...options,
  })
}

export default useFiscalYears
