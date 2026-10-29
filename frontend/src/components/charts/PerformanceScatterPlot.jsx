import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  LabelList,
} from 'recharts'
import { HelpCircle, BarChart3 } from 'lucide-react'
import EmptyState from '@/components/EmptyState'
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Custom circle shape renderer for Recharts Scatter.
 * Circle radius = 8, colored according to quadrant rules.
 */
function CustomScatterDot(props) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null) return null

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={8}
        fill={payload.color || '#3B82F6'}
        stroke="#0F172A"
        strokeWidth={2}
        className="transition-all duration-200 hover:scale-125 cursor-pointer filter drop-shadow-md"
      />
    </g>
  )
}

/**
 * Custom tooltip displaying department name, utilization rate, and performance score.
 */
function CustomScatterTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-lg p-3 shadow-xl text-xs space-y-2 z-50 min-w-[210px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="font-semibold text-white text-sm truncate max-w-[150px]">
            {data.department_name}
          </span>
          {data.department_code && (
            <span className="font-mono text-[10px] text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
              {data.department_code}
            </span>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">Budget Utilization:</span>
            <span className="font-mono font-semibold text-white">{data.x}%</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">Performance Score:</span>
            <span className="font-mono font-semibold text-white">{data.y} / 100</span>
          </div>
        </div>

        <div className="pt-1.5 border-t border-slate-800 flex items-center gap-1.5 text-[11px]">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: data.color }}
          />
          <span className="text-slate-300 font-medium">{data.quadrantLabel}</span>
        </div>
      </div>
    )
  }
  return null
}

export default function PerformanceScatterPlot({
  data = [],
  isLoading = false,
  fiscalYearLabel = '',
}) {
  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-[380px] flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-56 bg-slate-800" />
          <Skeleton className="h-4 w-20 bg-slate-800" />
        </div>
        <Skeleton className="h-[280px] w-full bg-slate-800 rounded-lg mt-4" />
      </div>
    )
  }

  // Transform data points:
  // x = utilization_rate (%), y = performance_score
  // Quadrants guided by lines at x=80 and y=50:
  // - High Perf + Low Spend (y >= 50 && x < 80) = emerald
  // - Low Perf + High Spend (y < 50 && x >= 80) = red
  // - Others (High Perf + High Spend, Low Perf + Low Spend) = accent-blue
  const chartPoints = (data || [])
    .filter((d) => d.utilization_rate != null && d.performance_score != null)
    .map((d) => {
      // Backend utilization_rate may be a decimal ratio (e.g. 0.952) or a percentage
      const rawRate = Number(d.utilization_rate)
      const utilPct = rawRate <= 1.5 ? Number((rawRate * 100).toFixed(1)) : Number(rawRate.toFixed(1))
      const perfScore = Number(Number(d.performance_score).toFixed(1))

      let color = '#3B82F6' // default accent-blue
      let quadrantLabel = 'Standard'

      if (perfScore >= 50 && utilPct < 80) {
        color = '#10B981' // emerald
        quadrantLabel = 'High Perf / Efficient Spend'
      } else if (perfScore < 50 && utilPct >= 80) {
        color = '#EF4444' // red
        quadrantLabel = 'Low Perf / High Spend'
      } else if (perfScore >= 50 && utilPct >= 80) {
        quadrantLabel = 'High Perf / High Spend'
      } else {
        quadrantLabel = 'Low Perf / Low Spend'
      }

      const code =
        d.department_code ||
        (d.department_name ? d.department_name.slice(0, 3).toUpperCase() : 'DEP')

      return {
        ...d,
        x: utilPct,
        y: perfScore,
        department_code: code,
        color,
        quadrantLabel,
      }
    })

  // Calculate domain bounds
  const maxX = chartPoints.reduce((max, p) => Math.max(max, p.x), 100)
  const xDomain = [0, Math.max(100, Math.ceil((maxX + 5) / 10) * 10)]

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-sm">
      {/* Card Header with HelpCircle Tooltip */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <span>Performance vs. Budget Utilization</span>
            {fiscalYearLabel && (
              <span className="text-xs font-normal text-slate-400">({fiscalYearLabel})</span>
            )}
          </h3>

          <TooltipProvider>
            <UiTooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Quadrant Explanations"
                  className="text-slate-400 hover:text-slate-200 transition-colors p-0.5 rounded-full hover:bg-slate-800"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="max-w-xs bg-slate-900 border-slate-800 text-slate-200 p-3 shadow-xl space-y-2 text-xs"
              >
                <p className="font-semibold text-white border-b border-slate-800 pb-1">
                  Quadrant Explanations (Guides at 80% Spend & 50 Score)
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-accent-emerald shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-accent-emerald">Top-Left (Emerald):</strong> High
                      performance with low budget spend (&lt;80% spend, &ge;50 score). Exemplary efficiency.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-accent-red shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-accent-red">Bottom-Right (Red):</strong> Low
                      performance with high spend (&ge;80% spend, &lt;50 score). High risk requiring audit.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-accent-blue shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-accent-blue">Other (Blue):</strong> Balanced
                      high-spend/high-output or emerging departments.
                    </span>
                  </div>
                </div>
              </TooltipContent>
            </UiTooltip>
          </TooltipProvider>
        </div>

        {/* Quadrant mini-legend */}
        <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent-emerald" />
            <span>High Perf / Low Spend</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent-red" />
            <span>Low Perf / High Spend</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent-blue" />
            <span>Balanced</span>
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-400 mb-2">
        Correlation between actual budget utilization rate (%) and evaluated departmental performance score (0-100)
      </p>

      {/* Chart Canvas */}
      <div
        className="h-[280px] w-full mt-2"
        role="img"
        aria-label="Scatter plot showing department performance score versus budget utilization percentage"
      >
        {chartPoints.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -10 }}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                name="Budget Utilization"
                unit="%"
                domain={xDomain}
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
                tickFormatter={(val) => `${val}%`}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Performance Score"
                domain={[0, 100]}
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
              />

              {/* Reference lines at x=80 and y=50 creating quadrant guides */}
              <ReferenceLine
                x={80}
                stroke="#475569"
                strokeDasharray="4 4"
                label={{
                  value: '80% Spend',
                  fill: '#64748B',
                  fontSize: 10,
                  position: 'insideTopRight',
                  offset: 5,
                }}
              />
              <ReferenceLine
                y={50}
                stroke="#475569"
                strokeDasharray="4 4"
                label={{
                  value: '50 Perf Score',
                  fill: '#64748B',
                  fontSize: 10,
                  position: 'insideRight',
                  offset: 5,
                }}
              />

              <Tooltip content={<CustomScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />

              <Scatter name="Departments" data={chartPoints} shape={<CustomScatterDot />}>
                <LabelList
                  dataKey="department_code"
                  position="top"
                  fill="#94A3B8"
                  fontSize={11}
                  offset={10}
                />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            icon={BarChart3}
            title="No performance records found"
            description="No departmental utilization or performance score records found for this fiscal year."
            className="h-full min-h-[260px] border-none bg-transparent"
          />
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
        <span>Quadrants partitioned at 80% utilization and 50 performance score</span>
        <span className="text-accent-blue font-medium">Recharts Scatter Engine</span>
      </div>
    </div>
  )
}

