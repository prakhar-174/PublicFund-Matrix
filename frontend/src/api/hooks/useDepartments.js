import { useQuery } from '@tanstack/react-query'
import { getDepartments, getDepartment, getDepartmentBudgetHistory } from '../departments'

/**
 * Query hook for all departments.
 * Cache TTL: 5 minutes for reference data.
 */
export function useDepartments(options = {}) {
  return useQuery({
    queryKey: ['departments'],
    queryFn: getDepartments,
    staleTime: 5 * 60 * 1000,
    ...options,
  })
}

/**
 * Query hook for a single department by ID.
 */
export function useDepartment(id, options = {}) {
  return useQuery({
    queryKey: ['departments', id],
    queryFn: () => getDepartment(id),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
    ...options,
  })
}

/**
 * Query hook for department budget history across years.
 */
export function useDepartmentBudgetHistory(id, options = {}) {
  return useQuery({
    queryKey: ['departments', id, 'budget_history'],
    queryFn: () => getDepartmentBudgetHistory(id),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
    ...options,
  })
}

export default useDepartments
