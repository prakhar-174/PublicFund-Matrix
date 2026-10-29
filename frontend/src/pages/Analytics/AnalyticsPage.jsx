import { useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Layers, Activity } from 'lucide-react'

import { useFiscalYear } from '@/store/FiscalYearContext'
import { useComparison, useTrend } from '@/api/hooks/useAnalytics'
import PerformanceScatterPlot from '@/components/charts/PerformanceScatterPlot'
import SpendingAreaChart from '@/components/charts/SpendingAreaChart'
import UnderfundedPanel from '@/components/UnderfundedPanel'
import { Badge } from '@/components/ui/badge'

export default function AnalyticsPage() {
  const { activeFiscalYear, isLoading: isFyLoading } = useFiscalYear()
  const fiscalYearId = activeFiscalYear?.id
  const fiscalYearLabel =
    activeFiscalYear?.label || (activeFiscalYear?.year ? `FY ${activeFiscalYear.year}` : '')

  // 1. Department comparison (Scatter plot)
  const { data: comparisonData, isLoading: isComparisonLoading } = useComparison(fiscalYearId)

  // 2. Spending trend with period switcher
  const [trendPeriod, setTrendPeriod] = useState('monthly')
  const {
    data: trendData,
    isLoading: isTrendLoading,
    refetch: refetchTrend,
  } = useTrend(fiscalYearId)

  const handlePeriodChange = (newPeriod) => {
    setTrendPeriod(newPeriod)
    refetchTrend()
  }

  const activeTrendData =
    trendPeriod === 'quarterly'
      ? trendData?.quarterly || []
      : trendData?.monthly || []

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="space-y-6 pb-8"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Activity className="h-6 w-6 text-accent-blue" />
            <span>Performance & Spend Analytics</span>
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Departmental efficiency matrices, expenditure trajectory, and funding gap identification.
          </p>
        </div>

        {fiscalYearLabel && (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-slate-900 border-slate-700 text-slate-200 px-3 py-1 text-xs flex items-center gap-1.5"
            >
              <Calendar className="h-3.5 w-3.5 text-accent-blue" />
              <span>{fiscalYearLabel}</span>
            </Badge>
          </div>
        )}
      </div>

      {/* Top Charts Section: Scatter Plot & Spending Trend */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Section 1: Performance vs. Spend Scatter Plot */}
        <div>
          <PerformanceScatterPlot
            data={comparisonData?.departments || []}
            fiscalYearLabel={fiscalYearLabel}
            isLoading={isComparisonLoading || isFyLoading}
          />
        </div>

        {/* Section 2: Spending Trend Chart (Height 280 with Period Selector) */}
        <div>
          <SpendingAreaChart
            data={activeTrendData}
            fiscalYearLabel={fiscalYearLabel}
            isLoading={isTrendLoading || isFyLoading}
            height={280}
            period={trendPeriod}
            onPeriodChange={handlePeriodChange}
            showPeriodSelector={true}
          />
        </div>
      </div>

      {/* Section 3: Underfunded Departments Alert Panel */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
              <Layers className="h-4 w-4 text-accent-amber" />
              <span>Funding Adequacy & Allocation Deficits</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Review departments where authorized allocations fall short of requested thresholds.
            </p>
          </div>
        </div>

        <UnderfundedPanel fiscalYearId={fiscalYearId} />
      </div>
    </motion.div>
  )
}
