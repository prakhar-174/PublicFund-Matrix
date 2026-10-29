import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { loginUser, logoutUser, getProfile } from '@/api/auth'

const TOKEN_KEY = import.meta.env.VITE_TOKEN_KEY || 'budget_access'
const REFRESH_KEY = import.meta.env.VITE_REFRESH_KEY || 'budget_refresh'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [isLoading, setIsLoading] = useState(true)

  // Validate stored token on mount
  useEffect(() => {
    let isMounted = true

    const validateToken = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY)
      if (!storedToken) {
        if (isMounted) {
          setIsLoading(false)
        }
        return
      }

      try {
        const profile = await getProfile()
        if (isMounted) {
          setUser(profile)
          setAccessToken(storedToken)
        }
      } catch {
        // If token validation fails and refresh fails, reset state
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(REFRESH_KEY)
        if (isMounted) {
          setUser(null)
          setAccessToken(null)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    validateToken()

    return () => {
      isMounted = false
    }
  }, [])

  const login = useCallback(async (credentials) => {
    setIsLoading(true)
    try {
      const data = await loginUser(credentials)
      const token = data.access
      const refresh = data.refresh

      if (token) {
        localStorage.setItem(TOKEN_KEY, token)
        setAccessToken(token)
      }
      if (refresh) {
        localStorage.setItem(REFRESH_KEY, refresh)
      }

      let profile = data.user
      if (!profile) {
        profile = await getProfile()
      }
      setUser(profile)
      return { success: true, user: profile, data }
    } catch (err) {
      setUser(null)
      setAccessToken(null)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutUser()
    } catch {
      // Continue client cleanup even if backend logout fails
    } finally {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(REFRESH_KEY)
      setUser(null)
      setAccessToken(null)
      setIsLoading(false)
    }
  }, [])

  const isAuthenticated = Boolean(user && accessToken)

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isAuthenticated,
      isLoading,
      login,
      logout,
    }),
    [user, accessToken, isAuthenticated, isLoading, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
