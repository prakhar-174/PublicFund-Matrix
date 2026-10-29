import { createContext, useContext, useState, useMemo, useCallback } from 'react'
import { useFiscalYears } from '@/api/hooks/useFiscalYears'

export const FiscalYearContext = createContext(null)

export function FiscalYearProvider({ children }) {
  const { data: fiscalYears = [], isLoading, isError, error } = useFiscalYears()
  const [selectedYearId, setSelectedYearId] = useState(null)

  // Derive the active fiscal year directly during render without cascading setState effects
  const activeFiscalYear = useMemo(() => {
    if (!fiscalYears || fiscalYears.length === 0) return null
    if (selectedYearId) {
      const match = fiscalYears.find((fy) => String(fy.id) === String(selectedYearId))
      if (match) return match
    }
    const active = fiscalYears.find((fy) => fy.is_active)
    return active || fiscalYears[0]
  }, [fiscalYears, selectedYearId])

  // Support setting either an ID or a fiscal year object
  const setActiveFiscalYear = useCallback((input) => {
    if (!input) {
      setSelectedYearId(null)
      return
    }
    const id = typeof input === 'object' && input.id !== undefined ? input.id : input
    setSelectedYearId(id)
  }, [])

  const value = useMemo(
    () => ({
      fiscalYears,
      activeFiscalYear,
      setActiveFiscalYear,
      isLoading,
      isError,
      error,
    }),
    [fiscalYears, activeFiscalYear, setActiveFiscalYear, isLoading, isError, error]
  )

  return <FiscalYearContext.Provider value={value}>{children}</FiscalYearContext.Provider>
}

export function useFiscalYear() {
  const context = useContext(FiscalYearContext)
  if (!context) {
    throw new Error('useFiscalYear must be used within a FiscalYearProvider')
  }
  return context
}

export default FiscalYearContext
