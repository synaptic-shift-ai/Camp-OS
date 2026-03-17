'use client'

/**
 * Property Details Settings
 *
 * Form for property name, address, contact (phone, email), and hours of operation.
 * Persists via PATCH /api/v1/properties/[propertyId].
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
// import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Building2, CreditCard, CheckCircle2, PlugZap, Unplug } from 'lucide-react'

const propertyDetailsSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
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

export type PropertyDetailsInitial = {
  name: string
  address?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  phone?: string | null
  email?: string | null
  checkInTime?: string | null
  checkOutTime?: string | null
}

interface PropertySettingsProps {
  propertyId: string
  initial: PropertyDetailsInitial
  stripeConnected: boolean
  stripeConnectedAt?: string | null
  stripeAccountId?: string | null 
}

export function PropertySettings({ 
  propertyId, 
  initial,
  stripeConnected,
  stripeConnectedAt,
  stripeAccountId,
}: PropertySettingsProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
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
        alert('Stripe Connect is not configured. Please contact support.')
        return 
      }

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
      if (!baseUrl) {
        console.error("Missing NEXT_PUBLIC_BASE_URL environment variable")
        alert('Stripe Connect is not configured. Please contact support.')
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
      alert('Failed to start Stripe connection. Please try again.')
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
        throw new Error(result.error?.message || 'Failed to disconnect Stripe')
      }

      setStripeStatus({
        connected: false,
        connectedAt: null,
        connectedId: null,
      })
    } catch (error) {
      console.error('Error disconnecting Stripe:', error)
      alert('Failed to disconnect Stripe. Please try again.')
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
    setMessage(null)
    try {
      const response = await fetch(`/api/v1/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name.trim() || undefined,
          address: data.address?.trim() || null,
          city: data.city?.trim() || null,
          state: data.state?.trim() || null,
          zipCode: data.zipCode?.trim() || null,
          phone: data.phone?.trim() || null,
          email: data.email?.trim() || null,
          checkInTime: data.checkInTime?.trim() || null,
          checkOutTime: data.checkOutTime?.trim() || null,
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message ?? 'Failed to save')
      }
      setMessage({ type: 'success', text: 'Property details saved.' })
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save property details',
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {message && (
              <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Property name</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="e.g. Pine Lake Campground"
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Street address</Label>
              <Input
                id="address"
                {...register('address')}
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
                  {...register('city')}
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
                  {...register('state')}
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
                  {...register('zipCode')}
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
                {...register('phone')}
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
                {...register('email')}
                placeholder="office@example.com"
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Hours of operation</Label>
              <div className="grid grid-cols-2 gap-4">
                <Label htmlFor="checkInTime" className="flex flex-col gap-2">
                  Check-in Time
                  <Input type="time" id="checkInTime" {...register('checkInTime')} />
                </Label>
                <Label htmlFor="checkOutTime" className="flex flex-col gap-2">
                  Check-out Time
                  <Input type="time" id="checkOutTime" {...register('checkOutTime')} />
                </Label>
              </div>
              {/* <Textarea
                id="officeHours"
                {...register('officeHours')}
                placeholder="e.g. Office: Mon–Fri 9am–5pm, Sat 9am–noon. Gate: 24/7."
                rows={3}
                className={errors.officeHours ? 'border-destructive' : ''}
              /> */}
              {errors.checkInTime && (
                <p className="text-sm text-destructive">{errors.checkInTime.message}</p>
              )}
              {errors.checkOutTime && (
                <p className="text-sm text-destructive">{errors.checkOutTime.message}</p>
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
        </CardContent>
      </Card>
    </>
  )
}
