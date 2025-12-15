'use client'

/**
 * Discounts Configuration Settings Component
 *
 * Allows property owners to configure user-defined discounts:
 * - Flat amount or percentage discounts
 * - Manual or auto-triggered (min nights, min guests, date range)
 *
 * @module components/dashboard/settings/discounts-settings
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Pencil, Trash2, GripVertical } from 'lucide-react'
import type { RateDiscountsConfig, UserDefinedDiscount, UserDefinedDiscountType, DiscountTriggerType } from '@/lib/config/types'

interface DiscountsSettingsProps {
  initialConfig?: RateDiscountsConfig
  propertyId: string
  onSave?: (config: RateDiscountsConfig) => Promise<void>
}

// Discount type options for the dropdown
const DISCOUNT_TYPE_OPTIONS: { value: UserDefinedDiscountType; label: string; description: string }[] = [
  { value: 'flat_amount', label: 'Flat Amount', description: 'Fixed dollar amount off' },
  { value: 'percentage_of_subtotal', label: '% of Subtotal', description: 'Percentage off nightly rate subtotal' },
  { value: 'percentage_of_total', label: '% of Total', description: 'Percentage off total including fees' },
]

// Trigger type options
const TRIGGER_TYPE_OPTIONS: { value: DiscountTriggerType; label: string; description: string }[] = [
  { value: 'manual', label: 'Manual', description: 'Staff applies this discount manually' },
  { value: 'min_nights', label: 'Min Nights', description: 'Auto-apply when stay is at least X nights' },
  { value: 'min_guests', label: 'Min Guests', description: 'Auto-apply when guests >= X' },
  { value: 'date_range', label: 'Date Range', description: 'Auto-apply during specific dates' },
]

// Helper to handle NaN from valueAsNumber (empty inputs return NaN)
const nanToUndefined = (val: unknown) => (typeof val === 'number' && isNaN(val) ? undefined : val)

// Form schema for adding/editing a discount
const discountFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title is too long'),
  description: z.string().max(500).optional(),
  discount_type: z.enum(['flat_amount', 'percentage_of_subtotal', 'percentage_of_total']),
  value_dollars: z.preprocess(nanToUndefined, z.number().min(0, 'Value must be positive').optional()),
  value_percentage: z.preprocess(nanToUndefined, z.number().min(0).max(100, 'Percentage must be 0-100').optional()),
  trigger_type: z.enum(['manual', 'min_nights', 'min_guests', 'date_range']),
  min_nights: z.preprocess(nanToUndefined, z.number().int().min(1, 'Minimum nights must be at least 1').optional()),
  min_guests: z.preprocess(nanToUndefined, z.number().int().min(1, 'Minimum guests must be at least 1').optional()),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  max_discount_dollars: z.preprocess(nanToUndefined, z.number().min(0).optional()),
}).superRefine((data, ctx) => {
  // Require value based on discount_type
  const isPercentage = data.discount_type === 'percentage_of_subtotal' || data.discount_type === 'percentage_of_total'
  if (isPercentage && (data.value_percentage === undefined || data.value_percentage === null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Percentage is required',
      path: ['value_percentage'],
    })
  }
  if (data.discount_type === 'flat_amount' && (data.value_dollars === undefined || data.value_dollars === null)) {
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

type DiscountFormInput = z.infer<typeof discountFormSchema>

export function DiscountsSettings({ initialConfig, propertyId, onSave }: DiscountsSettingsProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingDiscount, setEditingDiscount] = useState<UserDefinedDiscount | null>(null)

  // User-defined discounts state
  const [discounts, setDiscounts] = useState<UserDefinedDiscount[]>(
    initialConfig?.user_defined_discounts || []
  )

  // Form for adding/editing discounts
  const discountForm = useForm<DiscountFormInput>({
    resolver: zodResolver(discountFormSchema),
    defaultValues: {
      title: '',
      description: '',
      discount_type: 'percentage_of_subtotal',
      value_dollars: undefined,
      value_percentage: undefined,
      trigger_type: 'manual',
      min_nights: undefined,
      min_guests: undefined,
      start_date: undefined,
      end_date: undefined,
      max_discount_dollars: undefined,
    },
  })

  const watchDiscountType = discountForm.watch('discount_type')
  const watchTriggerType = discountForm.watch('trigger_type')
  const isPercentageType = watchDiscountType === 'percentage_of_subtotal' || watchDiscountType === 'percentage_of_total'

  const openAddDialog = () => {
    discountForm.reset({
      title: '',
      description: '',
      discount_type: 'percentage_of_subtotal',
      value_dollars: undefined,
      value_percentage: undefined,
      trigger_type: 'manual',
      min_nights: undefined,
      min_guests: undefined,
      start_date: undefined,
      end_date: undefined,
      max_discount_dollars: undefined,
    })
    setEditingDiscount(null)
    setIsAddDialogOpen(true)
  }

  const openEditDialog = (discount: UserDefinedDiscount) => {
    discountForm.reset({
      title: discount.title,
      description: discount.description || '',
      discount_type: discount.discount_type,
      value_dollars: discount.value_cents ? discount.value_cents / 100 : undefined,
      value_percentage: discount.value_percentage,
      trigger_type: discount.trigger_type,
      min_nights: discount.trigger_conditions?.min_nights,
      min_guests: discount.trigger_conditions?.min_guests,
      start_date: discount.trigger_conditions?.start_date,
      end_date: discount.trigger_conditions?.end_date,
      max_discount_dollars: discount.max_discount_cents ? discount.max_discount_cents / 100 : undefined,
    })
    setEditingDiscount(discount)
    setIsAddDialogOpen(true)
  }

  const handleDiscountSubmit = (data: DiscountFormInput) => {
    // Build trigger conditions based on trigger type
    let triggerConditions: UserDefinedDiscount['trigger_conditions']
    if (data.trigger_type === 'min_nights' && data.min_nights) {
      triggerConditions = { min_nights: data.min_nights }
    } else if (data.trigger_type === 'min_guests' && data.min_guests) {
      triggerConditions = { min_guests: data.min_guests }
    } else if (data.trigger_type === 'date_range') {
      // Only include defined properties to satisfy exactOptionalPropertyTypes
      const dateRangeConditions: { min_nights?: number; min_guests?: number; start_date?: string; end_date?: string } = {}
      if (data.start_date) dateRangeConditions.start_date = data.start_date
      if (data.end_date) dateRangeConditions.end_date = data.end_date
      if (Object.keys(dateRangeConditions).length > 0) {
        triggerConditions = dateRangeConditions
      }
    }

    const newDiscount: UserDefinedDiscount = {
      id: editingDiscount?.id || uuidv4(),
      title: data.title,
      ...(data.description ? { description: data.description } : {}),
      discount_type: data.discount_type,
      ...(isPercentageType
        ? (data.value_percentage !== undefined ? { value_percentage: data.value_percentage } : {})
        : (data.value_dollars ? { value_cents: Math.round(data.value_dollars * 100) } : {})),
      trigger_type: data.trigger_type,
      ...(triggerConditions ? { trigger_conditions: triggerConditions } : {}),
      ...(data.max_discount_dollars ? { max_discount_cents: Math.round(data.max_discount_dollars * 100) } : {}),
      display_order: editingDiscount?.display_order ?? discounts.length,
      enabled: editingDiscount?.enabled ?? true,
      created_at: editingDiscount?.created_at || new Date().toISOString(),
    }

    if (editingDiscount) {
      setDiscounts(discounts.map(d => d.id === editingDiscount.id ? newDiscount : d))
    } else {
      setDiscounts([...discounts, newDiscount])
    }

    setIsAddDialogOpen(false)
    setEditingDiscount(null)
    discountForm.reset()
  }

  const toggleDiscountEnabled = (discountId: string) => {
    setDiscounts(discounts.map(d => d.id === discountId ? { ...d, enabled: !d.enabled } : d))
  }

  const deleteDiscount = (discountId: string) => {
    setDiscounts(discounts.filter(d => d.id !== discountId))
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      const rateDiscountsConfig: RateDiscountsConfig = {
        user_defined_discounts: discounts,
        // Legacy fields - keep undefined to not override
      }

      if (onSave) {
        await onSave(rateDiscountsConfig)
      } else {
        const response = await fetch(`/api/properties/${propertyId}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rate_discounts_config: rateDiscountsConfig }),
        })

        if (!response.ok) {
          throw new Error('Failed to save discounts configuration')
        }
      }

      setSaveMessage({ type: 'success', text: 'Discounts saved successfully!' })
      router.refresh()
    } catch (error) {
      console.error('Error saving discounts:', error)
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save discounts',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const getDiscountTypeLabel = (type: UserDefinedDiscountType) => {
    return DISCOUNT_TYPE_OPTIONS.find(opt => opt.value === type)?.label || type
  }

  const getTriggerTypeLabel = (type: DiscountTriggerType) => {
    return TRIGGER_TYPE_OPTIONS.find(opt => opt.value === type)?.label || type
  }

  const formatDiscountValue = (discount: UserDefinedDiscount) => {
    if (discount.discount_type === 'percentage_of_subtotal' || discount.discount_type === 'percentage_of_total') {
      return `${discount.value_percentage ?? 0}%`
    }
    return `$${((discount.value_cents ?? 0) / 100).toFixed(2)}`
  }

  const getTriggerBadge = (discount: UserDefinedDiscount) => {
    switch (discount.trigger_type) {
      case 'manual':
        return <Badge variant="outline">Manual</Badge>
      case 'min_nights':
        return <Badge variant="secondary">{discount.trigger_conditions?.min_nights}+ nights</Badge>
      case 'min_guests':
        return <Badge variant="secondary">{discount.trigger_conditions?.min_guests}+ guests</Badge>
      case 'date_range':
        const start = discount.trigger_conditions?.start_date
        const end = discount.trigger_conditions?.end_date
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
      {/* User-Defined Discounts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Discounts</CardTitle>
              <CardDescription>
                Configure discounts that can be applied automatically or manually to reservations
              </CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openAddDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Discount
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingDiscount ? 'Edit Discount' : 'Add Discount'}</DialogTitle>
                  <DialogDescription>
                    Configure a discount to be applied to reservations
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={discountForm.handleSubmit(handleDiscountSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="discount_title">Discount Title</Label>
                    <Input
                      id="discount_title"
                      placeholder="e.g., Weekly Stay Discount, Early Bird"
                      {...discountForm.register('title')}
                    />
                    {discountForm.formState.errors.title && (
                      <p className="text-sm text-destructive">{discountForm.formState.errors.title.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="discount_description">Description (optional)</Label>
                    <Input
                      id="discount_description"
                      placeholder="Brief description of this discount"
                      {...discountForm.register('description')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="discount_type">Discount Type</Label>
                    <Select
                      value={watchDiscountType}
                      onValueChange={(value) => discountForm.setValue('discount_type', value as UserDefinedDiscountType)}
                    >
                      <SelectTrigger id="discount_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DISCOUNT_TYPE_OPTIONS.map(opt => (
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
                      <Label htmlFor="discount_value_percentage">Percentage (%)</Label>
                      <Input
                        id="discount_value_percentage"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="10.0"
                        {...discountForm.register('value_percentage', { valueAsNumber: true })}
                      />
                      {discountForm.formState.errors.value_percentage && (
                        <p className="text-sm text-destructive">{discountForm.formState.errors.value_percentage.message}</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="discount_value_dollars">Amount ($)</Label>
                      <Input
                        id="discount_value_dollars"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="25.00"
                        {...discountForm.register('value_dollars', { valueAsNumber: true })}
                      />
                      {discountForm.formState.errors.value_dollars && (
                        <p className="text-sm text-destructive">{discountForm.formState.errors.value_dollars.message}</p>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="trigger_type">When to Apply</Label>
                    <Select
                      value={watchTriggerType}
                      onValueChange={(value) => discountForm.setValue('trigger_type', value as DiscountTriggerType)}
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
                        {...discountForm.register('min_nights', { valueAsNumber: true })}
                      />
                      {discountForm.formState.errors.min_nights ? (
                        <p className="text-sm text-destructive">{discountForm.formState.errors.min_nights.message}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Discount applies when stay is at least this many nights
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
                        {...discountForm.register('min_guests', { valueAsNumber: true })}
                      />
                      {discountForm.formState.errors.min_guests ? (
                        <p className="text-sm text-destructive">{discountForm.formState.errors.min_guests.message}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Discount applies when guest count is at least this many
                        </p>
                      )}
                    </div>
                  )}

                  {watchTriggerType === 'date_range' && (
                    <div className="grid gap-4 grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="start_date">Start Date</Label>
                        <Input
                          id="start_date"
                          type="date"
                          {...discountForm.register('start_date')}
                        />
                        {discountForm.formState.errors.start_date && (
                          <p className="text-sm text-destructive">{discountForm.formState.errors.start_date.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end_date">End Date</Label>
                        <Input
                          id="end_date"
                          type="date"
                          {...discountForm.register('end_date')}
                        />
                        {discountForm.formState.errors.end_date && (
                          <p className="text-sm text-destructive">{discountForm.formState.errors.end_date.message}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="max_discount_dollars">Maximum Discount (optional)</Label>
                    <Input
                      id="max_discount_dollars"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="100.00"
                      {...discountForm.register('max_discount_dollars', { valueAsNumber: true })}
                    />
                    <p className="text-sm text-muted-foreground">
                      Cap the discount at this amount (useful for percentage discounts)
                    </p>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingDiscount ? 'Save Changes' : 'Add Discount'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {discounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No discounts configured yet.</p>
              <p className="text-sm">Click "Add Discount" to create your first discount.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {discounts.map((discount) => (
                <div
                  key={discount.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    discount.enabled ? 'bg-card' : 'bg-muted/50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{discount.title}</span>
                        {getTriggerBadge(discount)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {getDiscountTypeLabel(discount.discount_type)} · {formatDiscountValue(discount)} off
                        {discount.max_discount_cents && ` (max $${(discount.max_discount_cents / 100).toFixed(2)})`}
                      </div>
                      {discount.description && (
                        <div className="text-xs text-muted-foreground mt-1">{discount.description}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={discount.enabled}
                      onCheckedChange={() => toggleDiscountEnabled(discount.id)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(discount)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteDiscount(discount.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button and Messages */}
      <div className="flex items-center justify-between">
        <div>
          {saveMessage && (
            <Alert variant={saveMessage.type === 'error' ? 'destructive' : 'default'}>
              <AlertDescription>{saveMessage.text}</AlertDescription>
            </Alert>
          )}
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? 'Saving...' : 'Save Discounts'}
        </Button>
      </div>
    </div>
  )
}
