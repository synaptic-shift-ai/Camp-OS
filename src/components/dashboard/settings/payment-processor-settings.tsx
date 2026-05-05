'use client'

/**
 * Payment Processor Settings Component
 *
 * Allows property owners to select which payment processor to use:
 * - Stripe (Stripe Connect)
 * - CampOS Payments (coming soon)
 * - None (manual payments only)
 *
 * Follows the same pattern as DepositSettings for consistency.
 *
 * @module components/dashboard/settings/payment-processor-settings
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Info } from 'lucide-react'
import type { PaymentProcessorType } from '@/lib/config/types'

const SEASON_ERROR_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

const PROCESSOR_OPTIONS: { value: PaymentProcessorType; label: string; description: string }[] = [
  {
    value: 'stripe',
    label: 'Stripe',
    description:
      'Process payments through Stripe Connect. Supports credit/debit cards, ACH, and card-on-file.',
  },
  {
    value: 'campost_payments',
    label: 'CampOS Payments',
    description:
      'Built-in payment processing by CampOS. Coming soon — pending partner selection.',
  },
  {
    value: 'none',
    label: 'None',
    description: 'Disable online payments. All payments must be recorded manually.',
  },
]

interface PaymentProcessorSettingsProps {
  initialProcessor?: PaymentProcessorType | null
  propertyId: string
  canEdit?: boolean
}

export function PaymentProcessorSettings({
  initialProcessor,
  propertyId,
  canEdit = true,
}: PaymentProcessorSettingsProps) {
  const readOnly = !canEdit
  const router = useRouter()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [selectedProcessor, setSelectedProcessor] = useState<PaymentProcessorType>(
    initialProcessor ?? 'stripe',
  )

  const onSubmit = async () => {
    setIsSaving(true)

    try {
      const response = await fetch(`/api/properties/${propertyId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_processor: selectedProcessor }),
      })

      if (!response.ok) {
        throw new Error('Failed to save payment processor setting')
      }

      toast({
        title: 'Payment processor saved',
        description: `Payment processor set to ${PROCESSOR_OPTIONS.find((o) => o.value === selectedProcessor)?.label ?? selectedProcessor}.`,
        variant: 'success',
      })

      router.refresh()
    } catch (error) {
      console.error('Error saving payment processor:', error)
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save payment processor',
        variant: 'destructive',
        className: SEASON_ERROR_TOAST_CLASS,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const isDirty = selectedProcessor !== (initialProcessor ?? 'stripe')

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Payment Processor</CardTitle>
          <CardDescription>
            Choose how online payments are processed for your property
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payment_processor">Processor</Label>
            <Select
              value={selectedProcessor}
              disabled={readOnly}
              onValueChange={(value) => setSelectedProcessor(value as PaymentProcessorType)}
            >
              <SelectTrigger id="payment_processor" disabled={readOnly}>
                <SelectValue placeholder="Select a payment processor" />
              </SelectTrigger>
              <SelectContent>
                {PROCESSOR_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {PROCESSOR_OPTIONS.find((o) => o.value === selectedProcessor)?.description}
            </AlertDescription>
          </Alert>

          {selectedProcessor === 'campost_payments' && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                CampOS Payments is not yet available. Your guests will not be able to pay online until
                a processor is configured. Select Stripe or None to enable payments.
              </AlertDescription>
            </Alert>
          )}
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
