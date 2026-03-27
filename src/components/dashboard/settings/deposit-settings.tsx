'use client'

/**
 * Deposit Configuration Settings Component
 *
 * Allows property owners to configure:
 * - Deposit requirement toggle
 * - Deposit type (percentage, flat amount, first night)
 * - Deposit amount/percentage
 * - Which booking types require deposit
 * - "Paid in full" exemption
 * - Full payment deadline
 *
 * @module components/dashboard/settings/deposit-settings
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
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Info } from 'lucide-react'
import { depositConfigFormSchema, type DepositConfigFormInput } from '@/lib/config/schemas'
import type { DepositConfig, BookingType } from '@/lib/config/types'

interface DepositSettingsProps {
  initialConfig?: DepositConfig
  propertyId: string
  onSave?: (config: DepositConfig) => Promise<void>
}

const BOOKING_TYPES: { value: BookingType; label: string; description: string }[] = [
  { value: 'nightly', label: 'Nightly', description: 'Standard short-term stays' },
  { value: 'weekly', label: 'Weekly', description: '7+ day reservations' },
  { value: 'monthly', label: 'Monthly', description: '30+ day reservations' },
  { value: 'seasonal', label: 'Seasonal', description: 'Multi-month seasonal stays' },
  { value: 'long_term', label: 'Long-term', description: 'Extended stays (6+ months)' },
]

const SEASON_ALERT_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

export function DepositSettings({ initialConfig, propertyId, onSave }: DepositSettingsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<DepositConfigFormInput>({
    resolver: zodResolver(depositConfigFormSchema),
    defaultValues: initialConfig
      ? {
          require_deposit: initialConfig.require_deposit,
          deposit_type: initialConfig.deposit_type,
          deposit_percentage: initialConfig.deposit_percentage,
          deposit_amount_dollars: initialConfig.deposit_amount_cents
            ? initialConfig.deposit_amount_cents / 100
            : null,
          applies_to_booking_types: initialConfig.applies_to_booking_types,
          exempt_if_paid_in_full: initialConfig.exempt_if_paid_in_full,
          full_payment_required_days_before: initialConfig.full_payment_required_days_before,
        }
      : {
          require_deposit: false,
          deposit_type: 'percentage',
          deposit_percentage: 25,
          deposit_amount_dollars: null,
          applies_to_booking_types: ['nightly', 'weekly', 'monthly', 'seasonal', 'long_term'],
          exempt_if_paid_in_full: true,
          full_payment_required_days_before: null,
        },
  })

  const requireDeposit = watch('require_deposit')
  const depositType = watch('deposit_type')
  const appliesToBookingTypes = watch('applies_to_booking_types')
  const exemptIfPaidInFull = watch('exempt_if_paid_in_full')

  const toggleBookingType = (type: BookingType) => {
    const current = appliesToBookingTypes
    const updated = current.includes(type)
      ? current.filter((t: BookingType) => t !== type)
      : [...current, type]
    setValue('applies_to_booking_types', updated, { shouldDirty: true })
  }

  const onSubmit = async (data: DepositConfigFormInput) => {
    setIsSaving(true)

    try {
      // Convert form data to API format
      const depositConfig: DepositConfig = {
        require_deposit: data.require_deposit,
        deposit_type: data.deposit_type,
        applies_to_booking_types: data.applies_to_booking_types,
        exempt_if_paid_in_full: data.exempt_if_paid_in_full,
        full_payment_required_days_before: data.full_payment_required_days_before === undefined ? null : data.full_payment_required_days_before,
      }

      if (data.deposit_percentage !== undefined) {
        depositConfig.deposit_percentage = data.deposit_percentage
      }

      if (data.deposit_amount_dollars !== undefined && data.deposit_amount_dollars !== null) {
        depositConfig.deposit_amount_cents = Math.round(data.deposit_amount_dollars * 100)
      }

      if (onSave) {
        await onSave(depositConfig)
      } else {
        // Default API call
        const response = await fetch(`/api/properties/${propertyId}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deposit_config: depositConfig }),
        })

        if (!response.ok) {
          throw new Error('Failed to save deposit configuration')
        }
      }

      toast({
        title: 'Deposit settings saved',
        description: 'Deposit settings saved successfully.',
        className: SEASON_ALERT_TOAST_CLASS,
      })

      // Refresh the page data to show updated values
      router.refresh()
    } catch (error) {
      console.error('Error saving deposit settings:', error)
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save deposit settings',
        variant: 'destructive',
        className: SEASON_ALERT_TOAST_CLASS,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Deposit Requirement */}
      <Card>
        <CardHeader>
          <CardTitle>Deposit Requirement</CardTitle>
          <CardDescription>Configure if and when deposits are required</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Require Deposit</Label>
              <p className="text-sm text-muted-foreground">
                Require guests to pay a deposit at booking
              </p>
            </div>
            <Switch
              checked={requireDeposit}
              onCheckedChange={(checked) => setValue('require_deposit', checked, { shouldDirty: true })}
            />
          </div>

          {requireDeposit && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Deposits help secure reservations and reduce no-shows. Configure the amount and rules below.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Deposit Amount Configuration */}
      {requireDeposit && (
        <Card>
          <CardHeader>
            <CardTitle>Deposit Amount</CardTitle>
            <CardDescription>How much deposit to collect</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deposit_type">Deposit Type</Label>
              <Select
                value={depositType}
                onValueChange={(value) => setValue('deposit_type', value as any, { shouldDirty: true })}
              >
                <SelectTrigger id="deposit_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage of Total</SelectItem>
                  <SelectItem value="flat_amount">Flat Amount</SelectItem>
                  <SelectItem value="first_night">First Night's Cost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {depositType === 'percentage' && (
              <div className="space-y-2">
                <Label htmlFor="deposit_percentage">Deposit Percentage (%)</Label>
                <Input
                  id="deposit_percentage"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="25"
                  {...register('deposit_percentage', { valueAsNumber: true })}
                />
                {errors.deposit_percentage && (
                  <p className="text-sm text-destructive">{errors.deposit_percentage.message}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  Percentage of reservation total (e.g., 25% of $400 = $100 deposit)
                </p>
              </div>
            )}

            {depositType === 'flat_amount' && (
              <div className="space-y-2">
                <Label htmlFor="deposit_amount_dollars">Deposit Amount ($)</Label>
                <Input
                  id="deposit_amount_dollars"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="100.00"
                  {...register('deposit_amount_dollars', { valueAsNumber: true })}
                />
                {errors.deposit_amount_dollars && (
                  <p className="text-sm text-destructive">{errors.deposit_amount_dollars.message}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  Fixed deposit amount regardless of reservation total
                </p>
              </div>
            )}

            {depositType === 'first_night' && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Deposit will be the cost of the first night of the stay (including all fees and taxes for that night).
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Applies To Booking Types */}
      {requireDeposit && (
        <Card>
          <CardHeader>
            <CardTitle>Booking Type Rules</CardTitle>
            <CardDescription>Which booking types require a deposit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {BOOKING_TYPES.map((type) => (
                <div key={type.value} className="flex items-start space-x-3">
                  <Checkbox
                    id={`booking-type-${type.value}`}
                    checked={appliesToBookingTypes.includes(type.value)}
                    onCheckedChange={() => toggleBookingType(type.value)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor={`booking-type-${type.value}`}
                      className="cursor-pointer font-medium"
                    >
                      {type.label}
                    </Label>
                    <p className="text-sm text-muted-foreground">{type.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {errors.applies_to_booking_types && (
              <p className="text-sm text-destructive">{errors.applies_to_booking_types.message}</p>
            )}

            {appliesToBookingTypes.length === 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  Warning: No booking types selected. Deposits will not be required for any reservations.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Exemptions and Payment Deadlines */}
      {requireDeposit && (
        <Card>
          <CardHeader>
            <CardTitle>Exemptions & Payment Deadlines</CardTitle>
            <CardDescription>Configure deposit exemptions and payment timing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Exempt if Paid in Full</Label>
                <p className="text-sm text-muted-foreground">
                  Skip deposit if guest pays full amount upfront
                </p>
              </div>
              <Switch
                checked={exemptIfPaidInFull}
                onCheckedChange={(checked) => setValue('exempt_if_paid_in_full', checked, { shouldDirty: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_payment_required_days_before">
                Full Payment Required (days before check-in)
              </Label>
              <Input
                id="full_payment_required_days_before"
                type="number"
                min="0"
                max="90"
                placeholder="Optional - leave blank for no requirement"
                {...register('full_payment_required_days_before', {
                  setValueAs: v => v === '' || v === null ? null : parseInt(v),
                })}
              />
              {errors.full_payment_required_days_before && (
                <p className="text-sm text-destructive">{errors.full_payment_required_days_before.message}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Require full payment X days before check-in (e.g., 7 days = full payment due 1 week before arrival)
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Example: With 25% deposit and full payment required 7 days before check-in, guests pay 25% at booking and the remaining 75% must be paid at least 7 days before arrival.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Save Button and Messages */}
      <div className="flex items-center justify-between">
        <Button type="submit" disabled={isSaving || !isDirty}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? 'Saving...' : 'Save Deposit Settings'}
        </Button>
      </div>
    </form>
  )
}
