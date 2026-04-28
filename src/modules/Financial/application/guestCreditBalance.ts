/**
 * Guest Credit Balance
 *
 * Shared helper for calculating property-scoped guest credit balances.
 * Credits are accumulated via refunds with handling='guest_credit'
 * and consumed via payments with source='guest_credit'.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface GuestCreditBalanceResult {
  creditBalance: number
  totalCredits: number
  totalUsed: number
}

/**
 * Calculate the guest credit balance for a guest at a specific property.
 *
 * Credits IN:  refunds where handling='guest_credit' AND status='completed' AND not voided
 * Credits OUT: payments where source='guest_credit' AND status='completed' AND not voided
 *
 * @param supabase - Service-role Supabase client (bypasses RLS)
 * @param guestId - The guest UUID
 * @param propertyId - The property UUID
 */
export async function getGuestCreditBalance(
  supabase: SupabaseClient,
  guestId: string,
  propertyId: string,
): Promise<GuestCreditBalanceResult> {
  // Fetch all completed, non-voided transactions for this guest/property
  // that involve guest credit (either as refund credits in or payment credits out)
  const { data: txns } = await supabase
    .from('financial_transactions')
    .select('type, amount_cents, source, handling')
    .eq('guest_id', guestId)
    .eq('property_id', propertyId)
    .eq('status', 'completed')
    .neq('is_voided', true)

  let totalCredits = 0
  let totalUsed = 0

  for (const txn of txns ?? []) {
    // Credits come in via refunds with handling='guest_credit'
    if (txn.type === 'refund' && txn.handling === 'guest_credit') {
      totalCredits += txn.amount_cents
    }
    // Credits go out via payments with source='guest_credit'
    if (txn.type === 'payment' && txn.source === 'guest_credit') {
      totalUsed += txn.amount_cents
    }
  }

  return {
    creditBalance: totalCredits - totalUsed,
    totalCredits,
    totalUsed,
  }
}
