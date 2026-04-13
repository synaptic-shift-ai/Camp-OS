import { describe, it, expect } from 'vitest'
import {
  isStaffCategory,
  normaliseCategories,
  hasCategory,
  getPermissionsForCategory,
  resolveStaffPermissions,
  staffHasPermission,
} from '../staff-categories'

describe('staff-categories', () => {
  describe('isStaffCategory', () => {
    it('accepts all 7 categories', () => {
      expect(isStaffCategory('housekeeping')).toBe(true)
      expect(isStaffCategory('maintenance')).toBe(true)
      expect(isStaffCategory('front_desk')).toBe(true)
      expect(isStaffCategory('security')).toBe(true)
      expect(isStaffCategory('marketing')).toBe(true)
      expect(isStaffCategory('activities')).toBe(true)
      expect(isStaffCategory('all')).toBe(true)
    })

    it('rejects invalid categories', () => {
      expect(isStaffCategory('random')).toBe(false)
      expect(isStaffCategory('')).toBe(false)
      expect(isStaffCategory(null)).toBe(false)
      expect(isStaffCategory(undefined)).toBe(false)
    })
  })

  describe('normaliseCategories', () => {
    it('filters valid categories', () => {
      expect(normaliseCategories(['front_desk', 'housekeeping', 'invalid'])).toEqual([
        'front_desk',
        'housekeeping',
      ])
    })

    it('handles null/undefined input', () => {
      expect(normaliseCategories(null)).toEqual([])
      expect(normaliseCategories(undefined)).toEqual([])
    })

    it('handles array with nulls', () => {
      expect(normaliseCategories(['front_desk', null, undefined, 'maintenance'])).toEqual([
        'front_desk',
        'maintenance',
      ])
    })
  })

  describe('hasCategory', () => {
    it('returns true when category is present', () => {
      expect(hasCategory(['front_desk', 'housekeeping'], 'front_desk')).toBe(true)
    })

    it('returns true when "all" is present', () => {
      expect(hasCategory(['all'], 'front_desk')).toBe(true)
      expect(hasCategory(['all'], 'maintenance')).toBe(true)
    })

    it('returns false when category is absent', () => {
      expect(hasCategory(['front_desk'], 'maintenance')).toBe(false)
    })
  })

  describe('getPermissionsForCategory', () => {
    it('front_desk grants check_in and balance', () => {
      const perms = getPermissionsForCategory('front_desk')
      expect(perms.has('reservations.check_in')).toBe(true)
      expect(perms.has('reservations.check_out')).toBe(true)
      expect(perms.has('financial.view_balance')).toBe(true)
      expect(perms.has('financial.view_transactions')).toBe(true)
      expect(perms.has('financial.record_payment')).toBe(true)
    })

    it('housekeeping grants view_assigned and start_complete', () => {
      const perms = getPermissionsForCategory('housekeeping')
      expect(perms.has('housekeeping.view_assigned')).toBe(true)
      expect(perms.has('housekeeping.start_complete')).toBe(true)
      expect(perms.has('reservations.check_in')).toBe(false)
    })

    it('maintenance grants create_wo and enter_labor_cost', () => {
      const perms = getPermissionsForCategory('maintenance')
      expect(perms.has('maintenance.create_wo')).toBe(true)
      expect(perms.has('maintenance.enter_labor_cost')).toBe(true)
      expect(perms.has('maintenance.view_labor_rates')).toBe(false)
    })

    it('security grants gate access permissions', () => {
      const perms = getPermissionsForCategory('security')
      expect(perms.has('gate_access.view_log')).toBe(true)
      expect(perms.has('gate_access.view_health')).toBe(true)
      expect(perms.has('gate_access.log_incident')).toBe(true)
      expect(perms.has('gate_access.configure_vendor')).toBe(false)
    })

    it('marketing grants listing and media permissions', () => {
      const perms = getPermissionsForCategory('marketing')
      expect(perms.has('marketing_seo.edit_listings')).toBe(true)
      expect(perms.has('marketing_seo.manage_photos')).toBe(true)
      expect(perms.has('marketing_seo.configure_seo')).toBe(false)
    })

    it('activities grants activity permissions', () => {
      const perms = getPermissionsForCategory('activities')
      expect(perms.has('activities.view')).toBe(true)
      expect(perms.has('activities.schedule')).toBe(true)
      expect(perms.has('activities.book')).toBe(true)
    })

    it('"all" is the union of all categories', () => {
      const allPerms = getPermissionsForCategory('all')
      const housekeepingPerms = getPermissionsForCategory('housekeeping')
      const maintenancePerms = getPermissionsForCategory('maintenance')
      const frontDeskPerms = getPermissionsForCategory('front_desk')

      // "all" should include at least what housekeeping, maintenance, and front_desk grant
      for (const p of housekeepingPerms) {
        expect(allPerms.has(p)).toBe(true)
      }
      for (const p of maintenancePerms) {
        expect(allPerms.has(p)).toBe(true)
      }
      for (const p of frontDeskPerms) {
        expect(allPerms.has(p)).toBe(true)
      }
    })
  })

  describe('resolveStaffPermissions', () => {
    it('returns empty set for no categories', () => {
      expect(resolveStaffPermissions([]).size).toBe(0)
    })

    it('combines multiple categories', () => {
      const perms = resolveStaffPermissions(['front_desk', 'housekeeping'])
      expect(perms.has('reservations.check_in')).toBe(true) // from front_desk
      expect(perms.has('housekeeping.view_assigned')).toBe(true) // from housekeeping
    })

    it('"all" grants union of everything', () => {
      const perms = resolveStaffPermissions(['all'])
      expect(perms.has('reservations.check_in')).toBe(true)
      expect(perms.has('housekeeping.view_assigned')).toBe(true)
      expect(perms.has('maintenance.create_wo')).toBe(true)
      expect(perms.has('gate_access.view_log')).toBe(true)
    })
  })

  describe('staffHasPermission', () => {
    it('front_desk staff can check in', () => {
      expect(staffHasPermission(['front_desk'], 'reservations.check_in')).toBe(true)
    })

    it('housekeeping staff cannot check in', () => {
      expect(staffHasPermission(['housekeeping'], 'reservations.check_in')).toBe(false)
    })

    it('staff with no categories has no permissions', () => {
      expect(staffHasPermission([], 'reservations.check_in')).toBe(false)
    })
  })
})
