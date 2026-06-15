"use client"

import { useEffect, useState, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  Tent,
  Car,
  TreePine,
  MapPin,
  Users,
  Calendar,
  Check,
  Star,
  Zap,
  Shield,
  Clock,
  ChevronLeft,
  Sparkles,
  Home,
  Circle,
} from "lucide-react"
import { format, differenceInDays } from "date-fns"
import { useCheckout } from "@/lib/booking/checkout-context"
import { useToast } from "@/hooks/use-toast"
import type { AvailableSite, SiteType } from "@/lib/booking/types"
import { calculatePriceBreakdown, getBaseSubtotalAndLabel } from "@/lib/booking/pricing"
import { DEFAULT_TAX_RATE } from "@/lib/booking/types"
import type { RateDiscountsConfig } from "@/lib/config/types"
import { cn, capitalizeWordsPreserveSpacing } from "@/lib/utils"

type GuestPricingConfig = {
  tax_rate?: number
  tax_name?: string
  pet_fee_cents?: number
  user_defined_fees?: Array<{
  enabled?: boolean
  trigger_type?: string
  fee_type?: string
  value_cents?: number | null
  }>
}

const resolveGuestPetFeeCents = (pricingConfig: GuestPricingConfig | null): number => {
  const configuredPetFee = pricingConfig?.user_defined_fees?.find(
    (fee) =>
      fee.enabled === true &&
      fee.trigger_type === "has_pets" &&
      fee.fee_type === "flat_amount" &&
      typeof fee.value_cents === "number" &&
      fee.value_cents >= 0,
  )
  if (configuredPetFee?.value_cents != null) return configuredPetFee.value_cents
  if (typeof pricingConfig?.pet_fee_cents === "number" && pricingConfig.pet_fee_cents >= 0) {
    return pricingConfig.pet_fee_cents
  }
  return 0
}

function AvailabilityResultsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setCheckoutData } = useCheckout()
  const { toast } = useToast()

  const [availableSites, setAvailableSites] = useState<AvailableSite[]>([])
  const [activePromos, setActivePromos] = useState<Array<{ discountLabel: string; discountCondition: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [propertyName, setPropertyName] = useState<string>("")
  const [propertyAddress, setPropertyAddress] = useState<string | null>(null)
  const [cancellationPolicy, setCancellationPolicy] = useState<string | null>(null)

  const slug = searchParams.get("slug") || ""
  const propertyNameFromUrl = searchParams.get("propertyName")?.trim() || ""
  const propertyId = searchParams.get("propertyId")
  const checkInStr = searchParams.get("checkIn")
  const checkOutStr = searchParams.get("checkOut")
  const adults = Number.parseInt(searchParams.get("adults") || "2")
  const children = Number.parseInt(searchParams.get("children") || "0")
  const pets = Number.parseInt(searchParams.get("pets") || "0")
  const shouldRestoreGuestDraft = searchParams.get("restoreGuestDraft") === "1"
  const rawSiteType = searchParams.get("siteType")
  const siteTypeFilter =
    rawSiteType === "all" || rawSiteType === "" ? null : (rawSiteType as SiteType | null)
  const [rateDiscountsConfig, setRateDiscountsConfig] = useState<RateDiscountsConfig | null>(null)
  const [pricingConfig, setPricingConfig] = useState<GuestPricingConfig | null>(null)

  // Parse dates inside useMemo to avoid recreating on every render
  const checkIn = useMemo(() => checkInStr ? new Date(checkInStr) : null, [checkInStr])
  const checkOut = useMemo(() => checkOutStr ? new Date(checkOutStr) : null, [checkOutStr])
  const nights = checkIn && checkOut ? differenceInDays(checkOut, checkIn) : 0

  useEffect(() => {
    let mounted = true

    const fetchAvailableSites = async () => {
      if (!propertyId || !checkInStr || !checkOutStr) {
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch("/api/booking/search-availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            property_id: propertyId,
            check_in_date: checkInStr,
            check_out_date: checkOutStr,
            num_adults: adults,
            num_children: children,
            site_type: siteTypeFilter || undefined,
            respect_property_enabled_rate_types: true,
          }),
        })

        const result = await response.json()

        if (!mounted) return

        if (result.success && result.data) {
          setAvailableSites(result.data.sites || [])
          setActivePromos(result.data.active_promos ?? [])
          if (typeof result.data.property_name === "string" && result.data.property_name.trim().length > 0) {
            setPropertyName(result.data.property_name)
          }
          if (typeof result.data.property_address === "string" && result.data.property_address.trim().length > 0) {
            setPropertyAddress(result.data.property_address)
          }
          if (typeof result.data.cancellation_policy === "string" && result.data.cancellation_policy.trim().length > 0) {
            setCancellationPolicy(result.data.cancellation_policy)
          } else {
            setCancellationPolicy(null)
          }
          if (result.data.rate_discounts_config) {
            setRateDiscountsConfig(result.data.rate_discounts_config)
          }
          if (result.data.pricing_config) {
            setPricingConfig(result.data.pricing_config)
          }
        } else {
          toast({
            title: "Search Error",
            description: result.error?.message || "Failed to search availability",
            variant: "destructive",
          })
        }
      } catch {
        if (mounted) {
          toast({
            title: "Error",
            description: "Failed to search for available sites",
            variant: "destructive",
          })
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    fetchAvailableSites()

    return () => {
      mounted = false
    }
  }, [propertyId, checkInStr, checkOutStr, adults, children, siteTypeFilter])

  const getSiteIcon = (type: SiteType) => {
    switch (type) {
      case "tent":
        return Tent
      case "rv":
        return Car
      case "cabin":
        return TreePine
      case "yurt":
        return Circle
      case "glamping":
        return Sparkles
      default:
        return Home
    }
  }

  const getSiteTypeLabel = (type: SiteType) => {
    switch (type) {
      case "tent":
        return "Tent Site"
      case "rv":
        return "RV Site"
      case "cabin":
        return "Cabin"
      case "yurt":
        return "Yurt"
      case "glamping":
        return "Glamping"
      default:
        return "Site"
    }
  }

  const handleSelectSite = (site: AvailableSite) => {
    if (!checkIn || !checkOut || !propertyId) return
    const { subtotalCents, basePriceLabel, rateType } = getBaseSubtotalAndLabel(
      nights,
      site.base_price_per_night,
      site.weekly_rate_cents ?? null,
      site.monthly_rate_cents ?? null
    )
    const priceBreakdown = calculatePriceBreakdown({
      basePricePerNight: site.base_price_per_night,
      numberOfNights: nights,
      siteType: site.site_type,
      numPets: pets,
      petFeeCentsOverride: resolveGuestPetFeeCents(pricingConfig),
    })
    priceBreakdown.subtotal = subtotalCents
    priceBreakdown.base_price_label = basePriceLabel
    priceBreakdown.rate_type = rateType
    priceBreakdown.total = subtotalCents + (priceBreakdown.pet_fee ?? 0)
    // Add fees (match guest-info / payment logic)
    const cleaningFeeCents = site.site_type === "cabin" ? 5000 : 0
    const serviceFeeCents = Math.round(subtotalCents * 0.1)
    priceBreakdown.cleaningFee = cleaningFeeCents
    priceBreakdown.serviceFee = serviceFeeCents
    // Use property tax rate from settings (pricing_config), fallback to default
    const propertyTaxRate =
      pricingConfig?.tax_rate != null && pricingConfig.tax_rate >= 0
        ? pricingConfig.tax_rate
        : DEFAULT_TAX_RATE
    priceBreakdown.tax_rate = propertyTaxRate
    if (pricingConfig?.tax_name) {
      priceBreakdown.tax_name = pricingConfig.tax_name
    }
    // Apply all matching auto discounts (same as Pricing Summary: every applicable discount)
    const taxableBeforeDiscount = subtotalCents + cleaningFeeCents + serviceFeeCents
    const appliedDiscounts: {
      id: string
      title: string
      amount: number
      trigger_type: "manual" | "min_nights" | "min_guests" | "date_range"
    }[] = []
    let discountCents = 0
    if (rateDiscountsConfig?.user_defined_discounts?.length) {
      const checkInStr = checkIn.toISOString().slice(0, 10)
      const totalGuests = adults + children
      const inDateRange = (start: string | undefined, end: string | undefined) => {
        if (start && checkInStr < start) return false
        if (end && checkInStr > end) return false
        return true
      }
      for (const d of rateDiscountsConfig.user_defined_discounts) {
        if (!d.enabled || d.trigger_type === "manual") continue
        let shouldApply = false
        if (d.trigger_type === "date_range") {
          shouldApply = inDateRange(d.trigger_conditions?.start_date, d.trigger_conditions?.end_date)
        } else if (d.trigger_type === "min_nights") {
          shouldApply = nights >= (d.trigger_conditions?.min_nights ?? 0)
        } else if (d.trigger_type === "min_guests") {
          shouldApply = totalGuests >= (d.trigger_conditions?.min_guests ?? 0)
        }
        if (!shouldApply) continue
        let amount = 0
        if (
          d.discount_type === "percentage_of_subtotal" ||
          d.discount_type === "percentage_of_total"
        ) {
          const pct = (d.value_percentage ?? 0) / 100
          const base = d.discount_type === "percentage_of_total" ? taxableBeforeDiscount : subtotalCents
          amount = Math.round(base * pct)
          if ((d.max_discount_cents ?? 0) > 0) {
            amount = Math.min(amount, d.max_discount_cents!)
          }
        } else if (d.discount_type === "flat_amount") {
          amount = d.value_cents ?? 0
        }
        if (amount > 0) {
          appliedDiscounts.push({
            id: d.id,
            title: d.title ?? "Discount",
            amount,
            trigger_type: d.trigger_type,
          })
          discountCents += amount
        }
      }
      if (appliedDiscounts.length > 0) {
        priceBreakdown.user_discounts = appliedDiscounts
      }
    }
    // Tax is applied to subtotal after discounts only (not on fees)
    const taxableAmountAfterDiscount = subtotalCents - discountCents
    priceBreakdown.taxes = Math.round(taxableAmountAfterDiscount * propertyTaxRate)
    priceBreakdown.total_before_tax = subtotalCents - discountCents
    priceBreakdown.total =
      subtotalCents - discountCents + (priceBreakdown.taxes ?? 0) + (priceBreakdown.pet_fee ?? 0)
    setCheckoutData({
      propertyId,
      propertyName: displayPropertyName,
      ...(propertyAddress ? { propertyAddress } : {}),
      site,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      numAdults: adults,
      numChildren: children,
      numPets: pets,
      priceBreakdown,
      cancellationPolicy: cancellationPolicy ?? null,
    })

    toast({
      title: "Site selected!",
      description: `${site.name} has been added to your booking.`,
      variant: "success",
    })

    const guestInfoPath = shouldRestoreGuestDraft
      ? `/book/${slug}/guest-info?restoreGuestDraft=1`
      : `/book/${slug}/guest-info`
    router.push(guestInfoPath)
  }

  const displayPropertyName =
    propertyName ||
    propertyNameFromUrl ||
    (slug ? capitalizeWordsPreserveSpacing(slug.replace(/-[a-f0-9]{8}$/i, '').replace(/-/g, ' ')) : "")

  if (!checkIn || !checkOut || !propertyId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="p-8 text-center">
          <TreePine className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <h2 className="mb-2 text-xl font-bold text-foreground">Invalid Search</h2>
          <p className="mb-4 text-muted-foreground">Missing required search parameters</p>
          <Button onClick={() => router.push(`/book/${slug}`)} className={cn("bg-[#2D5A27] hover:bg-[#1e3d1a] dark:bg-emerald-800 dark:hover:bg-emerald-900", "text-white")}>
            Back to Search
          </Button>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/50 to-background dark:from-muted/20">
        <header className="sticky top-0 z-50 border-b border-border bg-background/95 shadow-sm backdrop-blur">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center space-x-3">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", "bg-[#2D5A27] hover:bg-[#1e3d1a] dark:bg-emerald-800 dark:hover:bg-emerald-900")}>
                <TreePine className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className={cn("text-xl font-bold", "text-[#2D5A27] dark:text-emerald-400")}>{displayPropertyName}</h1>
                <p className="text-xs text-muted-foreground">Searching...</p>
              </div>
            </div>
          </div>
        </header>
        <div className="container mx-auto px-4 py-16 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[#2D5A27] dark:border-emerald-500" />
          <p className="text-muted-foreground">Searching for available sites...</p>
        </div>
      </div>
    )
  }

  const yourSearchDetailRows = (
    <>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Check-in:</span>
        <span className="font-medium text-foreground">{checkIn && format(checkIn, "MMM dd, yyyy")}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Check-out:</span>
        <span className="font-medium text-foreground">{checkOut && format(checkOut, "MMM dd, yyyy")}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Guests:</span>
        <span className="font-medium text-foreground">
          {adults + children} ({adults}A, {children}C)
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Nights:</span>
        <span className="font-medium text-foreground">{nights}</span>
      </div>
    </>
  )

  const yourSearchCard = (
    <Card>
      <CardHeader className="bg-[#2D5A27] text-white dark:bg-emerald-950">
        <CardTitle className="text-white">Your Search Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-6">{yourSearchDetailRows}</CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/50 to-background text-foreground dark:from-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 shadow-sm backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", "bg-[#2D5A27] hover:bg-[#1e3d1a] dark:bg-emerald-800 dark:hover:bg-emerald-900")}>
                <TreePine className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className={cn("text-xl font-bold", "text-[#2D5A27] dark:text-emerald-400")}>{displayPropertyName}</h1>
                <p className="text-xs text-muted-foreground">Availability Results</p>
              </div>
            </div>
            <Button variant="ghost" onClick={() => router.push(`/book/${slug}`)}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back to Search
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Trust Bar */}
        <div className="mb-8 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <div className="flex items-center space-x-2 text-green-700 dark:text-emerald-400">
              <Shield className="h-5 w-5" />
              <span className="font-medium">Secure Booking</span>
            </div>
            <div className="flex items-center space-x-2 text-green-700 dark:text-emerald-400">
              <Zap className="h-5 w-5" />
              <span className="font-medium">Instant Confirmation</span>
            </div>
            <div className="flex items-center space-x-2 text-green-700 dark:text-emerald-400">
              <Clock className="h-5 w-5" />
              <span className="font-medium">Easy Cancellation</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Mobile: collapsible so details don’t push the site list down */}
            <div className="lg:hidden">
              <Accordion
                type="single"
                collapsible
                className="overflow-hidden rounded-lg border-2 border-border bg-card shadow-sm"
              >
                <AccordionItem value="your-search" className="border-0">
                  <AccordionTrigger className="rounded-t-lg bg-[#2D5A27] px-4 py-3 text-left text-base font-semibold text-white hover:no-underline data-[state=open]:rounded-b-none dark:bg-emerald-950 [&>svg]:text-white">
                    Your Search
                  </AccordionTrigger>
                  <AccordionContent className="px-0">
                    <div className="space-y-3 border-t border-border px-4 py-4">{yourSearchDetailRows}</div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Search Summary */}
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/35">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="mb-2 text-xl font-bold text-foreground">
                      {availableSites.length} Available Site{availableSites.length !== 1 ? "s" : ""} Found
                    </h2>
                    <div className="flex flex-wrap gap-4 text-sm text-foreground/90">
                      <div className="flex items-center space-x-2">
                        <Calendar className={cn("h-4 w-4", "text-[#2D5A27] dark:text-emerald-400")} />
                        <span>
                          {checkIn && format(checkIn, "MMM dd")} - {checkOut && format(checkOut, "MMM dd")}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className={cn("h-4 w-4", "text-[#2D5A27] dark:text-emerald-400")} />
                        <span>
                          {adults + children} Guest{adults + children !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {nights > 0 && (
                        <div className="flex items-center space-x-2">
                          <Clock className={cn("h-4 w-4", "text-[#2D5A27] dark:text-emerald-400")} />
                          <span>
                            {nights} Night{nights !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button size="sm" className={cn("shrink-0", "bg-[#2D5A27] hover:bg-[#1e3d1a] dark:bg-emerald-800 dark:hover:bg-emerald-900", "text-white")} onClick={() => router.push(`/book/${slug}`)}>
                    Modify Search
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Available Sites */}
            <div className="space-y-4">
              {availableSites.map((site) => {
                const Icon = getSiteIcon(site.site_type)
                const { subtotalCents, basePriceLabel } = getBaseSubtotalAndLabel(
                  nights,
                  site.base_price_per_night,
                  site.weekly_rate_cents ?? null,
                  site.monthly_rate_cents ?? null
                )
                const totalPrice = subtotalCents / 100

                return (
                  <Card key={site.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge
                              className={cn(
                                "bg-[#2D5A27] dark:bg-emerald-800",
                                "text-white hover:bg-[#2D5A27] hover:text-white dark:hover:bg-emerald-800",
                              )}
                            >
                              <Icon className="mr-1 h-3 w-3" />
                              {getSiteTypeLabel(site.site_type)}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="border border-green-300 bg-green-50 font-semibold text-green-800 shadow-none hover:border-green-300 hover:bg-green-50 hover:text-green-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200"
                            >
                              Available
                            </Badge>
                            {activePromos.map((promo, i) => (
                              <Badge
                                key={i}
                                className="bg-yellow-500 text-white hover:bg-yellow-500 hover:text-white dark:bg-amber-600 dark:hover:bg-amber-600"
                              >
                                {[promo.discountLabel, promo.discountCondition].filter(Boolean).join(" ")}
                              </Badge>
                            ))}
                          </div>
                          <h3 className="mb-1 text-xl font-bold text-foreground">{site.name}</h3>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>Site {site.site_number}</span>
                            <span>•</span>
                            <Users className="h-4 w-4" />
                            <span>Sleeps {site.max_occupancy}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={cn("text-2xl font-bold", "text-[#2D5A27] dark:text-emerald-400")}>${totalPrice.toFixed(2)}</div>
                          <div className="text-xs text-muted-foreground">
                            {basePriceLabel}
                          </div>
                        </div>
                      </div>

                      {/* Amenities */}
                      {Object.keys(site.amenities).length > 0 && (
                        <div className="mb-4">
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(site.amenities).map(
                              ([key, value]) =>
                                value && (
                                  <div key={key} className="flex items-center space-x-1 text-xs text-muted-foreground">
                                    <Check className="h-3 w-3 text-green-600 dark:text-emerald-500" />
                                    <span className="capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                                  </div>
                                )
                            )}
                          </div>
                        </div>
                      )}

                      <Separator className="my-4" />

                      {/* CTA */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Check className="h-4 w-4 text-green-600 dark:text-emerald-500" />
                            <span>Easy cancellation</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Zap className="h-4 w-4 text-green-600 dark:text-emerald-500" />
                            <span>Instant confirmation</span>
                          </div>
                        </div>
                        <Button onClick={() => handleSelectSite(site)} className={cn("bg-[#2D5A27] hover:bg-[#1e3d1a] dark:bg-emerald-800 dark:hover:bg-emerald-900", "text-white")}>
                          Select
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>

            {availableSites.length === 0 && (
              <Card className="p-12 text-center">
                <TreePine className="mx-auto mb-4 h-16 w-16 text-muted-foreground/50" />
                <h3 className="mb-2 text-xl font-semibold text-foreground">No sites available</h3>
                <p className="mb-6 text-muted-foreground">
                  We couldn't find any available sites for your selected dates. Try adjusting your search criteria.
                </p>
                <Button onClick={() => router.push(`/book/${slug}`)} className={cn("bg-[#2D5A27] hover:bg-[#1e3d1a] dark:bg-emerald-800 dark:hover:bg-emerald-900", "text-white")}>
                  Modify Search
                </Button>
              </Card>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              <div className="hidden lg:block">{yourSearchCard}</div>

              {/* Why Book With Us */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Why Book With Us?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <Shield className={cn("mt-0.5 h-5 w-5 shrink-0", "text-[#2D5A27] dark:text-emerald-400")} />
                    <div>
                      <p className="text-sm font-medium">Best Price Guarantee</p>
                      <p className="text-xs text-muted-foreground">Lowest rates, guaranteed</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Clock className={cn("mt-0.5 h-5 w-5 shrink-0", "text-[#2D5A27] dark:text-emerald-400")} />
                    <div>
                      <p className="text-sm font-medium">Easy Cancellation</p>
                      <p className="text-xs text-muted-foreground">Flexible cancellation policy</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Star className={cn("mt-0.5 h-5 w-5 shrink-0", "text-[#2D5A27] dark:text-emerald-400")} />
                    <div>
                      <p className="text-sm font-medium">Secure Booking</p>
                      <p className="text-xs text-muted-foreground">Your information is safe</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Need Help */}
              <Card className="bg-muted/50 dark:bg-muted/20">
                <CardContent className="p-6 text-center">
                  <h3 className="mb-2 font-semibold text-foreground">Need Help?</h3>
                  <p className="mb-4 text-sm text-muted-foreground">Our team is here to assist you</p>
                  <Button className={cn("w-full", "bg-[#2D5A27] hover:bg-[#1e3d1a] dark:bg-emerald-800 dark:hover:bg-emerald-900", "text-white")}>
                    Contact Support
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AvailabilityResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#2D5A27] dark:border-emerald-500" />
        </div>
      }
    >
      <AvailabilityResultsContent />
    </Suspense>
  )
}
