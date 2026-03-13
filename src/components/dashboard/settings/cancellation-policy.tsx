'use client'

/**
 * Cancellation Policy Settings
 *
 * Form for property cancellation policy text. Shown to guests during booking
 * and on the property portal. Persists via PATCH /api/v1/properties/[propertyId]:
 * cancellation_policy and cancellation_policy_config columns (not settings).
 *
 * @module components/dashboard/settings/cancellation-policy
 */

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, FileText, ShieldAlert, Plus, Pencil, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  CancellationRuleDialog,
  type CancellationRule,
} from '@/components/dashboard/settings/cancellation-rule-dialog'
// import { Description } from '@/components/ui/description'

function optionalNumber(schema: z.ZodNumber) {
  return z.preprocess(
    (val) => {
      if (val === '' || val === undefined) return null
      if (typeof val === 'number' && Number.isNaN(val)) return null
      return val
    },
    schema.nullable()
  )
}

function parseRefundEligiblePeriod(val: string | null): { minDays: number; maxDays: number } | null {
  if (val == null || (typeof val === 'string' && val.trim() === '')) return null
  const s = typeof val === 'string' ? val.trim() : String(val)
  const parts = s.split('-').map((x) => parseInt(x.trim(), 10))
  const first = parts[0]
  if (first === undefined || Number.isNaN(first)) return null
  const minDays = first
  const second = parts[1]
  const maxDays = second !== undefined && !Number.isNaN(second) ? second : minDays
  return { minDays, maxDays }
}

const cancellationPolicySchema = z.object({
  cancellationPolicy: z.string().max(5000, 'Policy text must be 5000 characters or less').nullable(),
  freeCancellationWindow: optionalNumber(z.number().int().min(0)),
  cancellationRefundPercentage: optionalNumber(z.number().int().min(0).max(100)),
  cancellationNonRefundableDays: optionalNumber(z.number().int().min(0)),
  refundEligiblePeriod: z.preprocess(
    (val) =>
      val === '' || (typeof val === 'string' && val.trim() === '') || val === undefined
        ? null
        : val,
    z
      .string()
      .regex(/^(?:\d+|\d+-\d+)$/, {
        message: 'Enter a number (e.g. 4) or a range (e.g. 3-6)',
      })
      .nullable()
  ),
})
.refine(
    (data) => {
      const hasPercentage = data.cancellationRefundPercentage != null
      if (!hasPercentage) return true
      return data.refundEligiblePeriod != null && data.refundEligiblePeriod.trim() !== ''
    },
    {
      message: 'Refund-eligible period (days before check-in) is required when refund percentage is set.',
      path: ['refundEligiblePeriod'],
    }
)
.superRefine((data, ctx) => {
  const free = data.freeCancellationWindow ?? null
  const nonRefundable = data.cancellationNonRefundableDays ?? null
  const eligible = parseRefundEligiblePeriod(data.refundEligiblePeriod ?? null)

  const message =
    'You cannot set the same value for multiple fields. Please adjust the values to avoid overlapping periods.'

  // Free vs non-refundable: disallow exact same day value
  if (free != null && nonRefundable != null && free === nonRefundable) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message,
      path: ['freeCancellationWindow'],
    })
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message,
      path: ['cancellationNonRefundableDays'],
    })
  }

  if (eligible != null) {
    // Free vs refund-eligible range: disallow when free equals any boundary of the range
    if (
      free != null &&
      (free === eligible.minDays || free === eligible.maxDays)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        path: ['freeCancellationWindow'],
      })
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        path: ['refundEligiblePeriod'],
      })
    }

    // Non-refundable vs refund-eligible range: disallow when non-refundable equals any boundary of the range
    if (
      nonRefundable != null &&
      (nonRefundable === eligible.minDays || nonRefundable === eligible.maxDays)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        path: ['cancellationNonRefundableDays'],
      })
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        path: ['refundEligiblePeriod'],
      })
    }
  }
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
  initialCancellationRules?: CancellationRule[]
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
  initialCancellationRules,
  currentSettings,
}: CancellationPolicySettingsProps) {
    const router = useRouter()
    const [isSaving, setIsSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false)
    const [cancellationRules, setCancellationRules] = useState<CancellationRule[]>(initialCancellationRules ?? [])
    const [editingRule, setEditingRule] = useState<CancellationRule | null>(null)

    useEffect(() => {
      setCancellationRules(initialCancellationRules ?? [])
    }, [initialCancellationRules])

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

    const deleteRule = (ruleId: string) => {
      setCancellationRules((prev) => prev.filter((rule) => rule.id !== ruleId))
    }

    const onSubmit = async (data: CancellationPolicyFormData) => {
        setIsSaving(true)
        setMessage(null)
        try {
            const policyValue = data.cancellationPolicy?.trim() || null
            const body: {
              cancellation_policy: string | null
              cancellation_policy_config: { refund_tiers: CancellationRule[] }
            } = {
              cancellation_policy: policyValue,
              cancellation_policy_config: { refund_tiers: cancellationRules },
            }

            const response = await fetch(`/api/v1/properties/${propertyId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
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
      <div className="space-y-6">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  Cancellation Rules
                </CardTitle>
                <CardDescription>
                  Set up flexible cancellation rules to suit your property and guests.
                </CardDescription>
              </div>
              <Button
                onClick={() => {
                  setEditingRule(null)
                  setIsRuleDialogOpen(true)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Rules
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {cancellationRules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>
                  No rules yet. Add a rule to define refund % by days before check-in.
                </p>
                <p className="text-sm">Click "Add Rules" to create your first rule.</p>
              </div>
            ) : (
              <ul className="space-y-2 text-sm">
                {cancellationRules.map((rule, i) => (
                  <li key={rule.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span>
                      Rule {i + 1}: Refund % = {rule.refund_percentage}, Days before reservation: {rule.days_before_reservation}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Edit rule"
                        onClick={() => {
                          setEditingRule(rule)
                          setIsRuleDialogOpen(true)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        aria-label="Delete rule"
                        onClick={() => deleteRule(rule.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <CancellationRuleDialog
          open={isRuleDialogOpen}
          onOpenChange={(open) => {
            if (!open) setEditingRule(null)
            setIsRuleDialogOpen(open)
          }}
          onSubmit={(rule) => {
            setCancellationRules((prev) => {
              const i = prev.findIndex((r) => r.id === rule.id)
              if (i >= 0) {
                const next = [...prev]
                next[i] = rule
                return next
              }
              return [...prev, rule]
            })
          }}
          initialValues={editingRule}
          existingRules={cancellationRules}
          title={editingRule ? 'Edit cancellation rule' : 'Add cancellation rule'}
          submitLabel={editingRule ? 'Save changes' : 'Add rule'}
        />

        <div className="flex items-center justify-end">
          <Button
            type="button"
            onClick={() => handleSubmit(onSubmit)()}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      </div>
    )
}
