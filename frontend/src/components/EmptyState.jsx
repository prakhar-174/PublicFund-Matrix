import React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Standard EmptyState component for consistent empty data views across all pages.
 * @param {Object} props
 * @param {import('lucide-react').LucideIcon} [props.icon] - Lucide icon component (renders at 48px)
 * @param {string} props.title - Empty state heading
 * @param {string|React.ReactNode} props.description - Explanatory message
 * @param {Object|React.ReactNode} [props.action] - Optional primary action { label, onClick, icon } or custom button element
 * @param {string} [props.className] - Additional styling classes
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-800 bg-slate-900/40 p-10 text-center flex flex-col items-center justify-center min-h-[300px] shadow-sm select-none',
        className
      )}
    >
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mb-3.5 text-slate-400">
          <Icon className="w-12 h-12 text-slate-400" strokeWidth={1.5} />
        </div>
      )}

      {title && (
        <h3 className="text-base font-semibold text-white tracking-tight">{title}</h3>
      )}

      {description && (
        <p className="text-xs text-slate-400 max-w-sm mt-1.5 leading-relaxed">
          {description}
        </p>
      )}

      {action && (
        <div className="mt-4">
          {React.isValidElement(action) ? (
            action
          ) : typeof action === 'object' && action.label && action.onClick ? (
            <Button
              onClick={action.onClick}
              size="sm"
              className="bg-accent-blue hover:bg-accent-blue/90 text-white text-xs h-8 px-4 flex items-center gap-1.5 font-medium"
            >
              {action.icon && <action.icon className="h-3.5 w-3.5" />}
              <span>{action.label}</span>
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}
