import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react'

import { useFiscalYear } from '@/store/FiscalYearContext'
import { useDepartments } from '@/api/hooks/useDepartments'
import { useAllocations, useDeleteAllocation } from '@/api/hooks/useAllocations'
import { formatCurrency, formatPercent } from '@/lib/utils'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import EmptyState from '@/components/EmptyState'
import AllocationFormModal from '@/components/AllocationFormModal'

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase()
  if (s === 'approved') {
    return (
      <Badge variant="outline" className="border-accent-emerald/40 text-accent-emerald bg-accent-emerald/10 text-xs font-medium">
        Approved
      </Badge>
    )
  }
  if (s === 'revised') {
    return (
      <Badge variant="outline" className="border-accent-blue/40 text-accent-blue bg-accent-blue/10 text-xs font-medium">
        Revised
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-accent-amber/40 text-accent-amber bg-accent-amber/10 text-xs font-medium">
      Draft
    </Badge>
  )
}

export default function BudgetsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { activeFiscalYear } = useFiscalYear()
  const { data: departments = [] } = useDepartments()

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAllocation, setEditingAllocation] = useState(null)

  const deleteMutation = useDeleteAllocation()

  // Filter params synchronized with URL search params
  const searchQuery = searchParams.get('search') || ''
  const departmentFilter = searchParams.get('department') || 'all'
  const statusFilter = searchParams.get('status') || 'all'
  const ordering = searchParams.get('ordering') || '-allocated_amount'

  const updateParam = (key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (!value || value === 'all') {
        next.delete(key)
      } else {
        next.set(key, value)
      }
      return next
    })
  }

  // Construct query parameters for allocations API
  const queryParams = useMemo(() => {
    const params = {}
    if (activeFiscalYear?.id) {
      params.fiscal_year = activeFiscalYear.id
    }
    if (searchQuery.trim()) {
      params.search = searchQuery.trim()
    }
    if (departmentFilter !== 'all') {
      params.department = departmentFilter
    }
    if (statusFilter !== 'all') {
      params.status = statusFilter
    }
    if (ordering) {
      params.ordering = ordering
    }
    return params
  }, [activeFiscalYear, searchQuery, departmentFilter, statusFilter, ordering])

  const { data: allocationsResponse, isLoading } = useAllocations(queryParams)

  const allocations = useMemo(() => {
    if (!allocationsResponse) return []
    return Array.isArray(allocationsResponse)
      ? allocationsResponse
      : allocationsResponse.results || []
  }, [allocationsResponse])

  const handleCreate = () => {
    setEditingAllocation(null)
    setModalOpen(true)
  }

  const handleEdit = (alloc) => {
    setEditingAllocation(alloc)
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this allocation?')) {
      try {
        await deleteMutation.mutateAsync(id)
      } catch (err) {
        alert(err.response?.data?.detail || 'Failed to delete allocation')
      }
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Budget Allocations</span>
            {activeFiscalYear?.label && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal">
                {activeFiscalYear.label}
              </span>
            )}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Manage departmental allocations, review requested vs allocated amounts, and track spending
          </p>
        </div>

        <Button
          onClick={handleCreate}
          className="bg-accent-blue hover:bg-blue-600 text-white font-medium text-xs h-9 px-4 inline-flex items-center gap-1.5 shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Allocation</span>
        </Button>
      </div>

      {/* Toolbar Filter Row */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            type="text"
            placeholder="Search by department name or code..."
            value={searchQuery}
            onChange={(e) => updateParam('search', e.target.value)}
            className="pl-9 bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 text-xs h-9 focus-visible:ring-accent-blue"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Department Filter */}
          <Select
            value={departmentFilter}
            onValueChange={(val) => updateParam('department', val)}
          >
            <SelectTrigger className="w-[180px] bg-slate-950 border-slate-800 text-white text-xs h-9 focus:ring-accent-blue">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-white max-h-56">
              <SelectItem value="all" className="text-xs text-slate-200">
                All Departments
              </SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={String(d.id)} className="text-xs text-slate-200">
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select
            value={statusFilter}
            onValueChange={(val) => updateParam('status', val)}
          >
            <SelectTrigger className="w-[140px] bg-slate-950 border-slate-800 text-white text-xs h-9 focus:ring-accent-blue">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-white">
              <SelectItem value="all" className="text-xs text-slate-200">
                All Statuses
              </SelectItem>
              <SelectItem value="draft" className="text-xs text-slate-200">
                Draft
              </SelectItem>
              <SelectItem value="revised" className="text-xs text-slate-200">
                Revised
              </SelectItem>
              <SelectItem value="approved" className="text-xs text-slate-200">
                Approved
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Ordering Toggle */}
          <Select
            value={ordering}
            onValueChange={(val) => updateParam('ordering', val)}
          >
            <SelectTrigger className="w-[190px] bg-slate-950 border-slate-800 text-white text-xs h-9 focus:ring-accent-blue">
              <div className="flex items-center gap-1.5 truncate">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <SelectValue placeholder="Order by..." />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-white">
              <SelectItem value="-allocated_amount" className="text-xs text-slate-200">
                Allocated (Highest first)
              </SelectItem>
              <SelectItem value="allocated_amount" className="text-xs text-slate-200">
                Allocated (Lowest first)
              </SelectItem>
              <SelectItem value="-spent_amount" className="text-xs text-slate-200">
                Spent (Highest first)
              </SelectItem>
              <SelectItem value="department__name" className="text-xs text-slate-200">
                Department Name (A-Z)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main DataTable Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-6 space-y-3.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-slate-800/80 rounded" />
            ))}
          </div>
        ) : allocations.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No budget allocations found"
              description="No allocations match your active filters. Try modifying your search or add a new record."
              action={
                <Button
                  onClick={handleCreate}
                  className="bg-accent-blue hover:bg-blue-600 text-white text-xs h-8 px-4"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>Add First Allocation</span>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-950/70 border-b border-slate-800">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-xs text-slate-400 font-semibold py-3.5">Department Name</TableHead>
                  <TableHead className="text-xs text-slate-400 font-semibold py-3.5">Fiscal Year</TableHead>
                  <TableHead className="text-xs text-slate-400 font-semibold py-3.5 text-right">Requested</TableHead>
                  <TableHead className="text-xs text-slate-400 font-semibold py-3.5 text-right">Allocated</TableHead>
                  <TableHead className="text-xs text-slate-400 font-semibold py-3.5 text-right">Spent</TableHead>
                  <TableHead className="text-xs text-slate-400 font-semibold py-3.5 text-right">Utilization %</TableHead>
                  <TableHead className="text-xs text-slate-400 font-semibold py-3.5 text-center">Status</TableHead>
                  <TableHead className="text-xs text-slate-400 font-semibold py-3.5 text-center">Approved By</TableHead>
                  <TableHead className="text-xs text-slate-400 font-semibold py-3.5 text-right w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocations.map((alloc) => {
                  const deptId = alloc.department || alloc.department_detail?.id || alloc.id
                  const deptName = alloc.department_name || alloc.department_detail?.name || 'Department'
                  const fyLabel = alloc.fiscal_year_label || (alloc.fiscal_year_detail?.year ? `FY ${alloc.fiscal_year_detail.year}` : '—')

                  const utilRate = alloc.utilization_rate !== null && alloc.utilization_rate !== undefined
                    ? alloc.utilization_rate
                    : Number(alloc.allocated_amount) > 0
                    ? Number(alloc.spent_amount) / Number(alloc.allocated_amount)
                    : 0

                  return (
                    <TableRow
                      key={alloc.id}
                      className="border-slate-800/70 hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Department */}
                      <TableCell className="py-3.5 font-medium text-sm text-white">
                        <Link
                          to={`/budgets/${deptId}`}
                          className="hover:text-accent-blue transition-colors flex items-center gap-1.5"
                        >
                          <span>{deptName}</span>
                          <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-accent-blue transition-opacity" />
                        </Link>
                      </TableCell>

                      {/* Fiscal Year */}
                      <TableCell className="py-3.5 text-xs text-slate-400">
                        {fyLabel}
                      </TableCell>

                      {/* Requested */}
                      <TableCell className="py-3.5 text-right text-xs text-slate-300 font-mono tabular-nums">
                        {formatCurrency(alloc.requested_amount)}
                      </TableCell>

                      {/* Allocated */}
                      <TableCell className="py-3.5 text-right text-sm text-slate-100 font-mono font-medium tabular-nums">
                        {formatCurrency(alloc.allocated_amount)}
                      </TableCell>

                      {/* Spent */}
                      <TableCell className="py-3.5 text-right text-xs text-slate-300 font-mono tabular-nums">
                        {formatCurrency(alloc.spent_amount)}
                      </TableCell>

                      {/* Utilization % */}
                      <TableCell className="py-3.5 text-right text-xs font-mono tabular-nums">
                        <span
                          className={
                            utilRate > 0.95
                              ? 'text-accent-red font-semibold'
                              : utilRate >= 0.8
                              ? 'text-accent-amber font-semibold'
                              : 'text-accent-emerald font-semibold'
                          }
                        >
                          {formatPercent(utilRate)}
                        </span>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-3.5 text-center">
                        <StatusBadge status={alloc.status} />
                      </TableCell>

                      {/* Approved By */}
                      <TableCell className="py-3.5 text-center text-xs text-slate-400">
                        {alloc.approved_by_username || '—'}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(alloc)}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Edit allocation"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800 text-white w-40">
                              <DropdownMenuItem
                                onClick={() => handleEdit(alloc)}
                                className="cursor-pointer text-xs focus:bg-slate-800 focus:text-white py-1.5"
                              >
                                <Pencil className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                <span>Edit Record</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-slate-800" />
                              <DropdownMenuItem
                                onClick={() => handleDelete(alloc.id)}
                                className="cursor-pointer text-xs text-accent-red focus:bg-accent-red/10 focus:text-accent-red py-1.5"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                <span>Delete Record</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* Allocation Create / Edit Dialog Modal */}
      <AllocationFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        allocation={editingAllocation}
        defaultFiscalYearId={activeFiscalYear?.id}
      />
    </div>
  )
}
