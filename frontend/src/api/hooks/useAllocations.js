import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAllocations,
  getAllocation,
  createAllocation,
  updateAllocation,
  deleteAllocation,
} from '../allocations'

/**
 * Query hook for fetching budget allocations.
 * Namespaced query key: ['allocations', params]
 */
export function useAllocations(params = {}, options = {}) {
  return useQuery({
    queryKey: ['allocations', params],
    queryFn: () => getAllocations(params),
    staleTime: 30 * 1000,
    ...options,
  })
}

/**
 * Query hook for a single budget allocation by ID.
 */
export function useAllocation(id, options = {}) {
  return useQuery({
    queryKey: ['allocations', id],
    queryFn: () => getAllocation(id),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
    ...options,
  })
}

/**
 * Mutation hook for creating an allocation. Invalidates ['allocations'] on success.
 */
export function useCreateAllocation(options = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createAllocation,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] })
      queryClient.invalidateQueries({ queryKey: ['fiscal-years'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      options.onSuccess?.(data, variables, context)
    },
    ...options,
  })
}

/**
 * Mutation hook for updating an allocation. Invalidates ['allocations'] on success.
 */
export function useUpdateAllocation(options = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => updateAllocation(id, data),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] })
      queryClient.invalidateQueries({ queryKey: ['fiscal-years'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      options.onSuccess?.(data, variables, context)
    },
    ...options,
  })
}

/**
 * Mutation hook for deleting an allocation. Invalidates ['allocations'] on success.
 */
export function useDeleteAllocation(options = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => deleteAllocation(id),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] })
      queryClient.invalidateQueries({ queryKey: ['fiscal-years'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      options.onSuccess?.(data, variables, context)
    },
    ...options,
  })
}

export default useAllocations
