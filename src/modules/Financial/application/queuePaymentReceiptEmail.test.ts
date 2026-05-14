import { describe, it, expect, vi } from 'vitest'
import { capReceiptChargesSubtotalCents, queuePaymentReceiptEmail } from './queuePaymentReceiptEmail'

describe('capReceiptChargesSubtotalCents', () => {
  it('returns the summed cents when reservation total is unset', () => {
    expect(
      capReceiptChargesSubtotalCents({
        summedChargeLineItemsCents: 217_500,
        reservationContractTotalCents: null,
      }),
    ).toBe(217_500)
  })

  it('returns the summed cents when sum is at or below the reservation contract total', () => {
    expect(
      capReceiptChargesSubtotalCents({
        summedChargeLineItemsCents: 157_500,
        reservationContractTotalCents: 157_500,
      }),
    ).toBe(157_500)
    expect(
      capReceiptChargesSubtotalCents({
        summedChargeLineItemsCents: 100_000,
        reservationContractTotalCents: 157_500,
      }),
    ).toBe(100_000)
  })

  it('caps the charges subtotal to the reservation contract total when the sum is inflated', () => {
    expect(
      capReceiptChargesSubtotalCents({
        summedChargeLineItemsCents: 217_500,
        reservationContractTotalCents: 157_500,
      }),
    ).toBe(157_500)
  })
})

describe('queuePaymentReceiptEmail', () => {
  it('resolves without touching Supabase when amountCents is zero', async () => {
    const from = vi.fn()
    const serviceRole = { from } as unknown as Parameters<typeof queuePaymentReceiptEmail>[0]['serviceRole']

    await queuePaymentReceiptEmail({
      serviceRole,
      propertyId: '00000000-0000-4000-8000-000000000001',
      reservationId: '00000000-0000-4000-8000-000000000002',
      guestId: '00000000-0000-4000-8000-000000000003',
      amountCents: 0,
      paymentRecordId: '00000000-0000-4000-8000-000000000004',
      paymentMethodForLabel: 'stripe',
      sourceForLabel: 'manual',
      rbacCompanyId: null,
      reservationTotals: {
        total_amount: 10_000,
        paid_amount: 0,
        confirmation_number: 'CAMP-TEST',
      },
    })

    expect(from).not.toHaveBeenCalled()
  })
})
