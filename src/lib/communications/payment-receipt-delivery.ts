import type { SupabaseClient } from '@supabase/supabase-js'
import {
  logDelivery,
  updateDeliveryStatus,
  type DeliveryChannel,
  type DeliveryStatus,
  type CommunicationLogRow,
} from '@/lib/communications/delivery-logger'

export type RecordPaymentReceiptEmailDeliveryParams = {
  supabase: SupabaseClient
  companyId: string
  propertyId: string
  reservationId?: string | null
  guestId?: string | null
  recipientEmail: string
  subject: string
  sendResult:
    | { success: true; attempts?: number }
    | { success: false; error: string; attempts?: number }
  logDeliveryFn?: typeof logDelivery
  updateDeliveryStatusFn?: typeof updateDeliveryStatus
}

export async function recordPaymentReceiptEmailDelivery(
  params: RecordPaymentReceiptEmailDeliveryParams,
): Promise<CommunicationLogRow | null> {
  const {
    supabase,
    companyId,
    propertyId,
    reservationId,
    guestId,
    recipientEmail,
    subject,
    sendResult,
    logDeliveryFn = logDelivery,
    updateDeliveryStatusFn = updateDeliveryStatus,
  } = params

  const channel: DeliveryChannel = 'email'
  const initial = await logDeliveryFn({
    supabase,
    companyId,
    propertyId,
    reservationId: reservationId ?? null,
    guestId: guestId ?? null,
    templateId: null,
    channel,
    recipientAddress: recipientEmail,
    subject,
    status: 'queued',
  })

  if (!initial) return null

  const finalStatus: Exclude<DeliveryStatus, 'queued'> = sendResult.success ? 'sent' : 'failed'
  const smtpRetryCount =
    typeof sendResult.attempts === 'number'
      ? Math.max(0, sendResult.attempts - 1)
      : undefined

  const updated = await updateDeliveryStatusFn({
    supabase,
    logId: initial.id,
    status: finalStatus,
    failureReason: sendResult.success ? null : sendResult.error,
    ...(smtpRetryCount !== undefined ? { retryCount: smtpRetryCount } : {}),
  })

  return updated ?? initial
}

