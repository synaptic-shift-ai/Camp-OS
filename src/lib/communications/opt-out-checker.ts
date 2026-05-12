/**
 * Opt-Out Checker
 *
 * Checks and records guest opt-outs per channel (email/sms).
 * Uses the service-role client to bypass RLS.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Types
// ============================================================================

export type OptOutChannel = 'email' | 'sms'

export type OptOutSource = 'unsubscribe_link' | 'sms_stop' | 'manual'

// ============================================================================
// Functions
// ============================================================================

/**
 * Check whether a guest has opted out of a specific communication channel.
 * Returns true if an opt-out record exists, false otherwise.
 */
export async function isOptedOut(
  supabase: SupabaseClient,
  companyId: string,
  guestId: string,
  channel: OptOutChannel,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('communication_opt_outs')
    .select('id')
    .eq('company_id', companyId)
    .eq('guest_id', guestId)
    .eq('channel', channel)
    .maybeSingle()

  if (error) {
    console.error('[opt-out-checker] Failed to check opt-out status:', error.message)
    return false
  }

  return data != null
}

/**
 * Record a guest opt-out. Uses upsert so repeated opt-outs are idempotent.
 * Returns true on success, false on failure.
 */
export async function recordOptOut(
  supabase: SupabaseClient,
  companyId: string,
  guestId: string,
  channel: OptOutChannel,
  source: OptOutSource,
): Promise<boolean> {
  const { error } = await supabase
    .from('communication_opt_outs')
    .upsert(
      {
        company_id: companyId,
        guest_id: guestId,
        channel,
        source,
        opted_out_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,guest_id,channel' },
    )

  if (error) {
    console.error('[opt-out-checker] Failed to record opt-out:', error.message)
    return false
  }

  return true
}
