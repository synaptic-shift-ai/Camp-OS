/**
 * Entity Context Builder
 *
 * Builds EventContext for resolved entities, replicating the same
 * enrichment pattern used by the reminder cron routes:
 * guest, site, and property lookups for reservations.
 */

import type { EventContext } from '../types'
import type { ScheduledTriggerConfig } from '../types'
import type { ResolvedTarget } from './target-resolver'
import type { SupabaseClient } from '@supabase/supabase-js'

interface BuildContextParams {
  target: ResolvedTarget
  config: ScheduledTriggerConfig
  propertyId: string
  companyId: string
  supabase: SupabaseClient
}

/**
 * Build EventContext for a resolved entity.
 *
 * Context varies by target type:
 * - reservations: reservation + guest + property + site (no payment)
 * - property:     just property
 * - guests:       guest + property
 * - sites:        site + property
 *
 * Always includes: event.type, event.timestamp, propertyId, companyId
 */
export async function buildEntityContext(params: BuildContextParams): Promise<EventContext> {
  const { target, config, propertyId, companyId, supabase } = params

  const context: EventContext = {
    event: {
      type: 'system.scheduled', // will be overridden by the trigger_type from the automation
      timestamp: new Date(),
    },
    propertyId,
    companyId,
  }

  switch (target.entityType) {
    case 'reservation':
      return buildReservationContext(context, target, propertyId, supabase)
    case 'property':
      return buildPropertyContext(context, target)
    case 'guest':
      return buildGuestContext(context, target, propertyId, supabase)
    case 'site':
      return buildSiteContext(context, target, propertyId, supabase)
    default:
      return context
  }
}

/**
 * Build full context for a reservation entity.
 * Mirrors the pattern from check-in/check-out/pre-arrival reminder crons.
 */
async function buildReservationContext(
  baseContext: EventContext,
  target: ResolvedTarget,
  propertyId: string,
  supabase: SupabaseClient,
): Promise<EventContext> {
  const reservation = target.entity

  // Set reservation on context
  baseContext.reservation = reservation

  // Fetch property
  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single()

  if (property) {
    baseContext.property = property as Record<string, unknown>
  }

  // Fetch guest
  const guestId = reservation.guest_id as string | undefined
  if (guestId) {
    const { data: guest } = await supabase
      .from('guests')
      .select('*')
      .eq('id', guestId)
      .single()

    if (guest) {
      baseContext.guest = guest as Record<string, unknown>
    }
  }

  // Fetch site
  const siteId = reservation.site_id as string | undefined
  if (siteId) {
    const { data: site } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .single()

    if (site) {
      baseContext.site = site as Record<string, unknown>
    }
  }

  return baseContext
}

/**
 * Build minimal context for property target.
 * Matches the existing automation-scheduled cron (property only).
 */
function buildPropertyContext(
  baseContext: EventContext,
  target: ResolvedTarget,
): EventContext {
  baseContext.property = target.entity
  return baseContext
}

/**
 * Build context for a guest entity.
 */
async function buildGuestContext(
  baseContext: EventContext,
  target: ResolvedTarget,
  propertyId: string,
  supabase: SupabaseClient,
): Promise<EventContext> {
  baseContext.guest = target.entity

  // Fetch property
  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single()

  if (property) {
    baseContext.property = property as Record<string, unknown>
  }

  return baseContext
}

/**
 * Build context for a site entity.
 */
async function buildSiteContext(
  baseContext: EventContext,
  target: ResolvedTarget,
  propertyId: string,
  supabase: SupabaseClient,
): Promise<EventContext> {
  baseContext.site = target.entity

  // Fetch property
  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single()

  if (property) {
    baseContext.property = property as Record<string, unknown>
  }

  return baseContext
}
