import { describe, expect, test } from 'vitest'
import { summarizeReservationFinancialTransactions } from './reservation-amount-due'

describe('summarizeReservationFinancialTransactions', () => {
  test('uses reservation snapshot when ledger line sum is below snapshot (unposted charges)', () => {
    const transactions = [
      { type: 'charge', amount_cents: 2000 },
      { type: 'payment', amount_cents: 5500 },
    ]
    const reservationTotalCents = 6500
    const reservationPaidCents = 5500

    const result = summarizeReservationFinancialTransactions(
      transactions,
      reservationTotalCents,
      reservationPaidCents,
    )

    expect(result.ledgerBalance).toBe(-3500)
    expect(result.reservationBalance).toBe(1000)
    expect(result.balanceDueCents).toBe(1000)
  })

  test('uses reservation snapshot when ledger charge sum exceeds total_amount', () => {
    const transactions = [
      { type: 'payment', amount_cents: 124800 },
      { type: 'charge', amount_cents: 203490 },
    ]

    const result = summarizeReservationFinancialTransactions(
      transactions,
      146010,
      124800,
    )

    expect(result.ledgerBalance).toBe(78690)
    expect(result.reservationBalance).toBe(21210)
    expect(result.balanceDueCents).toBe(21210)
  })

  test('falls back to ledger when reservation total_amount is zero', () => {
    const transactions = [
      { type: 'charge', amount_cents: 50000 },
      { type: 'payment', amount_cents: 0 },
    ]
    const result = summarizeReservationFinancialTransactions(transactions, 0, 0)

    expect(result.reservationBalance).toBe(0)
    expect(result.ledgerBalance).toBe(50000)
    expect(result.balanceDueCents).toBe(50000)
  })
})
