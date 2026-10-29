import { Link } from 'react-router-dom'
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts'
import { ChevronRight } from 'lucide-react'
import { formatCompact, formatCurrency, formatPercent } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Custom renderer for individual Treemap cells.
 */
function TreemapContent(props) {
  const { x, y, width, height, name, size, utilization_rate } = props

  if (!width || !height || width <= 0 || height <= 0) return null

  const util = Number(utilization_rate) || 0
  const normalizedUtil = util <= 1 && util > 0 ? util * 100 : util

  let fillColor = '#10B981' // emerald < 80%
  if (normalizedUtil >= 80 && normalizedUtil <= 95) {
    fillColor = '#F59E0B' // amber 80-95%
  } else if (normalizedUtil > 95) {
    fillColor = '#EF4444' // red > 95%
  }

  const showTitle = width > 55 && height > 32
  const showAmount = width > 75 && height > 48

  const maxChars = Math.max(6, Math.floor(width / 7.5))
  const displayTitle = name && name.length > maxChars ? `${name.slice(0, maxChars)}...` : name

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={4}
        fill={fillColor}
        fillOpacity={0.85}
        stroke="#1E293B"
        strokeWidth={2}
        className="transition-all hover:fill-opacity-100 cursor-pointer"
      />
      {showTitle && (
        <text
          x={x + 8}
          y={y + 18}
          fill="#FFFFFF"
          fontSize={width < 90 ? 10 : 12}
          fontWeight={600}
          className="pointer-events-none select-none font-sans"
        >
          {displayTitle}
        </text>
      )}
      {showAmount && (
        <text
          x={x + 8}
          y={y + 34}
          fill="#FFFFFF"
          fontSize={10}
          opacity={0.9}
          className="pointer-events-none select-none tabular-nums font-mono"
        >
          {formatCompact(size)}
        </text>
      )}
    </g>
  )
}

function CustomTreemapTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-xl text-xs space-y-1 z-50">
        <p className="font-semibold text-white">{data.name}</p>
        <p className="text-slate-400">
          Allocated: <span className="text-white font-mono">{formatCurrency(data.size)}</span>
        </p>
        {data.utilization_rate !== undefined && (
          <p className="text-slate-400">
            Utilization:{' '}
            <span className="text-white font-mono">{formatPercent(data.utilization_rate)}</span>
          </p>
        )}
      </div>
    )
  }
  return null
}

export default function AllocationTreemap({
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
        <Skeleton className="h-[240px] w-full bg-slate-800 rounded-lg mt-4" />
      </div>
    )
  }

  // Transform departments list to Recharts Treemap hierarchy
  const treeData = (data || [])
    .filter((d) => Number(d.allocated_amount) > 0)
    .map((d) => ({
      name: d.department_name || d.name || 'Department',
      size: Number(d.allocated_amount) || 0,
      utilization_rate: d.utilization_rate,
      id: d.department || d.id,
    }))

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <span>Budget Distribution</span>
            {fiscalYearLabel && (
              <span className="text-xs font-normal text-slate-400">({fiscalYearLabel})</span>
            )}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Department allocations sized by budget volume and colored by utilization
          </p>
        </div>

        <Link
          to="/budgets"
          className="inline-flex items-center gap-1 text-xs text-accent-blue hover:underline font-medium shrink-0"
        >
          <span>All Budgets</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Treemap Content */}
      <div
        className="h-[240px] w-full"
        role="img"
        aria-label="Treemap chart showing budget distribution across departments"
      >
        {treeData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={treeData}
              dataKey="size"
              aspectRatio={4 / 3}
              stroke="#1E293B"
              content={<TreemapContent />}
            >
              <Tooltip content={<CustomTreemapTooltip />} />
            </Treemap>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-slate-500">
            No allocation data found for this fiscal year.
          </div>
        )}
      </div>

      {/* Utilization Legend */}
      <div className="flex items-center justify-end gap-4 mt-3 pt-3 border-t border-slate-800/60 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-accent-emerald" />
          <span>&lt; 80% Healthy</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-accent-amber" />
          <span>80–95% Approaching</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-accent-red" />
          <span>&gt; 95% High Spend</span>
        </span>
      </div>
    </div>
  )
}
