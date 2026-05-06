'use client'

/**
 * Payment Processor Settings Component
 *
 * Allows property owners to enable multiple payment methods:
 * - Stripe (credit/debit cards, ACH, card-on-file)
 * - PayPal
 * - Apple Pay
 *
 * The enabled methods are stored as an array in the `settings` JSONB field
 * under the key `enabled_payment_methods`.
 *
 * @module components/dashboard/settings/payment-processor-settings
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Info } from 'lucide-react'
import { DEFAULT_PAYMENT_METHODS, type PaymentMethod } from '@/lib/config/types'

const SEASON_ERROR_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string; description: string }[] = [
  {
    value: 'stripe',
    label: 'Stripe',
    description:
      'Process payments through Stripe Connect. Supports credit/debit cards, ACH, and card-on-file.',
  },
  {
    value: 'paypal',
    label: 'PayPal',
    description:
      'Accept PayPal payments from guests. Supports PayPal balance, linked cards, and Venmo.',
  },
  {
    value: 'apple_pay',
    label: 'Apple Pay',
    description:
      'Enable Apple Pay for a fast, secure checkout experience on Safari and supported browsers.',
  },
]

interface PaymentProcessorSettingsProps {
  initialEnabledMethods?: PaymentMethod[] | null
  propertyId: string
  canEdit?: boolean
}

export function PaymentProcessorSettings({
  initialEnabledMethods,
  propertyId,
  canEdit = true,
}: PaymentProcessorSettingsProps) {
  const readOnly = !canEdit
  const router = useRouter()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [enabledMethods, setEnabledMethods] = useState<PaymentMethod[]>(
    initialEnabledMethods ?? DEFAULT_PAYMENT_METHODS,
  )

  const toggleMethod = (method: PaymentMethod) => {
    setEnabledMethods((prev) =>
      prev.includes(method)
        ? prev.filter((m) => m !== method)
        : [...prev, method],
    )
  }

  const onSubmit = async () => {
    setIsSaving(true)

    try {
      const response = await fetch(`/api/properties/${propertyId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled_payment_methods: enabledMethods }),
      })

      if (!response.ok) {
        throw new Error('Failed to save payment methods')
      }

      const labels = enabledMethods
        .map((m) => PAYMENT_METHOD_OPTIONS.find((o) => o.value === m)?.label ?? m)
        .join(', ')

      toast({
        title: 'Payment methods saved',
        description: `Enabled: ${labels}`,
        variant: 'success',
      })

      router.refresh()
    } catch (error) {
      console.error('Error saving payment methods:', error)
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save payment methods',
        variant: 'destructive',
        className: SEASON_ERROR_TOAST_CLASS,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const initial = initialEnabledMethods ?? DEFAULT_PAYMENT_METHODS
  const isDirty =
    enabledMethods.length !== initial.length ||
    !enabledMethods.every((m) => initial.includes(m))

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
          <CardDescription>
            Choose which payment methods are available to your guests at checkout
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {PAYMENT_METHOD_OPTIONS.map((option) => (
            <div
              key={option.value}
              className="flex items-start gap-3 rounded-lg border p-4"
            >
              <Checkbox
                id={`payment-method-${option.value}`}
                checked={enabledMethods.includes(option.value)}
                onCheckedChange={() => toggleMethod(option.value)}
                disabled={readOnly}
                className="mt-0.5"
              />
              <div className="grid gap-1">
                <Label
                  htmlFor={`payment-method-${option.value}`}
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  {option.label}
                </Label>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </div>
            </div>
          ))}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {enabledMethods.length === 0
                ? 'No payment methods are enabled. Guests will not be able to pay online.'
                : `${enabledMethods.length} payment method${enabledMethods.length === 1 ? '' : 's'} enabled. Guests can choose from these at checkout.`}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex items-center justify-between">
          <Button type="submit" disabled={isSaving || !isDirty} onClick={onSubmit}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  )
}
