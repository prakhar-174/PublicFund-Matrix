import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Pencil,
  Circle,
  CheckCircle2,
  Clock,
  UserCheck,
} from 'lucide-react'

import { useFiscalYear } from '@/store/FiscalYearContext'
import { useDepartment } from '@/api/hooks/useDepartments'
import { useYoy } from '@/api/hooks/useAnalytics'
import { useAllocations } from '@/api/hooks/useAllocations'
import { useMetrics } from '@/api/hooks/useMetrics'
import { formatCurrency, formatPercent } from '@/lib/utils'

import { Button } from '@/components/ui/button'
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

import YoYBarChart from '@/components/charts/YoYBarChart'
import AllocationFormModal from '@/components/AllocationFormModal'
import EmptyState from '@/components/EmptyState'
import { Target } from 'lucide-react'

export default function BudgetDetailPage() {
  const { deptId } = useParams()
  const { activeFiscalYear } = useFiscalYear()
  const [editModalOpen, setEditModalOpen] = useState(false)

  // 1. Department Info
  const { data: department, isLoading: isDeptLoading } = useDepartment(deptId)

  // 2. Year-over-Year History
  const { data: yoyData, isLoading: isYoyLoading } = useYoy(deptId)

  // 3. Current Active Allocation for this Department
  const { data: allocationsData, isLoading: isAllocLoading } = useAllocations(
    { department: deptId, fiscal_year: activeFiscalYear?.id },
    { enabled: Boolean(deptId && activeFiscalYear?.id) }
  )

  const currentAllocation = useMemo(() => {
    if (!allocationsData) return null
    const list = Array.isArray(allocationsData) ? allocationsData : allocationsData.results || []
    return list[0] || null
  }, [allocationsData])

  // 4. Performance Metrics for this Department + Active FY
  const { data: metrics = [], isLoading: isMetricsLoading } = useMetrics(
    { department: deptId, fiscal_year: activeFiscalYear?.id },
    { enabled: Boolean(deptId && activeFiscalYear?.id) }
  )

  // Compute composite performance score
  const { totalWeight, compositeScore, evaluatedMetrics } = useMemo(() => {
    if (!metrics || metrics.length === 0) {
      return { totalWeight: 0, compositeScore: null, evaluatedMetrics: [] }
    }

    let weightSum = 0
    let weightedSum = 0

    const list = metrics.map((m) => {
      const val = Number(m.metric_value) || 0
      const wt = Number(m.weight) || 1
      const weighted = val * wt
      weightSum += wt
      weightedSum += weighted
      return {
        ...m,
        weightedScore: weighted,
      }
    })

    const score = weightSum > 0 ? weightedSum / weightSum : null
    return {
      totalWeight: weightSum,
      compositeScore: score,
      evaluatedMetrics: list,
    }
  }, [metrics])

  const utilRate = currentAllocation?.utilization_rate !== null && currentAllocation?.utilization_rate !== undefined
    ? Number(currentAllocation.utilization_rate)
    : Number(currentAllocation?.allocated_amount) > 0
    ? Number(currentAllocation.spent_amount) / Number(currentAllocation.allocated_amount)
    : 0

  const status = (currentAllocation?.status || 'draft').toLowerCase()

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="space-y-6 pb-12"
    >
      {/* Page Header */}
      <div className="flex flex-col gap-3">
        <Link
          to="/budgets"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Budgets</span>
        </Link>

        {isDeptLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 bg-slate-800" />
            <Skeleton className="h-4 w-40 bg-slate-800" />
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {department?.name || 'Department Details'}
                </h1>
                {department?.code && (
                  <Badge variant="outline" className="border-accent-blue/40 text-accent-blue bg-accent-blue/10 text-xs font-mono">
                    {department.code}
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                {department?.head_name ? (
                  <span>Head of Department: <strong className="text-slate-300 font-medium">{department.head_name}</strong></span>
                ) : (
                  department?.description || 'Government Department Budget and Performance Record'
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Left 2/3 Content, Right 1/3 Sticky Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: YoY Bar Chart & Performance Metrics */}
        <div className="lg:col-span-2 space-y-6">
          {/* YoY Bar Chart */}
          <YoYBarChart
            years={yoyData?.years || []}
            departmentName={department?.name}
            isLoading={isYoyLoading}
          />

          {/* Performance Metrics Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                  <span>Performance Metrics Evaluation</span>
                  {activeFiscalYear?.label && (
                    <span className="text-xs text-slate-400 font-normal">({activeFiscalYear.label})</span>
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  KPI tracking and weighted outcome scoring used in budget reallocation decisions
                </p>
              </div>

              {compositeScore !== null && (
                <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-lg shrink-0">
                  <span className="text-xs text-slate-400">Composite:</span>
                  <span className="text-sm font-bold font-mono text-accent-blue">
                    {compositeScore.toFixed(1)} / 100
                  </span>
                </div>
              )}
            </div>

            {isMetricsLoading ? (
              <div className="space-y-3 py-4">
                <Skeleton className="h-8 w-full bg-slate-800" />
                <Skeleton className="h-8 w-full bg-slate-800" />
                <Skeleton className="h-8 w-full bg-slate-800" />
              </div>
            ) : evaluatedMetrics.length > 0 ? (
              <div className="rounded-lg border border-slate-800/80 overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-950/60">
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-xs text-slate-400 font-semibold">Metric Name</TableHead>
                      <TableHead className="text-xs text-slate-400 font-semibold text-right">Value (0–100)</TableHead>
                      <TableHead className="text-xs text-slate-400 font-semibold text-right">Weight</TableHead>
                      <TableHead className="text-xs text-slate-400 font-semibold text-right">Weighted Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evaluatedMetrics.map((metric) => (
                      <TableRow key={metric.id} className="border-slate-800/60 hover:bg-slate-800/40">
                        <TableCell className="py-3 text-sm text-slate-200">
                          <div>
                            <span className="font-medium text-white">{metric.metric_name}</span>
                            {metric.description && (
                              <p className="text-xs text-slate-400 mt-0.5">{metric.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-right text-sm font-mono text-slate-200 tabular-nums">
                          {Number(metric.metric_value).toFixed(1)}
                        </TableCell>
                        <TableCell className="py-3 text-right text-sm font-mono text-slate-300 tabular-nums">
                          {Number(metric.weight).toFixed(2)}
                        </TableCell>
                        <TableCell className="py-3 text-right text-sm font-mono text-accent-blue font-semibold tabular-nums">
                          {metric.weightedScore.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Footer Row */}
                    <TableRow className="bg-slate-950/80 border-t-2 border-slate-800 font-semibold">
                      <TableCell className="py-3 text-xs text-slate-300">
                        Total Performance Weight & Average
                      </TableCell>
                      <TableCell className="py-3 text-right text-xs text-slate-400 font-mono">
                        —
                      </TableCell>
                      <TableCell className="py-3 text-right text-xs font-mono text-slate-300 tabular-nums">
                        {totalWeight.toFixed(2)}
                      </TableCell>
                      <TableCell className="py-3 text-right text-sm font-mono text-accent-emerald font-bold tabular-nums">
                        {compositeScore !== null ? `${compositeScore.toFixed(1)} / 100` : '—'}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState
                icon={Target}
                title="No performance metrics recorded"
                description={`No performance metrics evaluated for this department in ${activeFiscalYear?.label || 'the active fiscal year'}.`}
                className="my-2 border-dashed bg-transparent"
              />
            )}
          </div>
        </div>

        {/* Right Sidebar: Current Allocation Card & Status Timeline */}
        <div className="space-y-6 lg:sticky lg:top-6">
          {/* Current Allocation Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-white">Current Allocation</h3>
                <span className="text-xs text-slate-400">{activeFiscalYear?.label || 'Active FY'}</span>
              </div>
              {currentAllocation && (
                <Button
                  onClick={() => setEditModalOpen(true)}
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 text-xs border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 gap-1"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </Button>
              )}
            </div>

            {isAllocLoading ? (
              <div className="space-y-3 py-2">
                <Skeleton className="h-6 w-32 bg-slate-800" />
                <Skeleton className="h-6 w-48 bg-slate-800" />
                <Skeleton className="h-6 w-40 bg-slate-800" />
              </div>
            ) : currentAllocation ? (
              <div className="space-y-3.5">
                <div>
                  <span className="text-xs text-slate-400">Allocated Budget</span>
                  <p className="text-xl font-bold text-white font-mono mt-0.5">
                    {formatCurrency(currentAllocation.allocated_amount)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">Requested</span>
                    <p className="font-mono text-slate-300 font-medium mt-0.5">
                      {formatCurrency(currentAllocation.requested_amount)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Spent Actuals</span>
                    <p className="font-mono text-slate-300 font-medium mt-0.5">
                      {formatCurrency(currentAllocation.spent_amount)}
                    </p>
                  </div>
                </div>

                {/* Utilization Progress Bar */}
                <div className="pt-2 border-t border-slate-800/70">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-400">Budget Utilization</span>
                    <span
                      className={`font-mono font-bold ${
                        utilRate > 0.95
                          ? 'text-accent-red'
                          : utilRate >= 0.8
                          ? 'text-accent-amber'
                          : 'text-accent-emerald'
                      }`}
                    >
                      {formatPercent(utilRate)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        utilRate > 0.95
                          ? 'bg-accent-red'
                          : utilRate >= 0.8
                          ? 'bg-accent-amber'
                          : 'bg-accent-emerald'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, utilRate * 100))}%` }}
                    />
                  </div>
                </div>

                {/* Approver Info */}
                {currentAllocation.approved_by_username && (
                  <div className="flex items-center gap-2 pt-2 text-xs text-slate-400 border-t border-slate-800/70">
                    <UserCheck className="w-4 h-4 text-accent-blue" />
                    <span>Approved by {currentAllocation.approved_by_username}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-4 text-center">
                No allocation record exists for this department in {activeFiscalYear?.label || 'this fiscal year'}.
              </div>
            )}
          </div>

          {/* Status History Timeline */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-white">Status Workflow History</h3>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-slate-800">
              {/* Step 1: Draft */}
              <div className="relative flex items-start gap-3">
                <span className="absolute -left-6 top-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 border border-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent-emerald" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-white">Initial Draft Created</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Proposal submitted with requested funding.
                  </p>
                </div>
              </div>

              {/* Step 2: Committee Revision */}
              <div className="relative flex items-start gap-3">
                <span className="absolute -left-6 top-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 border border-slate-700">
                  {status === 'revised' || status === 'approved' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent-blue" />
                  ) : (
                    <Circle className="w-3 h-3 text-slate-600" />
                  )}
                </span>
                <div>
                  <p className="text-xs font-semibold text-white">Budget Committee Revision</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {status === 'revised'
                      ? 'Currently undergoing committee adjustment.'
                      : status === 'approved'
                      ? 'Adjusted and recommended for sign-off.'
                      : 'Pending review.'}
                  </p>
                </div>
              </div>

              {/* Step 3: Approval */}
              <div className="relative flex items-start gap-3">
                <span className="absolute -left-6 top-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 border border-slate-700">
                  {status === 'approved' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent-emerald" />
                  ) : (
                    <Clock className="w-3 h-3 text-slate-600" />
                  )}
                </span>
                <div>
                  <p className="text-xs font-semibold text-white">Official Sign-Off</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {status === 'approved'
                      ? `Approved by ${currentAllocation?.approved_by_username || 'Administrator'}.`
                      : 'Pending administrative approval.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Allocation Modal */}
      {currentAllocation && (
        <AllocationFormModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          allocation={currentAllocation}
          defaultFiscalYearId={activeFiscalYear?.id}
        />
      )}
    </motion.div>
  )
}
