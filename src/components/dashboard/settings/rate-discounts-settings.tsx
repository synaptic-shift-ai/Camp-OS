'use client'

/**
 * Rate Discounts Configuration Settings Component
 *
 * Allows property owners to configure:
 * - Weekly discount (percentage and minimum nights)
 * - Monthly discount (percentage and minimum nights)
 *
 * @module components/dashboard/settings/rate-discounts-settings
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Info, Percent } from 'lucide-react'
import { rateDiscountsConfigSchema, type RateDiscountsConfigInput } from '@/lib/config/schemas'
import type { RateDiscountsConfig } from '@/lib/config/types'

interface RateDiscountsSettingsProps {
  initialConfig?: RateDiscountsConfig
  propertyId: string
  onSave?: (config: RateDiscountsConfig) => Promise<void>
}

export function RateDiscountsSettings({ initialConfig, propertyId, onSave }: RateDiscountsSettingsProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<RateDiscountsConfigInput>({
    resolver: zodResolver(rateDiscountsConfigSchema),
    defaultValues: initialConfig ?? {
      weekly_discount_enabled: false,
      weekly_discount_percentage: 10,
      weekly_minimum_nights: 7,
      monthly_discount_enabled: false,
      monthly_discount_percentage: 25,
      monthly_minimum_nights: 28,
    },
  })

  const weeklyEnabled = watch('weekly_discount_enabled')
  const monthlyEnabled = watch('monthly_discount_enabled')
  const weeklyMinNights = watch('weekly_minimum_nights')
  const monthlyMinNights = watch('monthly_minimum_nights')

  const onSubmit = async (data: RateDiscountsConfigInput) => {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      // Keep existing user_defined_discounts when saving legacy fields
      const rateDiscountsConfig: RateDiscountsConfig = {
        user_defined_discounts: initialConfig?.user_defined_discounts ?? [],
        weekly_discount_enabled: data.weekly_discount_enabled ?? false,
        weekly_discount_percentage: data.weekly_discount_percentage ?? 0,
        weekly_minimum_nights: data.weekly_minimum_nights ?? 7,
        monthly_discount_enabled: data.monthly_discount_enabled ?? false,
        monthly_discount_percentage: data.monthly_discount_percentage ?? 0,
        monthly_minimum_nights: data.monthly_minimum_nights ?? 28,
      }

      if (onSave) {
        await onSave(rateDiscountsConfig)
      } else {
        // Default API call
        const response = await fetch(`/api/properties/${propertyId}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rate_discounts_config: rateDiscountsConfig }),
        })

        if (!response.ok) {
          throw new Error('Failed to save rate discount configuration')
        }
      }

      setSaveMessage({ type: 'success', text: 'Rate discount settings saved successfully!' })

      // Refresh the page data to show updated values
      router.refresh()
    } catch (error) {
      console.error('Error saving rate discount settings:', error)
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save rate discount settings',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Weekly Discount */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Weekly Discount
          </CardTitle>
          <CardDescription>Offer discounts for stays of 7+ nights</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Weekly Discount</Label>
              <p className="text-sm text-muted-foreground">
                Automatically apply discount for qualifying stays
              </p>
            </div>
            <Switch
              checked={weeklyEnabled ?? false}
              onCheckedChange={(checked) => setValue('weekly_discount_enabled', checked, { shouldDirty: true })}
            />
          </div>

          {weeklyEnabled && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="weekly_discount_percentage">Discount Percentage (%)</Label>
                  <Input
                    id="weekly_discount_percentage"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="10"
                    {...register('weekly_discount_percentage', { valueAsNumber: true })}
                  />
                  {errors.weekly_discount_percentage && (
                    <p className="text-sm text-destructive">{errors.weekly_discount_percentage.message}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Percentage off the nightly rate (e.g., 10% off)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weekly_minimum_nights">Minimum Nights</Label>
                  <Input
                    id="weekly_minimum_nights"
                    type="number"
                    min="1"
                    max="365"
                    step="1"
                    placeholder="7"
                    {...register('weekly_minimum_nights', { valueAsNumber: true })}
                  />
                  {errors.weekly_minimum_nights && (
                    <p className="text-sm text-destructive">{errors.weekly_minimum_nights.message}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Nights required to qualify for weekly discount
                  </p>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Example: With 10% weekly discount and 7-night minimum, a $100/night site would be $90/night for
                  stays of 7+ nights.
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      {/* Monthly Discount */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Monthly Discount
          </CardTitle>
          <CardDescription>Offer discounts for stays of 28+ nights</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Monthly Discount</Label>
              <p className="text-sm text-muted-foreground">
                Automatically apply discount for qualifying stays
              </p>
            </div>
            <Switch
              checked={monthlyEnabled ?? false}
              onCheckedChange={(checked) => setValue('monthly_discount_enabled', checked, { shouldDirty: true })}
            />
          </div>

          {monthlyEnabled && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="monthly_discount_percentage">Discount Percentage (%)</Label>
                  <Input
                    id="monthly_discount_percentage"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="25"
                    {...register('monthly_discount_percentage', { valueAsNumber: true })}
                  />
                  {errors.monthly_discount_percentage && (
                    <p className="text-sm text-destructive">{errors.monthly_discount_percentage.message}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Percentage off the nightly rate (e.g., 25% off)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthly_minimum_nights">Minimum Nights</Label>
                  <Input
                    id="monthly_minimum_nights"
                    type="number"
                    min="1"
                    max="365"
                    step="1"
                    placeholder="28"
                    {...register('monthly_minimum_nights', { valueAsNumber: true })}
                  />
                  {errors.monthly_minimum_nights && (
                    <p className="text-sm text-destructive">{errors.monthly_minimum_nights.message}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Nights required to qualify for monthly discount
                  </p>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Example: With 25% monthly discount and 28-night minimum, a $100/night site would be $75/night for
                  stays of 28+ nights.
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      {/* Validation Warnings */}
      {weeklyEnabled && monthlyEnabled && (monthlyMinNights ?? 28) < (weeklyMinNights ?? 7) && (
        <Alert variant="destructive">
          <AlertDescription>
            Warning: Monthly minimum nights ({monthlyMinNights ?? 28}) should be greater than or equal to weekly minimum
            nights ({weeklyMinNights ?? 7}) to avoid confusion.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Card */}
      {(weeklyEnabled || monthlyEnabled) && (
        <Card>
          <CardHeader>
            <CardTitle>Discount Summary</CardTitle>
            <CardDescription>Active discounts that will apply automatically</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {weeklyEnabled && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">Weekly Discount</p>
                    <p className="text-sm text-muted-foreground">
                      {weeklyMinNights}+ nights
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">
                      {watch('weekly_discount_percentage')}%
                    </p>
                    <p className="text-sm text-muted-foreground">off</p>
                  </div>
                </div>
              )}
              {monthlyEnabled && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">Monthly Discount</p>
                    <p className="text-sm text-muted-foreground">
                      {monthlyMinNights}+ nights
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">
                      {watch('monthly_discount_percentage')}%
                    </p>
                    <p className="text-sm text-muted-foreground">off</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button and Messages */}
      <div className="flex items-center justify-between">
        <div className="flex-1 mr-4">
          {saveMessage && (
            <Alert variant={saveMessage.type === 'error' ? 'destructive' : 'default'}>
              <AlertDescription>{saveMessage.text}</AlertDescription>
            </Alert>
          )}
        </div>
        <Button type="submit" disabled={isSaving || !isDirty}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? 'Saving...' : 'Save Discount Settings'}
        </Button>
      </div>
    </form>
  )
}
