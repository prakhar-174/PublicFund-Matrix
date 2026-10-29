import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

import { useDepartments } from '@/api/hooks/useDepartments'
import { useFiscalYears } from '@/api/hooks/useFiscalYears'
import { useCreateAllocation, useUpdateAllocation } from '@/api/hooks/useAllocations'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const allocationSchema = z.object({
  department: z.coerce
    .number({ invalid_type_error: 'Department is required' })
    .min(1, 'Department is required'),
  fiscal_year: z.coerce
    .number({ invalid_type_error: 'Fiscal year is required' })
    .min(1, 'Fiscal year is required'),
  requested_amount: z.coerce
    .number({ invalid_type_error: 'Requested amount is required' })
    .positive('Requested amount must be greater than 0'),
  allocated_amount: z.coerce
    .number({ invalid_type_error: 'Allocated amount is required' })
    .positive('Allocated amount must be greater than 0'),
  status: z.enum(['draft', 'approved', 'revised'], {
    required_error: 'Status is required',
  }),
})

export default function AllocationFormModal({
  open,
  onOpenChange,
  allocation = null,
  defaultFiscalYearId = null,
}) {
  const isEditing = Boolean(allocation?.id)
  const [serverError, setServerError] = useState('')

  const { data: departments = [], isLoading: isDeptLoading } = useDepartments()
  const { data: fiscalYears = [], isLoading: isFyLoading } = useFiscalYears()

  const createMutation = useCreateAllocation()
  const updateMutation = useUpdateAllocation()
  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(allocationSchema),
    defaultValues: {
      department: '',
      fiscal_year: defaultFiscalYearId ? String(defaultFiscalYearId) : '',
      requested_amount: '',
      allocated_amount: '',
      status: 'draft',
    },
  })

  // Synchronize initial form values whenever the dialog opens or allocation changes
  useEffect(() => {
    if (open) {
      if (allocation) {
        reset({
          department: String(allocation.department || allocation.department_detail?.id || ''),
          fiscal_year: String(allocation.fiscal_year || allocation.fiscal_year_detail?.id || ''),
          requested_amount: String(allocation.requested_amount || ''),
          allocated_amount: String(allocation.allocated_amount || ''),
          status: allocation.status || 'draft',
        })
      } else {
        reset({
          department: '',
          fiscal_year: defaultFiscalYearId ? String(defaultFiscalYearId) : '',
          requested_amount: '',
          allocated_amount: '',
          status: 'draft',
        })
      }
    }
  }, [open, allocation, defaultFiscalYearId, reset])

  const handleOpenChange = (isOpen) => {
    if (!isOpen) {
      setServerError('')
    }
    onOpenChange(isOpen)
  }

  const onSubmit = async (values) => {
    setServerError('')
    try {
      const payload = {
        department: Number(values.department),
        fiscal_year: Number(values.fiscal_year),
        requested_amount: Number(values.requested_amount),
        allocated_amount: Number(values.allocated_amount),
        status: values.status,
      }

      if (isEditing) {
        await updateMutation.mutateAsync({ id: allocation.id, data: payload })
      } else {
        await createMutation.mutateAsync(payload)
      }

      onOpenChange(false)
    } catch (err) {
      const errDetail =
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        (err.response?.data && typeof err.response.data === 'object'
          ? Object.entries(err.response.data)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
              .join('; ')
          : 'Failed to save budget allocation.')
      setServerError(errDetail)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-lg p-0 overflow-hidden">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="p-6"
        >
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold text-white tracking-tight">
              {isEditing ? 'Edit Budget Allocation' : 'New Budget Allocation'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              {isEditing
                ? 'Update departmental budget figures and approval status.'
                : 'Assign funding for a government department within a fiscal year.'}
            </DialogDescription>
          </DialogHeader>

          {serverError && (
            <div className="mb-4 p-3 rounded-lg bg-accent-red/10 border border-accent-red/20 text-accent-red text-xs font-medium">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Department Field */}
            <div className="space-y-1.5">
              <Label htmlFor="department" className="text-xs font-medium text-slate-300">
                Department
              </Label>
              <Controller
                name="department"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ? String(field.value) : ''}
                    onValueChange={field.onChange}
                    disabled={isDeptLoading}
                  >
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs h-9 focus:ring-accent-blue">
                      <SelectValue placeholder={isDeptLoading ? 'Loading departments...' : 'Select Department'} />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white max-h-56">
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={String(dept.id)} className="text-xs text-slate-200">
                          {dept.name} ({dept.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.department && (
                <p className="text-[11px] text-accent-red">{errors.department.message}</p>
              )}
            </div>

            {/* Fiscal Year Field */}
            <div className="space-y-1.5">
              <Label htmlFor="fiscal_year" className="text-xs font-medium text-slate-300">
                Fiscal Year
              </Label>
              <Controller
                name="fiscal_year"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ? String(field.value) : ''}
                    onValueChange={field.onChange}
                    disabled={isFyLoading}
                  >
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs h-9 focus:ring-accent-blue">
                      <SelectValue placeholder={isFyLoading ? 'Loading years...' : 'Select Fiscal Year'} />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white max-h-56">
                      {fiscalYears.map((fy) => (
                        <SelectItem key={fy.id} value={String(fy.id)} className="text-xs text-slate-200">
                          {fy.label || `FY ${fy.year}`} {fy.is_active ? '(Active)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.fiscal_year && (
                <p className="text-[11px] text-accent-red">{errors.fiscal_year.message}</p>
              )}
            </div>

            {/* Requested & Allocated Amounts Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="requested_amount" className="text-xs font-medium text-slate-300">
                  Requested Amount (₹)
                </Label>
                <Input
                  id="requested_amount"
                  type="number"
                  step="any"
                  placeholder="e.g. 50000000"
                  className="bg-slate-950 border-slate-800 text-white text-xs h-9 placeholder:text-slate-500 focus-visible:ring-accent-blue font-mono"
                  {...register('requested_amount')}
                />
                {errors.requested_amount && (
                  <p className="text-[11px] text-accent-red">{errors.requested_amount.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="allocated_amount" className="text-xs font-medium text-slate-300">
                  Allocated Amount (₹)
                </Label>
                <Input
                  id="allocated_amount"
                  type="number"
                  step="any"
                  placeholder="e.g. 45000000"
                  className="bg-slate-950 border-slate-800 text-white text-xs h-9 placeholder:text-slate-500 focus-visible:ring-accent-blue font-mono"
                  {...register('allocated_amount')}
                />
                {errors.allocated_amount && (
                  <p className="text-[11px] text-accent-red">{errors.allocated_amount.message}</p>
                )}
              </div>
            </div>

            {/* Status Select */}
            <div className="space-y-1.5">
              <Label htmlFor="status" className="text-xs font-medium text-slate-300">
                Allocation Status
              </Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs h-9 focus:ring-accent-blue">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                      <SelectItem value="draft" className="text-xs text-slate-200">
                        Draft (Initial Proposal)
                      </SelectItem>
                      <SelectItem value="revised" className="text-xs text-slate-200">
                        Revised (Under Committee Review)
                      </SelectItem>
                      <SelectItem value="approved" className="text-xs text-slate-200">
                        Approved (Official Allocation)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.status && (
                <p className="text-[11px] text-accent-red">{errors.status.message}</p>
              )}
            </div>

            {/* Modal Action Buttons */}
            <DialogFooter className="pt-4 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-slate-800 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-accent-blue hover:bg-blue-600 text-white font-medium text-xs h-9 px-5 shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : isEditing ? (
                  'Update Allocation'
                ) : (
                  'Create Allocation'
                )}
              </Button>
            </DialogFooter>
          </form>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
