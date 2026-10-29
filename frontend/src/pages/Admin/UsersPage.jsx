import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  UserPlus,
  Search,
  Check,
  ChevronDown,
  UserX,
  UserCheck,
  Loader2,
  AlertTriangle,
} from 'lucide-react'

import { useUsers, useInviteUser, useUpdateUser } from '@/api/hooks/useUsers'
import { useDepartments } from '@/api/hooks/useDepartments'
import { useAuth } from '@/store/AuthContext'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import EmptyState from '@/components/EmptyState'
import { cn } from '@/lib/utils'

/**
 * Inline Role Badge with Popover for one-click role switching.
 */
function RoleBadgePopover({ user, onRoleChange, disabled }) {
  const [open, setOpen] = useState(false)
  const role = (user.role || 'viewer').toLowerCase()

  const getBadgeStyle = (r) => {
    if (r === 'admin') {
      return 'bg-accent-violet/15 text-accent-violet border-accent-violet/30 hover:bg-accent-violet/25'
    }
    if (r === 'analyst') {
      return 'bg-accent-blue/15 text-accent-blue border-accent-blue/30 hover:bg-accent-blue/25'
    }
    return 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700/80'
  }

  const handleSelectRole = (newRole) => {
    if (newRole !== user.role) {
      onRoleChange(user.id, newRole)
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`Change role for ${user.username || user.email}`}
          title="Click to change role"
          className="inline-flex items-center gap-1 focus:outline-none group"
        >
          <Badge
            variant="outline"
            className={cn(
              'text-xs font-medium cursor-pointer transition-all capitalize px-2.5 py-0.5 flex items-center gap-1',
              getBadgeStyle(role),
              disabled && 'cursor-not-allowed opacity-60'
            )}
          >
            <span>{role}</span>
            <ChevronDown className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-44 p-1.5 bg-slate-900 border-slate-800 text-slate-200 shadow-xl z-50"
        align="start"
      >
        <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1">
          Select Role
        </div>
        <div className="space-y-0.5">
          {[
            { id: 'admin', label: 'Admin', desc: 'Full System Control' },
            { id: 'analyst', label: 'Analyst', desc: 'Edits & Optimization' },
            { id: 'viewer', label: 'Viewer', desc: 'Read-only Access' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Select ${item.label} role`}
              onClick={() => handleSelectRole(item.id)}
              className={cn(
                'w-full flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md transition-colors text-left',
                user.role === item.id
                  ? 'bg-slate-800 text-white font-medium'
                  : 'hover:bg-slate-800/60 text-slate-300'
              )}
            >
              <div>
                <span className="capitalize">{item.label}</span>
                <span className="block text-[10px] text-slate-500 font-normal">{item.desc}</span>
              </div>
              {user.role === item.id && <Check className="h-3.5 w-3.5 text-accent-blue shrink-0" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const { data: usersData, isLoading: isUsersLoading, error: usersError } = useUsers()
  const { data: departmentsData } = useDepartments()

  // Local search and filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  // Invite Dialog state
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'analyst',
    department: '',
    first_name: '',
    last_name: '',
  })
  const [inviteError, setInviteError] = useState(null)

  // Mutations
  const inviteMutation = useInviteUser({
    onSuccess: () => {
      setIsInviteOpen(false)
      setInviteForm({
        email: '',
        role: 'analyst',
        department: '',
        first_name: '',
        last_name: '',
      })
      setInviteError(null)
    },
    onError: (err) => {
      const data = err?.response?.data
      const message =
        data?.email?.[0] ||
        data?.detail ||
        err?.message ||
        'Failed to send user invitation.'
      setInviteError(message)
    },
  })

  const updateMutation = useUpdateUser()

  const departments = useMemo(() => {
    if (!departmentsData) return []
    return Array.isArray(departmentsData) ? departmentsData : departmentsData.results || []
  }, [departmentsData])

  const usersList = useMemo(() => {
    if (!usersData) return []
    return Array.isArray(usersData) ? usersData : usersData.results || []
  }, [usersData])

  // Filtered users
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const fullName = `${u.first_name || ''} ${u.last_name || ''} ${u.username || ''}`.toLowerCase()
      const email = (u.email || '').toLowerCase()
      const matchesSearch =
        fullName.includes(searchQuery.toLowerCase()) || email.includes(searchQuery.toLowerCase())
      const matchesRole = roleFilter === 'all' || (u.role || '').toLowerCase() === roleFilter.toLowerCase()
      return matchesSearch && matchesRole
    })
  }, [usersList, searchQuery, roleFilter])

  // Handlers
  const handleRoleChange = (userId, newRole) => {
    updateMutation.mutate({
      id: userId,
      data: { role: newRole },
    })
  }

  const handleToggleActive = (user) => {
    const nextActive = !user.is_active
    updateMutation.mutate({
      id: user.id,
      data: { is_active: nextActive },
    })
  }

  const handleInviteSubmit = (e) => {
    e.preventDefault()
    if (!inviteForm.email) return

    const payload = {
      email: inviteForm.email.trim(),
      role: inviteForm.role,
      ...(inviteForm.department && inviteForm.department !== 'none'
        ? { department: Number(inviteForm.department) }
        : {}),
      ...(inviteForm.first_name ? { first_name: inviteForm.first_name.trim() } : {}),
      ...(inviteForm.last_name ? { last_name: inviteForm.last_name.trim() } : {}),
    }

    inviteMutation.mutate(payload)
  }

  // Lookup helper for department name
  const getDepartmentLabel = (u) => {
    if (u.department_name) return u.department_name
    if (u.department) {
      const match = departments.find((d) => d.id === u.department)
      if (match) return match.name
    }
    return '—'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="space-y-6 pb-12"
    >
      {/* Header & Invite Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Users className="h-6 w-6 text-accent-blue" />
            <span>User Management</span>
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Manage system access, assign roles (Admin, Analyst, Viewer), and link departmental staff.
          </p>
        </div>

        {/* Invite User Dialog */}
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent-blue hover:bg-accent-blue/90 text-white text-xs h-9 px-4 flex items-center gap-2 shadow-sm font-medium self-start sm:self-auto">
              <UserPlus className="h-4 w-4" />
              <span>Invite User</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 sm:max-w-md shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-white flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-accent-blue" />
                <span>Invite New User</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Grant budget dashboard permissions. The invitee can be provisioned with an assigned
                role and department.
              </DialogDescription>
            </DialogHeader>

            {inviteError && (
              <Alert className="border-destructive/40 bg-destructive/10 text-destructive text-xs p-3">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription>{inviteError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleInviteSubmit} className="space-y-3.5 py-1">
              {/* Email Address */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Email Address <span className="text-accent-red">*</span>
                </label>
                <Input
                  type="email"
                  required
                  placeholder="analyst@finance.gov"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="bg-slate-950 border-slate-800 text-white text-xs focus:ring-accent-blue"
                />
              </div>

              {/* Name Fields (Optional) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">First Name</label>
                  <Input
                    placeholder="Prakhar"
                    value={inviteForm.first_name}
                    onChange={(e) =>
                      setInviteForm((prev) => ({ ...prev, first_name: e.target.value }))
                    }
                    className="bg-slate-950 border-slate-800 text-white text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Last Name</label>
                  <Input
                    placeholder="Sharma"
                    value={inviteForm.last_name}
                    onChange={(e) =>
                      setInviteForm((prev) => ({ ...prev, last_name: e.target.value }))
                    }
                    className="bg-slate-950 border-slate-800 text-white text-xs"
                  />
                </div>
              </div>

              {/* Role Select */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Assigned Role</label>
                <Select
                  value={inviteForm.role}
                  onValueChange={(val) => setInviteForm((prev) => ({ ...prev, role: val }))}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="analyst" className="text-xs cursor-pointer">
                      Budget Analyst (Can run optimizations &amp; edit allocations)
                    </SelectItem>
                    <SelectItem value="viewer" className="text-xs cursor-pointer">
                      Viewer (Read-only analytics access)
                    </SelectItem>
                    <SelectItem value="admin" className="text-xs cursor-pointer">
                      Administrator (Full system management)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Department Select (Optional) */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Associated Department <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <Select
                  value={inviteForm.department}
                  onValueChange={(val) =>
                    setInviteForm((prev) => ({ ...prev, department: val }))
                  }
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs">
                    <SelectValue placeholder="None / Organization-wide" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200 max-h-56">
                    <SelectItem value="none" className="text-xs cursor-pointer">
                      None (Organization-wide)
                    </SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={String(dept.id)} className="text-xs cursor-pointer">
                        {dept.name} {dept.code ? `(${dept.code})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsInviteOpen(false)}
                  className="bg-slate-900 border-slate-800 text-slate-300 text-xs h-9 hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="bg-accent-blue hover:bg-accent-blue/90 text-white text-xs h-9 px-4 flex items-center gap-1.5 font-medium"
                >
                  {inviteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Send Invitation</span>
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <Input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-950 border-slate-800 text-white text-xs h-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 hidden sm:inline">Role Filter:</span>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-36 h-9 bg-slate-950 border-slate-800 text-slate-200 text-xs">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="all" className="text-xs">All Roles</SelectItem>
              <SelectItem value="admin" className="text-xs">Administrators</SelectItem>
              <SelectItem value="analyst" className="text-xs">Analysts</SelectItem>
              <SelectItem value="viewer" className="text-xs">Viewers</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Users DataTable */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {isUsersLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full bg-slate-800" />
            ))}
          </div>
        ) : usersError ? (
          <div className="p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2 opacity-80" />
            <p className="text-sm font-medium text-white">Error Loading Users</p>
            <p className="text-xs text-slate-400 mt-1">
              {usersError?.response?.data?.detail || usersError?.message || 'Failed to fetch user list.'}
            </p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users found"
            description="No users match your active search query or role filter."
            className="my-4 border-none bg-transparent"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
            <TableHeader className="bg-slate-950/60 border-b border-slate-800">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400 text-xs font-semibold">Full Name</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold">Email</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold">Role</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold">Department</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold">Joined Date</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-800/60">
              {filteredUsers.map((u) => {
                const fullName =
                  `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username
                const joinedStr = u.date_joined
                  ? new Date(u.date_joined).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '—'
                const isSelf = currentUser?.id === u.id
                const isActive = u.is_active !== false

                return (
                  <TableRow
                    key={u.id}
                    className={cn(
                      'border-slate-800/60 hover:bg-slate-800/40 transition-colors',
                      !isActive && 'opacity-60 bg-slate-950/30'
                    )}
                  >
                    {/* Full Name & Username */}
                    <TableCell className="font-medium text-white text-xs py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 font-mono text-xs flex items-center justify-center font-bold shrink-0 border border-slate-700">
                          {(fullName[0] || 'U').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-200">
                            {fullName}
                            {isSelf && (
                              <span className="ml-1.5 text-[10px] text-accent-blue bg-accent-blue/10 px-1.5 py-0.2 rounded border border-accent-blue/20">
                                You
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono truncate">
                            @{u.username}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Email */}
                    <TableCell className="text-slate-300 text-xs font-mono">
                      {u.email || '—'}
                    </TableCell>

                    {/* Role (Inline Role Badge with Popover) */}
                    <TableCell className="text-xs">
                      <RoleBadgePopover
                        user={u}
                        onRoleChange={handleRoleChange}
                        disabled={updateMutation.isPending}
                      />
                    </TableCell>

                    {/* Department */}
                    <TableCell className="text-slate-300 text-xs">
                      <span className="truncate max-w-[140px] block">
                        {getDepartmentLabel(u)}
                      </span>
                    </TableCell>

                    {/* Joined Date */}
                    <TableCell className="text-slate-400 text-xs whitespace-nowrap font-mono text-[11px]">
                      {joinedStr}
                    </TableCell>

                    {/* Actions: Edit Role & Deactivate */}
                    <TableCell className="text-right text-xs">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Role Change Trigger Button */}
                        <RoleBadgePopover
                          user={u}
                          onRoleChange={handleRoleChange}
                          disabled={updateMutation.isPending}
                        />

                        {/* Deactivate / Reactivate Action */}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isSelf || updateMutation.isPending}
                          onClick={() => handleToggleActive(u)}
                          title={
                            isSelf
                              ? 'Cannot deactivate yourself'
                              : isActive
                              ? 'Deactivate user'
                              : 'Reactivate user'
                          }
                          className={cn(
                            'h-7 px-2 text-xs',
                            isActive
                              ? 'text-slate-400 hover:text-accent-red hover:bg-accent-red/10'
                              : 'text-accent-emerald hover:bg-accent-emerald/10'
                          )}
                        >
                          {isActive ? (
                            <span className="flex items-center gap-1">
                              <UserX className="h-3.5 w-3.5" />
                              <span className="hidden md:inline">Deactivate</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <UserCheck className="h-3.5 w-3.5" />
                              <span className="hidden md:inline">Activate</span>
                            </span>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
      </div>
    </motion.div>
  )
}
