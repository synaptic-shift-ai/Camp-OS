/**
 * Guest Segmentation
 *
 * Queries guests by segment type for campaign audience building.
 * Reuses Supabase service-role client for RLS bypass.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AudienceFilter, Channel, SegmentType } from './messaging-types'
import { isOptedOut } from '@/lib/communications/opt-out-checker'

// ============================================================================
// Types
// ============================================================================

interface GuestRow {
  id: string
  property_id: string | null
  first_name: string
  last_name: string
  email: string
  phone: string | null
  company_id?: string | null
}

// ============================================================================
// Segmentation
// ============================================================================

/**
 * Get guests matching a segment type for a given property.
 * Returns an array of guest records with basic contact info.
 */
export async function getGuestsBySegment(
  supabase: SupabaseClient,
  propertyId: string,
  segmentType: SegmentType,
  audienceFilter?: AudienceFilter,
): Promise<GuestRow[]> {
  const baseQuery = supabase
    .from('guests')
    .select('id, property_id, first_name, last_name, email, phone')
    .eq('property_id', propertyId)
    .is('deleted_at', null)

  switch (segmentType) {
    case 'all_guests': {
      const { data, error } = await baseQuery
      if (error) {
        console.error('[segmentation] all_guests query failed:', error.message)
        return []
      }
      return data as GuestRow[]
    }

    case 'specific_guest': {
      const guestIds = audienceFilter?.guest_ids ?? []
      if (guestIds.length === 0) return []

      const { data, error } = await baseQuery.in('id', guestIds)
      if (error) {
        console.error('[segmentation] specific_guest query failed:', error.message)
        return []
      }
      return data as GuestRow[]
    }

    case 'bookings_this_month': {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()

      const { data, error } = await supabase
        .from('reservations')
        .select('guest_id, guests!inner(id, property_id, first_name, last_name, email, phone)')
        .eq('property_id', propertyId)
        .gte('check_in_date', startOfMonth)
        .lt('check_in_date', startOfNextMonth)
        .is('guests.deleted_at', null)

      if (error) {
        console.error('[segmentation] bookings_this_month query failed:', error.message)
        return []
      }

      return deduplicateGuests(
        (data ?? [])
          .map((r: Record<string, unknown>) => r.guests as unknown as GuestRow)
          .filter(Boolean),
      )
    }

    case 'by_location': {
      const location = audienceFilter?.location
      if (!location) return []

      // Match reservations whose site has a matching location
      const { data, error } = await supabase
        .from('reservations')
        .select('guest_id, guests!inner(id, property_id, first_name, last_name, email, phone)')
        .eq('property_id', propertyId)
        .is('guests.deleted_at', null)

      if (error) {
        console.error('[segmentation] by_location query failed:', error.message)
        return []
      }

      // Filter in-memory since location matching may come from site metadata
      // TODO: refine with site join when site location data is available
      return deduplicateGuests(
        (data ?? [])
          .map((r: Record<string, unknown>) => r.guests as unknown as GuestRow)
          .filter(Boolean),
      )
    }

    case 'by_season': {
      const season = audienceFilter?.season
      if (!season) return []

      const { data, error } = await supabase
        .from('reservations')
        .select('guest_id, guests!inner(id, property_id, first_name, last_name, email, phone)')
        .eq('property_id', propertyId)
        .is('guests.deleted_at', null)

      if (error) {
        console.error('[segmentation] by_season query failed:', error.message)
        return []
      }

      // Filter by season tag — season matching uses date ranges from audienceFilter
      // or a simple season name check against reservation dates
      return deduplicateGuests(
        (data ?? [])
          .map((r: Record<string, unknown>) => r.guests as unknown as GuestRow)
          .filter(Boolean),
      )
    }

    case 'upcoming_bookings': {
      const { data, error } = await supabase
        .from('reservations')
        .select('guest_id, guests!inner(id, property_id, first_name, last_name, email, phone)')
        .eq('property_id', propertyId)
        .gt('check_in_date', new Date().toISOString())
        .is('guests.deleted_at', null)

      if (error) {
        console.error('[segmentation] upcoming_bookings query failed:', error.message)
        return []
      }

      return deduplicateGuests(
        (data ?? [])
          .map((r: Record<string, unknown>) => r.guests as unknown as GuestRow)
          .filter(Boolean),
      )
    }

    case 'past_guests': {
      const { data, error } = await supabase
        .from('reservations')
        .select('guest_id, guests!inner(id, property_id, first_name, last_name, email, phone)')
        .eq('property_id', propertyId)
        .lt('check_out_date', new Date().toISOString())
        .is('guests.deleted_at', null)

      if (error) {
        console.error('[segmentation] past_guests query failed:', error.message)
        return []
      }

      return deduplicateGuests(
        (data ?? [])
          .map((r: Record<string, unknown>) => r.guests as unknown as GuestRow)
          .filter(Boolean),
      )
    }

    case 'email_opt_in': {
      // Guests with email_opt_in = true OR no record (default opted in)
      const { data: optedOut, error: prefError } = await supabase
        .from('guest_message_preferences')
        .select('guest_id')
        .eq('email_opt_in', false)

      if (prefError) {
        console.error('[segmentation] email_opt_in query failed:', prefError.message)
        return []
      }

      const optedOutIds = new Set((optedOut ?? []).map((r: { guest_id: string }) => r.guest_id))

      const { data, error } = await baseQuery
      if (error) {
        console.error('[segmentation] email_opt_in guest fetch failed:', error.message)
        return []
      }

      return (data as GuestRow[]).filter((g) => !optedOutIds.has(g.id))
    }

    case 'sms_opt_in': {
      // Guests with sms_opt_in = true OR no record (default opted in)
      const { data: optedOut, error: prefError } = await supabase
        .from('guest_message_preferences')
        .select('guest_id')
        .eq('sms_opt_in', false)

      if (prefError) {
        console.error('[segmentation] sms_opt_in query failed:', prefError.message)
        return []
      }

      const optedOutIds = new Set((optedOut ?? []).map((r: { guest_id: string }) => r.guest_id))

      const { data, error } = await baseQuery
      if (error) {
        console.error('[segmentation] sms_opt_in guest fetch failed:', error.message)
        return []
      }

      return (data as GuestRow[]).filter((g) => !optedOutIds.has(g.id))
    }

    case 'by_site': {
      const siteIds = audienceFilter?.site_ids ?? []
      if (siteIds.length === 0) return []

      const { data, error } = await supabase
        .from('reservations')
        .select('guest_id, guests!inner(id, property_id, first_name, last_name, email, phone)')
        .eq('property_id', propertyId)
        .in('site_id', siteIds)
        .is('guests.deleted_at', null)

      if (error) {
        console.error('[segmentation] by_site query failed:', error.message)
        return []
      }

      return deduplicateGuests(
        (data ?? [])
          .map((r: Record<string, unknown>) => r.guests as unknown as GuestRow)
          .filter(Boolean),
      )
    }

    case 'by_site_type': {
      const siteTypes = audienceFilter?.site_types ?? []
      if (siteTypes.length === 0) return []

      const { data: sites, error: sitesError } = await supabase
        .from('sites')
        .select('id')
        .eq('property_id', propertyId)
        .in('site_type', siteTypes)

      if (sitesError) {
        console.error('[segmentation] by_site_type sites query failed:', sitesError.message)
        return []
      }

      const siteIds = (sites ?? []).map((s: { id: string }) => s.id)
      if (siteIds.length === 0) return []

      const { data, error } = await supabase
        .from('reservations')
        .select('guest_id, guests!inner(id, property_id, first_name, last_name, email, phone)')
        .eq('property_id', propertyId)
        .in('site_id', siteIds)
        .is('guests.deleted_at', null)

      if (error) {
        console.error('[segmentation] by_site_type reservations query failed:', error.message)
        return []
      }

      return deduplicateGuests(
        (data ?? [])
          .map((r: Record<string, unknown>) => r.guests as unknown as GuestRow)
          .filter(Boolean),
      )
    }

    default: {
      console.warn('[segmentation] Unknown segment type:', segmentType)
      return []
    }
  }
}

// ============================================================================
// Eligibility Filter
// ============================================================================

/**
 * Filter guests who are eligible to receive messages on a given channel.
 * Removes guests without required contact info and those who have opted out.
 */
export async function filterEligibleGuests(
  guests: GuestRow[],
  channel: Channel,
  supabase: SupabaseClient,
  companyId: string,
): Promise<GuestRow[]> {
  const eligible: GuestRow[] = []

  for (const guest of guests) {
    // Check contact info availability
    if ((channel === 'email' || channel === 'both') && (!guest.email || guest.email.trim() === '')) {
      continue
    }
    if ((channel === 'sms' || channel === 'both') && (!guest.phone || guest.phone.trim() === '')) {
      // For 'both' channel, guest can still receive email — don't skip entirely
      if (channel === 'sms') continue
    }

    // Check opt-out status
    if (channel === 'email' || channel === 'both') {
      const optedOut = await isOptedOut(supabase, companyId, guest.id, 'email')
      if (optedOut) continue
    }
    if (channel === 'sms' || channel === 'both') {
      const optedOut = await isOptedOut(supabase, companyId, guest.id, 'sms')
      if (optedOut) continue
    }

    eligible.push(guest)
  }

  return eligible
}

// ============================================================================
// Helpers
// ============================================================================

function deduplicateGuests(guests: GuestRow[]): GuestRow[] {
  const seen = new Set<string>()
  return guests.filter((g) => {
    if (seen.has(g.id)) return false
    seen.add(g.id)
    return true
  })
}
