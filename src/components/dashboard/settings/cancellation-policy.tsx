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

const cancellationPolicySchema = z.object({
  cancellationPolicy: z.string().max(5000, 'Policy text must be 5000 characters or less').nullable(),
})

type CancellationPolicyFormData = z.infer<typeof cancellationPolicySchema>

/** Current settings from DB (camelCase) so PATCH only updates cancellationPolicy without wiping other fields */
type SettingsForMerge = Record<string, unknown> | null

interface CancellationPolicySettingsProps {
  propertyId: string
  initialCancellationPolicy: string | null
  currentSettings: SettingsForMerge
}

const DEFAULT_PLACEHOLDER =
  'e.g. Free cancellation up to 7 days before check-in. 50% refund for cancellations 3–7 days before. No refund within 3 days of check-in.'

export function CancellationPolicySettings({
  propertyId,
  initialCancellationPolicy,
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
                <Label htmlFor="cancellationPolicy">Policy text</Label>
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
