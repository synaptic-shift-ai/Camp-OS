/**
 * Value Objects Tests
 *
 * Tests for StaffManagement value objects.
 */

import { describe, test, expect } from 'vitest'
import { StaffRole } from '../value-objects/StaffRole'
import { Permissions } from '../value-objects/Permissions'

describe('StaffRole', () => {
  test('should have static instances', () => {
    expect(StaffRole.OWNER.value).toBe('owner')
    expect(StaffRole.MANAGER.value).toBe('manager')
    expect(StaffRole.STAFF.value).toBe('staff')
    expect(StaffRole.VIEWER.value).toBe('viewer')
  })

  test('fromString should return correct instance', () => {
    expect(StaffRole.fromString('owner')).toBe(StaffRole.OWNER)
    expect(StaffRole.fromString('manager')).toBe(StaffRole.MANAGER)
    expect(StaffRole.fromString('staff')).toBe(StaffRole.STAFF)
    expect(StaffRole.fromString('viewer')).toBe(StaffRole.VIEWER)
  })

  test('fromString should be case insensitive', () => {
    expect(StaffRole.fromString('OWNER')).toBe(StaffRole.OWNER)
    expect(StaffRole.fromString('Manager')).toBe(StaffRole.MANAGER)
  })

  test('fromString should default to VIEWER for null', () => {
    expect(StaffRole.fromString(null)).toBe(StaffRole.VIEWER)
  })

  test('fromString should throw for invalid role', () => {
    expect(() => StaffRole.fromString('invalid')).toThrow('Invalid staff role: invalid')
  })

  test('hasHigherAuthorityThan works correctly', () => {
    expect(StaffRole.OWNER.hasHigherAuthorityThan(StaffRole.MANAGER)).toBe(true)
    expect(StaffRole.MANAGER.hasHigherAuthorityThan(StaffRole.STAFF)).toBe(true)
    expect(StaffRole.STAFF.hasHigherAuthorityThan(StaffRole.VIEWER)).toBe(true)
    expect(StaffRole.VIEWER.hasHigherAuthorityThan(StaffRole.OWNER)).toBe(false)
    expect(StaffRole.STAFF.hasHigherAuthorityThan(StaffRole.MANAGER)).toBe(false)
  })

  test('isAdmin returns correct values', () => {
    expect(StaffRole.OWNER.isAdmin).toBe(true)
    expect(StaffRole.MANAGER.isAdmin).toBe(true)
    expect(StaffRole.STAFF.isAdmin).toBe(false)
    expect(StaffRole.VIEWER.isAdmin).toBe(false)
  })

  test('isOwner returns correct values', () => {
    expect(StaffRole.OWNER.isOwner).toBe(true)
    expect(StaffRole.MANAGER.isOwner).toBe(false)
    expect(StaffRole.STAFF.isOwner).toBe(false)
    expect(StaffRole.VIEWER.isOwner).toBe(false)
  })

  test('canManageStaff returns correct values', () => {
    expect(StaffRole.OWNER.canManageStaff).toBe(true)
    expect(StaffRole.MANAGER.canManageStaff).toBe(true)
    expect(StaffRole.STAFF.canManageStaff).toBe(false)
    expect(StaffRole.VIEWER.canManageStaff).toBe(false)
  })

  test('canManageFinancials returns correct values', () => {
    expect(StaffRole.OWNER.canManageFinancials).toBe(true)
    expect(StaffRole.MANAGER.canManageFinancials).toBe(true)
    expect(StaffRole.STAFF.canManageFinancials).toBe(false)
    expect(StaffRole.VIEWER.canManageFinancials).toBe(false)
  })

  test('displayName returns correct values', () => {
    expect(StaffRole.OWNER.displayName).toBe('Owner')
    expect(StaffRole.MANAGER.displayName).toBe('Manager')
    expect(StaffRole.STAFF.displayName).toBe('Staff')
    expect(StaffRole.VIEWER.displayName).toBe('Viewer')
  })

  test('toString returns value', () => {
    expect(StaffRole.OWNER.toString()).toBe('owner')
    expect(StaffRole.MANAGER.toString()).toBe('manager')
  })
})

describe('Permissions', () => {
  describe('factory methods', () => {
    test('create should create from array', () => {
      const permissions = Permissions.create(['reservations:read', 'guests:read'])

      expect(permissions.has('reservations:read')).toBe(true)
      expect(permissions.has('guests:read')).toBe(true)
      expect(permissions.has('sites:read')).toBe(false)
      expect(permissions.count).toBe(2)
    })

    test('fromRole should create permissions based on role', () => {
      const ownerPerms = Permissions.fromRole(StaffRole.OWNER)
      const viewerPerms = Permissions.fromRole(StaffRole.VIEWER)

      expect(ownerPerms.has('staff:manage')).toBe(true)
      expect(ownerPerms.has('settings:manage')).toBe(true)
      expect(viewerPerms.has('staff:manage')).toBe(false)
      expect(viewerPerms.has('reservations:read')).toBe(true)
    })

    test('none should create empty permissions', () => {
      const permissions = Permissions.none()

      expect(permissions.isEmpty).toBe(true)
      expect(permissions.count).toBe(0)
    })

    test('all should create permissions with all owner permissions', () => {
      const permissions = Permissions.all()

      expect(permissions.has('staff:manage')).toBe(true)
      expect(permissions.has('settings:manage')).toBe(true)
      expect(permissions.has('financial:refund')).toBe(true)
    })

    test('fromPersistence handles null', () => {
      const permissions = Permissions.fromPersistence(null)
      expect(permissions.isEmpty).toBe(true)
    })

    test('fromPersistence handles array format', () => {
      const permissions = Permissions.fromPersistence(['reservations:read', 'guests:read'])

      expect(permissions.has('reservations:read')).toBe(true)
      expect(permissions.has('guests:read')).toBe(true)
    })

    test('fromPersistence handles object format', () => {
      const permissions = Permissions.fromPersistence({
        'reservations:read': true,
        'guests:read': true,
        'sites:read': false,
      })

      expect(permissions.has('reservations:read')).toBe(true)
      expect(permissions.has('guests:read')).toBe(true)
      expect(permissions.has('sites:read')).toBe(false)
    })
  })

  describe('permission checks', () => {
    test('has checks single permission', () => {
      const permissions = Permissions.create(['reservations:read', 'guests:read'])

      expect(permissions.has('reservations:read')).toBe(true)
      expect(permissions.has('sites:read')).toBe(false)
    })

    test('hasAny checks if any permission granted', () => {
      const permissions = Permissions.create(['reservations:read'])

      expect(permissions.hasAny(['reservations:read', 'guests:read'])).toBe(true)
      expect(permissions.hasAny(['sites:read', 'staff:manage'])).toBe(false)
    })

    test('hasAll checks if all permissions granted', () => {
      const permissions = Permissions.create(['reservations:read', 'guests:read'])

      expect(permissions.hasAll(['reservations:read', 'guests:read'])).toBe(true)
      expect(permissions.hasAll(['reservations:read', 'sites:read'])).toBe(false)
    })
  })

  describe('mutation methods', () => {
    test('add creates new instance with added permission', () => {
      const original = Permissions.create(['reservations:read'])
      const updated = original.add('guests:read')

      expect(updated.has('guests:read')).toBe(true)
      expect(original.has('guests:read')).toBe(false) // immutable
    })

    test('remove creates new instance without permission', () => {
      const original = Permissions.create(['reservations:read', 'guests:read'])
      const updated = original.remove('guests:read')

      expect(updated.has('guests:read')).toBe(false)
      expect(original.has('guests:read')).toBe(true) // immutable
    })

    test('merge combines two permission sets', () => {
      const perms1 = Permissions.create(['reservations:read'])
      const perms2 = Permissions.create(['guests:read'])
      const merged = perms1.merge(perms2)

      expect(merged.has('reservations:read')).toBe(true)
      expect(merged.has('guests:read')).toBe(true)
    })
  })

  describe('serialization', () => {
    test('toArray returns array of permissions', () => {
      const permissions = Permissions.create(['reservations:read', 'guests:read'])
      const array = permissions.toArray()

      expect(array).toContain('reservations:read')
      expect(array).toContain('guests:read')
      expect(array).toHaveLength(2)
    })

    test('toPersistence returns object format', () => {
      const permissions = Permissions.create(['reservations:read', 'guests:read'])
      const persisted = permissions.toPersistence()

      expect(persisted['reservations:read']).toBe(true)
      expect(persisted['guests:read']).toBe(true)
    })
  })

  describe('role-based defaults', () => {
    test('owner role has all permissions', () => {
      const permissions = Permissions.fromRole(StaffRole.OWNER)

      expect(permissions.has('reservations:delete')).toBe(true)
      expect(permissions.has('sites:delete')).toBe(true)
      expect(permissions.has('financial:refund')).toBe(true)
      expect(permissions.has('staff:manage')).toBe(true)
      expect(permissions.has('settings:manage')).toBe(true)
    })

    test('manager role has subset of owner permissions', () => {
      const permissions = Permissions.fromRole(StaffRole.MANAGER)

      expect(permissions.has('reservations:read')).toBe(true)
      expect(permissions.has('reservations:delete')).toBe(false)
      expect(permissions.has('financial:read')).toBe(true)
      expect(permissions.has('financial:refund')).toBe(false)
      expect(permissions.has('staff:manage')).toBe(false)
    })

    test('staff role has limited permissions', () => {
      const permissions = Permissions.fromRole(StaffRole.STAFF)

      expect(permissions.has('reservations:read')).toBe(true)
      expect(permissions.has('reservations:check_in')).toBe(true)
      expect(permissions.has('guests:create')).toBe(true)
      expect(permissions.has('guests:update')).toBe(false)
      expect(permissions.has('financial:read')).toBe(false)
    })

    test('viewer role has read-only permissions', () => {
      const permissions = Permissions.fromRole(StaffRole.VIEWER)

      expect(permissions.has('reservations:read')).toBe(true)
      expect(permissions.has('guests:read')).toBe(true)
      expect(permissions.has('sites:read')).toBe(true)
      expect(permissions.has('reservations:create')).toBe(false)
      expect(permissions.has('guests:create')).toBe(false)
    })
  })
})
