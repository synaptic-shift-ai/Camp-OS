'use client'

/**
 * Fees Configuration Settings Component
 *
 * Allows property owners to configure:
 * - Tax rates and names
 * - User-defined fees (replaces legacy cleaning, pet, service, extra guest fees)
 *
 * @module components/dashboard/settings/fees-settings
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Pencil, Trash2, GripVertical } from 'lucide-react'
import type { PricingConfig, UserDefinedFee, UserDefinedFeeType, FeeTriggerType } from '@/lib/config/types'

interface FeesSettingsProps {
  initialConfig?: PricingConfig
  propertyId: string
  openPeriodFrom?: string | null
  openPeriodUntil?: string | null
  onSave?: (config: PricingConfig) => Promise<void>
  canEdit?: boolean
}

// Charge type options for the dropdown
const FEE_TYPE_OPTIONS: { value: UserDefinedFeeType; label: string; description: string }[] = [
  { value: 'flat_amount', label: 'Flat Amount', description: 'One-time charge per reservation' },
  { value: 'percentage_of_subtotal', label: '% of Subtotal', description: 'Percentage of nightly rate subtotal' },
  { value: 'percentage_of_total', label: '% of Total', description: 'Percentage of total including other charges' },
  { value: 'per_night', label: 'Per Night', description: 'Charge for each night' },
  { value: 'per_guest', label: 'Per Guest', description: 'Charge per guest (one-time)' },
  { value: 'per_guest_per_night', label: 'Per Guest Per Night', description: 'Charge per guest for each night' },
]

// Trigger type options for when to apply the charge
const TRIGGER_TYPE_OPTIONS: { value: FeeTriggerType; label: string; description: string }[] = [
  { value: 'always', label: 'Always', description: 'Auto-apply to every reservation' },
  { value: 'manual', label: 'Manual', description: 'Staff applies manually (one-time charges)' },
  { value: 'min_nights', label: 'Min Nights', description: 'Auto-apply when stay is at least X nights' },
  { value: 'min_guests', label: 'Min Guests', description: 'Auto-apply when guests >= X' },
  { value: 'has_pets', label: 'Has Pets', description: 'Auto-apply when reservation includes pets' },
  { value: 'date_range', label: 'Date Range', description: 'Auto-apply during specific dates' },
]

// Helper to handle NaN from valueAsNumber (empty inputs return NaN)
const nanToUndefined = (val: unknown) => (typeof val === 'number' && isNaN(val) ? undefined : val)

// Form schema for adding/editing a fee
const feeFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title is too long'),
  description: z.string().max(500).optional(),
  fee_type: z.enum(['flat_amount', 'percentage_of_subtotal', 'percentage_of_total', 'per_night', 'per_guest', 'per_guest_per_night']),
  value_dollars: z.preprocess(nanToUndefined, z.number().min(0, 'Value must be positive').optional()),
  value_percentage: z.preprocess(nanToUndefined, z.number().min(0).max(100, 'Percentage must be 0-100').optional()),
  is_taxable: z.boolean(),
  trigger_type: z.enum(['always', 'manual', 'min_nights', 'min_guests', 'has_pets', 'date_range']),
  min_nights: z.preprocess(nanToUndefined, z.number().int().min(1, 'Minimum nights must be at least 1').optional()),
  min_guests: z.preprocess(nanToUndefined, z.number().int().min(1, 'Minimum guests must be at least 1').optional()),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
}).superRefine((data, ctx) => {
  // Require value based on fee_type
  const isPercentage = data.fee_type === 'percentage_of_subtotal' || data.fee_type === 'percentage_of_total'
  if (isPercentage && (data.value_percentage === undefined || data.value_percentage === null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Percentage is required',
      path: ['value_percentage'],
    })
  }
  const requiresDollars = ['flat_amount', 'per_night', 'per_guest', 'per_guest_per_night']
  if (requiresDollars.includes(data.fee_type) && (data.value_dollars === undefined || data.value_dollars === null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Amount is required',
      path: ['value_dollars'],
    })
  }
  // Require trigger conditions based on trigger_type
  if (data.trigger_type === 'min_nights' && (data.min_nights === undefined || data.min_nights === null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Minimum nights is required',
      path: ['min_nights'],
    })
  }
  if (data.trigger_type === 'min_guests' && (data.min_guests === undefined || data.min_guests === null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Minimum guests is required',
      path: ['min_guests'],
    })
  }
  if (data.trigger_type === 'date_range') {
    if (!data.start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Start date is required',
        path: ['start_date'],
      })
    }
    if (!data.end_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End date is required',
        path: ['end_date'],
      })
    }
  }
})

type FeeFormInput = z.infer<typeof feeFormSchema>

const SEASON_ALERT_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

export function FeesSettings({
  initialConfig,
  propertyId,
  openPeriodFrom,
  openPeriodUntil,
  onSave,
  canEdit = true,
}: FeesSettingsProps) {
  const readOnly = !canEdit
  const router = useRouter()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingFee, setEditingFee] = useState<UserDefinedFee | null>(null)

  // Tax settings state
  const [taxRatePercentage, setTaxRatePercentage] = useState(
    initialConfig?.tax_rate ? initialConfig.tax_rate * 100 : 0
  )
  const [taxName, setTaxName] = useState(initialConfig?.tax_name || 'Tax')

  // User-defined fees state
  const [fees, setFees] = useState<UserDefinedFee[]>(initialConfig?.user_defined_fees || [])

  // Form for adding/editing fees
  const feeForm = useForm<FeeFormInput>({
    resolver: zodResolver(feeFormSchema),
    defaultValues: {
      title: '',
      description: '',
      fee_type: 'flat_amount',
      value_dollars: undefined,
      value_percentage: undefined,
      is_taxable: true,
      trigger_type: 'always',
      min_nights: undefined,
      min_guests: undefined,
      start_date: undefined,
      end_date: undefined,
    },
  })

  const watchFeeType = feeForm.watch('fee_type')
  const watchTriggerType = feeForm.watch('trigger_type')
  const isPercentageType = watchFeeType === 'percentage_of_subtotal' || watchFeeType === 'percentage_of_total'

  const openAddDialog = () => {
    feeForm.reset({
      title: '',
      description: '',
      fee_type: 'flat_amount',
      value_dollars: undefined,
      value_percentage: undefined,
      is_taxable: true,
      trigger_type: 'always',
      min_nights: undefined,
      min_guests: undefined,
      start_date: undefined,
      end_date: undefined,
    })
    setEditingFee(null)
    setIsAddDialogOpen(true)
  }

  const openEditDialog = (fee: UserDefinedFee) => {
    feeForm.reset({
      title: fee.title,
      description: fee.description || '',
      fee_type: fee.fee_type,
      value_dollars: fee.value_cents ? fee.value_cents / 100 : undefined,
      value_percentage: fee.value_percentage,
      is_taxable: fee.is_taxable,
      trigger_type: fee.trigger_type,
      min_nights: fee.trigger_conditions?.min_nights,
      min_guests: fee.trigger_conditions?.min_guests,
      start_date: fee.trigger_conditions?.start_date,
      end_date: fee.trigger_conditions?.end_date,
    })
    setEditingFee(fee)
    setIsAddDialogOpen(true)
  }

  const handleFeeSubmit = (data: FeeFormInput) => {
    // Build trigger conditions based on trigger type
    let triggerConditions: UserDefinedFee['trigger_conditions']
    if (data.trigger_type === 'min_nights' && data.min_nights) {
      triggerConditions = { min_nights: data.min_nights }
    } else if (data.trigger_type === 'min_guests' && data.min_guests) {
      triggerConditions = { min_guests: data.min_guests }
    } else if (data.trigger_type === 'date_range') {
      const dateRangeConditions: { min_nights?: number; min_guests?: number; start_date?: string; end_date?: string } = {}
      if (data.start_date) dateRangeConditions.start_date = data.start_date
      if (data.end_date) dateRangeConditions.end_date = data.end_date
      if (Object.keys(dateRangeConditions).length > 0) {
        triggerConditions = dateRangeConditions
      }
    }

    const newFee: UserDefinedFee = {
      id: editingFee?.id || uuidv4(),
      title: data.title,
      ...(data.description ? { description: data.description } : {}),
      fee_type: data.fee_type,
      ...(isPercentageType
        ? (data.value_percentage !== undefined ? { value_percentage: data.value_percentage } : {})
        : (data.value_dollars ? { value_cents: Math.round(data.value_dollars * 100) } : {})),
      is_taxable: data.is_taxable,
      trigger_type: data.trigger_type,
      ...(triggerConditions ? { trigger_conditions: triggerConditions } : {}),
      display_order: editingFee?.display_order ?? fees.length,
      enabled: editingFee?.enabled ?? true,
      created_at: editingFee?.created_at || new Date().toISOString(),
    }

    if (editingFee) {
      setFees(fees.map(f => f.id === editingFee.id ? newFee : f))
    } else {
      setFees([...fees, newFee])
    }

    setIsAddDialogOpen(false)
    setEditingFee(null)
    feeForm.reset()
  }

  const toggleFeeEnabled = (feeId: string) => {
    setFees(fees.map(f => f.id === feeId ? { ...f, enabled: !f.enabled } : f))
  }

  const deleteFee = (feeId: string) => {
    setFees(fees.filter(f => f.id !== feeId))
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      const pricingConfig: PricingConfig = {
        tax_rate: taxRatePercentage / 100,
        tax_name: taxName,
        user_defined_fees: fees,
        // Legacy fields - keep undefined to not override
      }

      if (onSave) {
        await onSave(pricingConfig)
      } else {
        const response = await fetch(`/api/properties/${propertyId}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pricing_config: pricingConfig }),
        })

        if (!response.ok) {
          throw new Error('Failed to save fees configuration')
        }
      }

      toast({
        title: 'Additional charges saved',
        description: 'Additional charges saved successfully.',
        className: SEASON_ALERT_TOAST_CLASS,
      })
      router.refresh()
    } catch (error) {
      console.error('Error saving fees settings:', error)
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save fees settings',
        variant: 'destructive',
        className: SEASON_ALERT_TOAST_CLASS,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const getFeeTypeLabel = (type: UserDefinedFeeType) => {
    return FEE_TYPE_OPTIONS.find(opt => opt.value === type)?.label || type
  }

  const formatFeeValue = (fee: UserDefinedFee) => {
    if (fee.fee_type === 'percentage_of_subtotal' || fee.fee_type === 'percentage_of_total') {
      return `${fee.value_percentage ?? 0}%`
    }
    return `$${((fee.value_cents ?? 0) / 100).toFixed(2)}`
  }

  const getTriggerBadge = (fee: UserDefinedFee) => {
    switch (fee.trigger_type) {
      case 'always':
        return <Badge variant="secondary">Always</Badge>
      case 'manual':
        return <Badge variant="outline">Manual</Badge>
      case 'min_nights':
        return <Badge variant="secondary">{fee.trigger_conditions?.min_nights}+ nights</Badge>
      case 'min_guests':
        return <Badge variant="secondary">{fee.trigger_conditions?.min_guests}+ guests</Badge>
      case 'has_pets':
        return <Badge variant="secondary">Pets</Badge>
      case 'date_range':
        const start = fee.trigger_conditions?.start_date
        const end = fee.trigger_conditions?.end_date
        if (start && end) {
          return <Badge variant="secondary">{start} - {end}</Badge>
        } else if (start) {
          return <Badge variant="secondary">From {start}</Badge>
        } else if (end) {
          return <Badge variant="secondary">Until {end}</Badge>
        }
        return <Badge variant="secondary">Date Range</Badge>
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Tax Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Taxes</CardTitle>
          <CardDescription>Configure tax rates applied to reservations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tax_rate_percentage">Tax Rate (%)</Label>
              <Input
                id="tax_rate_percentage"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="8.5"
                value={taxRatePercentage || ''}
                disabled={readOnly}
                onChange={(e) => setTaxRatePercentage(parseFloat(e.target.value) || 0)}
              />
              <p className="text-sm text-muted-foreground">
                Example: 8.5% sales tax or occupancy tax
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax_name">Tax Name</Label>
              <Input
                id="tax_name"
                placeholder="Sales Tax"
                value={taxName}
                disabled={readOnly}
                onChange={(e) => setTaxName(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Displayed on invoices and receipts
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User-Defined Additional Charges */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="text-xl sm:text-2xl">Additional Charges</CardTitle>
              <CardDescription className="text-pretty">
                Configure charges applied to reservations (cleaning, service, pet fees, etc.)
              </CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              {canEdit && (
              <DialogTrigger asChild>
                <Button onClick={openAddDialog} className="w-full shrink-0 sm:w-auto" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Charge
                </Button>
              </DialogTrigger>
              )}
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingFee ? 'Edit Charge' : 'Add Charge'}</DialogTitle>
                  <DialogDescription>
                    Configure a charge to be applied to reservations
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={feeForm.handleSubmit(handleFeeSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fee_title">Charge Title</Label>
                    <Input
                      id="fee_title"
                      placeholder="e.g., Cleaning Fee, Resort Fee, Pet Fee"
                      {...feeForm.register('title')}
                    />
                    {feeForm.formState.errors.title && (
                      <p className="text-sm text-destructive">{feeForm.formState.errors.title.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fee_description">Description (optional)</Label>
                    <Input
                      id="fee_description"
                      placeholder="Brief description of this fee"
                      {...feeForm.register('description')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fee_type">Charge Type</Label>
                    <Select
                      value={watchFeeType}
                      onValueChange={(value) => feeForm.setValue('fee_type', value as UserDefinedFeeType)}
                    >
                      <SelectTrigger id="fee_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FEE_TYPE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div>
                              <div>{opt.label}</div>
                              <div className="text-xs text-muted-foreground">{opt.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {isPercentageType ? (
                    <div className="space-y-2">
                      <Label htmlFor="fee_value_percentage">Percentage (%)</Label>
                      <Input
                        id="fee_value_percentage"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="5.0"
                        {...feeForm.register('value_percentage', { valueAsNumber: true })}
                      />
                      {feeForm.formState.errors.value_percentage && (
                        <p className="text-sm text-destructive">{feeForm.formState.errors.value_percentage.message}</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="fee_value_dollars">Amount ($)</Label>
                      <Input
                        id="fee_value_dollars"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="25.00"
                        {...feeForm.register('value_dollars', { valueAsNumber: true })}
                      />
                      {feeForm.formState.errors.value_dollars && (
                        <p className="text-sm text-destructive">{feeForm.formState.errors.value_dollars.message}</p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Taxable</Label>
                      <p className="text-sm text-muted-foreground">
                        Include this charge in tax calculation
                      </p>
                    </div>
                    <Switch
                      checked={feeForm.watch('is_taxable')}
                      onCheckedChange={(checked) => feeForm.setValue('is_taxable', checked)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trigger_type">When to Apply</Label>
                    <Select
                      value={watchTriggerType}
                      onValueChange={(value) => feeForm.setValue('trigger_type', value as FeeTriggerType)}
                    >
                      <SelectTrigger id="trigger_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRIGGER_TYPE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div>
                              <div>{opt.label}</div>
                              <div className="text-xs text-muted-foreground">{opt.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Conditional trigger condition inputs */}
                  {watchTriggerType === 'min_nights' && (
                    <div className="space-y-2">
                      <Label htmlFor="min_nights">Minimum Nights</Label>
                      <Input
                        id="min_nights"
                        type="number"
                        min="1"
                        placeholder="7"
                        {...feeForm.register('min_nights', { valueAsNumber: true })}
                      />
                      {feeForm.formState.errors.min_nights ? (
                        <p className="text-sm text-destructive">{feeForm.formState.errors.min_nights.message}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Charge applies when stay is at least this many nights
                        </p>
                      )}
                    </div>
                  )}

                  {watchTriggerType === 'min_guests' && (
                    <div className="space-y-2">
                      <Label htmlFor="min_guests">Minimum Guests</Label>
                      <Input
                        id="min_guests"
                        type="number"
                        min="1"
                        placeholder="4"
                        {...feeForm.register('min_guests', { valueAsNumber: true })}
                      />
                      {feeForm.formState.errors.min_guests ? (
                        <p className="text-sm text-destructive">{feeForm.formState.errors.min_guests.message}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Charge applies when guest count is at least this many
                        </p>
                      )}
                    </div>
                  )}

                  {watchTriggerType === 'date_range' && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="start_date">Start Date</Label>
                        <Input
                          id="start_date"
                          type="date"
                          min={openPeriodFrom ?? undefined}
                          max={openPeriodUntil ?? undefined}
                          {...feeForm.register('start_date')}
                        />
                        {feeForm.formState.errors.start_date && (
                          <p className="text-sm text-destructive">{feeForm.formState.errors.start_date.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end_date">End Date</Label>
                        <Input
                          id="end_date"
                          type="date"
                          min={openPeriodFrom ?? undefined}
                          max={openPeriodUntil ?? undefined}
                          {...feeForm.register('end_date')}
                        />
                        {feeForm.formState.errors.end_date && (
                          <p className="text-sm text-destructive">{feeForm.formState.errors.end_date.message}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm">
                      {editingFee ? 'Save Changes' : 'Add Charge'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {fees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No additional charges configured yet.</p>
              <p className="text-sm">Click "Add Charge" to create your first charge.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {fees.map((fee) => (
                <div
                  key={fee.id}
                  className={`flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4 ${
                    fee.enabled ? 'bg-card' : 'bg-muted/50 opacity-60'
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-4">
                    <GripVertical
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground cursor-grab sm:mt-0"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium">{fee.title}</span>
                        {getTriggerBadge(fee)}
                      </div>
                      <div className="mt-0.5 text-sm text-muted-foreground break-words">
                        {getFeeTypeLabel(fee.fee_type)} · {formatFeeValue(fee)}
                        {fee.is_taxable && ' · Taxable'}
                      </div>
                      {fee.description && (
                        <div className="mt-1 text-xs text-muted-foreground break-words">{fee.description}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center justify-end gap-1 border-t border-border/60 pt-3 sm:gap-2 sm:border-0 sm:pt-0">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Switch
                        checked={fee.enabled}
                        disabled={readOnly}
                        onCheckedChange={() => toggleFeeEnabled(fee.id)}
                        className="shrink-0"
                        aria-label={fee.enabled ? `Disable ${fee.title}` : `Enable ${fee.title}`}
                      />
                      {canEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0 touch-manipulation"
                        onClick={() => openEditDialog(fee)}
                        aria-label={`Edit ${fee.title}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      )}
                      {canEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0 touch-manipulation"
                        onClick={() => deleteFee(fee.id)}
                        aria-label={`Delete ${fee.title}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button and Messages */}
      {canEdit && (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button onClick={handleSave} disabled={isSaving} className="w-full shrink-0 sm:w-auto" size="sm">
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? 'Saving...' : 'Save Additional Charges'}
        </Button>
      </div>
      )}
    </div>
  )
}
