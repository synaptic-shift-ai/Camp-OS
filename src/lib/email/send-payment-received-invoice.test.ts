import { describe, expect, test } from 'vitest'
import {
  buildSiteStayReceiptLineItem,
  calculateReservationStayNights,
  isGenericReservationChargeNote,
  siteDisplayLabel,
} from '@/lib/email/send-payment-received-invoice'

describe(calculateReservationStayNights, () => {
  test('returns 1 when check-out is the day after check-in', () => {
    expect(calculateReservationStayNights('2026-05-11', '2026-05-12')).toBe(1)
  })

  test('returns 3 for a three-night stay', () => {
    expect(calculateReservationStayNights('2026-05-11', '2026-05-14')).toBe(3)
  })
})

describe(siteDisplayLabel, () => {
  test('prefers trimmed site_name over site_number', () => {
    expect(
      siteDisplayLabel({ site_name: '  test1  ', site_number: 'A12' }),
    ).toBe('test1')
  })

  test('falls back to site_number when site_name is empty', () => {
    expect(siteDisplayLabel({ site_name: '   ', site_number: 'A12' })).toBe('A12')
  })

  test('returns null when both are empty', () => {
    expect(siteDisplayLabel({ site_name: null, site_number: '' })).toBeNull()
  })
})

describe(isGenericReservationChargeNote, () => {
  test('returns true for empty or whitespace notes', () => {
    expect(isGenericReservationChargeNote(null)).toBe(true)
    expect(isGenericReservationChargeNote('  ')).toBe(true)
  })

  test('returns true for reservation charge phrasing', () => {
    expect(isGenericReservationChargeNote('Reservation charges')).toBe(true)
  })

  test('returns true for guest self-service payment text', () => {
    expect(isGenericReservationChargeNote('Guest self-service reservation payment')).toBe(true)
  })

  test('returns false for specific fee descriptions', () => {
    expect(isGenericReservationChargeNote('Pet fee — 2 dogs')).toBe(false)
  })
})

describe(buildSiteStayReceiptLineItem, () => {
  test('builds a per-night line with unitPricePerNight for email rendering', () => {
    const totalCents = 4000
    const row = buildSiteStayReceiptLineItem({
      siteLabel: 'test1',
      checkInDate: '2026-05-11',
      checkOutDate: '2026-05-12',
      totalChargeCents: totalCents,
    })
    expect(row).toEqual({
      quantity: 1,
      description: 'test1 stay (1 night)',
      unitPriceCents: 4000,
      amountCents: totalCents,
      unitPricePerNight: true,
    })
  })
})
