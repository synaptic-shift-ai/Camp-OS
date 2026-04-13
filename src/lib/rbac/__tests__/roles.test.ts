import { describe, it, expect } from 'vitest'
import {
  isDbRole,
  toEffectiveRole,
  getRoleRank,
  roleMeetsMinimum,
  isBasicStaff,
  isElevatedStaff,
  isOwnerOrAdmin,
  isOwner,
  isAdminOrAbove,
  isManagerOrAbove,
} from '../roles'

describe('roles', () => {
  describe('isDbRole', () => {
    it('accepts all 5 valid DB roles', () => {
      expect(isDbRole('owner')).toBe(true)
      expect(isDbRole('admin')).toBe(true)
      expect(isDbRole('property_admin')).toBe(true)
      expect(isDbRole('manager')).toBe(true)
      expect(isDbRole('staff')).toBe(true)
    })

    it('rejects invalid roles', () => {
      expect(isDbRole('viewer')).toBe(false)
      expect(isDbRole('superadmin')).toBe(false)
      expect(isDbRole('')).toBe(false)
      expect(isDbRole(null)).toBe(false)
      expect(isDbRole(undefined)).toBe(false)
    })
  })

  describe('toEffectiveRole', () => {
    it('normalises owner', () => {
      expect(toEffectiveRole('owner')).toBe('owner')
      expect(toEffectiveRole('OWNER')).toBe('owner')
    })

    it('normalises admin and property_admin to admin', () => {
      expect(toEffectiveRole('admin')).toBe('admin')
      expect(toEffectiveRole('property_admin')).toBe('admin')
      expect(toEffectiveRole('ADMIN')).toBe('admin')
    })

    it('normalises manager', () => {
      expect(toEffectiveRole('manager')).toBe('manager')
    })

    it('normalises staff', () => {
      expect(toEffectiveRole('staff')).toBe('staff')
    })

    it('maps invalid values to staff', () => {
      expect(toEffectiveRole('viewer')).toBe('staff')
      expect(toEffectiveRole('random')).toBe('staff')
    })

    it('maps null/undefined to staff', () => {
      expect(toEffectiveRole(null)).toBe('staff')
      expect(toEffectiveRole(undefined)).toBe('staff')
    })
  })

  describe('getRoleRank', () => {
    it('returns correct ranks', () => {
      expect(getRoleRank('staff')).toBe(10)
      expect(getRoleRank('manager')).toBe(20)
      expect(getRoleRank('admin')).toBe(30)
      expect(getRoleRank('owner')).toBe(40)
    })
  })

  describe('roleMeetsMinimum', () => {
    it('owner meets all minimums', () => {
      expect(roleMeetsMinimum('owner', 'owner')).toBe(true)
      expect(roleMeetsMinimum('owner', 'admin')).toBe(true)
      expect(roleMeetsMinimum('owner', 'manager')).toBe(true)
      expect(roleMeetsMinimum('owner', 'staff')).toBe(true)
    })

    it('admin meets admin, manager, staff', () => {
      expect(roleMeetsMinimum('admin', 'owner')).toBe(false)
      expect(roleMeetsMinimum('admin', 'admin')).toBe(true)
      expect(roleMeetsMinimum('admin', 'manager')).toBe(true)
      expect(roleMeetsMinimum('admin', 'staff')).toBe(true)
    })

    it('manager meets manager and staff', () => {
      expect(roleMeetsMinimum('manager', 'owner')).toBe(false)
      expect(roleMeetsMinimum('manager', 'admin')).toBe(false)
      expect(roleMeetsMinimum('manager', 'manager')).toBe(true)
      expect(roleMeetsMinimum('manager', 'staff')).toBe(true)
    })

    it('staff only meets staff', () => {
      expect(roleMeetsMinimum('staff', 'owner')).toBe(false)
      expect(roleMeetsMinimum('staff', 'admin')).toBe(false)
      expect(roleMeetsMinimum('staff', 'manager')).toBe(false)
      expect(roleMeetsMinimum('staff', 'staff')).toBe(true)
    })
  })

  describe('isBasicStaff', () => {
    it('returns true for staff role', () => {
      expect(isBasicStaff('staff')).toBe(true)
    })
    it('returns false for non-staff roles', () => {
      expect(isBasicStaff('manager')).toBe(false)
      expect(isBasicStaff('admin')).toBe(false)
      expect(isBasicStaff('owner')).toBe(false)
    })
  })

  describe('isElevatedStaff', () => {
    it('returns false for staff', () => {
      expect(isElevatedStaff('staff')).toBe(false)
    })
    it('returns true for manager, admin, owner', () => {
      expect(isElevatedStaff('manager')).toBe(true)
      expect(isElevatedStaff('admin')).toBe(true)
      expect(isElevatedStaff('owner')).toBe(true)
    })
  })

  describe('isOwnerOrAdmin', () => {
    it('returns true for owner and admin', () => {
      expect(isOwnerOrAdmin('owner')).toBe(true)
      expect(isOwnerOrAdmin('admin')).toBe(true)
    })
    it('returns false for manager and staff', () => {
      expect(isOwnerOrAdmin('manager')).toBe(false)
      expect(isOwnerOrAdmin('staff')).toBe(false)
    })
  })

  describe('isOwner', () => {
    it('returns true for owner only', () => {
      expect(isOwner('owner')).toBe(true)
    })
    it('returns false for non-owner', () => {
      expect(isOwner('admin')).toBe(false)
    })
  })

  describe('isAdminOrAbove', () => {
    it('returns true for owner and admin', () => {
      expect(isAdminOrAbove('owner')).toBe(true)
      expect(isAdminOrAbove('admin')).toBe(true)
    })
    it('returns false for manager and staff', () => {
      expect(isAdminOrAbove('manager')).toBe(false)
      expect(isAdminOrAbove('staff')).toBe(false)
    })
  })

  describe('isManagerOrAbove', () => {
    it('returns true for owner, admin, manager', () => {
      expect(isManagerOrAbove('owner')).toBe(true)
      expect(isManagerOrAbove('admin')).toBe(true)
      expect(isManagerOrAbove('manager')).toBe(true)
    })
    it('returns false for staff', () => {
      expect(isManagerOrAbove('staff')).toBe(false)
    })
  })
})
