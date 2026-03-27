'use client'

/**
 * Pricing Configuration Settings Component
 *
 * Allows property owners to configure:
 * - Tax rates and names
 * - Service fees (percentage, flat, or per-night)
 * - Default cleaning fees
 * - Extra guest fees
 * - Pet fees
 * - Weekly/monthly rate discounts
 *
 * @module components/dashboard/settings/pricing-settings
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Info } from 'lucide-react'
import { pricingConfigFormSchema, type PricingConfigFormInput } from '@/lib/config/schemas'
import type { PricingConfig } from '@/lib/config/types'

interface PricingSettingsProps {
  initialConfig?: PricingConfig
  propertyId: string
  onSave?: (config: PricingConfig) => Promise<void>
}

const SEASON_ALERT_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

export function PricingSettings({ initialConfig, propertyId, onSave }: PricingSettingsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<PricingConfigFormInput>({
    resolver: zodResolver(pricingConfigFormSchema),
    defaultValues: initialConfig
      ? {
          tax_rate_percentage: initialConfig.tax_rate * 100,
          tax_name: initialConfig.tax_name,
          service_fee_type: initialConfig.service_fee_type,
          service_fee_percentage: initialConfig.service_fee_percentage || 0,
          service_fee_amount_dollars: initialConfig.service_fee_amount_cents !== null && initialConfig.service_fee_amount_cents !== undefined
            ? initialConfig.service_fee_amount_cents / 100
            : null,
          default_cleaning_fee_dollars: initialConfig.default_cleaning_fee_cents !== null && initialConfig.default_cleaning_fee_cents !== undefined
            ? initialConfig.default_cleaning_fee_cents / 100
            : null,
          extra_guest_fee_enabled: initialConfig.extra_guest_fee_enabled,
          extra_guest_threshold: initialConfig.extra_guest_threshold,
          extra_guest_fee_dollars: (initialConfig.extra_guest_fee_cents ?? 0) / 100,
          pet_fee_dollars: (initialConfig.pet_fee_cents ?? 0) / 100,
        }
      : {
          tax_rate_percentage: 0,
          tax_name: 'Tax',
          service_fee_type: 'none',
          service_fee_percentage: 0,
          service_fee_amount_dollars: null,
          default_cleaning_fee_dollars: null,
          extra_guest_fee_enabled: false,
          extra_guest_threshold: 2,
          extra_guest_fee_dollars: 0,
          pet_fee_dollars: 20,
        },
  })

  const serviceFeeType = watch('service_fee_type')
  const extraGuestFeeEnabled = watch('extra_guest_fee_enabled')

  const onSubmit = async (data: PricingConfigFormInput) => {
    setIsSaving(true)

    try {
      // Convert form data to API format (dollars to cents, percentage to decimal)
      // Keep existing user_defined_fees when saving legacy fields
      const pricingConfig: PricingConfig = {
        tax_rate: data.tax_rate_percentage / 100,
        tax_name: data.tax_name,
        user_defined_fees: initialConfig?.user_defined_fees ?? [],
        service_fee_type: data.service_fee_type ?? 'none',
        service_fee_percentage: data.service_fee_percentage ?? 0,
        service_fee_amount_cents: data.service_fee_amount_dollars
          ? Math.round(data.service_fee_amount_dollars * 100)
          : null,
        default_cleaning_fee_cents: data.default_cleaning_fee_dollars
          ? Math.round(data.default_cleaning_fee_dollars * 100)
          : null,
        extra_guest_fee_enabled: data.extra_guest_fee_enabled ?? false,
        extra_guest_threshold: data.extra_guest_threshold ?? 2,
        extra_guest_fee_cents: Math.round((data.extra_guest_fee_dollars ?? 0) * 100),
        pet_fee_cents: Math.round((data.pet_fee_dollars ?? 0) * 100),
      }

      if (onSave) {
        await onSave(pricingConfig)
      } else {
        // Default API call
        const response = await fetch(`/api/properties/${propertyId}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pricing_config: pricingConfig }),
        })

        if (!response.ok) {
          throw new Error('Failed to save pricing configuration')
        }
      }

      toast({
        title: 'Pricing settings saved',
        description: 'Pricing settings saved successfully!',
        className: SEASON_ALERT_TOAST_CLASS,
      })

      // Refresh the page data to show updated values
      router.refresh()
    } catch (error) {
      console.error('Error saving pricing settings:', error)
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save pricing settings',
        variant: 'destructive',
        className: SEASON_ALERT_TOAST_CLASS,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                {...register('tax_rate_percentage', { valueAsNumber: true })}
              />
              {errors.tax_rate_percentage && (
                <p className="text-sm text-destructive">{errors.tax_rate_percentage.message}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Example: 8.5% sales tax or occupancy tax
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax_name">Tax Name</Label>
              <Input
                id="tax_name"
                placeholder="Sales Tax"
                {...register('tax_name')}
              />
              {errors.tax_name && <p className="text-sm text-destructive">{errors.tax_name.message}</p>}
              <p className="text-sm text-muted-foreground">
                Displayed on invoices and receipts
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Fee Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Service Fees</CardTitle>
          <CardDescription>Optional service or booking fees</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service_fee_type">Service Fee Type</Label>
            <Select
              value={serviceFeeType ?? 'none'}
              onValueChange={(value) => setValue('service_fee_type', value as any, { shouldDirty: true })}
            >
              <SelectTrigger id="service_fee_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Service Fee</SelectItem>
                <SelectItem value="percentage">Percentage of Subtotal</SelectItem>
                <SelectItem value="flat">Flat Fee per Reservation</SelectItem>
                <SelectItem value="per_night">Per Night Fee</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {serviceFeeType === 'percentage' && (
            <div className="space-y-2">
              <Label htmlFor="service_fee_percentage">Service Fee Percentage (%)</Label>
              <Input
                id="service_fee_percentage"
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="5.0"
                {...register('service_fee_percentage', { valueAsNumber: true })}
              />
              {errors.service_fee_percentage && (
                <p className="text-sm text-destructive">{errors.service_fee_percentage.message}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Applied to subtotal before tax (e.g., 5% = $5 on $100 subtotal)
              </p>
            </div>
          )}

          {(serviceFeeType === 'flat' || serviceFeeType === 'per_night') && (
            <div className="space-y-2">
              <Label htmlFor="service_fee_amount_dollars">
                Service Fee Amount ($)
              </Label>
              <Input
                id="service_fee_amount_dollars"
                type="number"
                step="0.01"
                min="0"
                placeholder="10.00"
                {...register('service_fee_amount_dollars', { valueAsNumber: true })}
              />
              {errors.service_fee_amount_dollars && (
                <p className="text-sm text-destructive">{errors.service_fee_amount_dollars.message}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {serviceFeeType === 'flat'
                  ? 'One-time fee per reservation'
                  : 'Fee charged per night of stay'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cleaning Fee Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Cleaning Fees</CardTitle>
          <CardDescription>Default cleaning fee applied to reservations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="default_cleaning_fee_dollars">Default Cleaning Fee ($)</Label>
            <Input
              id="default_cleaning_fee_dollars"
              type="number"
              step="0.01"
              min="0"
              placeholder="25.00"
              {...register('default_cleaning_fee_dollars', { valueAsNumber: true })}
            />
            {errors.default_cleaning_fee_dollars && (
              <p className="text-sm text-destructive">{errors.default_cleaning_fee_dollars.message}</p>
            )}
            <p className="text-sm text-muted-foreground">
              One-time fee per reservation. Can be overridden per site.
            </p>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Leave blank for no cleaning fee. You can set site-specific cleaning fees in the Sites management page.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Pet Fee Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Pet Fees</CardTitle>
          <CardDescription>Default fee for guests bringing pets</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pet_fee_dollars">Pet Fee ($)</Label>
            <Input
              id="pet_fee_dollars"
              type="number"
              step="0.01"
              min="0"
              placeholder="20.00"
              {...register('pet_fee_dollars', { valueAsNumber: true })}
            />
            {errors.pet_fee_dollars && (
              <p className="text-sm text-destructive">{errors.pet_fee_dollars.message}</p>
            )}
            <p className="text-sm text-muted-foreground">
              One-time fee per reservation for guests with pets. Can be overridden per site.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Extra Guest Fee Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Extra Guest Fees</CardTitle>
          <CardDescription>Charge for guests beyond base occupancy</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Extra Guest Fees</Label>
              <p className="text-sm text-muted-foreground">
                Charge additional fee for guests beyond threshold
              </p>
            </div>
            <Switch
              checked={extraGuestFeeEnabled ?? false}
              onCheckedChange={(checked) => setValue('extra_guest_fee_enabled', checked, { shouldDirty: true })}
            />
          </div>

          {extraGuestFeeEnabled && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="extra_guest_threshold">Guest Threshold</Label>
                  <Input
                    id="extra_guest_threshold"
                    type="number"
                    min="1"
                    max="20"
                    placeholder="2"
                    {...register('extra_guest_threshold', { valueAsNumber: true })}
                  />
                  {errors.extra_guest_threshold && (
                    <p className="text-sm text-destructive">{errors.extra_guest_threshold.message}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Number of guests included in base price
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="extra_guest_fee_dollars">Fee per Extra Guest ($)</Label>
                  <Input
                    id="extra_guest_fee_dollars"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="10.00"
                    {...register('extra_guest_fee_dollars', { valueAsNumber: true })}
                  />
                  {errors.extra_guest_fee_dollars && (
                    <p className="text-sm text-destructive">{errors.extra_guest_fee_dollars.message}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Fee per extra guest per night
                  </p>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Example: With threshold of 2 and fee of $10, a family of 4 would pay an extra $20/night (2 extra guests × $10).
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Button and Messages */}
      <div className="flex items-center justify-between">
        <Button type="submit" disabled={isSaving || !isDirty}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? 'Saving...' : 'Save Pricing Settings'}
        </Button>
      </div>
    </form>
  )
}
