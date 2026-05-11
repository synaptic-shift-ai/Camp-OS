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
 * Spendable guest credit reconciles the financial ledger with `guests.guest_credit_cents`.
 * Refunds to guest credit update both; older rows can drift. The UI and GET credit-balance
 * surface the column; ledger-only checks would block valid spends when the column is higher.
 */
export function computeEffectiveGuestCreditAvailableCents(
  ledgerBalanceCents: number,
  guestsColumnCents: number | null | undefined,
): number {
  const column =
    typeof guestsColumnCents === 'number' && Number.isFinite(guestsColumnCents) && guestsColumnCents >= 0
      ? guestsColumnCents
      : 0
  return Math.max(ledgerBalanceCents, column)
}

export type EffectiveGuestCreditResult = {
  effectiveAvailableCents: number
  ledger: GuestCreditBalanceResult
  guestsColumnCents: number | null
}

/**
 * Ledger balance plus guests-table denormalized balance (see computeEffectiveGuestCreditAvailableCents).
 */
export async function getEffectiveGuestCreditAvailableCents(
  supabase: SupabaseClient,
  guestId: string,
  propertyId: string,
): Promise<EffectiveGuestCreditResult> {
  const ledger = await getGuestCreditBalance(supabase, guestId, propertyId)
  const { data } = await supabase
    .from('guests')
    .select('guest_credit_cents')
    .eq('id', guestId)
    .eq('property_id', propertyId)
    .maybeSingle()

  const guestsColumnCents =
    data && typeof data.guest_credit_cents === 'number' ? data.guest_credit_cents : null

  return {
    effectiveAvailableCents: computeEffectiveGuestCreditAvailableCents(
      ledger.creditBalance,
      guestsColumnCents,
    ),
    ledger,
    guestsColumnCents,
  }
}

/**
 * Calculate the guest credit balance for a guest at a specific property.getGuestCreditBalance
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
