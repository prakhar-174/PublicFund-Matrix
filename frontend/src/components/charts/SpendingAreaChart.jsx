import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { formatCompact, formatCurrency } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function CustomTrendTooltip({ active, payload, label, period }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const isQuarterly = period === 'quarterly' || (!data.month_label && Boolean(data.quarter))
    const displayTitle = isQuarterly
      ? `Quarter ${data.quarter || label}`
      : `${data.month_label || label} ${data.quarter ? `(${data.quarter})` : ''}`

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-xl text-xs space-y-1.5 z-50">
        <p className="font-semibold text-slate-300">{displayTitle}</p>
        <p className="text-white text-xs">
          {isQuarterly ? 'Quarterly Spend: ' : 'Monthly Spend: '}
          <span className="text-accent-blue font-bold font-mono">
            {formatCurrency(data.spent)}
          </span>
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
  height = 220,
  period = 'monthly',
  onPeriodChange = null,
  showPeriodSelector = false,
}) {
  if (isLoading) {
    return (
      <div
        className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-sm"
        style={{ minHeight: `${height + 120}px` }}
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40 bg-slate-800" />
          <Skeleton className="h-4 w-28 bg-slate-800" />
        </div>
        <Skeleton
          className="w-full bg-slate-800 rounded-lg mt-4"
          style={{ height: `${height}px` }}
        />
      </div>
    )
  }

  // Format labels for clean display:
  // For monthly: "2025-04" -> "Apr"
  // For quarterly: "Q1", "Q2", etc.
  const chartData = (data || []).map((item) => {
    let displayLabel = item.displayLabel
    if (!displayLabel) {
      if (period === 'quarterly' || (!item.month_label && item.quarter)) {
        displayLabel = item.quarter
      } else if (item.month_label && item.month_label.includes('-')) {
        const parts = item.month_label.split('-')
        const monthNum = parseInt(parts[1], 10)
        const date = new Date(2025, monthNum - 1, 1)
        displayLabel = date.toLocaleString('default', { month: 'short' })
      } else {
        displayLabel = item.month_label || item.quarter || ''
      }
    }
    return {
      ...item,
      displayLabel,
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
            {period === 'quarterly' ? 'Quarterly' : 'Monthly'} actual expenditures across departments
          </p>
        </div>

        {/* Period Selector */}
        {showPeriodSelector && onPeriodChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:inline">Interval:</span>
            <Select value={period} onValueChange={onPeriodChange}>
              <SelectTrigger className="w-[120px] h-8 text-xs bg-slate-950 border-slate-800 text-slate-200 focus:ring-1 focus:ring-accent-blue">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                <SelectItem value="monthly" className="text-xs cursor-pointer">
                  Monthly
                </SelectItem>
                <SelectItem value="quarterly" className="text-xs cursor-pointer">
                  Quarterly
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Area Chart Container */}
      <div
        className="w-full mt-3"
        style={{ height: `${height}px` }}
        role="img"
        aria-label={`Area chart showing ${period === 'quarterly' ? 'quarterly' : 'monthly'} spending progression across departments`}
      >
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={height}>
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
              <Tooltip content={<CustomTrendTooltip period={period} />} />
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
