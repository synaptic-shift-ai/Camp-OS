/**
 * Availability Query Functions
 *
 * Handles checking site availability and searching for available sites.
 * Uses Supabase service role client for unauthenticated guest bookings.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateDateRange } from './api'
import { detectBestReservationType } from './reservation-type-detection'
import {
  resolveEnabledReservationTypes,
  parseReservationTypesConfigFromDB,
  parseEnabledReservationTypesFromDB,
  resolveReservationTypeRate,
} from '@/lib/config/resolution'
import type {
  Site,
  AvailableSite,
  AvailabilitySearchParams,
  AvailabilitySearchResult,
  BookingResult,
  SiteAmenities,
} from './types'
import type { BookingType, SeasonalPeriod } from '@/lib/config/types'

/**
 * Convert DB amenities array to UI-friendly SiteAmenities object
 */
function convertAmenities(amenitiesArray: string[] | null): SiteAmenities {
  const amenities: SiteAmenities = {}

  if (!amenitiesArray || !Array.isArray(amenitiesArray)) {
    return amenities
  }

  amenitiesArray.forEach((amenity) => {
    switch (amenity.toLowerCase()) {
      case 'electric':
      case 'electricity':
        amenities.electric = true
        break
      case 'water':
        amenities.water = true
        break
      case 'sewer':
        amenities.sewer = true
        break
      case 'wifi':
      case 'wi-fi':
        amenities.wifi = true
        break
      case 'firepit':
      case 'fire pit':
        amenities.firepit = true
        break
      case 'picnic table':
      case 'picnictable':
        amenities.picnicTable = true
        break
      case 'pet friendly':
      case 'petfriendly':
        amenities.petFriendly = true
        break
      case 'pull through':
      case 'pullthrough':
        amenities.pullThrough = true
        break
      default:
        amenities[amenity] = true
    }
  })

  return amenities
}

/**
 * Convert DB Site to UI-friendly AvailableSite
 */
function convertToAvailableSite(site: Site, effectiveNightlyRateCents?: number): AvailableSite {
  const basePricePerNight =
    effectiveNightlyRateCents !== undefined
      ? effectiveNightlyRateCents
      : site.base_price
  return {
    id: site.id,
    name: site.site_name || `Site ${site.site_number}`,
    site_number: site.site_number,
    site_type: site.site_type,
    max_occupancy: site.max_occupancy,
    base_price_per_night: basePricePerNight,
    amenities: convertAmenities(site.amenities),
    ...(site.images && Array.isArray(site.images) && site.images.length > 0 && { image_url: site.images[0] }),
  }
}

/**
 * Calculate number of nights between check-in and check-out
 */
function calculateNights(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn)
  const end = new Date(checkOut)
  const diffTime = end.getTime() - start.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Check if a site's blocked_dates overlap with the requested date range.
 * A block overlaps when: block.from < checkOut AND block.to >= checkIn
 */
function hasBlockedDateOverlap(
  availabilityRules: unknown,
  checkInDate: string,
  checkOutDate: string
): boolean {
  if (!availabilityRules || typeof availabilityRules !== 'object') return false
  const rules = availabilityRules as { blocked_dates?: { from: string; to: string; reason: string }[] }
  const blockedDates = rules.blocked_dates ?? []
  return blockedDates.some(
    (block) => block.from < checkOutDate && block.to >= checkInDate
  )
}

/**
 * Check if a specific site is available for given dates
 *
 * Rules:
 * - Site must exist
 * - Site status must be 'available' (not maintenance or unavailable)
 * - No overlapping reservations
 * - Same-day turnover allowed (checkout day = checkin day)
 *
 * @param siteId - Site to check
 * @param checkInDate - Check-in date (YYYY-MM-DD)
 * @param checkOutDate - Check-out date (YYYY-MM-DD)
 * @returns true if available, false if occupied/blocked
 */
export async function checkSiteAvailability(
  siteId: string,
  checkInDate: string,
  checkOutDate: string
): Promise<BookingResult<boolean>> {
  const supabase = createServiceRoleClient()

  // Validate date range
  const dateValidation = validateDateRange(checkInDate, checkOutDate)
  if (!dateValidation.success) {
    return dateValidation as BookingResult<boolean>
  }

  // Fetch the site
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('*')
    .eq('id', siteId)
    .single()

  if (siteError || !site) {
    return {
      success: false,
      error: {
        code: 'SITE_NOT_FOUND',
        message: 'Site not found',
      },
    }
  }

  // Check site status
  if (site.status !== 'available') {
    return {
      success: true,
      data: false,
    }
  }

  // Check for overlapping reservations
  // Overlap occurs when:
  // - new check-in < existing check-out AND
  // - new check-out > existing check-in
  //
  // Same-day turnover: checkout on same day as new checkin is allowed
  // So we check: new_checkin < existing_checkout (strictly less)
  const { data: overlappingReservations, error: reservationError } = await supabase
    .from('reservations')
    .select('id')
    .eq('site_id', siteId)
    .in('status', ['pending', 'confirmed', 'checked_in'])
    .lt('check_in_date', checkOutDate) // Existing check-in before new checkout
    .gt('check_out_date', checkInDate) // Existing check-out after new checkin

  if (reservationError) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Error checking reservations',
      },
    }
  }

  const isAvailable = overlappingReservations.length === 0

  return {
    success: true,
    data: isAvailable,
  }
}

/**
 * Search for available sites based on dates and filters
 *
 * @param params - Search parameters including dates, property, guests, filters
 * @returns List of available sites with pricing and reservation type info
 */
export async function searchAvailableSites(
  params: AvailabilitySearchParams
): Promise<BookingResult<AvailabilitySearchResult>> {
  const supabase = createServiceRoleClient()

  // Validate date range
  const dateValidation = validateDateRange(params.check_in_date, params.check_out_date)
  if (!dateValidation.success) {
    return dateValidation as BookingResult<AvailabilitySearchResult>
  }

  const totalNights = calculateNights(params.check_in_date, params.check_out_date)

  // Fetch property config for reservation types
  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('id, enabled_reservation_types, reservation_type_config')
    .eq('id', params.property_id)
    .single()

  if (propertyError || !property) {
    return {
      success: false,
      error: {
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property not found',
      },
    }
  }

  // Parse property reservation type config
  const propertyEnabledTypes = parseEnabledReservationTypesFromDB(property.enabled_reservation_types)
  const reservationTypeConfig = parseReservationTypesConfigFromDB(property.reservation_type_config)

  // Fetch seasonal periods for the property
  const { data: seasonalPeriods } = await supabase
    .from('property_seasonal_periods')
    .select('*')
    .eq('property_id', params.property_id)

  const periods: SeasonalPeriod[] = (seasonalPeriods || []).map((p) => ({
    id: p.id,
    property_id: p.property_id,
    name: p.name,
    start_month: p.start_month,
    start_day: p.start_day,
    end_month: p.end_month,
    end_day: p.end_day,
    base_rate_cents: p.base_rate_cents,
    recurring: p.recurring,
  }))

  // Auto-detect best reservation type
  const detectedType = detectBestReservationType(
    totalNights,
    params.check_in_date,
    params.check_out_date,
    reservationTypeConfig,
    periods
  )

  // Build site query with filters
  let query = supabase
    .from('sites')
    .select('*, enabled_reservation_types_override, availability_rules')
    .eq('property_id', params.property_id)
    .in('status', ['available', 'housekeeping', 'maintenance'])

  // Apply filters
  if (params.site_type) {
    query = query.eq('site_type', params.site_type)
  }

  if (params.num_adults) {
    // Filter by occupancy (adults + children)
    const totalGuests = params.num_adults + (params.num_children || 0)
    query = query.gte('max_occupancy', totalGuests)
  }

  if (params.amenities && params.amenities.length > 0) {
    // Filter sites that have all requested amenities
    // Using PostgreSQL JSONB contains operator
    query = query.contains('amenities', params.amenities)
  }

  const { data: allSites, error: siteError } = await query

  if (siteError) {
    console.error('[Availability] Database error:', siteError)
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Error fetching sites',
      },
    }
  }

  if (!allSites || allSites.length === 0) {
    return {
      success: true,
      data: {
        sites: [],
        check_in_date: params.check_in_date,
        check_out_date: params.check_out_date,
        total_nights: totalNights,
        suggested_reservation_type: detectedType.type as any,
        suggested_type_reason: detectedType.reason,
        available_reservation_types: propertyEnabledTypes.filter(
          (t): t is 'nightly' | 'weekly' | 'monthly' | 'seasonal' =>
            ['nightly', 'weekly', 'monthly', 'seasonal'].includes(t)
        ),
      },
    }
  }

  // Get all site IDs
  const siteIds = allSites.map((site) => site.id)

  // Find sites with overlapping reservations
  const { data: overlappingReservations, error: reservationError } = await supabase
    .from('reservations')
    .select('site_id')
    .in('site_id', siteIds)
    .in('status', ['pending', 'confirmed', 'checked_in'])
    .lt('check_in_date', params.check_out_date)
    .gt('check_out_date', params.check_in_date)

  if (reservationError) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Error checking reservations',
      },
    }
  }

  // Get set of occupied site IDs
  const occupiedSiteIds = new Set(overlappingReservations?.map((r) => r.site_id) || [])

  // Filter out occupied sites and optionally filter by reservation type
  let filteredSites = allSites.filter(
    (site) => 
      !occupiedSiteIds.has(site.id) &&
      !hasBlockedDateOverlap(site.availability_rules, params.check_in_date, params.check_out_date)
  )

  // If a specific reservation type is requested, filter sites that support it
  if (params.reservation_type) {
    filteredSites = filteredSites.filter((site) => {
      const siteEnabledTypes = resolveEnabledReservationTypes(
        propertyEnabledTypes,
        site.enabled_reservation_types_override as BookingType[] | null
      )
      return siteEnabledTypes.includes(params.reservation_type!)
    })
  }

  type SiteRow = Site & {
    weekly_rate_cents?: number | null
    monthly_rate_cents?: number | null
    pricing_override?: { reservation_type_rates_override?: Partial<Record<BookingType, number>> | null }
  }
  const availableSites = filteredSites.map((site) => {
    const row = site as SiteRow
    const effectiveNightlyRate = resolveReservationTypeRate(
      'nightly',
      null,
      row.pricing_override?.reservation_type_rates_override ?? null,
      {
        base_price: row.base_price ?? 0,
        weekly_rate_cents: row.weekly_rate_cents ?? null,
        monthly_rate_cents: row.monthly_rate_cents ?? null,
      }
    )
    return convertToAvailableSite(row as Site, effectiveNightlyRate)
  })

  return {
    success: true,
    data: {
      sites: availableSites,
      check_in_date: params.check_in_date,
      check_out_date: params.check_out_date,
      total_nights: totalNights,
      suggested_reservation_type: detectedType.type as any,
      suggested_type_reason: detectedType.reason,
      available_reservation_types: propertyEnabledTypes.filter(
        (t): t is 'nightly' | 'weekly' | 'monthly' | 'seasonal' =>
          ['nightly', 'weekly', 'monthly', 'seasonal'].includes(t)
      ),
    },
  }
}
