import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { formatCompact, formatCurrency } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

function CustomYoYTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-xl text-xs space-y-1.5 z-50">
        <p className="font-semibold text-white">{label}</p>
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
              <span>{entry.name}:</span>
            </span>
            <span className="font-mono text-white font-medium">
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function YoYBarChart({
  years = [],
  departmentName = '',
  isLoading = false,
}) {
  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-[360px] flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-48 bg-slate-800" />
          <Skeleton className="h-4 w-24 bg-slate-800" />
        </div>
        <Skeleton className="h-[250px] w-full bg-slate-800 rounded-lg mt-4" />
      </div>
    )
  }

  const chartData = (years || []).map((item) => {
    const yearNum = Number(item.year)
    const fyLabel = yearNum ? `FY ${yearNum}-${String(yearNum + 1).slice(-2)}` : 'FY'
    return {
      yearLabel: fyLabel,
      Allocated: Number(item.allocated_amount) || 0,
      Spent: Number(item.spent_amount) || 0,
    }
  })

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white tracking-tight flex items-center justify-between">
          <span>Year-over-Year Allocation vs. Spend</span>
          {departmentName && (
            <span className="text-xs font-normal text-slate-400 truncate max-w-xs">
              {departmentName}
            </span>
          )}
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Historical progression of requested and utilized funds across recorded fiscal years
        </p>
      </div>

      <div className="h-[260px] w-full">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              barCategoryGap="25%"
            >
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="yearLabel"
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
              <Tooltip content={<CustomYoYTooltip />} />
              <Legend
                verticalAlign="bottom"
                wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }}
              />
              <Bar
                dataKey="Allocated"
                name="Allocated"
                fill="#3B82F6"
                radius={[4, 4, 0, 0]}
                animationDuration={600}
              />
              <Bar
                dataKey="Spent"
                name="Spent"
                fill="#10B981"
                radius={[4, 4, 0, 0]}
                animationDuration={600}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-slate-500">
            No historical allocation records found for this department.
          </div>
        )}
      </div>
    </div>
  )
}
