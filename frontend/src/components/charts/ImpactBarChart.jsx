import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts'
import { formatCompact, formatCurrency } from '@/lib/utils'

function CustomImpactTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const isPositive = Number(data.change_amount) >= 0

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-xl text-xs space-y-1.5 z-50 min-w-[210px]">
        <p className="font-semibold text-white text-sm">{data.department_name}</p>
        <div className="flex justify-between items-center text-slate-300">
          <span className="text-slate-400">Current:</span>
          <span className="font-mono text-slate-200">
            {formatCurrency(data.current_allocation)}
          </span>
        </div>
        <div className="flex justify-between items-center text-slate-300">
          <span className="text-slate-400">Recommended:</span>
          <span className="font-mono text-slate-200">
            {formatCurrency(data.recommended_allocation)}
          </span>
        </div>
        <div className="pt-1.5 border-t border-slate-800 flex justify-between items-center">
          <span className="text-slate-400">Proposed Change:</span>
          <span
            className={`font-mono font-bold ${
              isPositive ? 'text-accent-emerald' : 'text-accent-red'
            }`}
          >
            {isPositive ? '+' : ''}
            {formatCurrency(data.change_amount)}{' '}
            {data.change_percent != null
              ? `(${data.change_percent > 0 ? '+' : ''}${Number(data.change_percent).toFixed(1)}%)`
              : ''}
          </span>
        </div>
      </div>
    )
  }
  return null
}

export default function ImpactBarChart({ data = [] }) {
  if (!data || data.length === 0) {
    return null
  }

  // Prepare chart data ensuring numbers for recharts
  const chartData = data.map((item) => ({
    ...item,
    change_amount: Number(item.change_amount) || 0,
    current_allocation: Number(item.current_allocation) || 0,
    recommended_allocation: Number(item.recommended_allocation) || 0,
    change_percent: item.change_percent != null ? Number(item.change_percent) : null,
  }))

  // Dynamic height to keep spacing comfortable for any number of departments
  const calculatedHeight = Math.max(260, chartData.length * 40)

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white tracking-tight">
            Budget Reallocation Impact
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Proposed net shift in funding per department (positive = increase, negative = reduction)
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-accent-emerald" />
            <span>Increase</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-accent-red" />
            <span>Reduction</span>
          </span>
        </div>
      </div>

      <div
        style={{ height: `${calculatedHeight}px` }}
        className="w-full"
        role="img"
        aria-label="Horizontal bar chart showing budget reallocation impact by department"
      >
        <ResponsiveContainer width="100%" height={calculatedHeight}>
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
          >
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              stroke="#94A3B8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              tickFormatter={(val) => formatCompact(val)}
            />
            <YAxis
              type="category"
              dataKey="department_name"
              stroke="#94A3B8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              width={140}
            />
            <ReferenceLine x={0} stroke="#475569" strokeWidth={1.5} />
            <Tooltip content={<CustomImpactTooltip />} cursor={{ fill: '#334155', opacity: 0.2 }} />
            <Bar
              dataKey="change_amount"
              animationDuration={700}
              radius={[4, 4, 4, 4]}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`impact-bar-${index}`}
                  fill={entry.change_amount >= 0 ? '#10B981' : '#EF4444'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
        <span>Bars anchored about zero (net baseline delta)</span>
        <span className="text-accent-blue font-medium">Recharts Horizontal Engine</span>
      </div>
    </div>
  )
}

