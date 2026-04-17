/**
 * Event Context Builder
 *
 * Builds an EventContext from a DomainEvent by enriching it with
 * entity data from Supabase. Lookups are defensive — failures
 * result in omitted entities rather than thrown errors.
 */

import type { DomainEvent } from '@/shared/domain/DomainEvent'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { EventContext } from './types'

/**
 * Build an EventContext from a domain event.
 * Enriches with entity data from Supabase based on event type.
 */
export async function buildEventContext(event: DomainEvent): Promise<EventContext> {
  const payload = event.toJSON()

  const context: EventContext = {
    event: {
      type: event.eventType,
      timestamp: event.occurredAt,
    },
  }

  const supabase = createServiceRoleClient()

  const eventType = event.eventType.toLowerCase()

  try {
    if (eventType.startsWith('reservation')) {
      await enrichReservationContext(context, payload, supabase)
    } else if (eventType.startsWith('payment') || eventType.startsWith('refund')) {
      await enrichPaymentContext(context, payload, supabase)
    } else if (eventType.startsWith('guest')) {
      await enrichGuestContext(context, payload, supabase)
    } else if (eventType.startsWith('site')) {
      await enrichSiteContext(context, payload, supabase)
    } else if (eventType.startsWith('housekeeping') || eventType.startsWith('maintenance')) {
      await enrichTaskContext(context, payload, supabase)
    }
  } catch (err) {
    // Defensive: never throw from context building
    console.error('[automations] buildEventContext enrichment failed', {
      eventType,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return context
}

// ============================================================================
// Enrichment helpers
// ============================================================================

async function enrichReservationContext(
  context: EventContext,
  payload: Record<string, unknown>,
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<void> {
  const reservationId = extractId(payload.reservationId ?? payload.id)
  const propertyId = extractId(payload.propertyId)

  if (reservationId) {
    const { data } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single()
    if (data) context.reservation = data as Record<string, unknown>
  }

  // Derive property from reservation if not directly available
  const effectivePropertyId =
    propertyId ??
    (context.reservation?.property_id as string | undefined)

  if (effectivePropertyId) {
    await enrichProperty(context, effectivePropertyId, supabase)
  }

  // Guest from reservation
  const guestId = extractId(
    context.reservation?.guest_id ?? payload.guestId
  )
  if (guestId) {
    const { data } = await supabase
      .from('guests')
      .select('*')
      .eq('id', guestId)
      .single()
    if (data) context.guest = data as Record<string, unknown>
  }

  // Site from reservation
  const siteId = extractId(
    context.reservation?.site_id ?? payload.siteId
  )
  if (siteId) {
    const { data } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .single()
    if (data) context.site = data as Record<string, unknown>
  }
}

async function enrichPaymentContext(
  context: EventContext,
  payload: Record<string, unknown>,
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<void> {
  const paymentId = extractId(payload.paymentId ?? payload.id)
  const reservationId = extractId(payload.reservationId)
  const propertyId = extractId(payload.propertyId)

  if (paymentId) {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single()
    if (data) context.payment = data as Record<string, unknown>
  }

  // Derive reservation from payment if not directly available
  const effectiveReservationId =
    reservationId ??
    (context.payment?.reservation_id as string | undefined)

  if (effectiveReservationId) {
    const { data } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', effectiveReservationId)
      .single()
    if (data) context.reservation = data as Record<string, unknown>
  }

  const effectivePropertyId =
    propertyId ??
    (context.payment?.property_id as string | undefined) ??
    (context.reservation?.property_id as string | undefined)

  if (effectivePropertyId) {
    await enrichProperty(context, effectivePropertyId, supabase)
  }
}

async function enrichGuestContext(
  context: EventContext,
  payload: Record<string, unknown>,
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<void> {
  const guestId = extractId(payload.guestId ?? payload.id)
  const propertyId = extractId(payload.propertyId)

  if (guestId) {
    const { data } = await supabase
      .from('guests')
      .select('*')
      .eq('id', guestId)
      .single()
    if (data) context.guest = data as Record<string, unknown>
  }

  const effectivePropertyId =
    propertyId ??
    (context.guest?.property_id as string | undefined)

  if (effectivePropertyId) {
    await enrichProperty(context, effectivePropertyId, supabase)
  }
}

async function enrichSiteContext(
  context: EventContext,
  payload: Record<string, unknown>,
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<void> {
  const siteId = extractId(payload.siteId ?? payload.id)
  const propertyId = extractId(payload.propertyId)

  if (siteId) {
    const { data } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .single()
    if (data) context.site = data as Record<string, unknown>
  }

  const effectivePropertyId =
    propertyId ??
    (context.site?.property_id as string | undefined)

  if (effectivePropertyId) {
    await enrichProperty(context, effectivePropertyId, supabase)
  }
}

async function enrichTaskContext(
  context: EventContext,
  payload: Record<string, unknown>,
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<void> {
  const propertyId = extractId(payload.propertyId)

  if (propertyId) {
    await enrichProperty(context, propertyId, supabase)
  }

  const siteId = extractId(payload.siteId)
  if (siteId) {
    const { data } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .single()
    if (data) context.site = data as Record<string, unknown>
  }
}

async function enrichProperty(
  context: EventContext,
  propertyId: string,
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<void> {
  const { data } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single()
  if (data) context.property = data as Record<string, unknown>
}

// ============================================================================
// Utility
// ============================================================================

function extractId(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value
  return null
}
