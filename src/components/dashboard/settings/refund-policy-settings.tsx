'use client'

/**
 * Refund Policy Settings Component
 *
 * Allows property owners to configure the default refund handling method.
 * - Original Method: refunds go back to the original payment method
 * - Guest Credit: refunds are issued as property credit for future stays
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Info } from 'lucide-react'

type RefundHandling = 'original_method' | 'guest_credit'

interface RefundPolicySettingsProps {
  propertyId: string
  initialDefaultRefundHandling: string | null
  canEdit?: boolean
}

const SEASON_ALERT_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

const HANDLING_OPTIONS: { value: RefundHandling; label: string; description: string }[] = [
  {
    value: 'original_method',
    label: 'Original Method',
    description: 'Refunds will go back to the original payment method used (card, check, cash).',
  },
  {
    value: 'guest_credit',
    label: 'Guest Credit',
    description: 'Refunds will be issued as property credit that guests can apply to future reservations.',
  },
]

export function RefundPolicySettings({
  propertyId,
  initialDefaultRefundHandling,
  canEdit = true,
}: RefundPolicySettingsProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [refundHandling, setRefundHandling] = useState<RefundHandling>(
    (initialDefaultRefundHandling as RefundHandling) || 'original_method',
  )
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setRefundHandling((initialDefaultRefundHandling as RefundHandling) || 'original_method')
    setHasChanges(false)
  }, [initialDefaultRefundHandling])

  const handleChange = useCallback((value: string) => {
    setRefundHandling(value as RefundHandling)
    setHasChanges(true)
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/v1/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { defaultRefundHandling: refundHandling },
        }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error?.message || 'Failed to save refund policy settings')
      }

      toast({
        title: 'Refund policy saved',
        description: 'Default refund handling has been updated.',
        variant: 'success',
      })
      setHasChanges(false)
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      toast({
        title: 'Save failed',
        description: message,
        variant: 'destructive',
        className: SEASON_ALERT_TOAST_CLASS,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const readOnly = !canEdit

  const selectedOption = HANDLING_OPTIONS.find((o) => o.value === refundHandling)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Refund Policy</CardTitle>
          <CardDescription>
            Configure the default refund handling method for your property.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="space-y-2">
            <Label htmlFor="default-refund-handling">Default Refund Handling</Label>
            <Select
              value={refundHandling}
              onValueChange={handleChange}
              disabled={readOnly}
            >
              <SelectTrigger id="default-refund-handling">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HANDLING_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedOption && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>{selectedOption.description}</AlertDescription>
            </Alert>
          )}

          {canEdit && hasChanges && (
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
