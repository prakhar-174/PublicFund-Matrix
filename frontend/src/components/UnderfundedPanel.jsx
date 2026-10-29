import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, ArrowRight, TrendingDown } from 'lucide-react'
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts'

import { useUnderfunded } from '@/api/hooks/useAnalytics'
import { formatCurrency } from '@/lib/utils'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
}

export default function UnderfundedPanel({ fiscalYearId }) {
  const { data, isLoading, isError, error } = useUnderfunded(fiscalYearId)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full bg-slate-900 border border-slate-800 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 w-full bg-slate-900 border border-slate-800 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <Alert className="border-red-900/50 bg-red-950/20 text-red-400">
        <AlertTriangle className="h-5 w-5 text-red-400" />
        <AlertTitle className="text-sm font-semibold">Error Loading Underfunded Analysis</AlertTitle>
        <AlertDescription className="text-xs mt-1 text-red-300">
          {error?.message || 'Unable to retrieve underfunded departments data.'}
        </AlertDescription>
      </Alert>
    )
  }

  const departments = data?.departments || []

  // If empty: emerald Alert — ‘All departments are within funding targets.’
  if (departments.length === 0) {
    return (
      <Alert className="border-accent-emerald/40 bg-accent-emerald/10 text-accent-emerald">
        <CheckCircle2 className="h-5 w-5 text-accent-emerald" />
        <AlertTitle className="text-sm font-semibold text-accent-emerald">
          Funding Targets Achieved
        </AlertTitle>
        <AlertDescription className="text-xs text-accent-emerald/90 mt-1">
          All departments are within funding targets.
        </AlertDescription>
      </Alert>
    )
  }

  // If data: amber Alert header + a list of cards below
  return (
    <div className="space-y-4">
      {/* Amber Alert Header */}
      <Alert className="border-accent-amber/40 bg-accent-amber/10 text-accent-amber shadow-sm">
        <AlertTriangle className="h-5 w-5 text-accent-amber" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <AlertTitle className="text-sm font-semibold text-accent-amber flex items-center gap-2">
              <span>Underfunded Departments Alert</span>
              <Badge
                variant="outline"
                className="border-accent-amber/40 bg-accent-amber/20 text-accent-amber font-mono text-[11px]"
              >
                {departments.length} Flagged
              </Badge>
            </AlertTitle>
          </div>
          <AlertDescription className="text-xs text-accent-amber/90 mt-1">
            Departments funded below the target threshold (80% of requested budget). Review funding
            gaps and resource constraints before approvals.
          </AlertDescription>
        </div>
      </Alert>

      {/* List of Underfunded Cards with Framer Motion Stagger */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {departments.map((dept) => {
          // Ratio is allocated / requested
          const ratio = Number(dept.funded_ratio) || 0
          const ratioPct = Math.min(100, Math.max(0, Math.round(ratio * 100)))
          const radialData = [{ name: 'Funded', value: ratioPct, fill: '#F59E0B' }]

          return (
            <motion.div
              key={dept.department}
              variants={cardVariants}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-sm hover:border-slate-700 transition-colors"
            >
              {/* Card Header: Department Name + Code */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-white text-sm truncate mr-2">
                    {dept.department_name}
                  </h4>
                  {dept.department_code && (
                    <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[10px] font-mono shrink-0">
                      {dept.department_code}
                    </Badge>
                  )}
                </div>

                {/* Radial Chart & Financial Metrics */}
                <div className="flex items-center gap-4">
                  {/* Single-ring RadialBarChart with Accent Amber Fill */}
                  <div
                    className="relative w-20 h-20 shrink-0 flex items-center justify-center"
                    role="img"
                    aria-label={`Radial chart showing ${ratioPct}% of requested budget funded for ${dept.department_name}`}
                  >
                    <ResponsiveContainer width={80} height={80}>
                      <RadialBarChart
                        cx="50%"
                        cy="50%"
                        innerRadius="65%"
                        outerRadius="95%"
                        barSize={8}
                        data={radialData}
                        startAngle={90}
                        endAngle={-270}
                      >
                        <PolarAngleAxis
                          type="number"
                          domain={[0, 100]}
                          angleAxisId={0}
                          tick={false}
                        />
                        <RadialBar
                          background={{ fill: '#334155' }}
                          dataKey="value"
                          cornerRadius={4}
                        />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xs font-bold font-mono text-accent-amber">
                        {ratioPct}%
                      </span>
                      <span className="text-[9px] text-slate-400">funded</span>
                    </div>
                  </div>

                  {/* Amount Breakdown */}
                  <div className="space-y-1 text-xs flex-1 min-w-0">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-slate-400 text-[11px]">Allocated:</span>
                      <span className="font-mono text-slate-200">
                        {formatCurrency(dept.allocated_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-slate-400 text-[11px]">Requested:</span>
                      <span className="font-mono text-slate-200">
                        {formatCurrency(dept.requested_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-accent-amber pt-0.5 border-t border-slate-800">
                      <span className="text-[11px] font-medium flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" /> Gap:
                      </span>
                      <span className="font-mono font-semibold">
                        {formatCurrency(dept.funding_gap)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* View Detail Link */}
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <Link
                  to={`/budgets/${dept.department}`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-blue hover:text-accent-blue/80 transition-colors group"
                >
                  <span>View Detail</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}

