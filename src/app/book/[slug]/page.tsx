import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { extractPropertyIdFromSlug } from "@/lib/booking/slug-utils"
import { PropertyBookingPortal } from "@/components/guest/property-booking-portal"
import { ReservationExpiredHandler } from "@/components/guest/reservation-expired-handler"
import type { SiteType } from "@/lib/booking/types"
import { getActivePromoDisplay, parseReservationTypesConfigFromDB, resolveBookingRulesConfig, resolveRateDiscountsConfig } from "@/lib/config/resolution"
import { getPricingSourceType } from "@/lib/site-pricing-source"
import type { BookingRulesConfig, RateDiscountsConfig, UserDefinedDiscount } from "@/lib/config/types"
import { format } from "date-fns"
import { extractOpenPeriodFromPropertySettings } from "@/lib/booking/open-period"

export default async function PropertyBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // Extract property ID from slug
  try {
    extractPropertyIdFromSlug(slug)
  } catch (error) {
    console.error("[Booking] Invalid slug format:", slug, error)
    notFound()
  }

  // Fetch property details from database
  const supabase = await createClient()

  const { data: property, error } = await supabase
    .from("properties")
    .select(`
      id,
      name,
      city,
      state,
      description,
      booking_page_slug,
      booking_page_description,
      booking_page_tagline,
      hero_image_url,
      gallery_images,
      check_in_time,
      check_out_time,
      check_in_instructions,
      check_out_instructions,
      cancellation_policy,
      house_rules,
      phone,
      email,
      address,
      zip_code,
      timezone,
      office_hours,
      minimum_stay_nights,
      special_instructions,
      directions,
      amenities,
      site_amenities,
      enabled_reservation_types,
      reservation_type_config,
      site_type_config,
      rate_discounts_config,
      booking_rules_config,
      settings
    `)
    .eq("booking_page_slug", slug)
    .eq("onboarding_completed", true)
    .single()

  // Handle not found or unpublished properties — try historical booking slug alias
  if (error || !property) {
    const { data: aliasRow } = await supabase
      .from("property_booking_slug_aliases")
      .select("property_id")
      .eq("booking_page_slug", slug)
      .maybeSingle()

    if (aliasRow?.property_id) {
      const { data: redirected } = await supabase
        .from("properties")
        .select("booking_page_slug")
        .eq("id", aliasRow.property_id)
        .eq("onboarding_completed", true)
        .maybeSingle()

      if (redirected?.booking_page_slug) {
        redirect(`/book/${redirected.booking_page_slug}`)
      }
    }

    console.error("[Booking] Property not found or not published:", slug, error)
    notFound()
  }

  const { data: sites } = await supabase
    .from("sites")
    .select("id, site_name, site_number, site_type, base_price, max_occupancy, amenities, description, site_images, images, enabled_reservation_types_override, weekly_rate_cents, monthly_rate_cents, pricing_override")
    .eq("property_id", property.id)
    .is("deleted_at", null)

  const { data: recentReservations } = await supabase
    .from("reservations")
    .select(`
      created_at,
      check_in_date,
      check_out_date,
      guests ( first_name, last_name),
      sites ( site_name, site_type )
      `)
    .eq("property_id", property.id)
    .in("status", ["confirmed", "occupied"])
    .order("created_at", { ascending: false })
    .limit(5)

  // const bookingStats = {
  //   recentCount: recentReservations?.length ?? 0,
  //   siteTypes: [...new Set(recentReservations?.map(r => (r.sites as any)?.site_type).filter(Boolean))] as string[],
  // }

  console.log("recentReservations", recentReservations)

  const SITE_TYPE_DESCRIPTIONS: Record<string, string> = {
    tent: "Perfect for traditional camping with your own tent",
    rv: "Full hookup sites for RVs and motorhomes",
    cabin: "Cozy cabins with modern amenities",
    glamping: "Comfortable glamping accommodations",
    yurt: "Unique yurt stays",
    other: "Other accommodation types",
  }

  type SiteTypeSummary = {
    id?: string
    type: SiteType
    name: string
    description: string
    price: number
    priceWeekly?: number
    priceMonthly?: number
    capacity: string
    amenities: string[]
    imageUrl?: string | null
    discountedPrice?: number
    discountEndDate?: string
    discountLabel?: string
    discountCondition?: string
    promos?: Array<{ discountLabel: string; discountCondition: string }>
  }

  function getDiscountLabel(discount: UserDefinedDiscount): string {
    if (discount.discount_type === 'percentage_of_subtotal' || discount.discount_type === 'percentage_of_total') {
      const pct = discount.value_percentage ?? 0
      return pct ? `${pct}% off` : ''
    }
    if (discount.discount_type === 'flat_amount') {
      const dollars = ((discount.value_cents ?? 0) / 100).toFixed(2)
      return `$${dollars} off`
    }
    return ''
  }

  function getDiscountConditionText(discount: UserDefinedDiscount): string {
    if (discount.trigger_type === 'date_range' && discount.trigger_conditions?.end_date) {
      return `until ${format(new Date(discount.trigger_conditions.end_date), 'MMM d')}`
    }
    if (discount.trigger_type === 'min_nights' && discount.trigger_conditions?.min_nights != null) {
      return `for ${discount.trigger_conditions.min_nights}+ nights`
    }
    if (discount.trigger_type === 'min_guests' && discount.trigger_conditions?.min_guests != null) {
      return `for ${discount.trigger_conditions.min_guests}+ guests`
    }
    return ''
  }

  const bookingRules = resolveBookingRulesConfig(
    (property as { booking_rules_config?: BookingRulesConfig | null }).booking_rules_config ?? null,
    null
  ).config

  const rateDiscounts = resolveRateDiscountsConfig(
    (property as { rate_discounts_config?: RateDiscountsConfig | null }).rate_discounts_config ?? null
  )
  const userDiscounts = rateDiscounts.user_defined_discounts ?? []

  function isTodayInDateRange(
    startDate: string | undefined,
    endDate: string | undefined
  ): boolean {
    const today = new Date().toISOString().slice(0, 10)
    if (startDate && today < startDate) return false
    if (endDate && today > endDate) return false
    return true
  }

  const activeDateRangeDiscount: UserDefinedDiscount | undefined = userDiscounts.find(
    (d) =>
      d.enabled &&
      d.trigger_type === "date_range" &&
      isTodayInDateRange(
        d.trigger_conditions?.start_date,
        d.trigger_conditions?.end_date
      )
  )

  const activeMinNightsDiscount: UserDefinedDiscount | undefined = userDiscounts.find(
    (d) => d.enabled && d.trigger_type === "min_nights" && (d.trigger_conditions?.min_nights ?? 0) > 0
  )

  const activeMinGuestsDiscount: UserDefinedDiscount | undefined = userDiscounts.find(
    (d) => d.enabled && d.trigger_type === "min_guests" && (d.trigger_conditions?.min_guests ?? 0) > 0
  )

  const activeDiscount: UserDefinedDiscount | undefined =
    activeDateRangeDiscount ?? activeMinNightsDiscount ?? activeMinGuestsDiscount

  const activePromos = getActivePromoDisplay(
    (property as { rate_discounts_config?: RateDiscountsConfig | null }).rate_discounts_config ?? null
  )

  const recentBookings = recentReservations?.map(r => {
    const guest = r.guests as any
    const site = r.sites as any
    const firstName = guest.first_name ?? "Someone"
    const lastName = guest.last_name ?? ""
    const siteType = site.site_type ?? "other"
    const createdAt = r.created_at ? new Date(r.created_at) : new Date()
    const checkInDate = r.check_in_date ? new Date(r.check_in_date) : new Date()
    const checkOutDate = r.check_out_date ? new Date(r.check_out_date) : new Date()
    const numberOfNights = Math.floor((checkOutDate.getTime() - checkInDate.getTime()) / 86400000)
    const minutesAgo = Math.floor((Date.now() - createdAt.getTime()) / 60000)
    const timeAgo = minutesAgo < 60
      ? `${minutesAgo} minutes${minutesAgo !== 1 ? "s" : ""} ago`
      : minutesAgo < 1440
        ? `${Math.floor(minutesAgo / 60)} hour${Math.floor(minutesAgo / 60) !== 1 ? "s" : ""} ago`
        : `${Math.floor(minutesAgo / 1440)} day${Math.floor(minutesAgo / 1440) !== 1 ? "s" : ""} ago`

    console.log("recent Bookings:", { name: `${firstName} ${lastName}`.trim(), numberOfNights, siteType, timeAgo })

    return { name: `${firstName} ${lastName}`.trim(), numberOfNights, siteType, timeAgo }
  })

  const reservationTypeConfig = parseReservationTypesConfigFromDB(
    property.reservation_type_config ?? null
  )

  type SiteTypeRateBundle = {
    nightly?: { rate_cents: number | null }
    weekly?: { rate_cents: number | null }
    monthly?: { rate_cents: number | null }
  }

  const siteTypeRatesMap = 
    (property as { site_type_config?: { site_type_rates?: Record<string, SiteTypeRateBundle> } } | null)?.site_type_config?.site_type_rates ?? {}

  const rawSiteTypeConfig = (property as { site_type_config?: { allowed_site_types?: string[] } } | null)?.site_type_config ?? null
  const allowedSiteTypes =
    Array.isArray(rawSiteTypeConfig?.allowed_site_types) && rawSiteTypeConfig.allowed_site_types.length > 0
      ? rawSiteTypeConfig.allowed_site_types.map((t) => t.toLowerCase())
      : null

  const sitesToShow = allowedSiteTypes
    ? (sites ?? []).filter((s) => allowedSiteTypes.includes((s.site_type || "other").toLowerCase()))
    : (sites ?? [])

  const enabledTypesRaw = (property as { enabled_reservation_types?: unknown }).enabled_reservation_types
  const enabledTypes = Array.isArray(enabledTypesRaw) ? (enabledTypesRaw as string[]) : []
  const propertyNightlyEnabled = enabledTypes.includes('nightly')
  const propertyWeeklyEnabled = enabledTypes.includes('weekly')
  const propertyMonthlyEnabled = enabledTypes.includes('monthly')

  function effectiveNightlyCentsForSite(s: (typeof sitesToShow)[number]): number {
    const pricingSource = getPricingSourceType(
      (s as { pricing_override?: unknown }).pricing_override,
      (s as { enabled_reservation_types_override?: unknown }).enabled_reservation_types_override
    )
    if (pricingSource === 'site_type_default') {
      const st = (s.site_type ?? '').toLowerCase()
      const key = Object.keys(siteTypeRatesMap).find((k) => k.toLowerCase() === st) ?? (s.site_type ?? '')
      const rates = key ? siteTypeRatesMap[key] : null
      return (
        rates?.nightly?.rate_cents ??
        (propertyNightlyEnabled ? reservationTypeConfig.nightly?.rate_cents : null) ??
        (s.base_price ?? 0)
      )
    }
    if (pricingSource === 'property_default') {
      return propertyNightlyEnabled
        ? (reservationTypeConfig.nightly?.rate_cents ?? (s.base_price ?? 0))
        : (s.base_price ?? 0)
    }
    return s.base_price ?? 0
  }

  function effectiveWeeklyMonthlyDollarsForSite(
    s: (typeof sitesToShow)[number],
    nightlyDollars: number
  ): { priceWeekly: number; priceMonthly: number } {
    const pricingSource = getPricingSourceType(
      (s as { pricing_override?: unknown }).pricing_override,
      (s as { enabled_reservation_types_override?: unknown }).enabled_reservation_types_override
    )

    const fallbackWeekly = Math.round(nightlyDollars * 7 * 100) / 100
    const fallbackMonthly = Math.round(nightlyDollars * 30 * 100) / 100

    if (pricingSource === "property_default")  {
      const weeklyCents =
        propertyWeeklyEnabled ? reservationTypeConfig.weekly?.rate_cents : null
      const monthlyCents =
        propertyMonthlyEnabled ? reservationTypeConfig.monthly?.rate_cents : null
      return {
        priceWeekly:
          weeklyCents != null && weeklyCents > 0 ? weeklyCents / 100 : fallbackWeekly,
        priceMonthly:
          monthlyCents != null && monthlyCents > 0 ? monthlyCents / 100 : fallbackMonthly,
      }
    }

    if (pricingSource === "site_type_default") {
      const st = (s.site_type ?? "").toLowerCase()
      const key = Object.keys(siteTypeRatesMap).find((k) => k.toLowerCase() === st) ?? (s.site_type ?? "")
      const rates = key ? siteTypeRatesMap[key] : null
      const weeklyCents = rates?.weekly?.rate_cents
      const monthlyCents = rates?.monthly?.rate_cents
      return {
        priceWeekly:
          weeklyCents != null && weeklyCents > 0 ? weeklyCents / 100 : fallbackWeekly,
        priceMonthly:
          monthlyCents != null && monthlyCents > 0 ? monthlyCents / 100 : fallbackMonthly,
      }
    }

    const weeklyCents = (s as { weekly_rate_cents?: number | null }).weekly_rate_cents
    const monthlyCents = (s as { monthly_rate_cents?: number | null }).monthly_rate_cents
    return {
      priceWeekly:
        weeklyCents != null && weeklyCents > 0 ? weeklyCents / 100 : fallbackWeekly,
      priceMonthly:
        monthlyCents != null && monthlyCents > 0 ? monthlyCents / 100 : fallbackMonthly,
    }
  }

  const amenityIdToName = (() => {
    const map = new Map<string, string>()
    const raw = property.site_amenities

    if (!Array.isArray(raw)) return map

    for (const item of raw) {
      if (typeof item === "string") {
        map.set(item.toLowerCase(), item)
        continue
      }

      if (item && typeof item === "object") {
        const maybe = item as Record<string, unknown>
        const id =
          typeof maybe.id === "string"
            ? maybe.id.trim()
            : typeof maybe.amenity_id === "string"
              ? maybe.amenity_id.trim()
              : typeof maybe.amenityId === "string"
                ? maybe.amenityId.trim()
                : ""
        const name =
          typeof maybe.name === "string"
            ? maybe.name.trim()
            : typeof maybe.amenity_name === "string"
              ? maybe.amenity_name.trim()
              : typeof maybe.amenityName === "string"
                ? maybe.amenityName.trim()
                : ""

        if (id && name) map.set(id.toLowerCase(), name)
      }
    }

    return map
  })()

  const legacyAmenityKeyToLabel = (raw: string): string | null => {
    const lower = raw.trim().toLowerCase()
    if (!lower) return null
    const legacyKeyToLabel: Record<string, string> = {
      fire_pit: "Fire Pit",
      picnic_table: "Picnic Table",
      grill: "Grill",
      shade: "Shade",
      pet_friendly: "Pet Friendly",
      lake_view: "Lake View",
      waterfront: "Waterfront",
    }

    if (legacyKeyToLabel[lower]) return legacyKeyToLabel[lower]

    // snake_case -> Title Case
    if (lower.includes("_")) {
      return lower
        .split("_")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    }

    // If it's already a custom human-readable string (e.g. "test 2"), keep it.
    if (raw.includes(" ")) return raw.trim()

    return null
  }

  const siteTypeSummaries: SiteTypeSummary[] = sitesToShow.map((s) => {
    const siteType = ((s.site_type || "other").toLowerCase()) as SiteType
    const resolvedAmenities = Array.isArray(s.amenities)
      ? (s.amenities as string[])
          .slice(0, 6)
          .map((amenityId) => {
            const fromId = amenityIdToName.get(amenityId.toLowerCase())
            if (fromId) return fromId
            return legacyAmenityKeyToLabel(amenityId)
          })
          .filter((x): x is string => typeof x === "string" && x.length > 0)
      : []

    const amenities = resolvedAmenities.length > 0 ? resolvedAmenities : ["No Amenities Available"]
    const imageUrl = s.site_images?.[0] ?? s.images?.[0]

    const priceDollars = effectiveNightlyCentsForSite(s) / 100
    const { priceWeekly, priceMonthly } = effectiveWeeklyMonthlyDollarsForSite(s, priceDollars)

    let discountedPrice: number | undefined
    let discountEndDate: string | undefined
    let discountLabel: string | undefined
    let discountCondition: string | undefined

    if (activeDiscount) {
      discountCondition = getDiscountConditionText(activeDiscount)
      discountLabel = getDiscountLabel(activeDiscount)
      if (activeDiscount.trigger_type === "date_range" && activeDiscount.trigger_conditions?.end_date) {
        discountEndDate = activeDiscount.trigger_conditions.end_date
      }
      if (activeDiscount.discount_type === "percentage_of_subtotal" || activeDiscount.discount_type === "percentage_of_total") {
        const pct = activeDiscount.value_percentage ?? 0
        discountedPrice = Math.round(priceDollars * (1 - pct / 100) * 100) / 100
        if (activeDiscount.max_discount_cents != null && activeDiscount.max_discount_cents > 0) {
          const maxOffDollars = activeDiscount.max_discount_cents / 100
          discountedPrice = Math.max(priceDollars - maxOffDollars, discountedPrice)
        }
      } else if (activeDiscount.discount_type === "flat_amount") {
        discountedPrice = Math.max(0, priceDollars - (activeDiscount.value_cents ?? 0) / 100)
        discountedPrice = Math.round(discountedPrice * 100) / 100
      }
    }

    return {
      id: s.id,
      type: siteType,
      name: s.site_name ?? `Site ${s.site_number}`,
      description: s.description ?? SITE_TYPE_DESCRIPTIONS[siteType] ?? "",
      price: priceDollars,
      priceWeekly,
      priceMonthly,
      capacity: s.max_occupancy ? String(s.max_occupancy) : "-",
      amenities,
      imageUrl: imageUrl ?? null,
      ...(activePromos.length > 0 && { promos: activePromos }),
      ...(discountedPrice != null && (discountCondition ?? discountEndDate) && {
        discountedPrice,
        ...(discountEndDate && { discountEndDate }),
        ...(discountLabel && { discountLabel }),
        ...(discountCondition && { discountCondition }),
      }),
    }
  }).filter((s) => s.price > 0)

  const { openPeriodFrom, openPeriodUntil } = extractOpenPeriodFromPropertySettings(property.settings)

  // Prepare property data for PropertyBookingPortal component
  const propertyData = {
    id: property.id,
    name: property.name?.trim() || "",
    city: property.city || "",
    state: property.state || "",
    description: property.booking_page_description || property.description,
    tagline: property.booking_page_tagline,
    hero_image_url: property.hero_image_url,
    gallery_images: property.gallery_images,
    check_in_time: property.check_in_time || "15:00:00",
    check_out_time: property.check_out_time || "11:00:00",
    phone: property.phone,
    email: property.email,
    cancellation_policy: property.cancellation_policy,
    amenities: Array.isArray(property.amenities)
      ? (property.amenities as unknown[]).reduce<Array<string | { id?: string; name: string; description: string | null; icon_url?: string | null }>>((acc, amenity) => {
        if (typeof amenity === "string") {
          const normalizedAmenity = amenity.trim()
          if (normalizedAmenity) acc.push(normalizedAmenity)
          return acc
        }

        if (amenity && typeof amenity === "object") {
          const maybe = amenity as Record<string, unknown>
          const name = typeof maybe.name === "string" ? maybe.name.trim() : ""
          if (!name) return acc

          const id = typeof maybe.id === "string" ? maybe.id : undefined
          const description = typeof maybe.description === "string" ? maybe.description.trim() : null
          const icon_url =
            typeof maybe.icon_url === "string"
              ? maybe.icon_url.trim()
              : typeof maybe.iconUrl === "string"
                ? maybe.iconUrl.trim()
                : null
          acc.push({
            ...(id ? { id } : {}),
            name,
            description,
            icon_url: icon_url || null,
          })
        }

        return acc
      }, [])
      : [],
    enabled_reservation_types: (property.enabled_reservation_types as ('nightly' | 'weekly' | 'monthly' | 'seasonal')[]) || undefined,
    openPeriodFrom,
    openPeriodUntil,
  }

  return (
    <>
      <ReservationExpiredHandler />
      <PropertyBookingPortal
        property={propertyData}
        slug={slug}
        siteTypeSummaries={siteTypeSummaries.length > 0 ? siteTypeSummaries : [] as SiteTypeSummary[]}
        recentBookings={recentBookings ?? []}
        bookingRulesConfig={bookingRules}
      />
    </>
  )
}

// Generate metadata for SEO
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  try {
    extractPropertyIdFromSlug(slug)
    const supabase = await createClient()

    const { data: property } = await supabase
      .from("properties")
      .select("name, city, state, booking_page_description, booking_page_tagline")
      .eq("booking_page_slug", slug)
      .single()

    if (!property) {
      return {
        title: "Campground Booking",
      }
    }

    const displayName = property.name?.trim() || "Campground"
    const location = `${property.city || ""}${property.city && property.state ? ", " : ""}${property.state || ""}`
    const title = `${displayName}${location ? ` - ${location}` : ""} | Campground Reservations`
    const description =
      property.booking_page_description ||
      property.booking_page_tagline ||
      `Book your stay at ${displayName}${location ? ` in ${location}` : ""}. Browse available campsites and make your reservation online.`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
      },
    }
  } catch (error) {
    console.error("[Metadata] Error generating metadata:", error)
    return {
      title: "Campground Booking",
    }
  }
}
