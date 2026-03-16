"use client"

import { useState, useEffect, useRef } from "react"
import type { Property } from "@/components/property-context"
import {
  CheckCircle2,
  MapPin,
  Tent,
  Phone,
  AlertCircle,
  ArrowRight,
  Car,
  Home,
  Sparkles,
  Circle,
  Building2,
  CreditCard,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ReviewLaunchStepProps {
  property: Property
  onComplete: () => void
  onBack?: () => void
  onReadyChange?: (ready: boolean) => void
  onFixNow?: () => void
}

interface Site {
  id: string
  property_id: string
  site_number: string
  site_name: string | null
  site_type: string
  base_price: number
  status: string
}

interface PropertyData {
  id: string
  name: string
  description: string | null
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  phone: string | null
  email: string | null
  bookingPageSlug: string | null
  stripeConnected: boolean
  stripeConnectedAt: string | null
  bookingPageUrl: string
  sites: Site[]
  totalSites: number
  siteBreakdown: string
}

interface CompletionData {
  properties: PropertyData[]
  summary: {
    totalProperties: number
    totalSites: number
    propertiesWithStripe: number
    allStripeConnected: boolean
  }
}

const SITE_TYPE_ICONS: Record<string, LucideIcon> = {
  tent: Tent,
  rv: Car,
  cabin: Home,
  glamping: Sparkles,
  yurt: Circle,
  other: Circle,
}

function getSiteTypeCounts(sites: Site[]): Array<{ type: string; count: number }> {
  const counts: Record<string, number> = {}
  sites.forEach((s) => {
    const t = s.site_type || "other"
    counts[t] = (counts[t] || 0) + 1
  })
  return Object.entries(counts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => a.type.localeCompare(b.type))
}

export function ReviewLaunchStep({ property: _property, onComplete, onBack, onReadyChange, onFixNow }: ReviewLaunchStepProps) {
  const [completionData, setCompletionData] = useState<CompletionData | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch completion status - migrated to v1 API
  useEffect(() => {
    async function fetchData() {
      try {
        // Step 1: get all properties
        const propsResponse = await fetch("/api/v1/properties")
        const propsResult = await propsResponse.json()

        if (!propsResponse.ok || !propsResult.success) {
          throw new Error(propsResult.error?.message || "Failed to fetch properties")
        }

        const allProperties: { id: string }[] =
          propsResult.data?.items ?? propsResult.data ?? []

        // Step 2: fetch completion status for each property in parallel
        const statuses = await Promise.all(
          allProperties.map(async (p) => {
            const res = await fetch(`/api/v1/properties/${p.id}/completion-status`)
            const json = await res.json()
            if (!res.ok || !json.success) return null
            // Each endpoint returns { data: { properties: [PropertyData], summary: {...} } }
            // We only need the single property entry from each response
            return (json.data?.properties?.[0] ?? null) as PropertyData | null
          })
        )

        const validProperties = statuses.filter((p): p is PropertyData => p !== null)

        const summary = {
          totalProperties: validProperties.length,
          totalSites: validProperties.reduce((sum, p) => sum + p.totalSites, 0),
          propertiesWithStripe: validProperties.filter((p) => p.stripeConnected).length,
          allStripeConnected: validProperties.every((p) => p.stripeConnected),
        }

        setCompletionData({ properties: validProperties, summary })
      } catch (error) {
        console.error("Error fetching completion data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, []) // Run once on mount — fetches all properties, not scoped to a single property.id

  // All hooks must run on every render (before any early return)
  const allPropertiesReady =
    completionData?.properties.every(
      (prop) =>
        Boolean(prop.address && prop.city && prop.state && prop.totalSites > 0 && prop.stripeConnected)
    ) ?? false

  const prevReadyRef = useRef<boolean | null>(null)
  useEffect(() => {
    if (loading || !completionData) {
      onReadyChange?.(false)
      return
    }
    if (prevReadyRef.current !== allPropertiesReady) {
      prevReadyRef.current = allPropertiesReady
      onReadyChange?.(allPropertiesReady)
    }
  }, [loading, completionData, allPropertiesReady, onReadyChange])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!completionData) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Unable to load completion status. Please try again.
        </AlertDescription>
      </Alert>
    )
  }

  const { properties, summary } = completionData

  // Count incomplete properties
  const incompleteProperties = properties.filter(
    (prop) => !prop.address || !prop.city || !prop.state || prop.totalSites === 0 || !prop.stripeConnected
  )

  const paymentNeedsCount = summary.totalProperties - summary.propertiesWithStripe

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold">Review & launch</h2>
          {summary.totalProperties > 0 && (
            <Badge variant="secondary" className="text-sm px-3 py-1 shrink-0">
              {summary.totalProperties} {summary.totalProperties === 1 ? "property" : "properties"}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Check your setup and go live when ready
        </p>
      </div>

      {/* Overview — 3 cards with icons on left, light border, white background */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-border bg-background rounded-lg shadow-sm">
          <CardContent className="pt-6 flex items-start gap-4">
            <Building2 className="h-8 w-8 text-destructive shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl font-bold">{summary.totalProperties}</p>
              <p className="text-sm text-muted-foreground mt-0.5">Properties</p>
              <p className="text-xs text-muted-foreground">configured</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border bg-background rounded-lg shadow-sm">
          <CardContent className="pt-6 flex items-start gap-4">
            <Tent className="h-8 w-8 text-destructive shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl font-bold">{summary.totalSites}</p>
              <p className="text-sm text-muted-foreground mt-0.5">Total sites</p>
              <p className="text-xs text-muted-foreground">across all properties</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border bg-background rounded-lg shadow-sm">
          <CardContent className="pt-6 flex items-start gap-4">
            <CreditCard className="h-8 w-8 text-destructive shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl font-bold">
                {!summary.allStripeConnected ? (
                  <>
                    <span className="text-destructive">{summary.propertiesWithStripe}</span>
                    <span className="text-foreground">/{summary.totalProperties}</span>
                  </>
                ) : (
                  `${summary.propertiesWithStripe}/${summary.totalProperties}`
                )}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">Payment ready</p>
              <p className={`text-xs ${!summary.allStripeConnected ? "text-destructive" : "text-muted-foreground"}`}>
                {!summary.allStripeConnected
                  ? `${paymentNeedsCount} still ${paymentNeedsCount === 1 ? "needs" : "need"} Stripe`
                  : "All connected"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Setup incomplete banner — with Fix now */}
      {!allPropertiesReady && (
        <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-100">
                  Setup incomplete — fix before launching
                </p>
                <ul className="mt-2 space-y-1 text-sm text-amber-800 dark:text-amber-200">
                  {incompleteProperties.map((prop) => (
                    <li key={prop.id}>
                      • {prop.name} —{" "}
                      {!prop.address || !prop.city || !prop.state
                        ? "Missing property details"
                        : prop.totalSites === 0
                          ? "No sites configured"
                          : "Stripe not connected"}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {onFixNow && (
              <Button variant="outline" size="sm" onClick={onFixNow} className="shrink-0 border-amber-300 dark:border-amber-700">
                Fix now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </Alert>
      )}

      {/* Your properties */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Your properties</h3>
        <div className="space-y-4">
          {properties.map((prop) => {
            const hasBasicInfo = !!(prop.address && prop.city && prop.state)
            const hasSites = prop.totalSites > 0
            const hasStripe = prop.stripeConnected
            const isComplete = hasBasicInfo && hasSites && hasStripe

            return (
              <Card
                key={prop.id}
                className={
                  isComplete
                    ? "border-2 border-green-500/60 dark:border-green-500/50 bg-green-50/40 dark:bg-green-950/30 shadow-sm"
                    : "border-2 border-amber-500/60 dark:border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/30 shadow-sm"
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium text-foreground">
                      {prop.name}
                    </CardTitle>
                    {isComplete ? (
                      <Badge className="bg-green-600 text-white hover:bg-green-600 border-0">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Ready to launch
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Incomplete
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Address
                        </p>
                        {hasBasicInfo ? (
                          <p className="text-muted-foreground mt-0.5">
                            {prop.address}
                            <br />
                            {prop.city}, {prop.state} {prop.zipCode}
                          </p>
                        ) : (
                          <p className="text-destructive/80 text-xs mt-0.5">Not configured</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Contact
                        </p>
                        <div className="text-muted-foreground mt-0.5">
                          {prop.phone && <p>{prop.phone}</p>}
                          {prop.email && <p>{prop.email}</p>}
                          {!prop.phone && !prop.email && <p className="text-xs">—</p>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border space-y-3">
                    {/* Sites included — check + count + type pills */}
                    <div className="flex flex-wrap items-center gap-2">
                      {hasSites ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      )}
                      <span className="text-sm text-muted-foreground">
                        {hasSites ? `${prop.totalSites} site${prop.totalSites === 1 ? "" : "s"}` : "No sites"}
                      </span>
                      {hasSites && prop.sites?.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 ml-1">
                          {getSiteTypeCounts(prop.sites).map(({ type, count }) => {
                            const Icon = SITE_TYPE_ICONS[type] || Circle
                            const label = type.charAt(0).toUpperCase() + type.slice(1)
                            return (
                              <span
                                key={type}
                                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-700 px-2.5 py-0.5 text-xs font-medium text-white"
                              >
                                <Icon className="h-3 w-3" />
                                {label}
                                <span className="text-white/80">x{count}</span>
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    {/* Payment processing */}
                    <div className="flex items-center gap-2 text-sm">
                      {hasStripe ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      )}
                      <span className="text-muted-foreground">
                        Payment processing:{" "}
                        {hasStripe ? "Stripe connected and ready" : "Stripe not connected"}
                      </span>
                    </div>
                    {!isComplete && onFixNow && (
                      <div className="flex justify-end pt-1">
                        <Button variant="ghost" size="sm" onClick={onFixNow}>
                          Fix
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}