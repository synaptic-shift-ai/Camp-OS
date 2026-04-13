import { describe, it, expect } from 'vitest'
import {
  getPermissionsForRole,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  roleCanPerform,
} from '../permissions'

describe('permissions', () => {
  describe('getPermissionsForRole', () => {
    it('owner has all permissions', () => {
      const perms = getPermissionsForRole('owner')
      // Spot-check critical permissions
      expect(perms.has('global.view_own_profile')).toBe(true)
      expect(perms.has('global.view_billing')).toBe(true)
      expect(perms.has('financial.refund')).toBe(true)
      expect(perms.has('reservations.refund')).toBe(true)
      expect(perms.has('global.manage_property_settings')).toBe(true)
      expect(perms.has('automations.system_admin')).toBe(true)
      expect(perms.has('financial.switch_processor')).toBe(true)
    })

    it('admin has operational permissions but NOT billing', () => {
      const perms = getPermissionsForRole('admin')
      expect(perms.has('global.manage_property_settings')).toBe(true)
      expect(perms.has('financial.refund')).toBe(true)
      expect(perms.has('reservations.refund')).toBe(true)
      expect(perms.has('financial.switch_processor')).toBe(true)
      // Admin should NOT have billing access
      expect(perms.has('global.view_billing')).toBe(false)
    })

    it('manager has operational permissions, no financial config', () => {
      const perms = getPermissionsForRole('manager')
      expect(perms.has('reservations.read')).toBe(true)
      expect(perms.has('reservations.check_in')).toBe(true)
      expect(perms.has('financial.view_balance')).toBe(true)
      expect(perms.has('financial.view_transactions')).toBe(true)
      // Manager should NOT have
      expect(perms.has('financial.refund')).toBe(false)
      expect(perms.has('financial.view_processor_config')).toBe(false)
      expect(perms.has('global.manage_property_settings')).toBe(false)
      expect(perms.has('global.invite_staff')).toBe(false)
    })

    it('staff has only minimal permissions', () => {
      const perms = getPermissionsForRole('staff')
      expect(perms.has('global.view_own_profile')).toBe(true)
      expect(perms.has('global.change_password')).toBe(true)
      expect(perms.has('docs.view_guest')).toBe(true)
      // Staff should NOT have operational permissions by default
      expect(perms.has('reservations.read')).toBe(false)
      expect(perms.has('financial.view_balance')).toBe(false)
    })
  })

  describe('hasPermission', () => {
    it('returns true for owner with any permission', () => {
      expect(hasPermission('owner', 'financial.refund')).toBe(true)
    })

    it('returns false for staff without category', () => {
      expect(hasPermission('staff', 'reservations.check_in')).toBe(false)
    })

    it('returns true for manager with view_balance', () => {
      expect(hasPermission('manager', 'financial.view_balance')).toBe(true)
    })

    it('returns false for manager with refund', () => {
      expect(hasPermission('manager', 'financial.refund')).toBe(false)
    })
  })

  describe('hasAnyPermission', () => {
    it('returns true if any key matches', () => {
      expect(hasAnyPermission('staff', ['global.view_own_profile', 'reservations.read'])).toBe(true)
    })

    it('returns false if none match', () => {
      expect(hasAnyPermission('staff', ['reservations.read', 'financial.refund'])).toBe(false)
    })
  })

  describe('hasAllPermissions', () => {
    it('returns true when all keys present (owner)', () => {
      expect(hasAllPermissions('owner', ['reservations.read', 'financial.refund'])).toBe(true)
    })

    it('returns false when any key missing (manager)', () => {
      expect(hasAllPermissions('manager', ['reservations.read', 'financial.refund'])).toBe(false)
    })
  })

  describe('roleCanPerform', () => {
    it('admin can refund (meets minimum AND has permission)', () => {
      expect(roleCanPerform('admin', 'admin', 'financial.refund')).toBe(true)
    })

    it('manager cannot refund despite meeting admin min (no permission)', () => {
      expect(roleCanPerform('manager', 'admin', 'financial.refund')).toBe(false)
    })

    it('staff cannot check in (does not meet minimum)', () => {
      expect(roleCanPerform('staff', 'manager', 'reservations.cancel')).toBe(false)
    })
  })
})
