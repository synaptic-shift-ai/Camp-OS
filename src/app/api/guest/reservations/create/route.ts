/**
 * Guest Reservation Creation API (Public)
 *
 * POST /api/guest/reservations/create
 *
 * Creates a new reservation from the guest booking flow.
 * This is a PUBLIC endpoint (no authentication required).
 *
 * Security considerations:
 * - Rate limiting implemented via middleware
 * - Creates reservation in 'pending' status
 * - Payment must be completed to confirm
 * - Tenant isolation enforced by property_id
 *
 * Flow:
 * 1. Validate input data
 * 2. Check site availability
 * 3. Calculate pricing
 * 4. Create guest record (or link existing)
 * 5. Create pending reservation
 * 6. Return reservation details for payment
 */

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { calculatePriceBreakdown, getBaseSubtotalAndLabel } from '@/lib/booking/pricing'
import { DEFAULT_TAX_RATE } from '@/lib/booking/types'
import {
  resolveRateDiscountsConfig,
  parseReservationTypesConfigFromDB,
  resolveReservationTypeRate,
  parseEnabledReservationTypesFromDB,
} from '@/lib/config/resolution'
import { getManualOverrideTypes, getPricingSourceType } from '@/lib/site-pricing-source'
import type { RateDiscountsConfig } from '@/lib/config/types'
import { ConfirmationNumber } from '@/modules/BookingEngine/domain/value-objects/ConfirmationNumber'
import { GUEST_BOOKABLE_SITE_STATUSES } from '@/lib/constants'
import {
  extractOpenPeriodFromPropertySettings,
  isStayWithinOpenPeriodByIsoDates,
  buildOpenPeriodBookingErrorMessage,
} from '@/lib/booking/open-period'
import { createGuestVehicles, linkVehiclesToReservation } from '@/lib/booking/vehicles'
import { updateGuestSpouse } from '@/lib/booking/guest'
import { replaceReservationChildren } from '@/lib/booking/children'
import type { CreateChildInputData, CreateVehicleInputData, SpousePartnerInput } from '@/lib/booking/types'

const guestVehicleScehema = z.object({
  vehicle_type: z.enum(['personal', 'rv', 'tow_vehicle']),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().int().optional(),
  color: z.string().optional(),
  license_plate: z.string().optional(),
  license_plate_state: z.string().optional(),

  personal_vehicle_type: z.enum(
    ['car', 'truck', 'suv', 'motorcycle', 'boat_trailer', 'other']
  ).optional(),

  rv_type: z.enum(
    ['class_a', 'class_b', 'class_c', 'fifth_wheel', 'travel_trailer', 'popup', 'truck_camper', 'toy_hauler']
  ).optional(),

  rv_length_feet: z.coerce.number().optional(),
  rv_width_feet: z.coerce.number().optional(),
  num_slide_outs: z.coerce.number().int().optional(),

  insurance_company: z.string().optional(),
  insurance_policy_number: z.string().optional(),

  is_primary: z.boolean().optional(),
})

// Input validation schema
const createGuestReservationSchema = z.object({
  property_id: z.string().uuid('Invalid property ID'),
  site_id: z.string().uuid('Invalid site ID'),
  check_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Check-in date must be YYYY-MM-DD'),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Check-out date must be YYYY-MM-DD'),
  num_adults: z.coerce.number().int().min(1, 'At least one adult is required'),
  num_children: z.coerce.number().int().min(0).optional(),
  num_pets: z.coerce.number().int().min(0).optional(),
  num_vehicles: z.coerce.number().int().min(0).max(10).optional(),
  vehicle_info: z.array(guestVehicleScehema).optional(),
  spouse_partner: z
    .object({
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      is_alternate_contact: z.boolean().optional(),
    })
    .optional(),
  children: z
    .array(
      z.object({
        first_name: z.string().min(1, 'Child first name is required'),
        age: z.coerce.number().int().optional(),
        date_of_birth: z.string().optional(),
        special_needs_allergies: z.string().optional(),
      })
    )
    .optional(),
  special_requests: z.string().max(1000).optional(),
  guest: z.object({
    first_name: z.string().min(1, 'First name is required').max(100),
    last_name: z.string().min(1, 'Last name is required').max(100),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(10, 'Phone number must be at least 10 digits'),
    address: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(50).optional(),
    zip_code: z.string().max(20).optional(),
    country: z.string().max(100).optional(),
    emergency_contact_name: z.string().max(100).optional(),
    emergency_contact_phone: z.string().max(50).optional(),
  }),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validatedInput = createGuestReservationSchema.parse(body)

    const normalizeSpousePartnerOrNull = (
      spousePartner: typeof validatedInput.spouse_partner,
    ): SpousePartnerInput | null => {
      if (!spousePartner) return null

      const first = String(spousePartner.first_name ?? '').trim()
      const last = String(spousePartner.last_name ?? '').trim()
      const phone = String(spousePartner.phone ?? '').trim()
      const email = String(spousePartner.email ?? '').trim()
      const isAlternate = spousePartner.is_alternate_contact ?? false

      const hasAny =
        first.length > 0 ||
        last.length > 0 ||
        phone.length > 0 ||
        email.length > 0 ||
        isAlternate === true

      if (!hasAny) return null
      if (!first || !last) return null

      const spouseInput: SpousePartnerInput = {
        first_name: first,
        last_name: last,
        is_alternate_contact: isAlternate,
      }

      if (phone.length > 0) spouseInput.phone = phone
      if (email.length > 0) spouseInput.email = email

      return spouseInput
    }

    const normalizeChildrenInput = (
      children: NonNullable<typeof validatedInput.children>,
    ): CreateChildInputData[] => {
      return children.map((c) => ({
        first_name: c.first_name,
        ...(c.age != null ? { age: c.age } : {}),
        ...(c.date_of_birth ? { date_of_birth: c.date_of_birth } : {}),
        ...(c.special_needs_allergies ? { special_needs_allergies: c.special_needs_allergies } : {}),
      }))
    }

    const supabase = await createClient()

    // ========================================================================
    // Step 1: Verify property exists and is accepting bookings
    // ========================================================================

    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, name, booking_page_slug, onboarding_completed, pricing_config, rate_discounts_config, enabled_reservation_types, reservation_type_config, site_type_config, settings')
      .eq('id', validatedInput.property_id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'PROPERTY_NOT_FOUND', message: 'Property not found' }
        },
        { status: 404 }
      )
    }

    if (!property.onboarding_completed) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'PROPERTY_NOT_READY', message: 'This property is not yet accepting bookings' }
        },
        { status: 400 }
      )
    }

    const { openPeriodFrom, openPeriodUntil } = extractOpenPeriodFromPropertySettings(property.settings)
    if (
      !isStayWithinOpenPeriodByIsoDates(
        validatedInput.check_in_date,
        validatedInput.check_out_date,
        openPeriodFrom,
        openPeriodUntil,
      )
    ) {
      const fromIso = openPeriodFrom?.trim()
      const untilIso = openPeriodUntil?.trim()
      const message =
        fromIso && untilIso
          ? buildOpenPeriodBookingErrorMessage(property.name, fromIso, untilIso)
          : 'Selected dates are outside the property booking season.'
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'OPEN_PERIOD',
            message,
          },
        },
        { status: 400 },
      )
    }

    // ========================================================================
    // Step 2: Verify site exists based on guest bookable statuses
    // ========================================================================

    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, site_number, site_name, site_type, base_price, weekly_rate_cents, monthly_rate_cents, max_occupancy, max_vehicles, enabled_reservation_types_override, pricing_override')
      .eq('id', validatedInput.site_id)
      .eq('property_id', validatedInput.property_id) // Tenant isolation
      .in('status', [...GUEST_BOOKABLE_SITE_STATUSES])
      .is('deleted_at', null)
      .single()

    if (siteError || !site) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'SITE_NOT_AVAILABLE', message: 'Site is not available for booking' }
        },
        { status: 400 }
      )
    }

    // Check capacity
    const totalGuests = validatedInput.num_adults + (validatedInput.num_children || 0)
    if (site.max_occupancy && totalGuests > site.max_occupancy) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CAPACITY_EXCEEDED',
            message: `Site capacity is ${site.max_occupancy} guests. You selected ${totalGuests} guests.`
          }
        },
        { status: 400 }
      )
    }

    // Check vehicle limit
    if (site.max_vehicles && validatedInput.num_vehicles && validatedInput.num_vehicles > site.max_vehicles) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VEHICLE_LIMIT_EXCEEDED',
            message: `Site allows ${site.max_vehicles} vehicles. You selected ${validatedInput.num_vehicles} vehicles.`
          }
        },
        { status: 400 }
      )
    }

    // ========================================================================
    // Step 2.5: Resolve effective rates (property default vs site type default vs manual)
    // - property_default: use property's reservation_type_config
    // - site_type_default: use property's site_type_config.site_type_rates[site.site_type]
    // - manual: use site's base_price, weekly_rate_cents, monthly_rate_cents
    // ========================================================================
    const reservationTypeConfig = parseReservationTypesConfigFromDB(
      (property as { reservation_type_config?: unknown } | null)?.reservation_type_config ?? null
    )
    const pricingSource = getPricingSourceType((site as { pricing_override?: unknown }).pricing_override, (site as { enabled_reservation_types_override?: unknown }).enabled_reservation_types_override)
    const usesManual = pricingSource === 'manual'
    const usesSiteTypeDefault = pricingSource === 'site_type_default'

    let siteTypeHasWeekly = false
    let siteTypeHasMonthly = false
    let effectiveOverride: Partial<Record<'nightly' | 'weekly' | 'monthly' | 'seasonal', number>> | null = null
    if (usesSiteTypeDefault) {
      type SiteTypeRates = Record<string, { nightly?: { rate_cents: number | null }; weekly?: { rate_cents: number | null }; monthly?: { rate_cents: number | null }; seasonal?: { rate_cents: number | null } }>
      const siteTypeConfig = (property as { site_type_config?: { site_type_rates?: SiteTypeRates } } | null)?.site_type_config
      const map = siteTypeConfig?.site_type_rates ?? {}
      const st = (site.site_type ?? '').toLowerCase()
      const ratesKey = Object.keys(map).find((k) => k.toLowerCase() === st) ?? (site.site_type ?? '')
      const rates = ratesKey ? map[ratesKey] : null
      if (rates) {
        siteTypeHasWeekly = rates.weekly?.rate_cents != null && rates.weekly.rate_cents > 0
        siteTypeHasMonthly = rates.monthly?.rate_cents != null && rates.monthly.rate_cents > 0
        effectiveOverride = {}
        if (rates.nightly?.rate_cents != null) effectiveOverride.nightly = rates.nightly.rate_cents
        if (rates.weekly?.rate_cents != null) effectiveOverride.weekly = rates.weekly.rate_cents
        if (rates.monthly?.rate_cents != null) effectiveOverride.monthly = rates.monthly.rate_cents
        if (rates.seasonal?.rate_cents != null) effectiveOverride.seasonal = rates.seasonal.rate_cents
      }
    } else if (usesManual) {
      effectiveOverride = { nightly: site.base_price ?? 0 }
    }

    const fallbackRates = {
      base_price: site.base_price ?? 0,
      weekly_rate_cents: usesManual ? (site.weekly_rate_cents ?? null) : null,
      monthly_rate_cents: usesManual ? (site.monthly_rate_cents ?? null) : null,
    }
    const effectiveNightlyCents = resolveReservationTypeRate(
      'nightly',
      reservationTypeConfig,
      effectiveOverride,
      fallbackRates
    )
    const effectiveWeeklyCents = resolveReservationTypeRate(
      'weekly',
      reservationTypeConfig,
      effectiveOverride,
      fallbackRates
    )
    const effectiveMonthlyCents = resolveReservationTypeRate(
      'monthly',
      reservationTypeConfig,
      effectiveOverride,
      fallbackRates
    )

    const propertyEnabledTypes = parseEnabledReservationTypesFromDB(
      (property as { enabled_reservation_types?: unknown }).enabled_reservation_types
    )
    const manualTypes = getManualOverrideTypes(
      (site as { pricing_override?: unknown }).pricing_override,
      (site as { enabled_reservation_types_override?: unknown }).enabled_reservation_types_override
    )
    const weeklyEnabled = usesManual
      ? (manualTypes?.includes('weekly') ?? false)
      : usesSiteTypeDefault
        ? siteTypeHasWeekly || propertyEnabledTypes.includes('weekly')
        : propertyEnabledTypes.includes('weekly')
    const monthlyEnabled = usesManual
      ? (manualTypes?.includes('monthly') ?? false)
      : usesSiteTypeDefault
        ? siteTypeHasMonthly || propertyEnabledTypes.includes('monthly')
        : propertyEnabledTypes.includes('monthly')
    const weeklyForGuestLabel = weeklyEnabled ? effectiveWeeklyCents : effectiveNightlyCents * 7
    const monthlyForGuestLabel = monthlyEnabled ? effectiveMonthlyCents : effectiveNightlyCents * 28

    // ========================================================================
    // Step 3: Check for existing guest by email (need guest_id for next check)
    // ========================================================================

    // Check if guest exists by email for this property
    const { data: existingGuestForCheck } = await supabase
      .from('guests')
      .select('id')
      .eq('email', validatedInput.guest.email)
      .eq('property_id', validatedInput.property_id)
      .single()

    // ========================================================================
    // Step 4: Check if this exact reservation already exists (idempotency)
    // ========================================================================

    if (existingGuestForCheck) {
      // Check if this guest already has a pending reservation for these exact dates/site
      const { data: existingReservation } = await supabase
        .from('reservations')
        .select('id, confirmation_number, total_amount, reserved_until')
        .eq('site_id', validatedInput.site_id)
        .eq('guest_id', existingGuestForCheck.id)
        .eq('check_in_date', validatedInput.check_in_date)
        .eq('check_out_date', validatedInput.check_out_date)
        .eq('status', 'pending')
        .eq('payment_status', 'pending')
        .single()

      if (existingReservation) {
        // Return existing reservation instead of creating duplicate
        console.log('[Guest Reservation] Returning existing pending reservation:', existingReservation.id)

        // Persist spouse/children details if provided in this request
        if (validatedInput.spouse_partner !== undefined) {
          const spousePartnerOrNull = normalizeSpousePartnerOrNull(validatedInput.spouse_partner)
          const spouseResult = await updateGuestSpouse(
            existingGuestForCheck.id,
            validatedInput.property_id,
            spousePartnerOrNull
          )
          if (!spouseResult.success) {
            return NextResponse.json(
              {
                success: false,
                error: spouseResult.error,
              },
              { status: 400 }
            )
          }
        }

        if (validatedInput.children && validatedInput.children.length > 0) {
          const childrenInput = normalizeChildrenInput(validatedInput.children)
          const childrenResult = await replaceReservationChildren(
            existingReservation.id,
            validatedInput.property_id,
            childrenInput
          )
          if (!childrenResult.success) {
            return NextResponse.json(
              {
                success: false,
                error: childrenResult.error,
              },
              { status: 400 }
            )
          }
        }

        const checkIn = new Date(validatedInput.check_in_date)
        const checkOut = new Date(validatedInput.check_out_date)
        const numberOfNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))

        const { subtotalCents: existingSubtotalCents, basePriceLabel: existingBasePriceLabel, rateType: existingRateType } = getBaseSubtotalAndLabel(
          numberOfNights,
          effectiveNightlyCents,
          weeklyForGuestLabel !== effectiveNightlyCents * 7 ? weeklyForGuestLabel : null,
          monthlyForGuestLabel !== effectiveNightlyCents * 28 ? monthlyForGuestLabel : null
        )
        const priceBreakdown = calculatePriceBreakdown({
          basePricePerNight: effectiveNightlyCents,
          numberOfNights,
          siteType: site.site_type as any,
          numPets: validatedInput.num_pets,
        })
        priceBreakdown.subtotal = existingSubtotalCents
        priceBreakdown.base_price_label = existingBasePriceLabel
        priceBreakdown.rate_type = existingRateType
        priceBreakdown.total = existingSubtotalCents + (priceBreakdown.pet_fee ?? 0)
        const cleaningFeeCents = site.site_type === 'cabin' ? 5000 : 0
        const serviceFeeCents = Math.round(existingSubtotalCents * 0.1)
        priceBreakdown.cleaningFee = cleaningFeeCents
        priceBreakdown.serviceFee = serviceFeeCents
        const subtotalCents = existingSubtotalCents
        const pricingConfig = (property?.pricing_config as { tax_rate?: number; tax_name?: string } | null) ?? {}
        const propertyTaxRate =
          typeof pricingConfig.tax_rate === 'number' && pricingConfig.tax_rate >= 0
            ? pricingConfig.tax_rate
            : DEFAULT_TAX_RATE
        priceBreakdown.tax_rate = propertyTaxRate
        if (pricingConfig.tax_name) priceBreakdown.tax_name = pricingConfig.tax_name
        const rateDiscountsConfig = resolveRateDiscountsConfig(
          (property?.rate_discounts_config as RateDiscountsConfig | null) ?? null
        )
        const userDiscounts = rateDiscountsConfig.user_defined_discounts ?? []
        const appliedDiscounts: {
          id: string
          title: string
          amount: number
          trigger_type: 'manual' | 'min_nights' | 'min_guests' | 'date_range'
        }[] = []
        let discountCents = 0
        if (userDiscounts.length > 0) {
          const checkInStr = validatedInput.check_in_date
          const totalGuests = validatedInput.num_adults + (validatedInput.num_children ?? 0)
          const taxableBeforeDiscount = subtotalCents + cleaningFeeCents + serviceFeeCents
          const inDateRange = (start: string | undefined, end: string | undefined) => {
            if (start && checkInStr < start) return false
            if (end && checkInStr > end) return false
            return true
          }
          for (const d of userDiscounts) {
            if (!d.enabled || d.trigger_type === 'manual') continue
            let shouldApply = false
            if (d.trigger_type === 'date_range') {
              shouldApply = inDateRange(d.trigger_conditions?.start_date, d.trigger_conditions?.end_date)
            } else if (d.trigger_type === 'min_nights') {
              shouldApply = numberOfNights >= (d.trigger_conditions?.min_nights ?? 0)
            } else if (d.trigger_type === 'min_guests') {
              shouldApply = totalGuests >= (d.trigger_conditions?.min_guests ?? 0)
            }
            if (!shouldApply) continue
            let amount = 0
            if (
              d.discount_type === 'percentage_of_subtotal' ||
              d.discount_type === 'percentage_of_total'
            ) {
              const pct = (d.value_percentage ?? 0) / 100
              const base = d.discount_type === 'percentage_of_total' ? taxableBeforeDiscount : subtotalCents
              amount = Math.round(base * pct)
              if ((d.max_discount_cents ?? 0) > 0) {
                amount = Math.min(amount, d.max_discount_cents!)
              }
            } else if (d.discount_type === 'flat_amount') {
              amount = d.value_cents ?? 0
            }
            if (amount > 0) {
              appliedDiscounts.push({
                id: d.id,
                title: d.title ?? 'Discount',
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
        const taxableAmountAfterDiscount = subtotalCents - discountCents
        priceBreakdown.taxes = Math.round(taxableAmountAfterDiscount * propertyTaxRate)
        priceBreakdown.total_before_tax = subtotalCents - discountCents
        priceBreakdown.total =
          subtotalCents - discountCents + (priceBreakdown.taxes ?? 0) + (priceBreakdown.pet_fee ?? 0)

        return NextResponse.json({
          success: true,
          data: {
            reservation_id: existingReservation.id,
            confirmation_number: existingReservation.confirmation_number,
            total_amount_cents: existingReservation.total_amount,
            property_id: validatedInput.property_id,
            site_name: site.site_name || `Site ${site.site_number}`,
            check_in_date: validatedInput.check_in_date,
            check_out_date: validatedInput.check_out_date,
            number_of_nights: numberOfNights,
            price_breakdown: priceBreakdown,
            reserved_until: existingReservation.reserved_until,
          },
        })
      }
    }

    // ========================================================================
    // Step 5: Check availability (no overlapping blocking reservations)
    // ========================================================================

    const { data: existingReservations, error: availError } = await supabase
      .from('reservations')
      .select('id, status, guest_id')
      .eq('site_id', validatedInput.site_id)
      .not('status', 'in', '(cancelled,no_show)')
      .or(`and(check_in_date.lt.${validatedInput.check_out_date},check_out_date.gt.${validatedInput.check_in_date})`)

    if (availError) {
      console.error('[Guest Reservation] Availability check error:', availError)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'AVAILABILITY_CHECK_FAILED', message: 'Could not verify availability' }
        },
        { status: 500 }
      )
    }

    // Block overlaps with active holds and stays; allow same guest to resume their pending checkout
    const blockingReservations = existingReservations?.filter((res) => {
      if (res.status === 'confirmed' || res.status === 'checked_in' || res.status === 'reserved' || res.status === 'booked') {
        return true
      }
      if (res.status === 'pending' && existingGuestForCheck && res.guest_id !== existingGuestForCheck.id) {
        return true
      }
      return false
    }) ?? []

    if (blockingReservations.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SITE_UNAVAILABLE',
            message: 'This site is not available for the selected dates. Please choose different dates.'
          }
        },
        { status: 409 }
      )
    }

    // ========================================================================
    // Step 6: Calculate pricing
    // ========================================================================

    const checkIn = new Date(validatedInput.check_in_date)
    const checkOut = new Date(validatedInput.check_out_date)
    const numberOfNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))

    if (numberOfNights < 1) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_DATES', message: 'Check-out must be after check-in' }
        },
        { status: 400 }
      )
    }

    const { subtotalCents, basePriceLabel, rateType } = getBaseSubtotalAndLabel(
      numberOfNights,
      effectiveNightlyCents,
      weeklyForGuestLabel !== effectiveNightlyCents * 7 ? weeklyForGuestLabel : null,
      monthlyForGuestLabel !== effectiveNightlyCents * 28 ? monthlyForGuestLabel : null
    )
    const priceBreakdown = calculatePriceBreakdown({
      basePricePerNight: effectiveNightlyCents,
      numberOfNights,
      siteType: site.site_type as any,
      numPets: validatedInput.num_pets,
    })
    priceBreakdown.subtotal = subtotalCents
    priceBreakdown.base_price_label = basePriceLabel
    priceBreakdown.rate_type = rateType
    priceBreakdown.total = subtotalCents + (priceBreakdown.pet_fee ?? 0)

    // Apply fees, tax, and discounts from property config (match availability-results logic)
    const cleaningFeeCents = site.site_type === 'cabin' ? 5000 : 0
    const serviceFeeCents = Math.round((priceBreakdown.subtotal ?? 0) * 0.1)
    priceBreakdown.cleaningFee = cleaningFeeCents
    priceBreakdown.serviceFee = serviceFeeCents
    const taxableBeforeDiscount = subtotalCents + cleaningFeeCents + serviceFeeCents
    const pricingConfig = (property?.pricing_config as { tax_rate?: number; tax_name?: string } | null) ?? {}
    const propertyTaxRate =
      typeof pricingConfig.tax_rate === 'number' && pricingConfig.tax_rate >= 0
        ? pricingConfig.tax_rate
        : DEFAULT_TAX_RATE
    priceBreakdown.tax_rate = propertyTaxRate
    if (pricingConfig.tax_name) priceBreakdown.tax_name = pricingConfig.tax_name

    let discountCents = 0
    const rateDiscountsConfig = resolveRateDiscountsConfig(
      (property?.rate_discounts_config as RateDiscountsConfig | null) ?? null
    )
    const userDiscounts = rateDiscountsConfig.user_defined_discounts ?? []
    const appliedDiscounts: {
      id: string
      title: string
      amount: number
      trigger_type: 'manual' | 'min_nights' | 'min_guests' | 'date_range'
    }[] = []
    if (userDiscounts.length > 0) {
      const checkInStr = validatedInput.check_in_date
      const totalGuests = validatedInput.num_adults + (validatedInput.num_children ?? 0)
      const inDateRange = (start: string | undefined, end: string | undefined) => {
        if (start && checkInStr < start) return false
        if (end && checkInStr > end) return false
        return true
      }
      for (const d of userDiscounts) {
        if (!d.enabled || d.trigger_type === 'manual') continue
        let shouldApply = false
        if (d.trigger_type === 'date_range') {
          shouldApply = inDateRange(d.trigger_conditions?.start_date, d.trigger_conditions?.end_date)
        } else if (d.trigger_type === 'min_nights') {
          shouldApply = numberOfNights >= (d.trigger_conditions?.min_nights ?? 0)
        } else if (d.trigger_type === 'min_guests') {
          shouldApply = totalGuests >= (d.trigger_conditions?.min_guests ?? 0)
        }
        if (!shouldApply) continue
        let amount = 0
        if (
          d.discount_type === 'percentage_of_subtotal' ||
          d.discount_type === 'percentage_of_total'
        ) {
          const pct = (d.value_percentage ?? 0) / 100
          const base = d.discount_type === 'percentage_of_total' ? taxableBeforeDiscount : subtotalCents
          amount = Math.round(base * pct)
          if ((d.max_discount_cents ?? 0) > 0) {
            amount = Math.min(amount, d.max_discount_cents!)
          }
        } else if (d.discount_type === 'flat_amount') {
          amount = d.value_cents ?? 0
        }
        if (amount > 0) {
          appliedDiscounts.push({
            id: d.id,
            title: d.title ?? 'Discount',
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

    // ========================================================================
    // Step 7: Create or update guest record
    // ========================================================================

    // Reuse the guest lookup we did earlier
    let guestId: string

    if (existingGuestForCheck) {
      // Use existing guest
      guestId = existingGuestForCheck.id

      // Update guest info if provided
      await supabase
        .from('guests')
        .update({
          first_name: validatedInput.guest.first_name,
          last_name: validatedInput.guest.last_name,
          phone: validatedInput.guest.phone,
          address: validatedInput.guest.address || null,
          city: validatedInput.guest.city || null,
          state: validatedInput.guest.state || null,
          zip_code: validatedInput.guest.zip_code || null,
          country: validatedInput.guest.country || null,
          emergency_contact_name: validatedInput.guest.emergency_contact_name || null,
          emergency_contact_phone: validatedInput.guest.emergency_contact_phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', guestId)
    } else {
      // Create new guest
      const { data: newGuest, error: guestError } = await supabase
        .from('guests')
        .insert({
          property_id: validatedInput.property_id,
          first_name: validatedInput.guest.first_name,
          last_name: validatedInput.guest.last_name,
          email: validatedInput.guest.email,
          phone: validatedInput.guest.phone,
          address: validatedInput.guest.address || null,
          city: validatedInput.guest.city || null,
          state: validatedInput.guest.state || null,
          zip_code: validatedInput.guest.zip_code || null,
          country: validatedInput.guest.country || null,
          emergency_contact_name: validatedInput.guest.emergency_contact_name || null,
          emergency_contact_phone: validatedInput.guest.emergency_contact_phone || null,
        })
        .select('id')
        .single()

      if (guestError || !newGuest) {
        console.error('[Guest Reservation] Guest creation error:', guestError)
        return NextResponse.json(
          {
            success: false,
            error: { code: 'GUEST_CREATION_FAILED', message: 'Could not create guest record' }
          },
          { status: 500 }
        )
      }

      guestId = newGuest.id
    }

    // Persist spouse details if provided in this request
    if (validatedInput.spouse_partner !== undefined) {
      const spousePartnerOrNull = normalizeSpousePartnerOrNull(validatedInput.spouse_partner)
      const spouseResult = await updateGuestSpouse(
        guestId,
        validatedInput.property_id,
        spousePartnerOrNull
      )
      if (!spouseResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: spouseResult.error,
          },
          { status: 400 }
        )
      }
    }

    // ========================================================================
    // Step 8: Generate confirmation number
    // ========================================================================

    // const confirmationNumber = `CAMP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    const confirmationNumber = ConfirmationNumber.generate().value

    // ========================================================================
    // Step 9: Create pending reservation with 15-minute checkout timer
    // ========================================================================

    // Set reservation expiration to 15 minutes from now (airline-style checkout timer)
    const reservedUntil = new Date()
    reservedUntil.setMinutes(reservedUntil.getMinutes() + 1)

    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .insert({
        property_id: validatedInput.property_id,
        site_id: validatedInput.site_id,
        guest_id: guestId,
        confirmation_number: confirmationNumber,
        check_in_date: validatedInput.check_in_date,
        check_out_date: validatedInput.check_out_date,
        num_adults: validatedInput.num_adults,
        num_children: validatedInput.num_children || 0,
        num_pets: validatedInput.num_pets || 0,
        num_vehicles: validatedInput.num_vehicles || 0,
        vehicle_info: validatedInput.vehicle_info || [],
        total_amount: priceBreakdown.total,
        paid_amount: 0,
        status: 'pending', // Must be pending until payment
        payment_status: 'pending',
        special_requests: validatedInput.special_requests || null,
        source: 'online',
        reserved_until: reservedUntil.toISOString(), // 15-minute checkout timer
      })
      .select('id, confirmation_number, total_amount, reserved_until')
      .single()

    if (reservationError || !reservation) {
      console.error('[Guest Reservation] Reservation creation error:', reservationError)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'RESERVATION_CREATION_FAILED', message: 'Could not create reservation' }
        },
        { status: 500 }
      )
    }

    // Persist guest vehicles into `guest_vehicles` and link them to this reservation.
    const vehicles = validatedInput.vehicle_info ?? []
    if (vehicles.length > 0) {
      const vehicleInput = vehicles as CreateVehicleInputData[]

      const vehicleResult = await createGuestVehicles(guestId, validatedInput.property_id, vehicleInput)
      if (!vehicleResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: vehicleResult.error,
          },
          { status: 400 },
        )
      }

      const vehicleIds = vehicleResult.data.map((v) => v.id)
      const linkResult = await linkVehiclesToReservation(reservation.id, vehicleIds)
      if (!linkResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: linkResult.error,
          },
          { status: 400 },
        )
      }
    }

    // Persist detailed children rows only when provided in this request
    if (validatedInput.children && validatedInput.children.length > 0) {
      const childrenInput = normalizeChildrenInput(validatedInput.children)
      const childrenResult = await replaceReservationChildren(
        reservation.id,
        validatedInput.property_id,
        childrenInput
      )
      if (!childrenResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: childrenResult.error,
          },
          { status: 400 }
        )
      }
    }

    // ========================================================================
    // Step 9.5: Update site status to 'reserved' (hold during checkout)
    // ========================================================================

    // const { error: siteUpdateError } = await supabase
    //   .from('sites')
    //   .update({
    //     status: 'reserved',
    //     updated_at: new Date().toISOString(),
    //   })
    //   .eq('id', validatedInput.site_id)

    // if (siteUpdateError) {
    //   console.error('[Guest Reservation] Site status update error:', siteUpdateError)
    //   // Don't fail reservation creation - site status can be corrected by cleanup job
    // }

    // ========================================================================
    // Step 10: Return reservation details for payment
    // ========================================================================

    return NextResponse.json({
      success: true,
      data: {
        reservation_id: reservation.id,
        confirmation_number: reservation.confirmation_number,
        total_amount_cents: reservation.total_amount,
        property_id: validatedInput.property_id,
        site_name: site.site_name || `Site ${site.site_number}`,
        check_in_date: validatedInput.check_in_date,
        check_out_date: validatedInput.check_out_date,
        number_of_nights: numberOfNights,
        price_breakdown: priceBreakdown,
        reserved_until: reservation.reserved_until, // Checkout timer expiration
      },
    })
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: error.errors,
          },
        },
        { status: 400 }
      )
    }

    // Handle unexpected errors
    console.error('[Guest Reservation] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred. Please try again.',
        },
      },
      { status: 500 }
    )
  }
}
