import { useMutation, useQueryClient } from '@tanstack/react-query'
import { loginUser, logoutUser } from '../auth'

/**
 * TanStack useMutation wrapper for user login.
 * @param {Object} [options] - React Query mutation options
 */
export function useLoginMutation(options = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (credentials) => loginUser(credentials),
    onSuccess: (data, variables, context) => {
      if (data?.user) {
        queryClient.setQueryData(['auth', 'profile'], data.user)
      }
      options.onSuccess?.(data, variables, context)
    },
    ...options,
  })
}

/**
 * TanStack useMutation wrapper for user logout.
 * @param {Object} [options] - React Query mutation options
 */
export function useLogoutMutation(options = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => logoutUser(),
    onSuccess: (data, variables, context) => {
      queryClient.clear()
      options.onSuccess?.(data, variables, context)
    },
    ...options,
  })
}

export { useLoginMutation as useLogin, useLogoutMutation as useLogout }

/**
 * Convenience hook grouping auth mutations.
 */
export function useAuthMutations(options = {}) {
  const loginMutation = useLoginMutation(options.login)
  const logoutMutation = useLogoutMutation(options.logout)

  return {
    loginMutation,
    logoutMutation,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isPending: loginMutation.isPending || logoutMutation.isPending,
  }
}

export default useAuthMutations
