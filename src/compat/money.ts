/**
 * Money Conversion Adapter (TEMPORARY)
 *
 * Bridge utilities for Phase 1-2 transition.
 * After Phase 2 completes (DB migration to BIGINT cents), delete this file.
 *
 * CURRENT STATE (Phase 1):
 * - DB stores DECIMAL (dollars with 2 decimal places)
 * - Stripe expects integer cents
 * - UI displays dollars
 *
 * PHASE 2 TARGET:
 * - DB will store BIGINT (integer cents)
 * - Everything uses MoneyCents branded type
 * - This adapter becomes obsolete
 */

import type { MoneyAmount } from '@/contracts/booking'

// ============================================================================
// Temporary Money Helpers (Phase 1)
// ============================================================================

/**
 * Convert DB DECIMAL dollars to Stripe integer cents
 *
 * IMPORTANT: Only use for Stripe API calls during Phase 1
 * After Phase 2, DB will already be in cents
 *
 * @example
 * const dbPrice = 45.99 // from DB
 * const stripeCents = toStripeCents(dbPrice) // 4599
 */
export function toStripeCents(dollars: MoneyAmount): number {
  if (!Number.isFinite(dollars)) {
    throw new Error(`Invalid money amount: ${dollars}`)
  }
  return Math.round(dollars * 100)
}

/**
 * Convert Stripe integer cents to DB DECIMAL dollars
 *
 * IMPORTANT: Only use when storing Stripe amounts to DB during Phase 1
 * After Phase 2, DB will store cents directly
 *
 * @example
 * const stripeCents = 4599
 * const dbDollars = fromStripeCents(stripeCents) // 45.99
 */
export function fromStripeCents(cents: number): MoneyAmount {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error(`Invalid Stripe cents amount: ${cents}`)
  }
  return cents / 100
}

/**
 * Format money amount for UI display
 *
 * @example
 * formatMoney(45.99) // "$45.99"
 * formatMoney(45.99, false) // "45.99"
 */
export function formatMoney(amount: MoneyAmount, includeCurrency = true): string {
  const formatted = amount.toFixed(2)
  return includeCurrency ? `$${formatted}` : formatted
}

/**
 * Validate money amount is safe (no precision issues)
 *
 * Checks:
 * - Is finite number
 * - Has at most 2 decimal places
 * - Is non-negative
 *
 * @example
 * isValidMoney(45.99) // true
 * isValidMoney(45.999) // false (too many decimals)
 * isValidMoney(-10) // false (negative)
 */
export function isValidMoney(amount: MoneyAmount): boolean {
  if (!Number.isFinite(amount) || amount < 0) {
    return false
  }

  // Check max 2 decimal places
  const cents = Math.round(amount * 100)
  const reconstructed = cents / 100
  return Math.abs(amount - reconstructed) < 0.001
}

// ============================================================================
// Dual-Read Helper (Phase 2 only)
// ============================================================================

/**
 * DUAL-READ: Read money from DB during Phase 2 migration
 *
 * During Phase 2, DB will have BOTH old DECIMAL and new BIGINT columns.
 * This reads the new column (cents) and falls back to old (dollars * 100)
 *
 * DELETE THIS after Phase 2 cutover is complete.
 *
 * @example
 * const site = await db.from('sites').select('*').single()
 * const priceInCents = readMoneyDualMode(
 *   site.base_price,      // old DECIMAL column
 *   site.base_price_cents // new BIGINT column
 * )
 */
export function readMoneyDualMode(
  decimalDollars: number | null,
  bigintCents: number | null
): number {
  // Prefer new cents column if available
  if (bigintCents !== null && Number.isInteger(bigintCents)) {
    return bigintCents
  }

  // Fallback to old dollars column
  if (decimalDollars !== null && Number.isFinite(decimalDollars)) {
    return toStripeCents(decimalDollars)
  }

  throw new Error('No valid money value in dual-mode read')
}

/**
 * DUAL-WRITE: Write money to DB during Phase 2 migration
 *
 * During Phase 2, writes to BOTH old DECIMAL and new BIGINT columns.
 * This ensures no data loss during migration.
 *
 * DELETE THIS after Phase 2 cutover is complete.
 *
 * @example
 * const { dollars, cents } = writeMoneyDualMode(4599) // 4599 cents
 * await db.from('sites').update({
 *   base_price: dollars,       // 45.99
 *   base_price_cents: cents    // 4599
 * })
 */
export function writeMoneyDualMode(cents: number): {
  dollars: number
  cents: number
} {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error(`Invalid cents amount for dual-write: ${cents}`)
  }

  return {
    dollars: cents / 100,  // For old DECIMAL column
    cents: cents,          // For new BIGINT column
  }
}

// ============================================================================
// Phase 2 Branded Type (for future)
// ============================================================================

/**
 * After Phase 2 migration, replace all MoneyAmount with this:
 *
 * export type MoneyCents = number & { readonly __brand: 'MoneyCents' }
 *
 * export function cents(amount: number): MoneyCents {
 *   if (!Number.isInteger(amount) || amount < 0) {
 *     throw new Error(`Invalid cents: ${amount}`)
 *   }
 *   return amount as MoneyCents
 * }
 *
 * Then all money operations work in cents, no conversion needed!
 */
