import { useLocation, Link, useNavigate } from 'react-router-dom'
import { Bell, User, LogOut } from 'lucide-react'
import { useAuth } from '@/store/AuthContext'
import { useFiscalYear } from '@/store/FiscalYearContext'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const routeTitles = {
  '/dashboard': 'Dashboard',
  '/budgets': 'Budget Allocations',
  '/analytics': 'Performance Analytics',
  '/optimizer': 'Budget Reallocation Optimizer',
  '/admin/users': 'User Administration',
  '/admin/import': 'Data Import & Ingestion',
}

export default function Topbar({ title }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { fiscalYears, activeFiscalYear, setActiveFiscalYear, isLoading } = useFiscalYear()

  // Determine current page title
  const currentTitle =
    title ||
    routeTitles[location.pathname] ||
    (location.pathname.startsWith('/budgets/')
      ? 'Department Budget Detail'
      : 'Government Budget Analyzer')

  // Generate breadcrumb trail
  const pathParts = location.pathname.split('/').filter(Boolean)
  const isDashboardOnly = location.pathname === '/dashboard' || pathParts.length === 0
  const breadcrumbs = isDashboardOnly
    ? [{ label: 'Dashboard', path: '/dashboard' }]
    : [
        { label: 'Dashboard', path: '/dashboard' },
        ...pathParts
          .filter((p) => p !== 'dashboard')
          .map((part, index, arr) => {
            const url = `/${arr.slice(0, index + 1).join('/')}`
            let label = part.charAt(0).toUpperCase() + part.slice(1)
            if (part === 'users') label = 'Users'
            if (part === 'import') label = 'Import'
            if (part === 'budgets' && index === 0) label = 'Budgets'
            return { label, path: url }
          }),
      ]

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

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0 z-10">
      {/* Left: Page Title + Breadcrumbs */}
      <div className="flex flex-col justify-center min-w-0">
        <h1 className="text-lg font-bold text-white truncate tracking-tight">
          {currentTitle}
        </h1>
        <nav aria-label="Breadcrumb" className="flex items-center space-x-1 text-xs text-slate-400">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1
            return (
              <span key={crumb.path} className="flex items-center space-x-1">
                {idx > 0 && <span className="text-slate-600">/</span>}
                {isLast ? (
                  <span className="text-slate-300 font-medium">{crumb.label}</span>
                ) : (
                  <Link
                    to={crumb.path}
                    className="hover:text-slate-200 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                )}
              </span>
            )
          })}
        </nav>
      </div>

      {/* Center: FiscalYearSelector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 font-medium hidden md:inline">
          Fiscal Year:
        </span>
        <Select
          value={activeFiscalYear?.id ? String(activeFiscalYear.id) : ''}
          onValueChange={(val) => setActiveFiscalYear(val)}
        >
          <SelectTrigger className="w-[170px] h-9 bg-slate-900 border-slate-800 text-white text-xs focus:ring-accent-blue focus:ring-1">
            <SelectValue placeholder={isLoading ? 'Loading FY...' : 'Select FY'} />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-800 text-white">
            {fiscalYears.map((fy) => (
              <SelectItem
                key={fy.id}
                value={String(fy.id)}
                className="text-xs text-slate-200 focus:bg-slate-800 focus:text-white"
              >
                <div className="flex items-center justify-between w-full gap-2">
                  <span>{fy.label || `FY ${fy.year}`}</span>
                  {fy.is_active && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-emerald/20 text-accent-emerald font-medium ml-1">
                      Active
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Right: Notifications & Profile Dropdown */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <button
          type="button"
          aria-label="View notifications"
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors relative"
        >
          <Bell className="w-4 h-4 text-slate-400" />
        </button>

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 p-0.5 rounded-full hover:ring-2 hover:ring-slate-700 focus:outline-none focus:ring-2 focus:ring-accent-blue transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-white font-semibold text-xs flex items-center justify-center">
                {getInitials()}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-52 bg-slate-900 border-slate-800 text-white p-1 shadow-xl"
          >
            <DropdownMenuLabel className="font-normal text-xs text-slate-400 py-2 px-3">
              Signed in as{' '}
              <p className="font-semibold text-white truncate text-xs mt-0.5">
                {user?.username || user?.email}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem
              onClick={() => navigate('/admin/users')}
              className="cursor-pointer text-xs text-slate-200 focus:bg-slate-800 focus:text-white py-2"
            >
              <User className="w-4 h-4 mr-2 text-slate-400" />
              <span>User Profile</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem
              onClick={logout}
              className="cursor-pointer text-xs text-accent-red focus:bg-accent-red/10 focus:text-accent-red py-2"
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
