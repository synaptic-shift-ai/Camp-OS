import { describe, it, expect } from 'vitest'
import { computeEffectiveGuestCreditAvailableCents } from './guestCreditBalance'

describe('computeEffectiveGuestCreditAvailableCents', () => {
  it('returns the ledger balance when guests column is null', () => {
    expect(computeEffectiveGuestCreditAvailableCents(1500, null)).toBe(1500)
  })

  it('returns the guests column when it exceeds the ledger balance', () => {
    expect(computeEffectiveGuestCreditAvailableCents(0, 2000)).toBe(2000)
  })

  it('returns the ledger balance when it exceeds the guests column', () => {
    expect(computeEffectiveGuestCreditAvailableCents(3000, 2000)).toBe(3000)
  })
})
