/**
 * Availability Query Functions
 *
 * Handles checking site availability and searching for available sites.
 * Uses Supabase service role client for unauthenticated guest bookings.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateDateRange } from './api'
import type {
  Site,
  AvailableSite,
  AvailabilitySearchParams,
  AvailabilitySearchResult,
  BookingResult,
  SiteAmenities,
} from './types'

/**
 * Convert DB amenities array to UI-friendly SiteAmenities object
 */
function convertAmenities(amenitiesArray: string[]): SiteAmenities {
  const amenities: SiteAmenities = {}

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
function convertToAvailableSite(site: Site): AvailableSite {
  return {
    id: site.id,
    name: site.site_name || `Site ${site.site_number}`,
    site_number: site.site_number,
    site_type: site.site_type,
    max_occupancy: site.max_occupancy,
    base_price_per_night: site.base_price,
    amenities: convertAmenities(site.amenities),
    image_url: site.images.length > 0 ? site.images[0] : undefined,
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
 * @returns List of available sites with pricing
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

  // Build site query with filters
  let query = supabase
    .from('sites')
    .select('*')
    .eq('property_id', params.property_id)
    .eq('status', 'available')

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
        total_nights: calculateNights(params.check_in_date, params.check_out_date),
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

  // Filter out occupied sites
  const availableSites = allSites
    .filter((site) => !occupiedSiteIds.has(site.id))
    .map((site) => convertToAvailableSite(site as Site))

  return {
    success: true,
    data: {
      sites: availableSites,
      check_in_date: params.check_in_date,
      check_out_date: params.check_out_date,
      total_nights: calculateNights(params.check_in_date, params.check_out_date),
    },
  }
}
