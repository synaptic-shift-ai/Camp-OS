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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Loader2, Plus, Pencil, Trash2, GripVertical } from 'lucide-react'
import type { PricingConfig, UserDefinedFee, UserDefinedFeeType } from '@/lib/config/types'

interface FeesSettingsProps {
  initialConfig?: PricingConfig
  propertyId: string
  onSave?: (config: PricingConfig) => Promise<void>
}

// Fee type options for the dropdown
const FEE_TYPE_OPTIONS: { value: UserDefinedFeeType; label: string; description: string }[] = [
  { value: 'flat_amount', label: 'Flat Amount', description: 'One-time fee per reservation' },
  { value: 'percentage_of_subtotal', label: '% of Subtotal', description: 'Percentage of nightly rate subtotal' },
  { value: 'percentage_of_total', label: '% of Total', description: 'Percentage of total including other fees' },
  { value: 'per_night', label: 'Per Night', description: 'Fee charged for each night' },
  { value: 'per_guest', label: 'Per Guest', description: 'Fee charged per guest (one-time)' },
  { value: 'per_guest_per_night', label: 'Per Guest Per Night', description: 'Fee per guest for each night' },
]

// Form schema for adding/editing a fee
const feeFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title is too long'),
  description: z.string().max(500).optional(),
  fee_type: z.enum(['flat_amount', 'percentage_of_subtotal', 'percentage_of_total', 'per_night', 'per_guest', 'per_guest_per_night']),
  value_dollars: z.number().min(0, 'Value must be positive').optional(),
  value_percentage: z.number().min(0).max(100, 'Percentage must be 0-100').optional(),
  is_taxable: z.boolean(),
})

type FeeFormInput = z.infer<typeof feeFormSchema>

export function FeesSettings({ initialConfig, propertyId, onSave }: FeesSettingsProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
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
    },
  })

  const watchFeeType = feeForm.watch('fee_type')
  const isPercentageType = watchFeeType === 'percentage_of_subtotal' || watchFeeType === 'percentage_of_total'

  const openAddDialog = () => {
    feeForm.reset({
      title: '',
      description: '',
      fee_type: 'flat_amount',
      value_dollars: undefined,
      value_percentage: undefined,
      is_taxable: true,
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
    })
    setEditingFee(fee)
    setIsAddDialogOpen(true)
  }

  const handleFeeSubmit = (data: FeeFormInput) => {
    const newFee: UserDefinedFee = {
      id: editingFee?.id || uuidv4(),
      title: data.title,
      ...(data.description ? { description: data.description } : {}),
      fee_type: data.fee_type,
      ...(isPercentageType
        ? (data.value_percentage !== undefined ? { value_percentage: data.value_percentage } : {})
        : (data.value_dollars ? { value_cents: Math.round(data.value_dollars * 100) } : {})),
      is_taxable: data.is_taxable,
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
    setSaveMessage(null)

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

      setSaveMessage({ type: 'success', text: 'Fees settings saved successfully!' })
      router.refresh()
    } catch (error) {
      console.error('Error saving fees settings:', error)
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save fees settings',
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
                onChange={(e) => setTaxName(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Displayed on invoices and receipts
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User-Defined Fees */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Fees</CardTitle>
              <CardDescription>
                Configure fees applied to reservations (cleaning, service, pet fees, etc.)
              </CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openAddDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Fee
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingFee ? 'Edit Fee' : 'Add Fee'}</DialogTitle>
                  <DialogDescription>
                    Configure a fee to be applied to reservations
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={feeForm.handleSubmit(handleFeeSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fee_title">Fee Title</Label>
                    <Input
                      id="fee_title"
                      placeholder="e.g., Cleaning Fee, Resort Fee"
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
                    <Label htmlFor="fee_type">Fee Type</Label>
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
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Taxable</Label>
                      <p className="text-sm text-muted-foreground">
                        Include this fee in tax calculation
                      </p>
                    </div>
                    <Switch
                      checked={feeForm.watch('is_taxable')}
                      onCheckedChange={(checked) => feeForm.setValue('is_taxable', checked)}
                    />
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingFee ? 'Save Changes' : 'Add Fee'}
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
              <p>No fees configured yet.</p>
              <p className="text-sm">Click "Add Fee" to create your first fee.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {fees.map((fee) => (
                <div
                  key={fee.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    fee.enabled ? 'bg-card' : 'bg-muted/50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <div>
                      <div className="font-medium">{fee.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {getFeeTypeLabel(fee.fee_type)} · {formatFeeValue(fee)}
                        {fee.is_taxable && ' · Taxable'}
                      </div>
                      {fee.description && (
                        <div className="text-xs text-muted-foreground mt-1">{fee.description}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={fee.enabled}
                      onCheckedChange={() => toggleFeeEnabled(fee.id)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(fee)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteFee(fee.id)}
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
          {isSaving ? 'Saving...' : 'Save Fees Settings'}
        </Button>
      </div>
    </div>
  )
}
