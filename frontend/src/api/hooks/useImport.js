import { useMutation, useQueryClient } from '@tanstack/react-query'
import { importBudgets } from '../importer'

/**
 * Mutation hook for importing budget data from CSV or Excel file.
 * @param {Object} [options]
 */
export function useImportBudgets(options = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (formData) => importBudgets(formData),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      queryClient.invalidateQueries({ queryKey: ['fiscal-years'] })
      options.onSuccess?.(data, variables, context)
    },
    ...options,
  })
}

