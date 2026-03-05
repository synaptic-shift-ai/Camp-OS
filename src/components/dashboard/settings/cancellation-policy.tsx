'use client'

/**
 * Cancellation Policy Settings
 *
 * Form for property cancellation policy text. Shown to guests during booking
 * and on the property portal. Persists via PATCH /api/v1/properties/[propertyId]
 * with settings.cancellationPolicy (merged with existing settings).
 *
 * @module components/dashboard/settings/cancellation-policy
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, FileText } from 'lucide-react'
import { Input } from '@/components/ui/input'
// import { Description } from '@/components/ui/description'

const cancellationPolicySchema = z.object({
  cancellationPolicy: z.string().max(5000, 'Policy text must be 5000 characters or less').nullable(),
  freeCancellationWindow: z.number().int().min(0).nullable(),
  cancellationRefundPercentage: z.number().int().min(0).max(100).nullable(),
  cancellationNonRefundableDays: z.number().int().min(0).nullable(),
  refundEligiblePeriod: z
    .string()
    .regex(/^(?:\d+|\d+-\d+)$/, {
      message: 'Enter a number (e.g. 4) or a range (e.g. 3-6)',
    })
    .nullable(),
})

type CancellationPolicyFormData = z.infer<typeof cancellationPolicySchema>

/** Current settings from DB (camelCase) so PATCH only updates cancellationPolicy without wiping other fields */
type SettingsForMerge = Record<string, unknown> | null

interface CancellationPolicySettingsProps {
  propertyId: string
  initialCancellationPolicy: string | null
  initialFreeCancellationWindow: number | null
  initialCancellationRefundPercentage: number | null
  initialCancellationNonRefundableDays: number | null
  initialRefundEligiblePeriod: string | null
  currentSettings: SettingsForMerge
}

const DEFAULT_PLACEHOLDER =
  'e.g. Free cancellation up to 7 days before check-in. 50% refund for cancellations 3–7 days before. No refund within 3 days of check-in.'

export function CancellationPolicySettings({
  propertyId,
  initialCancellationPolicy,
  initialFreeCancellationWindow,
  initialCancellationRefundPercentage,
  initialCancellationNonRefundableDays,
  initialRefundEligiblePeriod,
  currentSettings,
}: CancellationPolicySettingsProps) {
    const router = useRouter()
    const [isSaving, setIsSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    } = useForm<CancellationPolicyFormData>({
    resolver: zodResolver(cancellationPolicySchema),
    defaultValues: {
        cancellationPolicy: initialCancellationPolicy ?? '',
        freeCancellationWindow: initialFreeCancellationWindow ?? null,
        cancellationRefundPercentage: initialCancellationRefundPercentage ?? null,
        cancellationNonRefundableDays: initialCancellationNonRefundableDays ?? null,
        refundEligiblePeriod: initialRefundEligiblePeriod ?? null,
    },
    })

    const onSubmit = async (data: CancellationPolicyFormData) => {
        setIsSaving(true)
        setMessage(null)
        try {
            const policyValue = data.cancellationPolicy?.trim() || null
            const mergedSettings = {
            ...(currentSettings && typeof currentSettings === 'object' ? currentSettings : {}),
            cancellationPolicy: policyValue,
            freeCancellationWindow: data.freeCancellationWindow ?? null,
            cancellationRefundPercentage: data.cancellationRefundPercentage ?? null,
            cancellationNonRefundableDays: data.cancellationNonRefundableDays ?? null,
            refundEligiblePeriod: data.refundEligiblePeriod ?? null,
            }

            const response = await fetch(`/api/v1/properties/${propertyId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: mergedSettings }),
            })

            const result = await response.json()
            if (!response.ok || !result.success) {
            throw new Error(result.error?.message ?? 'Failed to save cancellation policy')
            }
            setMessage({ type: 'success', text: 'Cancellation policy saved.' })
            router.refresh()
        } catch (err) {
            setMessage({
            type: 'error',
            text: err instanceof Error ? err.message : 'Failed to save cancellation policy',
            })
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Card>
            <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Cancellation policy
            </CardTitle>
            <CardDescription>
                This text is shown to guests during booking and on your property page. Describe your refund and cancellation rules clearly.
            </CardDescription>
            </CardHeader>
            <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {message && (
                <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
                    <AlertDescription>{message.text}</AlertDescription>
                </Alert>
                )}

                <div className="space-y-2">
                    <Label htmlFor="cancellationPolicy">Cancellation Policy</Label>
                    <Textarea
                        id="cancellationPolicy"
                        {...register('cancellationPolicy')}
                        placeholder={DEFAULT_PLACEHOLDER}
                        rows={6}
                        className={errors.cancellationPolicy ? 'border-destructive' : ''}
                    />
                    {errors.cancellationPolicy && (
                        <p className="text-sm text-destructive">{errors.cancellationPolicy.message}</p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="freeCancellationWindow">Free cancellation window (days)</Label>
                        <p className="text-sm text-muted-foreground">Number of days before check-in that guests can cancel for free.</p>
                        <Input
                            id="freeCancellationWindow"
                            type="number"
                            min="0"
                            placeholder="0"
                            className={errors.freeCancellationWindow ? 'border-destructive' : ''}
                            {...register('freeCancellationWindow', { valueAsNumber: true })}
                        />
                        {errors.freeCancellationWindow && (
                            <p className="text-sm text-destructive">{errors.freeCancellationWindow.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="cancellationRefundPercentage">Refund percentage for late cancellations (%)</Label>
                        <p className="text-sm text-muted-foreground">Percentage of the booking refunded when cancelling outside the free window.</p>
                        <Input
                            id="cancellationRefundPercentage"
                            type="number"
                            min="0"
                            max="100"
                            placeholder="0"
                            className={errors.cancellationRefundPercentage ? 'border-destructive' : ''}
                            {...register('cancellationRefundPercentage', { valueAsNumber: true })}
                        />
                        {errors.cancellationRefundPercentage && (
                            <p className="text-sm text-destructive">{errors.cancellationRefundPercentage.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="cancellationNonRefundableDays">Non-refundable window (days before check-in)</Label>
                        <p className="text-sm text-muted-foreground">Cancellations within this many days of check-in receive no refund.</p>
                        <Input
                            id="cancellationNonRefundableDays"
                            type="number"
                            min="0"
                            placeholder="0"
                            className={errors.cancellationNonRefundableDays ? 'border-destructive' : ''}
                            {...register('cancellationNonRefundableDays', { valueAsNumber: true })}
                        />
                        {errors.cancellationNonRefundableDays && (
                            <p className="text-sm text-destructive">{errors.cancellationNonRefundableDays.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="refundEligiblePeriod">Refund-eligible period (days before check-in)</Label>
                        <p className="text-sm text-muted-foreground">
                          Enter a single day (e.g. 4) or a range of days (e.g. 3-6) before check-in when a cancellation
                          still qualifies for the partial refund percentage.
                        </p>
                        <Input
                            id="refundEligiblePeriod"
                            type="text"
                            placeholder="e.g. 4 or 3-6"
                            className={errors.refundEligiblePeriod ? 'border-destructive' : ''}
                            {...register('refundEligiblePeriod')}
                        />
                        {errors.refundEligiblePeriod && (
                            <p className="text-sm text-destructive">{errors.refundEligiblePeriod.message}</p>
                        )}
                    </div>
                </div>

                <Button type="submit" disabled={isSaving || !isDirty}>
                {isSaving ? (
                    <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                    </>
                ) : (
                    'Save changes'
                )}
                </Button>
            </form>
            </CardContent>
        </Card>
    )
}
