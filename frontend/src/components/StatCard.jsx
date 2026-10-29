import { useEffect, useState } from 'react'
import { motion, useMotionValue, animate } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'

/**
 * StatCard component displaying KPI metric with smooth number animation and delta chip.
 *
 * @param {Object} props
 * @param {React.ComponentType} props.icon - Lucide icon component (20px, accent-blue)
 * @param {string} props.label - Metric description text
 * @param {number|string} props.value - Target numerical value
 * @param {Function} [props.formatter] - Formatter function for animated value
 * @param {number} [props.delta] - Percentage change
 * @param {string} [props.deltaLabel] - Contextual label for delta
 * @param {number} [props.index=0] - Card position index for staggered entrance
 * @param {boolean} [props.isLoading=false] - Loading skeleton toggle
 */
export default function StatCard({
  icon: Icon,
  label,
  value = 0,
  formatter = (v) => String(Math.round(v)),
  delta,
  deltaLabel,
  index = 0,
  isLoading = false,
}) {
  const numericValue = typeof value === 'number' ? value : Number(value) || 0
  const motionVal = useMotionValue(0)
  const [displayValue, setDisplayValue] = useState(() => formatter(0))

  useEffect(() => {
    if (isLoading) return

    const controls = animate(motionVal, numericValue, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate: (latest) => {
        setDisplayValue(formatter(latest))
      },
    })

    return () => controls.stop()
  }, [numericValue, formatter, isLoading, motionVal])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.06 * index, ease: 'easeOut' }}
      className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-sm hover:border-slate-700/80 transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-400">{label}</span>
        {Icon && (
          <div className="w-9 h-9 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-accent-blue" />
          </div>
        )}
      </div>

      <div className="mt-3">
        {isLoading ? (
          <div className="h-8 w-28 bg-slate-800 rounded animate-pulse" />
        ) : (
          <span className="text-2xl font-semibold text-white tabular-nums tracking-tight">
            {displayValue}
          </span>
        )}
      </div>

      {delta !== undefined && delta !== null && (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium">
          {delta >= 0 ? (
            <span className="inline-flex items-center gap-1 text-accent-emerald bg-accent-emerald/10 border border-accent-emerald/20 px-2 py-0.5 rounded-md">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+{Math.abs(delta) > 1 ? delta.toFixed(1) : (delta * 100).toFixed(1)}%</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-accent-red bg-accent-red/10 border border-accent-red/20 px-2 py-0.5 rounded-md">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>{Math.abs(delta) > 1 ? delta.toFixed(1) : (delta * 100).toFixed(1)}%</span>
            </span>
          )}
          {deltaLabel && <span className="text-slate-400 text-xs">{deltaLabel}</span>}
        </div>
      )}
    </motion.div>
  )
}
