/**
 * Email Provider
 *
 * Wraps the existing emailit sendEmail function for campaign use.
 * Applies property branding when available.
 */

import { sendEmail } from '@/lib/email/emailit'
import { getPropertyBranding } from '@/lib/communications/branding-applier'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SendResult } from '../messaging-types'

// ============================================================================
// Email Sending
// ============================================================================

/**
 * Send a campaign email to a single recipient.
 * Applies property branding (sender name, logo, colors) when propertyId is provided.
 */
export async function sendCampaignEmail(
  to: string,
  subject: string,
  htmlBody: string,
  options?: {
    textBody?: string
    propertyId?: string
    supabase?: SupabaseClient
  },
): Promise<SendResult> {
  try {
    // Apply branding if supabase + propertyId are provided
    let from: string | undefined
    if (options?.supabase && options?.propertyId) {
      const branding = await getPropertyBranding(options.supabase, options.propertyId)
      if (branding.senderEmail) {
        from = `${branding.senderName} <${branding.senderEmail}>`
      } else {
        from = `${branding.senderName} <${process.env.SMTP_FROM_EMAIL ?? ''}>`
      }
    }

    const result = await sendEmail({
      to,
      subject,
      html: htmlBody,
      ...(options?.textBody ? { text: options.textBody } : {}),
      ...(from ? { from } : {}),
    })

    if (result.success) {
      return {
        success: true,
        providerMessageId: result.id,
      }
    }

    return {
      success: false,
      error: result.error,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown email send error'
    console.error('[messaging/email] Send failed:', message)
    return {
      success: false,
      error: message,
    }
  }
}
