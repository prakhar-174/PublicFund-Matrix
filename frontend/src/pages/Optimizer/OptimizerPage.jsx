import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Sliders,
  Loader2,
  Download,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  SlidersHorizontal,
  X,
  Info,
} from 'lucide-react'

import { useFiscalYear } from '@/store/FiscalYearContext'
import { useRunRecommendations, useRunScenario } from '@/api/hooks/useOptimizer'
import ImpactBarChart from '@/components/charts/ImpactBarChart'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import EmptyState from '@/components/EmptyState'
import { formatCurrency, cn } from '@/lib/utils'

// Framer Motion animation variants
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    },
  },
}

const cardItemVariant = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
}

/**
 * Trigger CSV file download in browser using a Blob URL.
 */
function exportRecommendationsToCsv(allocations, fiscalYearLabel) {
  if (!allocations || allocations.length === 0) return

  const headers = [
    'Department ID',
    'Department Name',
    'Current Allocation (INR)',
    'Recommended Allocation (INR)',
    'Change Amount (INR)',
    'Change Percent (%)',
    'Need Score',
    'Confidence',
    'Manual Override',
    'Reasoning',
  ]

  const rows = allocations.map((row) => [
    row.department_id,
    `"${(row.department_name || '').replace(/"/g, '""')}"`,
    row.current_allocation,
    row.recommended_allocation,
    row.change_amount,
    row.change_percent != null ? Number(row.change_percent).toFixed(2) : '',
    row.need_score != null ? Number(row.need_score).toFixed(4) : '',
    row.confidence || '',
    row.is_override ? 'Yes' : 'No',
    `"${(row.reasoning || '').replace(/"/g, '""')}"`,
  ])

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `budget_recommendations_${fiscalYearLabel || 'FY'}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function OptimizerPage() {
  const { activeFiscalYear } = useFiscalYear()
  const fiscalYearId = activeFiscalYear?.id
  const fiscalYearLabel =
    activeFiscalYear?.label || (activeFiscalYear?.year ? `FY ${activeFiscalYear.year}` : '')

  // Total budget parameter state; tracks custom input or falls back to active fiscal year total
  const [customBudget, setCustomBudget] = useState(null)
  const defaultBudget = activeFiscalYear?.total_budget != null ? String(activeFiscalYear.total_budget) : ''
  const totalBudget = customBudget !== null ? customBudget : defaultBudget

  const setTotalBudget = (val) => setCustomBudget(val)

  // TanStack mutations
  const runRecommendMutation = useRunRecommendations({
    onSuccess: (data) => {
      setResultData(data)
    },
  })

  const runScenarioMutation = useRunScenario({
    onSuccess: (data) => {
      setResultData(data)
    },
  })

  const isPending = runRecommendMutation.isPending || runScenarioMutation.isPending
  const activeError = runRecommendMutation.error || runScenarioMutation.error

  // Handle Run Recommendations
  const handleRunRecommendations = () => {
    if (!fiscalYearId) return
    const payload = {
      fiscal_year_id: fiscalYearId,
      ...(totalBudget ? { total_budget: Number(totalBudget) } : {}),
    }
    runRecommendMutation.mutate(payload)
  }

  // Handle Run Scenario with Overrides
  const handleRunScenario = () => {
    if (!fiscalYearId) return
    // Clean up empty override entries
    const cleanedOverrides = {}
    Object.entries(overrides).forEach(([deptId, val]) => {
      if (val !== '' && val !== null && !Number.isNaN(Number(val))) {
        cleanedOverrides[deptId] = Number(val)
      }
    })

    const payload = {
      fiscal_year_id: fiscalYearId,
      overrides: cleanedOverrides,
      ...(totalBudget ? { total_budget: Number(totalBudget) } : {}),
    }
    runScenarioMutation.mutate(payload)
  }

  const handleOverrideChange = (deptId, value) => {
    setOverrides((prev) => ({
      ...prev,
      [deptId]: value,
    }))
  }

  const handleClearOverride = (deptId) => {
    setOverrides((prev) => {
      const next = { ...prev }
      delete next[deptId]
      return next
    })
  }

  const handleClearAllOverrides = () => {
    setOverrides({})
  }

  const toggleExpand = (deptId) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev)
      if (next.has(deptId)) {
        next.delete(deptId)
      } else {
        next.add(deptId)
      }
      return next
    })
  }

  const rawAllocations = resultData?.allocations

  // Recommendation cards sorted by |change_amount| descending
  const sortedAllocations = useMemo(() => {
    if (!rawAllocations) return []
    return [...rawAllocations].sort(
      (a, b) => Math.abs(Number(b.change_amount)) - Math.abs(Number(a.change_amount))
    )
  }, [rawAllocations])

  const allocations = rawAllocations || []

  // Summary counts
  const totalAnalyzed = allocations.length
  const increaseCount = allocations.filter((r) => Number(r.change_amount) > 0).length
  const decreaseCount = allocations.filter((r) => Number(r.change_amount) < 0).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="space-y-6 pb-12"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <SlidersHorizontal className="h-6 w-6 text-accent-blue" />
            <span>Budget Reallocation Optimizer</span>
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Data-driven reallocation recommendations and scenario modeling engine.
          </p>
        </div>

        {fiscalYearLabel && (
          <Badge
            variant="outline"
            className="bg-slate-900 border-slate-700 text-slate-200 px-3 py-1 text-xs self-start sm:self-auto"
          >
            Active: {fiscalYearLabel}
          </Badge>
        )}
      </div>

      {/* Error alert banner if any mutation fails */}
      {activeError && (
        <Alert className="border-red-900/50 bg-red-950/20 text-red-400 shadow-sm">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <AlertTitle className="text-xs font-semibold">Optimization Execution Failed</AlertTitle>
          <AlertDescription className="text-xs text-red-300 mt-0.5">
            {activeError?.response?.data?.detail ||
              activeError?.message ||
              'Could not solve allocations with the supplied parameters.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Responsive Layout:
          Two-column on desktop (left 60%: results, right 40%: controls, sticky).
          Single column on mobile (controls top, results below).
      */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ========================================================
            LEFT (60% on desktop): RESULTS PANEL
        ======================================================== */}
        <div className="w-full lg:w-[60%] space-y-6 min-w-0 order-2 lg:order-1">
          {isPending ? (
            /* Skeleton Loading State for Results */
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
                <Skeleton className="h-6 w-56 bg-slate-800" />
                <Skeleton className="h-8 w-28 bg-slate-800" />
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
                <Skeleton className="h-5 w-48 bg-slate-800" />
                <Skeleton className="h-4 w-72 bg-slate-800/60" />
                <Skeleton className="h-60 w-full bg-slate-800 rounded-lg mt-3" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton
                    key={i}
                    className="h-28 w-full bg-slate-900 border border-slate-800 rounded-xl"
                  />
                ))}
              </div>
            </div>
          ) : !resultData ? (
            /* Initial Empty State */
            <EmptyState
              icon={Sliders}
              title="Configure and run recommendations above"
              description="The optimization engine uses water-filling optimization weighted on performance gaps and historical underfunding to formulate balanced reallocations within stability caps."
            />
          ) : (
            /* Results Content after successful run */
            <div className="space-y-6">
              {/* Summary Chips & Export Action */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="bg-slate-800 text-slate-200 border-slate-700 text-xs font-normal px-2.5 py-1"
                  >
                    {totalAnalyzed} departments analyzed
                  </Badge>

                  <Badge
                    variant="outline"
                    className="bg-accent-emerald/10 text-accent-emerald border-accent-emerald/30 text-xs font-medium px-2.5 py-1 flex items-center gap-1"
                  >
                    <TrendingUp className="h-3 w-3" />
                    <span>{increaseCount} departments need increase</span>
                  </Badge>

                  <Badge
                    variant="outline"
                    className="bg-accent-red/10 text-accent-red border-accent-red/30 text-xs font-medium px-2.5 py-1 flex items-center gap-1"
                  >
                    <TrendingDown className="h-3 w-3" />
                    <span>{decreaseCount} departments reduced</span>
                  </Badge>
                </div>

                <Button
                  onClick={() => exportRecommendationsToCsv(allocations, fiscalYearLabel)}
                  variant="outline"
                  size="sm"
                  className="bg-slate-950 border-slate-800 hover:bg-slate-800 text-slate-200 text-xs h-8 flex items-center gap-1.5 shrink-0"
                >
                  <Download className="h-3.5 w-3.5 text-accent-blue" />
                  <span>Export as CSV</span>
                </Button>
              </div>

              {/* Impact Bar Chart */}
              <ImpactBarChart data={allocations} />

              {/* Recommendation Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200 tracking-tight">
                    Department Recommendations ({sortedAllocations.length})
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Sorted by absolute change magnitude &bull; Click card to expand reasoning
                  </span>
                </div>

                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                  className="space-y-3"
                >
                  {sortedAllocations.map((dept) => {
                    const isExpanded = expandedDepts.has(dept.department_id)
                    const changeAmount = Number(dept.change_amount) || 0
                    const isPositive = changeAmount >= 0
                    const changePct = dept.change_percent != null ? Number(dept.change_percent) : null

                    return (
                      <motion.div key={dept.department_id} variants={cardItemVariant}>
                        <Card
                          onClick={() => toggleExpand(dept.department_id)}
                          className={cn(
                            'border-slate-800 bg-slate-900/90 hover:border-slate-700 transition-all cursor-pointer rounded-xl shadow-sm',
                            isExpanded && 'border-slate-700 bg-slate-900 ring-1 ring-slate-700/50'
                          )}
                        >
                          <CardContent className="p-4">
                            {/* Card Header: Dept Name, Confidence & Change Chip */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <h4 className="font-semibold text-white text-sm truncate">
                                  {dept.department_name}
                                </h4>
                                {dept.is_override && (
                                  <Badge className="bg-accent-amber/15 text-accent-amber border-accent-amber/30 text-[10px] font-mono shrink-0">
                                    Override
                                  </Badge>
                                )}
                                {dept.bound_by_stability_cap && !dept.is_override && (
                                  <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-[10px] shrink-0">
                                    At Cap
                                  </Badge>
                                )}
                              </div>

                              {/* Change Chip */}
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'font-mono font-medium text-xs px-2.5 py-0.5',
                                    isPositive
                                      ? 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/30'
                                      : 'bg-accent-red/10 text-accent-red border-accent-red/30'
                                  )}
                                >
                                  {isPositive ? '+' : ''}
                                  {formatCurrency(changeAmount)}{' '}
                                  {changePct != null
                                    ? `(${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}%)`
                                    : ''}
                                </Badge>
                                <ChevronDown
                                  className={cn(
                                    'h-4 w-4 text-slate-400 transition-transform duration-200',
                                    isExpanded && 'rotate-180'
                                  )}
                                />
                              </div>
                            </div>

                            {/* Financial Comparison Numbers */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-800/60 text-xs">
                              <div>
                                <span className="text-[11px] text-slate-400 block">
                                  Current Allocation
                                </span>
                                <span className="font-mono text-slate-200 font-medium">
                                  {formatCurrency(dept.current_allocation)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[11px] text-slate-400 block">
                                  Recommended
                                </span>
                                <span className="font-mono text-white font-semibold">
                                  {formatCurrency(dept.recommended_allocation)}
                                </span>
                              </div>
                              <div className="hidden sm:block">
                                <span className="text-[11px] text-slate-400 block">
                                  Model Confidence
                                </span>
                                <span
                                  className={cn(
                                    'capitalize font-medium text-[11px]',
                                    dept.confidence === 'high'
                                      ? 'text-accent-emerald'
                                      : dept.confidence === 'medium'
                                      ? 'text-accent-amber'
                                      : 'text-slate-400'
                                  )}
                                >
                                  {dept.confidence || 'standard'}
                                </span>
                              </div>
                            </div>

                            {/* Expandable Reasoning Section */}
                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.25, ease: 'easeOut' }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-3 pt-3 border-t border-slate-800 text-sm text-slate-400 leading-relaxed space-y-2">
                                    <p>{dept.reasoning}</p>

                                    {/* Investigation flags if any */}
                                    {dept.flags?.length > 0 && (
                                      <div className="mt-2 space-y-1">
                                        {dept.flags.map((flag, idx) => (
                                          <div
                                            key={idx}
                                            className="text-xs text-accent-amber bg-accent-amber/10 border border-accent-amber/20 rounded-md p-2 flex items-start gap-1.5"
                                          >
                                            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                            <span>{flag}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Data gaps if any */}
                                    {dept.data_gaps?.length > 0 && (
                                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                                        <Info className="h-3 w-3 text-slate-500 shrink-0" />
                                        <span>Data notice: {dept.data_gaps.join(', ')}</span>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })}
                </motion.div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================
            RIGHT (40% on desktop): CONTROLS PANEL (STICKY)
        ======================================================== */}
        <div className="w-full lg:w-[40%] lg:sticky lg:top-6 space-y-5 order-1 lg:order-2">
          <div
            className={cn(
              'bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-5 transition-opacity',
              isPending && 'pointer-events-none opacity-60'
            )}
          >
            {/* Controls Header */}
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                <Sliders className="h-4 w-4 text-accent-blue" />
                <span>Optimization Controls</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure total budget cap and test department reallocation scenarios.
              </p>
            </div>

            {/* Total Budget Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="totalBudgetInput"
                className="text-xs font-medium text-slate-300 flex items-center justify-between"
              >
                <span>Total Budget Cap (₹)</span>
                {totalBudget && !Number.isNaN(Number(totalBudget)) && (
                  <span className="font-mono text-accent-blue text-[11px]">
                    {formatCurrency(totalBudget)}
                  </span>
                )}
              </label>
              <Input
                id="totalBudgetInput"
                type="number"
                placeholder="e.g. 10000000"
                value={totalBudget}
                onChange={(e) => setTotalBudget(e.target.value)}
                disabled={isPending}
                className="bg-slate-950 border-slate-800 text-white font-mono text-sm focus:border-accent-blue focus:ring-accent-blue"
              />
              <p className="text-[11px] text-slate-400">
                Pre-filled from the active fiscal year&apos;s registered budget.
              </p>
            </div>

            {/* Run Recommendations Button */}
            <Button
              onClick={handleRunRecommendations}
              disabled={isPending || !fiscalYearId}
              className="w-full bg-accent-blue hover:bg-accent-blue/90 text-white font-medium text-sm h-10 shadow-sm flex items-center justify-center gap-2"
            >
              {runRecommendMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Computing Recommendations...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Run Recommendations</span>
                </>
              )}
            </Button>

            {/* Scenario Overrides Section: Appears after first run */}
            {allocations.length > 0 && (
              <div className="pt-4 border-t border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200 tracking-tight flex items-center gap-1.5">
                      <span>Scenario Overrides</span>
                      {Object.keys(overrides).length > 0 && (
                        <Badge
                          variant="outline"
                          className="border-accent-amber/40 text-accent-amber bg-accent-amber/10 text-[10px] px-1.5 py-0"
                        >
                          {Object.keys(overrides).length} set
                        </Badge>
                      )}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Fix manual allocation amounts to observe optimal redistribution of the remainder.
                    </p>
                  </div>

                  {Object.keys(overrides).length > 0 && (
                    <button
                      type="button"
                      aria-label="Reset all overrides"
                      onClick={handleClearAllOverrides}
                      className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>

                {/* Overrides Department Rows */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {allocations.map((dept) => {
                    const currentVal = overrides[dept.department_id] ?? ''
                    return (
                      <div
                        key={dept.department_id}
                        className="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-200 truncate">
                            {dept.department_name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Rec: {formatCurrency(dept.recommended_allocation)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 w-36">
                          <Input
                            type="number"
                            placeholder="Override"
                            value={currentVal}
                            onChange={(e) =>
                              handleOverrideChange(dept.department_id, e.target.value)
                            }
                            disabled={isPending}
                            className="h-8 text-xs font-mono bg-slate-900 border-slate-800 text-white px-2"
                          />
                          {currentVal !== '' && (
                            <button
                              type="button"
                              onClick={() => handleClearOverride(dept.department_id)}
                              className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
                              aria-label="Clear override"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Run Scenario Button */}
                <Button
                  onClick={handleRunScenario}
                  disabled={isPending || !fiscalYearId}
                  variant="outline"
                  className="w-full border-accent-amber/40 bg-accent-amber/10 hover:bg-accent-amber/20 text-accent-amber font-medium text-xs h-9 flex items-center justify-center gap-2 mt-2"
                >
                  {runScenarioMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-amber" />
                      <span>Re-optimizing Remainder...</span>
                    </>
                  ) : (
                    <>
                      <Sliders className="h-3.5 w-3.5 text-accent-amber" />
                      <span>Run Scenario</span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
