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
import { useToast } from '@/hooks/use-toast'
import { getApiFailureMessage } from '@/lib/api/get-api-failure-message'
import { Loader2, FileText, ShieldAlert, Plus, Pencil, Trash2 } from 'lucide-react'
import {
  CancellationRuleDialog,
  type CancellationRule,
} from '@/components/dashboard/settings/cancellation-rule-dialog'

const cancellationPolicySchema = z.object({
  termsAndConditions: z.string().max(5000, 'Terms and conditions text must be 5000 characters or less').nullable(),
  cancellationPolicy: z.string().max(5000, 'Policy text must be 5000 characters or less').nullable(),
})

type CancellationPolicyFormData = z.infer<typeof cancellationPolicySchema>

interface CancellationPolicySettingsProps {
  propertyId: string
  initialTermsAndConditions: string | null
  initialCancellationPolicy: string | null
  initialCancellationRules?: CancellationRule[]
}

const DEFAULT_PLACEHOLDER =
  'e.g. Free cancellation up to 7 days before check-in. 50% refund for cancellations 3–7 days before. No refund within 3 days of check-in.'

const SEASON_ALERT_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

export function CancellationPolicySettings({
  propertyId,
  initialTermsAndConditions,
  initialCancellationPolicy,
  initialCancellationRules,
}: CancellationPolicySettingsProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [isSaving, setIsSaving] = useState(false)
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
        termsAndConditions: initialTermsAndConditions ?? '',
        cancellationPolicy: initialCancellationPolicy ?? '',
    },
    })

    const deleteRule = (ruleId: string) => {
      setCancellationRules((prev) => prev.filter((rule) => rule.id !== ruleId))
    }

    const onSubmit = async (data: CancellationPolicyFormData) => {
        setIsSaving(true)
        try {
            const policyValue = data.cancellationPolicy?.trim() || null
            const termsValue = data.termsAndConditions?.trim() || null
            const body: {
              terms_and_conditions: string | null
              cancellation_policy: string | null
              cancellation_policy_config: { refund_tiers: CancellationRule[] }
            } = {
              terms_and_conditions: termsValue,
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
              throw new Error(getApiFailureMessage(result) ?? 'Failed to save cancellation policy')
            }
            toast({
              title: 'Terms & policy saved',
              description: 'Terms & Policy saved.',
              className: SEASON_ALERT_TOAST_CLASS,
            })
            router.refresh()
        } catch (err) {
            toast({
              title: 'Save failed',
              description: err instanceof Error ? err.message : 'Failed to save cancellation policy',
              variant: 'destructive',
              className: SEASON_ALERT_TOAST_CLASS,
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
              Terms & Conditions
            </CardTitle>
            <CardDescription>
              Set up terms and conditions for your property.
            </CardDescription>
          </CardHeader>
          <CardContent>

            <div className="space-y-2">
              <Label htmlFor="termsAndConditions">Terms and Conditions</Label>
              <Textarea
                id="termsAndConditions"
                {...register('termsAndConditions')}
                rows={6}
                className={errors.termsAndConditions ? 'border-destructive' : ''}
              />
              {errors.termsAndConditions && (
                <p className="text-sm text-destructive">{errors.termsAndConditions.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  Cancellation Rules
                </CardTitle>
                <CardDescription className="text-pretty">
                  Set up flexible cancellation rules to suit your property and guests.
                </CardDescription>
              </div>
              <Button
                onClick={() => {
                  setEditingRule(null)
                  setIsRuleDialogOpen(true)
                }}
                className="w-full shrink-0 sm:w-auto"
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
                  <li
                    key={rule.id}
                    className="flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">Rule {i + 1}</p>
                      <p className="text-muted-foreground">
                        Refund {rule.refund_percentage}% • {rule.days_before_reservation} days before check-in
                      </p>
                    </div>
                    <div className="flex items-center justify-end gap-1 border-t border-border/60 pt-2 sm:border-0 sm:pt-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
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
                        className="h-9 w-9 text-destructive hover:text-destructive"
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
            className="w-full sm:w-auto"
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
