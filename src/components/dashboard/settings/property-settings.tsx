'use client'

/**
 * Property Details Settings
 *
 * Form for property name, address, contact (phone, email), and hours of operation.
 * Persists via PATCH /api/v1/properties/[propertyId].
 */

import { useMemo, useRef, useState } from 'react'
import { format, parse } from 'date-fns'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OpenPeriodDatePicker } from '@/components/dashboard/settings/open-period-date-picker'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { getApiFailureMessage } from '@/lib/api/get-api-failure-message'
import { Loader2, Building2, CreditCard, CheckCircle2, PlugZap, Unplug } from 'lucide-react'

const SEASON_ERROR_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

const propertyDetailsSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).optional(),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  zipCode: z.string().max(20).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  checkInTime: z.string().max(50).optional(),
  checkOutTime: z.string().max(50).optional(),
})

type PropertyDetailsFormData = z.infer<typeof propertyDetailsSchema>

function isSameCalendarDate(a: Date | undefined, b: Date | undefined): boolean {
  if (a === undefined && b === undefined) return true
  if (a === undefined || b === undefined) return false
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function parseIsoDateOnly(s: string | null | undefined): Date | undefined {
  if (s == null || typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined
  return parse(s, 'yyyy-MM-dd', new Date())
}

function toIsoDateOnly(d: Date | undefined): string | null {
  if (!d) return null
  return format(d, 'yyyy-MM-dd')
}

export type PropertyDetailsInitial = {
  name: string
  description?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  phone?: string | null
  email?: string | null
  checkInTime?: string | null
  checkOutTime?: string | null
  /** ISO YYYY-MM-DD from property.settings */
  openPeriodFrom?: string | null
  openPeriodUntil?: string | null
}

interface PropertySettingsProps {
  propertyId: string
  initial: PropertyDetailsInitial
  stripeConnected: boolean
  stripeConnectedAt?: string | null
  stripeAccountId?: string | null
  /** When false, fields are disabled and save / Stripe actions are hidden. */
  canEdit?: boolean
}

export function PropertySettings({
  propertyId,
  initial,
  stripeConnected,
  stripeConnectedAt,
  stripeAccountId,
  canEdit = true,
}: PropertySettingsProps) {
  const readOnly = !canEdit
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [isStripeUpdating, setIsStripeUpdating] = useState(false)
  const [stripeStatus, setStripeStatus] = useState<{
    connected: boolean
    connectedAt?: string | null
    connectedId?: string | null
  }>({
    connected: stripeConnected,
    connectedAt: stripeConnectedAt ?? null,
    connectedId: stripeAccountId ?? null,
  })

  const [openFrom, setOpenFrom] = useState<Date | undefined>(() =>
    parseIsoDateOnly(initial.openPeriodFrom ?? undefined),
  )
  const [openUntil, setOpenUntil] = useState<Date | undefined>(() =>
    parseIsoDateOnly(initial.openPeriodUntil ?? undefined),
  )

  const initialOpenPeriodRef = useRef<{ from: Date | undefined; until: Date | undefined }>({
    from: parseIsoDateOnly(initial.openPeriodFrom ?? undefined),
    until: parseIsoDateOnly(initial.openPeriodUntil ?? undefined),
  })

  const openPeriodDirty = useMemo(() => {
    const { from, until } = initialOpenPeriodRef.current
    return (
      !isSameCalendarDate(openFrom, from) || !isSameCalendarDate(openUntil, until)
    )
  }, [openFrom, openUntil])

  const handleOpenFromSelect = (d: Date | undefined) => {
    setOpenFrom(d)
    if (d && openUntil && openUntil < d) setOpenUntil(d)
  }

  const handleOpenUntilSelect = (d: Date | undefined) => {
    setOpenUntil(d)
    if (d && openFrom && d < openFrom) setOpenFrom(d)
  }

  const handleStripeConnect = async () => {
    if (stripeStatus.connected || isStripeUpdating) return

    try {
      const state = JSON.stringify({
        propertyId,
        timestamp: Date.now(),
        redirectPath: `/dashboard/${propertyId}/settings?tab=property`,
      })

      const clientId = process.env.NEXT_PUBLIC_STRIPE_CLIENT_ID

      if (!clientId) {
        console.error("Missing NEXT_PUBLIC_STRIPE_CLIENT_ID environment variable")
        toast({
          title: 'Stripe configuration missing',
          description: 'Stripe Connect is not configured. Please contact support.',
          variant: 'destructive',
            className: SEASON_ERROR_TOAST_CLASS,
        })
        return
      }

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
      if (!baseUrl) {
        console.error("Missing NEXT_PUBLIC_BASE_URL environment variable")
        toast({
          title: 'Stripe configuration missing',
          description: 'Stripe Connect is not configured. Please contact support.',
          variant: 'destructive',
            className: SEASON_ERROR_TOAST_CLASS,
        })
        return
      }

      const redirectUri = `${baseUrl}/api/stripe/connect/authorize`

      const stripeOAuthUrl = new URL("https://connect.stripe.com/oauth/authorize")
      stripeOAuthUrl.searchParams.set("client_id", clientId)
      stripeOAuthUrl.searchParams.set('state', state)
      stripeOAuthUrl.searchParams.set('redirect_uri', redirectUri)
      stripeOAuthUrl.searchParams.set('response_type', 'code')
      stripeOAuthUrl.searchParams.set('scope', 'read_write')

      window.location.href = stripeOAuthUrl.toString()
    } catch (error) {
      console.error('Error initiating Stripe Connect:', error)
      toast({
        title: 'Stripe connection failed',
        description: 'Failed to start Stripe connection. Please try again.',
        variant: 'destructive',
        className: SEASON_ERROR_TOAST_CLASS,
      })
    }
  }

  const handleStripeDisconnect = async () => {
    if (!stripeStatus.connected || isStripeUpdating) return

    const confirmed = window.confirm(
      'Are you sure you want to disconnect this Stripe account? You can reconnect anytime.'
    )

    if (!confirmed) return

    setIsStripeUpdating(true)

    try {
      const response = await fetch(`/api/v1/properties/${propertyId}/stripe-account`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(getApiFailureMessage(result) || 'Failed to disconnect Stripe')
      }

      setStripeStatus({
        connected: false,
        connectedAt: null,
        connectedId: null,
      })
      toast({
        title: 'Stripe disconnected',
        description: 'Stripe account has been disconnected successfully.',
        variant: "success",
      })
    } catch (error) {
      console.error('Error disconnecting Stripe:', error)
      toast({
        title: 'Stripe disconnect failed',
        description: 'Failed to disconnect Stripe. Please try again.',
        variant: 'destructive',
        className: SEASON_ERROR_TOAST_CLASS,
      })
    } finally {
      setIsStripeUpdating(false)
    }
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<PropertyDetailsFormData>({
    resolver: zodResolver(propertyDetailsSchema),
    defaultValues: {
      name: initial.name ?? '',
      description: initial.description ?? '',
      address: initial.address ?? '',
      city: initial.city ?? '',
      state: initial.state ?? '',
      zipCode: initial.zipCode ?? '',
      phone: initial.phone ?? '',
      email: initial.email ?? '',
      checkInTime: initial.checkInTime ?? '',
      checkOutTime: initial.checkOutTime ?? '',
    },
  })

  const onSubmit = async (data: PropertyDetailsFormData) => {
    setIsSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: data.name.trim() || undefined,
        description: data.description?.trim() || null,
        address: data.address?.trim() || null,
        city: data.city?.trim() || null,
        state: data.state?.trim() || null,
        zipCode: data.zipCode?.trim() || null,
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        checkInTime: data.checkInTime?.trim() || null,
        checkOutTime: data.checkOutTime?.trim() || null,
      }
      if (openPeriodDirty) {
        payload.settings = {
          openPeriodFrom: toIsoDateOnly(openFrom),
          openPeriodUntil: toIsoDateOnly(openUntil),
        }
      }

      const response = await fetch(`/api/v1/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(getApiFailureMessage(result) ?? 'Failed to save')
      }
      initialOpenPeriodRef.current = {
        from: openFrom,
        until: openUntil,
      }
      toast({
        title: 'Property details saved',
        description: 'Your property settings were updated successfully.',
        variant: "success",
      })
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Failed to save property details',
        variant: 'destructive',
        className: SEASON_ERROR_TOAST_CLASS,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Property details
          </CardTitle>
          <CardDescription>
            Name, address, contact information, and hours of operation for your property.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={readOnly ? (e) => e.preventDefault() : handleSubmit(onSubmit)}
            className="space-y-6"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Property name</Label>
              <Input
                id="name"
                {...register('name', { disabled: readOnly })}
                placeholder="e.g. Pine Lake Campground"
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description', { disabled: readOnly })}
                placeholder="Describe your property"
                className="min-h-40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Street address</Label>
              <Input
                id="address"
                {...register('address', { disabled: readOnly })}
                placeholder="123 Camp Road"
                className={errors.address ? 'border-destructive' : ''}
              />
              {errors.address && (
                <p className="text-sm text-destructive">{errors.address.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  {...register('city', { disabled: readOnly })}
                  placeholder="City"
                  className={errors.city ? 'border-destructive' : ''}
                />
                {errors.city && (
                  <p className="text-sm text-destructive">{errors.city.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State / Province</Label>
                <Input
                  id="state"
                  {...register('state', { disabled: readOnly })}
                  placeholder="State"
                  className={errors.state ? 'border-destructive' : ''}
                />
                {errors.state && (
                  <p className="text-sm text-destructive">{errors.state.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP / Postal code</Label>
                <Input
                  id="zipCode"
                  {...register('zipCode', { disabled: readOnly })}
                  placeholder="ZIP"
                  className={errors.zipCode ? 'border-destructive' : ''}
                />
                {errors.zipCode && (
                  <p className="text-sm text-destructive">{errors.zipCode.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                {...register('phone', { disabled: readOnly })}
                placeholder="(555) 123-4567"
                className={errors.phone ? 'border-destructive' : ''}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register('email', { disabled: readOnly })}
                placeholder="office@example.com"
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Open period</Label>
              <p className="text-sm text-muted-foreground">
                First and last day your property is open for the season.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="open-period-from" className="text-muted-foreground">
                    Open from
                  </Label>
                  <OpenPeriodDatePicker
                    id="open-period-from"
                    value={openFrom}
                    onChange={handleOpenFromSelect}
                    placeholder="Select dates"
                    readOnly={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="open-period-until" className="text-muted-foreground">
                    Until
                  </Label>
                  <OpenPeriodDatePicker
                    id="open-period-until"
                    value={openUntil}
                    onChange={handleOpenUntilSelect}
                    placeholder="Select dates"
                    readOnly={readOnly}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Hours of operation</Label>
              <div className="flex space-x-4">
                <div className="space-y-1 min-w-0">
                  <Label htmlFor="checkInTime">Check-in time</Label>
                  <Input
                    type="time"
                    id="checkInTime"
                    className="h-9 w-36 min-w-0 text-sm px-2 appearance-none flex items-center justify-center"
                    style={{
                      WebkitAppearance: 'none',
                      MozAppearance: 'textfield',
                    }}
                    {...register('checkInTime', { disabled: readOnly })}
                  />
                </div>

                <div className="space-y-1 min-w-0">
                  <Label htmlFor="checkOutTime">Check-out time</Label>
                  <Input
                    type="time"
                    id="checkOutTime"
                    className="h-9 w-36 min-w-0 text-sm px-2 appearance-none flex items-center justify-center"
                    style={{
                      WebkitAppearance: 'none',
                      MozAppearance: 'textfield',
                    }}
                    {...register('checkOutTime', { disabled: readOnly })}
                  />
                </div>
              </div>
              {errors.checkInTime && (
                <p className="text-sm text-destructive">{errors.checkInTime.message}</p>
              )}
              {errors.checkOutTime && (
                <p className="text-sm text-destructive">{errors.checkOutTime.message}</p>
              )}
            </div>

            {canEdit && (
              <Button
                type="submit"
                disabled={isSaving || (!isDirty && !openPeriodDirty)}
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
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payments & Stripe
          </CardTitle>
          <CardDescription>
            Connect a Stripe account to accept online payments for this property.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {stripeStatus.connected ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      Stripe connected
                    </span>
                  </>
                ) : (
                  <>
                    <PlugZap className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      Stripe not connected
                    </span>
                  </>
                )}
              </div>
              {stripeStatus.connected && (
                <p className="text-xs text-muted-foreground">
                  Account ID:{' '}
                  <span className="font-mono">
                    {stripeStatus.connectedId
                      ? `${stripeStatus.connectedId.slice(0, 10)}…`
                      : 'Unknown'}
                  </span>
                  {stripeStatus.connectedAt && (
                    <>
                      {' '}
                      · Connected since{' '}
                      {new Date(stripeStatus.connectedAt).toLocaleDateString()}
                    </>
                  )}
                </p>
              )}
              {!stripeStatus.connected && (
                <p className="text-xs text-muted-foreground">
                  You&apos;ll be redirected to Stripe to securely connect your account.
                </p>
              )}
            </div>
          </div>

          {canEdit && (
            <div className="flex flex-wrap gap-3">
              {stripeStatus.connected ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleStripeDisconnect}
                  disabled={isStripeUpdating}
                >
                  {isStripeUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Disconnecting…
                    </>
                  ) : (
                    <>
                      <Unplug className="mr-2 h-4 w-4" />
                      Disconnect Stripe
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleStripeConnect}
                  disabled={isStripeUpdating}
                >
                  {isStripeUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redirecting to Stripe…
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Connect Stripe
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
