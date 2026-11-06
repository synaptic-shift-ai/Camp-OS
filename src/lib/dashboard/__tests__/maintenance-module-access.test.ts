import { describe, it, expect } from 'vitest'
import { maintenanceFallbackForCategory } from '../maintenance-module-access'

describe('maintenanceFallbackForCategory', () => {
  // Business rule: entering a labour rate is a manager-and-above function.
  // This fallback is consulted when a property has no explicit module-action
  // configuration, so it has to uphold the rule on its own.
  describe('labour cost is a manager-and-above function', () => {
    it('denies staff in the maintenance category', () => {
      const access = maintenanceFallbackForCategory('staff', 'maintenance')

      expect(access['enter-labor-cost']).toBe(false)
      expect(access['view-cost-reports']).toBe(false)
    })

    it('allows manager, admin and owner', () => {
      for (const role of ['manager', 'admin', 'owner'] as const) {
        expect(maintenanceFallbackForCategory(role, 'maintenance')['enter-labor-cost']).toBe(true)
      }
    })

    it('denies staff outside the maintenance category too', () => {
      expect(
        maintenanceFallbackForCategory('staff', 'housekeeping')['enter-labor-cost'],
      ).toBe(false)
    })
  })

  it('still grants maintenance staff their work-order actions', () => {
    const access = maintenanceFallbackForCategory('staff', 'maintenance')

    expect(access.view).toBe(true)
    expect(access.create).toBe(true)
    expect(access.update).toBe(true)
    expect(access['request-onhold']).toBe(true)
    expect(access['approve-onhold']).toBe(false)
    expect(access['assign-wo']).toBe(false)
  })
})
