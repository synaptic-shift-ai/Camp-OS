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
    context.propertyId = effectivePropertyId
  }

  // Resolve companyId from property
  resolveCompanyFromProperty(context)

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

  // Always fetch the latest financial transaction for this reservation
  // so that reservation events (including cancellation) have payment context.
  if (reservationId) {
    const { data: latestTransaction } = await supabase
      .from('financial_transactions')
      .select('*')
      .eq('reservation_id', reservationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestTransaction) {
      context.payment = latestTransaction as Record<string, unknown>
    } else {
      // Fallback: legacy payments table
      const { data: legacyPayment } = await supabase
        .from('payments')
        .select('*')
        .eq('reservation_id', reservationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (legacyPayment) context.payment = legacyPayment as Record<string, unknown>
    }

    // For cancellation, look for a refund transaction specifically
    const evtType = (context.event?.type as string | undefined)?.toLowerCase() ?? ''
    if (evtType === 'reservation.cancelled') {
      const { data: refundTransaction } = await supabase
        .from('financial_transactions')
        .select('*')
        .eq('reservation_id', reservationId)
        .eq('type', 'refund')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (refundTransaction) {
        context.payment = refundTransaction as Record<string, unknown>
        ;(context.payment as Record<string, unknown>).refund_status = refundTransaction.status || 'processing'
      } else {
        context.payment = (context.payment || {}) as Record<string, unknown>
        ;(context.payment as Record<string, unknown>).refund_status = 'none'
      }
    }
  }

  // Computed fields on reservation
  const reservation = context.reservation as Record<string, unknown> | undefined
  if (reservation) {
    // Alias cancelled_at → cancellation_date for templates
    if (reservation.cancelled_at && !reservation.cancellation_date) {
      reservation.cancellation_date = new Date(String(reservation.cancelled_at)).toLocaleDateString()
    }
    // Compute balance_due
    if (reservation.total_amount !== undefined && reservation.paid_amount !== undefined) {
      const balanceCents = Number(reservation.total_amount) - Number(reservation.paid_amount)
      reservation.balance_due = `$${(balanceCents / 100).toFixed(2)}`
    }
  }

  // Normalize payment column aliases for templates
  const payment = context.payment as Record<string, unknown> | undefined
  if (payment) {
    const paymentAmount = payment.amount_cents ?? payment.amount
    if (paymentAmount !== undefined && paymentAmount !== null) {
      payment.formatted_amount = `$${(Number(paymentAmount) / 100).toFixed(2)}`
      if (!payment.amount && payment.amount_cents) {
        payment.amount = payment.amount_cents
      }
    }
    if (payment.status && !payment.payment_status) {
      payment.payment_status = payment.status
    }
    if (payment.method && !payment.payment_method) {
      payment.payment_method = payment.method
    }
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
    // Try unified ledger first
    const { data: ledgerData } = await supabase
      .from('financial_transactions')
      .select('*')
      .eq('id', paymentId)
      .single()
    if (ledgerData) {
      context.payment = ledgerData as Record<string, unknown>
    } else {
      // Fallback: legacy payments table
      const { data } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single()
      if (data) context.payment = data as Record<string, unknown>
    }
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
    context.propertyId = effectivePropertyId
  }

  // Resolve companyId from property
  resolveCompanyFromProperty(context)

  // Also fetch reservation for payment events so reservation vars resolve
  if (effectiveReservationId && context.reservation) {
    const reservation = context.reservation as Record<string, unknown>
    if (reservation.total_amount !== undefined && reservation.paid_amount !== undefined) {
      const balanceCents = Number(reservation.total_amount) - Number(reservation.paid_amount)
      reservation.balance_due = `$${(balanceCents / 100).toFixed(2)}`
    }
    if (reservation.cancelled_at && !reservation.cancellation_date) {
      reservation.cancellation_date = new Date(String(reservation.cancelled_at)).toLocaleDateString()
    }
  }

  // Normalize payment column aliases for templates
  const payment = context.payment as Record<string, unknown> | undefined
  if (payment) {
    const paymentAmount = payment.amount_cents ?? payment.amount
    if (paymentAmount !== undefined && paymentAmount !== null) {
      payment.formatted_amount = `$${(Number(paymentAmount) / 100).toFixed(2)}`
      if (!payment.amount && payment.amount_cents) {
        payment.amount = payment.amount_cents
      }
    }
    if (payment.status && !payment.payment_status) {
      payment.payment_status = payment.status
    }
    if (payment.method && !payment.payment_method) {
      payment.payment_method = payment.method
    }
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
    context.propertyId = effectivePropertyId
  }

  // Resolve companyId from property
  resolveCompanyFromProperty(context)
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
    context.propertyId = effectivePropertyId
  }

  // Resolve companyId from property
  resolveCompanyFromProperty(context)
}

async function enrichTaskContext(
  context: EventContext,
  payload: Record<string, unknown>,
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<void> {
  const propertyId = extractId(payload.propertyId)

  if (propertyId) {
    await enrichProperty(context, propertyId, supabase)
    context.propertyId = propertyId
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

  // Resolve companyId from property (may be set via enrichProperty)
  resolveCompanyFromProperty(context)

  // Store event payload fields for condition resolution (e.g. housekeeping.priority)
  const eventType = payload.eventType as string | undefined ?? ''
  if (eventType.startsWith('housekeeping')) {
    context.housekeeping = {
      taskId: payload.taskId,
      title: payload.title,
      priority: payload.priority,
      siteId: payload.siteId,
      propertyId: payload.propertyId,
    }
  } else if (eventType.startsWith('maintenance')) {
    context.maintenance = {
      taskId: payload.taskId,
      woNumber: payload.woNumber,
      title: payload.title,
      category: payload.category,
      priority: payload.priority,
      propertyId: payload.propertyId,
    }
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
  if (data) {
    context.property = data as Record<string, unknown>
    // Populate companyId and propertyId on context from property record
    context.propertyId = propertyId
    const cid = (data as Record<string, unknown>).company_id
    if (typeof cid === 'string') context.companyId = cid
  }
}

/**
 * Resolve companyId from context.property if not already set.
 */
function resolveCompanyFromProperty(context: EventContext): void {
  if (!context.companyId && context.property) {
    const cid = context.property.company_id
    if (typeof cid === 'string') context.companyId = cid
  }
}

// ============================================================================
// Utility
// ============================================================================

function extractId(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value
  return null
}
