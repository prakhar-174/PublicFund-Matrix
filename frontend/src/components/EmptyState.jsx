import { FileX } from 'lucide-react'

/**
 * Reusable EmptyState component for zero-data and filtered-out views.
 *
 * @param {Object} props
 * @param {React.ComponentType} [props.icon=FileX]
 * @param {string} [props.title='No budget allocations found']
 * @param {string} [props.description]
 * @param {React.ReactNode} [props.action]
 */
export default function EmptyState({
  icon: Icon = FileX,
  title = 'No budget allocations found',
  description = 'Try adjusting your search filters or create a new departmental allocation.',
  action,
}) {
  return (
    <div className="py-14 px-6 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/40 flex flex-col items-center justify-center">
      <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-white tracking-tight">{title}</h3>
      {description && (
        <p className="text-xs text-slate-400 mt-1.5 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
