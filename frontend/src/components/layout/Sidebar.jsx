import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Wallet,
  BarChart3,
  Sliders,
  ShieldCheck,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Landmark,
} from 'lucide-react'
import { useAuth } from '@/store/AuthContext'
import { cn } from '@/lib/utils'

export default function Sidebar({ isCollapsed: externalCollapsed, onToggle }) {
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const isCollapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed
  const setIsCollapsed = onToggle || setInternalCollapsed

  const { user, logout } = useAuth()

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Budgets', path: '/budgets', icon: Wallet },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
    { label: 'Optimizer', path: '/optimizer', icon: Sliders },
  ]

  if (user?.role === 'admin') {
    navItems.push({ label: 'Admin', path: '/admin/users', icon: ShieldCheck })
  }

  const getInitials = () => {
    if (!user) return 'U'
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    }
    if (user.first_name) {
      return user.first_name.slice(0, 2).toUpperCase()
    }
    if (user.username) {
      return user.username.slice(0, 2).toUpperCase()
    }
    if (user.email) {
      return user.email.slice(0, 2).toUpperCase()
    }
    return 'U'
  }

  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user?.username || user?.email || 'User'

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 64 : 240 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="h-screen bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none z-20 relative overflow-hidden"
    >
      {/* Top Logo Section */}
      <div>
        <div className="h-16 flex items-center px-4 border-b border-slate-800/80 gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 text-accent-blue shrink-0">
            <Landmark className="w-5 h-5 text-accent-blue" />
          </div>

          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="whitespace-nowrap overflow-hidden"
              >
                <span className="font-bold text-lg text-white tracking-tight">BudgetIQ</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation Items */}
        <nav className="p-2 space-y-1 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                title={isCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border-l-4',
                    isActive
                      ? 'border-accent-blue bg-slate-800 text-accent-blue font-semibold'
                      : 'border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200',
                    isCollapsed && 'justify-center px-2'
                  )
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                      className="whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </NavLink>
            )
          })}
        </nav>
      </div>

      {/* Bottom Section: User Info + Logout + Collapse Toggle */}
      <div className="p-2 border-t border-slate-800/80 space-y-2">
        {/* User Card */}
        <div
          className={cn(
            'flex items-center gap-2.5 p-2 rounded-lg bg-slate-900/60',
            isCollapsed && 'justify-center p-1'
          )}
        >
          {/* Avatar with initials */}
          <div
            className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-white font-semibold text-xs flex items-center justify-center shrink-0"
            title={displayName}
          >
            {getInitials()}
          </div>

          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 min-w-0 overflow-hidden"
              >
                <p className="text-sm font-medium text-white truncate">{displayName}</p>
                <p className="text-xs text-slate-400 capitalize truncate">
                  {user?.role || 'User'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Logout button */}
          <button
            type="button"
            onClick={logout}
            title="Log out"
            className="p-1.5 text-slate-400 hover:text-accent-red hover:bg-slate-800 rounded-md transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Collapse toggle button */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-md transition-colors',
            isCollapsed && 'justify-center px-1'
          )}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  )
}
