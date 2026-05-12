/**
 * Delivery Logger
 *
 * Appends entries to communication_log for tracking message delivery.
 * Uses the service-role client to bypass RLS (writes are server-side only).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Types
// ============================================================================

export type DeliveryChannel = 'email' | 'sms'

export type DeliveryStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'failed'
  | 'skipped'

export type LogDeliveryParams = {
  supabase: SupabaseClient
  companyId: string
  propertyId: string
  reservationId?: string | null
  guestId?: string | null
  templateId?: string | null
  channel: DeliveryChannel
  recipientAddress: string
  subject?: string | null
  status?: DeliveryStatus
}

export type UpdateDeliveryStatusParams = {
  supabase: SupabaseClient
  logId: string
  status: Exclude<DeliveryStatus, 'queued'>
  bounceType?: 'hard' | 'soft' | null
  failureReason?: string | null
  deliveredAt?: string | null
}

export type CommunicationLogRow = {
  id: string
  company_id: string
  property_id: string
  reservation_id: string | null
  guest_id: string | null
  template_id: string | null
  channel: string
  recipient_address: string
  subject: string | null
  status: string
  bounce_type: string | null
  failure_reason: string | null
  opened_at: string | null
  clicked_at: string | null
  retry_count: number
  created_at: string
  delivered_at: string | null
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Insert a new row into communication_log.
 * Returns the created row, or null on failure.
 */
export async function logDelivery(
  params: LogDeliveryParams,
): Promise<CommunicationLogRow | null> {
  const { supabase, companyId, propertyId, reservationId, guestId, templateId, channel, recipientAddress, subject, status = 'queued' } = params

  const { data, error } = await supabase
    .from('communication_log')
    .insert({
      company_id: companyId,
      property_id: propertyId,
      reservation_id: reservationId ?? null,
      guest_id: guestId ?? null,
      template_id: templateId ?? null,
      channel,
      recipient_address: recipientAddress,
      subject: subject ?? null,
      status,
    })
    .select()
    .single()

  if (error) {
    console.error('[delivery-logger] Failed to log delivery:', error.message)
    return null
  }

  return data as CommunicationLogRow
}

/**
 * Update the status of an existing communication_log entry.
 * Returns the updated row, or null on failure.
 */
export async function updateDeliveryStatus(
  params: UpdateDeliveryStatusParams,
): Promise<CommunicationLogRow | null> {
  const { supabase, logId, status, bounceType, failureReason, deliveredAt } = params

  const update: Record<string, unknown> = { status }

  if (bounceType) {
    update.bounce_type = bounceType
  }
  if (failureReason) {
    update.failure_reason = failureReason
  }
  if (deliveredAt) {
    update.delivered_at = deliveredAt
  }

  const { data, error } = await supabase
    .from('communication_log')
    .update(update)
    .eq('id', logId)
    .select()
    .single()

  if (error) {
    console.error('[delivery-logger] Failed to update delivery status:', error.message)
    return null
  }

  return data as CommunicationLogRow
}
