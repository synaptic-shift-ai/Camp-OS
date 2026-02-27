/**
 * Availability Checking Module for Booking Actions
 *
 * Provides intelligent availability checking for extensions, renewals, and modifications.
 * Detects conflicts, suggests alternatives, and provides actionable recommendations.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type {
  ActionAvailabilityCheck,
  AlternativeSite,
  ReservationConflict,
  Site,
  ReservationWithLifecycle,
} from './types'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate date difference in days
 */
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diffTime = Math.abs(d2.getTime() - d1.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Add/subtract days from a date
 */
function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]!
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Calculate similarity score between two sites (0-100)
 */
function calculateSiteSimilarity(currentSite: Site, compareSite: Site): number {
  let score = 0

  // Same type: +40 points
  if (currentSite.site_type === compareSite.site_type) score += 40

  // Similar price: +20 points
  const priceDiff = Math.abs(currentSite.base_price - compareSite.base_price)
  const priceScore = Math.max(0, 20 - (priceDiff / 1000) * 5)
  score += priceScore

  // Similar occupancy: +20 points
  const occupancyDiff = Math.abs(currentSite.max_occupancy - compareSite.max_occupancy)
  const occupancyScore = Math.max(0, 20 - occupancyDiff * 5)
  score += occupancyScore

  // Matching amenities: +20 points
  const currentAmenities = new Set(currentSite.amenities || [])
  const compareAmenities = new Set(compareSite.amenities || [])
  const matchingAmenities = [...currentAmenities].filter((a) => compareAmenities.has(a)).length
  const totalAmenities = Math.max(currentAmenities.size, compareAmenities.size)
  if (totalAmenities > 0) {
    score += (matchingAmenities / totalAmenities) * 20
  }

  return Math.round(score)
}

// ============================================================================
// Conflict Detection
// ============================================================================

/**
 * Find reservations that conflict with given date range
 */
async function findConflictingReservations(
  siteId: string,
  checkIn: string,
  checkOut: string,
  options?: { excludeReservationId?: string }
): Promise<ReservationConflict[]> {
  const supabase = createServiceRoleClient()

  // Query for overlapping reservations
  let query = supabase
    .from('reservations')
    .select('*, guest:guests(first_name, last_name)')
    .eq('site_id', siteId)
    .in('status', ['confirmed', 'checked_in', 'pending'])
    .or(`check_in_date.lte.${checkOut},check_out_date.gte.${checkIn}`)

  // Exclude specific reservation (for extension checks)
  if (options?.excludeReservationId) {
    query = query.neq('id', options.excludeReservationId)
  }

  const { data: reservations, error } = await query

  if (error) {
    console.error('[AvailabilityCheck] Error finding conflicts:', error)
    return []
  }

  if (!reservations || reservations.length === 0) {
    return []
  }

  // Map to conflict objects
  return reservations.map((res: any) => ({
    type: 'existing_reservation' as const,
    reservation: {
      id: res.id,
      confirmation_number: res.confirmation_number,
      guest_name: `${res.guest?.first_name} ${res.guest?.last_name}`,
      check_in: res.check_in_date,
      check_out: res.check_out_date,
      status: res.status,
      payment_status: res.payment_status,
      booking_type: res.booking_type || 'nightly',
    },
    conflicting_dates: {
      start: res.check_in_date,
      end: res.check_out_date,
    },
  }))
}

/**
 * Check for pending renewal holds on a site
 */
async function checkPendingRenewals(
  siteId: string,
  checkIn: string,
  checkOut: string
): Promise<ReservationConflict | null> {
  const supabase = createServiceRoleClient()

  const { data: renewal } = await supabase
    .from('reservations')
    .select('*, guest:guests(first_name, last_name)')
    .eq('site_id', siteId)
    .in('renewal_status', ['offered', 'accepted'])
    .gte('renewal_deadline', new Date().toISOString().split('T')[0])
    .or(`check_in_date.lte.${checkOut},check_out_date.gte.${checkIn}`)
    .single()

  if (!renewal) return null

  return {
    type: 'pending_renewal',
    reservation: {
      id: renewal.id,
      confirmation_number: renewal.confirmation_number,
      guest_name: `${renewal.guest?.first_name} ${renewal.guest?.last_name}`,
      check_in: renewal.check_in_date,
      check_out: renewal.check_out_date,
      status: renewal.status,
      payment_status: renewal.payment_status,
      booking_type: renewal.booking_type || 'nightly',
    },
    conflicting_dates: {
      start: renewal.check_in_date,
      end: renewal.check_out_date,
    },
    message: `Site held for renewal (deadline: ${formatDate(renewal.renewal_deadline)})`,
  }
}

// ============================================================================
// Alternative Site Finding
// ============================================================================

/**
 * Find alternative sites when primary site is unavailable
 */
async function findAlternativeSites(
  currentSiteId: string,
  checkIn: string,
  checkOut: string,
  filters?: {
    siteType?: string
    preferSameSection?: boolean
  }
): Promise<AlternativeSite[]> {
  const supabase = createServiceRoleClient()

  // Get current site for comparison
  const { data: currentSite } = await supabase
    .from('sites')
    .select('*')
    .eq('id', currentSiteId)
    .single()

  if (!currentSite) return []

  // Find available sites of same type
  const { data: sites } = await supabase
    .from('sites')
    .select('*')
    .eq('property_id', currentSite.property_id)
    .eq('site_type', filters?.siteType || currentSite.site_type)
    .eq('status', 'available')
    .neq('id', currentSiteId)

  if (!sites || sites.length === 0) return []

  // Check each site for actual availability
  const alternatives: AlternativeSite[] = []

  for (const site of sites) {
    const conflicts = await findConflictingReservations(site.id, checkIn, checkOut)

    if (conflicts.length === 0) {
      alternatives.push({
        site_id: site.id,
        site_number: site.site_number,
        site_name: site.site_name,
        site_type: site.site_type,
        available_through: checkOut,
        price_per_night: site.base_price,
        similarity_score: calculateSiteSimilarity(currentSite, site),
        amenities: site.amenities || [],
      })
    }
  }

  // Sort by similarity (best matches first)
  return alternatives.sort((a, b) => b.similarity_score - a.similarity_score).slice(0, 5)
}

// ============================================================================
// Extension Availability Check
// ============================================================================

/**
 * Check if a reservation can be extended
 *
 * @param reservationId - Reservation to extend
 * @param newCheckIn - New check-in date (if extending before)
 * @param newCheckOut - New check-out date (if extending after)
 * @returns Availability check result with conflicts and recommendations
 */
export async function checkExtensionAvailability(
  reservationId: string,
  newCheckIn?: string,
  newCheckOut?: string
): Promise<ActionAvailabilityCheck> {
  const supabase = createServiceRoleClient()

  // Get reservation details
  const { data: reservation, error } = await supabase
    .from('reservations')
    .select('*, site:sites(*)')
    .eq('id', reservationId)
    .single()

  if (error || !reservation) {
    return {
      available: false,
      status: 'not_available',
      conflicts: [],
      alternatives: [],
      recommendations: [],
      checked_at: new Date().toISOString(),
    }
  }

  const typedRes = reservation as unknown as ReservationWithLifecycle
  const siteId = typedRes.site_id
  const currentCheckIn = typedRes.check_in_date
  const currentCheckOut = typedRes.check_out_date

  // Determine extension range
  const extensionStart = newCheckIn || currentCheckIn
  const extensionEnd = newCheckOut || currentCheckOut

  // Find conflicts in the extended date range
  const conflicts = await findConflictingReservations(siteId, extensionStart, extensionEnd, {
    excludeReservationId: reservationId,
  })

  // Check for pending renewals
  const renewalConflict = await checkPendingRenewals(siteId, extensionStart, extensionEnd)
  if (renewalConflict) {
    conflicts.push(renewalConflict)
  }

  // No conflicts - fully available
  if (conflicts.length === 0) {
    const nightsAdded = newCheckOut
      ? daysBetween(currentCheckOut, newCheckOut)
      : daysBetween(extensionStart, currentCheckIn)

    const site = typedRes.site as Site
    const priceChange = nightsAdded * site.base_price

    return {
      available: true,
      status: 'fully_available',
      conflicts: [],
      alternatives: [],
      recommendations: [
        {
          action: 'extend_full',
          description: `Extend to ${formatDate(extensionEnd)}`,
          price_change: priceChange,
        },
      ],
      checked_at: new Date().toISOString(),
    }
  }

  // Has conflicts - determine partial availability
  const firstConflict = conflicts.sort((a, b) =>
    a.conflicting_dates.start.localeCompare(b.conflicting_dates.start)
  )[0]!

  // Can we extend partially?
  const maxAvailableEnd = addDays(firstConflict.conflicting_dates.start, -1)
  const canExtendPartially = maxAvailableEnd > currentCheckOut

  if (canExtendPartially) {
    const partialNights = daysBetween(currentCheckOut, maxAvailableEnd)
    const site = typedRes.site as Site
    const partialPrice = partialNights * site.base_price

    // Find alternatives for full extension
    const alternatives = await findAlternativeSites(
      siteId,
      extensionStart,
      extensionEnd,
      { siteType: site.site_type }
    )

    return {
      available: false,
      status: 'partially_available',
      conflicts,
      available_range: {
        start: currentCheckOut,
        end: maxAvailableEnd,
      },
      alternatives,
      recommendations: [
        {
          action: 'extend_partial',
          description: `Extend to ${formatDate(maxAvailableEnd)} only (${partialNights} nights)`,
          price_change: partialPrice,
        },
        ...alternatives.slice(0, 2).map((alt) => ({
          action: 'move_site' as const,
          description: `Move to Site #${alt.site_number} for full extension`,
          new_site_id: alt.site_id,
          price_change: daysBetween(extensionStart, extensionEnd) * alt.price_per_night,
        })),
      ],
      checked_at: new Date().toISOString(),
    }
  }

  // Completely blocked - only alternatives
  const alternatives = await findAlternativeSites(
    siteId,
    extensionStart,
    extensionEnd,
    { siteType: (typedRes.site as Site).site_type }
  )

  return {
    available: false,
    status: 'not_available',
    conflicts,
    alternatives,
    recommendations: alternatives.slice(0, 3).map((alt) => ({
      action: 'move_site',
      description: `Move to Site #${alt.site_number}`,
      new_site_id: alt.site_id,
      price_change: daysBetween(extensionStart, extensionEnd) * alt.price_per_night,
    })),
    checked_at: new Date().toISOString(),
  }
}

// ============================================================================
// Renewal Availability Check
// ============================================================================

/**
 * Check if a site is available for renewal (next season/month)
 *
 * @param reservationId - Current reservation
 * @param nextPeriodStart - Start date of next period
 * @param nextPeriodEnd - End date of next period
 * @returns Availability check result
 */
export async function checkRenewalAvailability(
  reservationId: string,
  nextPeriodStart: string,
  nextPeriodEnd: string
): Promise<ActionAvailabilityCheck> {
  const supabase = createServiceRoleClient()

  // Get reservation details
  const { data: reservation, error } = await supabase
    .from('reservations')
    .select('*, site:sites(*)')
    .eq('id', reservationId)
    .single()

  if (error || !reservation) {
    return {
      available: false,
      status: 'not_available',
      conflicts: [],
      alternatives: [],
      recommendations: [],
      checked_at: new Date().toISOString(),
    }
  }

  const typedRes = reservation as unknown as ReservationWithLifecycle
  const siteId = typedRes.site_id

  // Check if site is available for the entire next period
  const conflicts = await findConflictingReservations(siteId, nextPeriodStart, nextPeriodEnd)

  // Check for other pending renewals
  const renewalConflict = await checkPendingRenewals(siteId, nextPeriodStart, nextPeriodEnd)
  if (renewalConflict && renewalConflict.reservation?.id !== reservationId) {
    conflicts.push(renewalConflict)
  }

  // Site available for renewal
  if (conflicts.length === 0) {
    return {
      available: true,
      status: 'fully_available',
      conflicts: [],
      alternatives: [],
      recommendations: [
        {
          action: 'renew_same_site',
          description: `Renew Site #${(typedRes.site as Site).site_number} for next period`,
          price_change: 0, // Separate reservation
        },
      ],
      checked_at: new Date().toISOString(),
    }
  }

  // Site is booked - find alternatives
  const alternatives = await findAlternativeSites(
    siteId,
    nextPeriodStart,
    nextPeriodEnd,
    {
      siteType: (typedRes.site as Site).site_type,
      preferSameSection: true,
    }
  )

  const priceDiff = (alt: AlternativeSite) =>
    alt.price_per_night - (typedRes.site as Site).base_price

  return {
    available: false,
    status: 'not_available',
    conflicts,
    alternatives,
    recommendations: [
      ...alternatives.slice(0, 3).map((alt) => ({
        action: 'renew_different_site' as const,
        description: `Offer Site #${alt.site_number} instead`,
        new_site_id: alt.site_id,
        price_change: priceDiff(alt),
      })),
      {
        action: 'manual_review',
        description: 'Contact conflicting guest about priority',
        requires_approval: true,
      },
    ],
    checked_at: new Date().toISOString(),
  }
}

// ============================================================================
// Quick Availability Check (for UI)
// ============================================================================

/**
 * Quick check if site is available for given dates
 * Lighter weight than full availability check
 */
export async function quickAvailabilityCheck(
  siteId: string,
  checkIn: string,
  checkOut: string,
  options?: { excludeReservationId?: string }
): Promise<boolean> {
  const conflicts = await findConflictingReservations(siteId, checkIn, checkOut, options)
  return conflicts.length === 0
}
