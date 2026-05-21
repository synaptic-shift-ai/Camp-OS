/**
 * SMS Provider
 *
 * Phase 1 MVP placeholder for SMS sending.
 * Logs SMS details to console and returns a placeholder result.
 *
 * TODO: Integrate with Twilio, Vonage, or similar SMS provider.
 *       Replace console.log with actual API call.
 *       Add retry logic similar to emailit.
 */

import type { SendResult } from '../messaging-types'

// ============================================================================
// SMS Sending (MVP Placeholder)
// ============================================================================

/**
 * Send an SMS message to a single recipient.
 * Phase 1: Logs to console and returns a placeholder success result.
 */
export async function sendSMS(
  to: string,
  body: string,
): Promise<SendResult> {
  // TODO: Replace with real SMS provider integration (Twilio/Vonage)
  console.log(`[messaging/sms] Sending SMS to ${to}:`, body.substring(0, 100))

  return {
    success: true,
    providerMessageId: `sms-placeholder-${Date.now()}`,
  }
}
