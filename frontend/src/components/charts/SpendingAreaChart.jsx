import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { formatCompact, formatCurrency } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

function CustomTrendTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-xl text-xs space-y-1.5 z-50">
        <p className="font-semibold text-slate-300">
          {data.month_label || label} {data.quarter ? `(${data.quarter})` : ''}
        </p>
        <p className="text-white text-xs">
          Monthly Spend: <span className="text-accent-blue font-bold font-mono">{formatCurrency(data.spent)}</span>
        </p>
        {data.cumulative !== undefined && (
          <p className="text-slate-400 text-xs">
            Cumulative: <span className="text-slate-200 font-mono">{formatCompact(data.cumulative)}</span>
          </p>
        )}
      </div>
    )
  }
  return null
}

export default function SpendingAreaChart({
  data = [],
  fiscalYearLabel = '',
  isLoading = false,
}) {
  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-[340px] flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40 bg-slate-800" />
          <Skeleton className="h-4 w-20 bg-slate-800" />
        </div>
        <Skeleton className="h-[220px] w-full bg-slate-800 rounded-lg mt-4" />
      </div>
    )
  }

  // Format month labels for clean display (e.g. "2025-04" -> "Apr")
  const chartData = (data || []).map((item) => {
    let shortMonth = item.month_label
    if (item.month_label && item.month_label.includes('-')) {
      const parts = item.month_label.split('-')
      const monthNum = parseInt(parts[1], 10)
      const date = new Date(2025, monthNum - 1, 1)
      shortMonth = date.toLocaleString('default', { month: 'short' })
    }
    return {
      ...item,
      displayLabel: shortMonth || item.month_label,
      spent: Number(item.spent) || 0,
    }
  })

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <span>Spending Progression</span>
            {fiscalYearLabel && (
              <span className="text-xs font-normal text-slate-400">({fiscalYearLabel})</span>
            )}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Monthly actual expenditures across departments
          </p>
        </div>
      </div>

      {/* Area Chart Container */}
      <div className="h-[220px] w-full mt-3">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="displayLabel"
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
              />
              <YAxis
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => formatCompact(val)}
              />
              <Tooltip content={<CustomTrendTooltip />} />
              <Area
                type="monotone"
                dataKey="spent"
                stroke="#3B82F6"
                strokeWidth={2}
                fill="url(#areaGradient)"
                animationBegin={0}
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-slate-500">
            No spending trend recorded for this fiscal year.
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
        <span>Expenditures aggregated from validated spending entries</span>
        <span className="text-accent-blue font-medium">Recharts Area Engine</span>
      </div>
    </div>
  )
}
