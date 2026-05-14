/**
 * Shared balance logic for reservation financial APIs.
 *
 * `reservations.total_amount` / `paid_amount` define what the guest owes when a contract
 * total exists. Summing `financial_transactions` of type `charge` can exceed `total_amount`
 * (duplicate or ancillary rows), so we must not use max(ledger, snapshot) for amount due —
 * that overstates balance. When `total_amount` is zero (e.g. draft), fall back to ledger.
 */

export type ReservationFinancialTxnRow = {
  type: string
  amount_cents: number
  source?: string | null
  handling?: string | null
}

export function summarizeReservationFinancialTransactions(
  transactions: ReadonlyArray<ReservationFinancialTxnRow>,
  reservationTotalCents: number,
  reservationPaidCents: number,
) {
  let chargesTotal = 0
  let paymentsTotal = 0
  let refundsTotal = 0
  let guestCreditBalance = 0

  for (const txn of transactions) {
    const amt = txn.amount_cents
    if (txn.type === 'charge') {
      chargesTotal += amt
    } else if (txn.type === 'payment') {
      paymentsTotal += amt
      if (txn.source === 'guest_credit') {
        guestCreditBalance -= amt
      }
    } else if (txn.type === 'refund') {
      refundsTotal += amt
      if (txn.source === 'guest_credit' || txn.handling === 'guest_credit') {
        guestCreditBalance += amt
      }
    }
  }

  const ledgerBalance = chargesTotal - paymentsTotal - refundsTotal
  const reservationBalance = Math.max(0, reservationTotalCents - reservationPaidCents)
  const balanceDueCents =
    reservationTotalCents > 0
      ? reservationBalance
      : Math.max(0, ledgerBalance, reservationBalance)

  return {
    chargesTotal,
    paymentsTotal,
    refundsTotal,
    ledgerBalance,
    reservationBalance,
    balanceDueCents,
    guestCreditBalance,
  }
}
