import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Wallet,
  Layers,
  CreditCard,
  Activity,
  ChevronRight,
  ArrowUpRight,
} from 'lucide-react'

import { useFiscalYear } from '@/store/FiscalYearContext'
import { useFiscalYearSummary } from '@/api/hooks/useFiscalYears'
import { useComparison, useTrend } from '@/api/hooks/useAnalytics'
import { useAllocations } from '@/api/hooks/useAllocations'
import { formatCurrency, formatPercent } from '@/lib/utils'

import StatCard from '@/components/StatCard'
import AllocationTreemap from '@/components/charts/AllocationTreemap'
import SpendingAreaChart from '@/components/charts/SpendingAreaChart'
import EmptyState from '@/components/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase()
  if (s === 'approved') {
    return (
      <Badge className="bg-accent-emerald/15 text-accent-emerald border-accent-emerald/30 hover:bg-accent-emerald/20 text-xs font-medium">
        Approved
      </Badge>
    )
  }
  if (s === 'revised') {
    return (
      <Badge className="bg-accent-blue/15 text-accent-blue border-accent-blue/30 hover:bg-accent-blue/20 text-xs font-medium">
        Revised
      </Badge>
    )
  }
  return (
    <Badge className="bg-accent-amber/15 text-accent-amber border-accent-amber/30 hover:bg-accent-amber/20 text-xs font-medium">
      Draft
    </Badge>
  )
}

export default function DashboardPage() {
  const { activeFiscalYear, isLoading: isFyLoading } = useFiscalYear()
  const fiscalYearId = activeFiscalYear?.id
  const fiscalYearLabel = activeFiscalYear?.label || (activeFiscalYear?.year ? `FY ${activeFiscalYear.year}` : '')

  // 1. Fetch Fiscal Year Summary
  const { data: summary, isLoading: isSummaryLoading } = useFiscalYearSummary(fiscalYearId)

  // 2. Fetch Comparison Data for Treemap
  const { data: comparisonData, isLoading: isComparisonLoading } = useComparison(fiscalYearId)

  // 3. Fetch Spending Trend for Area Chart
  const { data: trendData, isLoading: isTrendLoading } = useTrend(fiscalYearId)

  // 4. Fetch Top 5 Allocations ordered by allocated_amount desc
  const { data: allocationsData, isLoading: isAllocationsLoading } = useAllocations(
    { fiscal_year: fiscalYearId, ordering: '-allocated_amount' },
    { enabled: Boolean(fiscalYearId) }
  )

  const topAllocations = (
    Array.isArray(allocationsData)
      ? allocationsData
      : allocationsData?.results || []
  ).slice(0, 5)

  // Extract department scores map from comparison data
  const comparisonDepartments = comparisonData?.departments || []
  const getPerformanceScore = (deptId) => {
    const found = comparisonDepartments.find((d) => d.department === deptId)
    return found?.performance_score
  }

  const isDataLoading = isFyLoading || isSummaryLoading

  // Calculate metrics
  const totalBudget = Number(summary?.fiscal_year?.total_budget) || Number(activeFiscalYear?.total_budget) || 0
  const totalAllocated = Number(summary?.total_allocated) || 0
  const totalSpent = Number(summary?.total_spent) || 0
  const utilizationRate = summary?.utilization_rate !== null && summary?.utilization_rate !== undefined
    ? Number(summary.utilization_rate)
    : totalAllocated > 0
    ? totalSpent / totalAllocated
    : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="space-y-6 pb-12"
    >
      {/* Page Title & Context Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>Executive Dashboard</span>
            {fiscalYearLabel && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-accent-blue/15 text-accent-blue border border-accent-blue/30 font-medium">
                {fiscalYearLabel}
              </span>
            )}
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Government budget allocation, department spend velocity, and utilization overview
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/optimizer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
          >
            <span>Run Optimizer</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-accent-blue" />
          </Link>
        </div>
      </div>

      {/* KPI Row — 4 StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Budget */}
        <StatCard
          icon={Wallet}
          label="Total Budget"
          value={totalBudget}
          formatter={(v) => formatCurrency(v)}
          delta={5.4}
          deltaLabel="vs previous year"
          index={0}
          isLoading={isDataLoading}
        />

        {/* Card 2: Total Allocated */}
        <StatCard
          icon={Layers}
          label="Total Allocated"
          value={totalAllocated}
          formatter={(v) => formatCurrency(v)}
          delta={summary?.unallocated_budget ? 0 : 2.1}
          deltaLabel={totalBudget > 0 ? `${formatPercent(totalAllocated / totalBudget)} assigned` : 'assigned'}
          index={1}
          isLoading={isDataLoading}
        />

        {/* Card 3: Total Spent */}
        <StatCard
          icon={CreditCard}
          label="Total Spent"
          value={totalSpent}
          formatter={(v) => formatCurrency(v)}
          delta={-1.8}
          deltaLabel="spend rate"
          index={2}
          isLoading={isDataLoading}
        />

        {/* Card 4: Overall Utilization Rate */}
        <StatCard
          icon={Activity}
          label="Overall Utilization Rate"
          value={utilizationRate * 100}
          formatter={(v) => `${v.toFixed(1)}%`}
          delta={utilizationRate > 0.85 ? 4.2 : -2.5}
          deltaLabel={utilizationRate > 0.9 ? 'Approaching ceiling' : 'Within target range'}
          index={3}
          isLoading={isDataLoading}
        />
      </div>

      {/* Charts Grid — Treemap + AreaChart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AllocationTreemap
          data={comparisonDepartments}
          fiscalYearLabel={fiscalYearLabel}
          isLoading={isComparisonLoading}
        />

        <SpendingAreaChart
          data={trendData?.monthly || []}
          fiscalYearLabel={fiscalYearLabel}
          isLoading={isTrendLoading}
        />
      </div>

      {/* Top Departments Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        {/* Table Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">
              Top 5 Department Allocations
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Highest-funded government departments for the active fiscal year
            </p>
          </div>

          <Link
            to="/budgets"
            className="inline-flex items-center gap-1 text-xs text-accent-blue hover:underline font-medium"
          >
            <span>View All Budgets</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Table Content */}
        {isAllocationsLoading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-8 w-full bg-slate-800" />
            <Skeleton className="h-8 w-full bg-slate-800" />
            <Skeleton className="h-8 w-full bg-slate-800" />
            <Skeleton className="h-8 w-full bg-slate-800" />
            <Skeleton className="h-8 w-full bg-slate-800" />
          </div>
        ) : topAllocations.length > 0 ? (
          <div className="rounded-lg border border-slate-800/80 overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-950/60">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-xs text-slate-400 font-semibold">Department</TableHead>
                  <TableHead className="text-xs text-slate-400 font-semibold text-right">Allocated</TableHead>
                  <TableHead className="text-xs text-slate-400 font-semibold text-right">Spent</TableHead>
                  <TableHead className="text-xs text-slate-400 font-semibold text-right">Utilization %</TableHead>
                  <TableHead className="text-xs text-slate-400 font-semibold text-center">Score</TableHead>
                  <TableHead className="text-xs text-slate-400 font-semibold text-center">Status</TableHead>
                  <TableHead className="text-xs text-slate-400 font-semibold text-right w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topAllocations.map((alloc, idx) => {
                  const deptId = alloc.department || alloc.department_detail?.id || alloc.id
                  const deptName = alloc.department_name || alloc.department_detail?.name || 'Department'
                  const score = getPerformanceScore(deptId)
                  const utilRate = alloc.utilization_rate !== null && alloc.utilization_rate !== undefined
                    ? alloc.utilization_rate
                    : Number(alloc.allocated_amount) > 0
                    ? Number(alloc.spent_amount) / Number(alloc.allocated_amount)
                    : 0

                  return (
                    <motion.tr
                      key={alloc.id || idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.05 * idx }}
                      className="border-slate-800/70 hover:bg-slate-800/50 transition-colors group cursor-pointer"
                    >
                      {/* Department Name */}
                      <TableCell className="py-3 font-medium text-sm text-white">
                        <Link
                          to={`/budgets/${deptId}`}
                          className="hover:text-accent-blue transition-colors flex items-center gap-1.5"
                        >
                          <span>{deptName}</span>
                        </Link>
                      </TableCell>

                      {/* Allocated */}
                      <TableCell className="py-3 text-right text-sm text-slate-200 tabular-nums font-mono">
                        {formatCurrency(alloc.allocated_amount)}
                      </TableCell>

                      {/* Spent */}
                      <TableCell className="py-3 text-right text-sm text-slate-300 tabular-nums font-mono">
                        {formatCurrency(alloc.spent_amount)}
                      </TableCell>

                      {/* Utilization % */}
                      <TableCell className="py-3 text-right text-sm tabular-nums font-mono">
                        <span
                          className={
                            utilRate > 0.95
                              ? 'text-accent-red font-semibold'
                              : utilRate >= 0.8
                              ? 'text-accent-amber font-semibold'
                              : 'text-accent-emerald font-semibold'
                          }
                        >
                          {formatPercent(utilRate)}
                        </span>
                      </TableCell>

                      {/* Performance Score */}
                      <TableCell className="py-3 text-center text-sm tabular-nums font-mono">
                        {score !== undefined && score !== null ? (
                          <span className="text-slate-200 bg-slate-800 px-2 py-0.5 rounded text-xs">
                            {Number(score).toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">—</span>
                        )}
                      </TableCell>

                      {/* Status Badge */}
                      <TableCell className="py-3 text-center">
                        <StatusBadge status={alloc.status} />
                      </TableCell>

                      {/* Detail Link Button */}
                      <TableCell className="py-3 text-right">
                        <Link
                          to={`/budgets/${deptId}`}
                          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/60 inline-flex transition-colors"
                          title="View department details"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </TableCell>
                    </motion.tr>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState
            icon={Wallet}
            title="No department allocations found"
            description="No departmental budget allocations found for the active fiscal year."
            className="my-2 border-dashed bg-transparent"
          />
        )}
      </div>
    </motion.div>
  )
}
