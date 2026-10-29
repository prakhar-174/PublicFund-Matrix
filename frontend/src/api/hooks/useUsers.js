import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, registerUser, updateUser, deactivateUser } from '../users'

/**
 * Query hook for fetching user list.
 * @param {Object} [params]
 * @param {Object} [options]
 */
export function useUsers(params = {}, options = {}) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => getUsers(params),
    staleTime: 30 * 1000,
    ...options,
  })
}

/**
 * Mutation hook for inviting/registering a user. Invalidates ['users'].
 * @param {Object} [options]
 */
export function useInviteUser(options = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => registerUser(data),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      options.onSuccess?.(data, variables, context)
    },
    ...options,
  })
}

/**
 * Mutation hook for updating user details (e.g. role, active status). Invalidates ['users'].
 * @param {Object} [options]
 */
export function useUpdateUser(options = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => updateUser(id, data),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      options.onSuccess?.(data, variables, context)
    },
    ...options,
  })
}

/**
 * Mutation hook for deactivating a user. Invalidates ['users'].
 * @param {Object} [options]
 */
export function useDeactivateUser(options = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => deactivateUser(id),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      options.onSuccess?.(data, variables, context)
    },
    ...options,
  })
}

