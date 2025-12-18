/**
 * PropertyStaff Aggregate Tests
 *
 * Tests for PropertyStaff aggregate root.
 */

import { describe, test, expect } from 'vitest'
import { PropertyStaff } from '../PropertyStaff'
import { StaffRole } from '../value-objects/StaffRole'
import { Permissions } from '../value-objects/Permissions'
import { StaffAddedEvent } from '../events/StaffAddedEvent'
import { StaffRemovedEvent } from '../events/StaffRemovedEvent'
import { StaffRoleChangedEvent } from '../events/StaffRoleChangedEvent'
import { StaffPermissionsUpdatedEvent } from '../events/StaffPermissionsUpdatedEvent'

const createTestIds = () => ({
  staffId: 'staff-' + crypto.randomUUID(),
  propertyId: 'property-' + crypto.randomUUID(),
  userId: 'user-' + crypto.randomUUID(),
  adminId: 'admin-' + crypto.randomUUID(),
})

describe('PropertyStaff', () => {
  describe('create', () => {
    test('should create staff with role and default permissions', () => {
      const ids = createTestIds()

      const staff = PropertyStaff.create({
        id: ids.staffId,
        propertyId: ids.propertyId,
        userId: ids.userId,
        role: 'staff',
      })

      expect(staff.id).toBe(ids.staffId)
      expect(staff.propertyId).toBe(ids.propertyId)
      expect(staff.userId).toBe(ids.userId)
      expect(staff.role.value).toBe('staff')
      expect(staff.hasPermission('reservations:read')).toBe(true)
      expect(staff.hasPermission('staff:manage')).toBe(false)
    })

    test('should create staff with custom permissions', () => {
      const ids = createTestIds()

      const staff = PropertyStaff.create({
        id: ids.staffId,
        propertyId: ids.propertyId,
        userId: ids.userId,
        role: 'staff',
        customPermissions: ['reservations:read', 'financial:read'],
      })

      expect(staff.hasPermission('reservations:read')).toBe(true)
      expect(staff.hasPermission('financial:read')).toBe(true)
      expect(staff.hasPermission('reservations:create')).toBe(false)
    })

    test('should emit StaffAddedEvent on creation', () => {
      const ids = createTestIds()

      const staff = PropertyStaff.create({
        id: ids.staffId,
        propertyId: ids.propertyId,
        userId: ids.userId,
        role: 'manager',
      })

      const events = staff.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(StaffAddedEvent)

      const event = events[0] as StaffAddedEvent
      expect(event.staffId).toBe(ids.staffId)
      expect(event.propertyId).toBe(ids.propertyId)
      expect(event.userId).toBe(ids.userId)
      expect(event.role).toBe('manager')
    })
  })

  describe('changeRole', () => {
    test('should change role and reset permissions by default', () => {
      const ids = createTestIds()

      const staff = PropertyStaff.create({
        id: ids.staffId,
        propertyId: ids.propertyId,
        userId: ids.userId,
        role: 'staff',
      })
      staff.clearDomainEvents()

      staff.changeRole('manager', ids.adminId)

      expect(staff.role.value).toBe('manager')
      expect(staff.hasPermission('financial:read')).toBe(true) // manager permission
    })

    test('should change role and preserve permissions when resetPermissions is false', () => {
      const ids = createTestIds()

      const staff = PropertyStaff.create({
        id: ids.staffId,
        propertyId: ids.propertyId,
        userId: ids.userId,
        role: 'staff',
        customPermissions: ['reservations:read'],
      })
      staff.clearDomainEvents()

      staff.changeRole('manager', ids.adminId, false)

      expect(staff.role.value).toBe('manager')
      expect(staff.hasPermission('reservations:read')).toBe(true)
      expect(staff.hasPermission('financial:read')).toBe(false) // not reset to manager defaults
    })

    test('should throw when changing to same role', () => {
      const ids = createTestIds()

      const staff = PropertyStaff.create({
        id: ids.staffId,
        propertyId: ids.propertyId,
        userId: ids.userId,
        role: 'staff',
      })

      expect(() => staff.changeRole('staff', ids.adminId)).toThrow(
        'Staff member already has this role'
      )
    })

    test('should emit StaffRoleChangedEvent', () => {
      const ids = createTestIds()

      const staff = PropertyStaff.create({
        id: ids.staffId,
        propertyId: ids.propertyId,
        userId: ids.userId,
        role: 'staff',
      })
      staff.clearDomainEvents()

      staff.changeRole('manager', ids.adminId)

      const events = staff.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(StaffRoleChangedEvent)

      const event = events[0] as StaffRoleChangedEvent
      expect(event.previousRole).toBe('staff')
      expect(event.newRole).toBe('manager')
      expect(event.changedBy).toBe(ids.adminId)
    })
  })

  describe('updatePermissions', () => {
    test('should replace all permissions', () => {
      const ids = createTestIds()

      const staff = PropertyStaff.create({
        id: ids.staffId,
        propertyId: ids.propertyId,
        userId: ids.userId,
        role: 'staff',
      })
      staff.clearDomainEvents()

      staff.updatePermissions(['reservations:read', 'financial:read'], ids.adminId)

      expect(staff.permissions.count).toBe(2)
      expect(staff.hasPermission('reservations:read')).toBe(true)
      expect(staff.hasPermission('financial:read')).toBe(true)
      expect(staff.hasPermission('guests:read')).toBe(false)
    })

    test('should emit StaffPermissionsUpdatedEvent', () => {
      const ids = createTestIds()

      const staff = PropertyStaff.create({
        id: ids.staffId,
        propertyId: ids.propertyId,
        userId: ids.userId,
        role: 'viewer',
      })
      staff.clearDomainEvents()

      staff.updatePermissions(['reservations:read'], ids.adminId)

      const events = staff.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(StaffPermissionsUpdatedEvent)

      const event = events[0] as StaffPermissionsUpdatedEvent
      expect(event.updatedBy).toBe(ids.adminId)
      expect(event.newPermissions).toEqual(['reservations:read'])
    })
  })

  describe('addPermission', () => {
    test('should add a permission', () => {
      const ids = createTestIds()

      const staff = PropertyStaff.create({
        id: ids.staffId,
        propertyId: ids.propertyId,
        userId: ids.userId,
        role: 'viewer',
      })
      staff.clearDomainEvents()

      staff.addPermission('reservations:create', ids.adminId)

      expect(staff.hasPermission('reservations:create')).toBe(true)
    })

    test('should not emit event when permission already exists', () => {
      const ids = createTestIds()

      const staff = PropertyStaff.create({
        id: ids.staffId,
        propertyId: ids.propertyId,
        userId: ids.userId,
        role: 'viewer',
      })
      staff.clearDomainEvents()

      staff.addPermission('reservations:read', ids.adminId) // viewer already has this

      const events = staff.getDomainEvents()
      expect(events).toHaveLength(0)
    })
  })

  describe('removePermission', () => {
    test('should remove a permission', () => {
      const ids = createTestIds()

      const staff = PropertyStaff.create({
        id: ids.staffId,
        propertyId: ids.propertyId,
        userId: ids.userId,
        role: 'viewer',
      })
      staff.clearDomainEvents()

      staff.removePermission('reservations:read', ids.adminId)

      expect(staff.hasPermission('reservations:read')).toBe(false)
    })

    test('should not emit event when permission does not exist', () => {
      const ids = createTestIds()

      const staff = PropertyStaff.create({
        id: ids.staffId,
        propertyId: ids.propertyId,
        userId: ids.userId,
        role: 'viewer',
      })
      staff.clearDomainEvents()

      staff.removePermission('staff:manage', ids.adminId) // viewer doesn't have this

      const events = staff.getDomainEvents()
      expect(events).toHaveLength(0)
    })
  })

  describe('resetPermissionsToRoleDefaults', () => {
    test('should reset permissions to role defaults', () => {
      const ids = createTestIds()

      const staff = PropertyStaff.create({
        id: ids.staffId,
        propertyId: ids.propertyId,
        userId: ids.userId,
        role: 'manager',
        customPermissions: ['reservations:read'],
      })
      staff.clearDomainEvents()

      staff.resetPermissionsToRoleDefaults(ids.adminId)

      expect(staff.hasPermission('financial:read')).toBe(true) // manager default
      expect(staff.hasPermission('staff:read')).toBe(true) // manager default
    })
  })

  describe('markAsRemoved', () => {
    test('should emit StaffRemovedEvent', () => {
      const ids = createTestIds()

      const staff = PropertyStaff.create({
        id: ids.staffId,
        propertyId: ids.propertyId,
        userId: ids.userId,
        role: 'staff',
      })
      staff.clearDomainEvents()

      staff.markAsRemoved(ids.adminId)

      const events = staff.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(StaffRemovedEvent)

      const event = events[0] as StaffRemovedEvent
      expect(event.staffId).toBe(ids.staffId)
      expect(event.removedBy).toBe(ids.adminId)
    })
  })

  describe('permission checks', () => {
    test('hasPermission checks single permission', () => {
      const ids = createTestIds()

      const staff = PropertyStaff.create({
        id: ids.staffId,
        propertyId: ids.propertyId,
        userId: ids.userId,
        role: 'manager',
      })

      expect(staff.hasPermission('financial:read')).toBe(true)
      expect(staff.hasPermission('financial:refund')).toBe(false)
    })

    test('hasAnyPermission checks multiple permissions', () => {
      const ids = createTestIds()

      const staff = PropertyStaff.create({
        id: ids.staffId,
        propertyId: ids.propertyId,
        userId: ids.userId,
        role: 'viewer',
      })

      expect(staff.hasAnyPermission(['reservations:read', 'staff:manage'])).toBe(true)
      expect(staff.hasAnyPermission(['staff:manage', 'settings:manage'])).toBe(false)
    })

    test('hasAllPermissions checks multiple permissions', () => {
      const ids = createTestIds()

      // Viewer only has read permissions
      const staff = PropertyStaff.create({
        id: ids.staffId,
        propertyId: ids.propertyId,
        userId: ids.userId,
        role: 'viewer',
      })

      expect(staff.hasAllPermissions(['reservations:read', 'guests:read'])).toBe(true)
      expect(staff.hasAllPermissions(['reservations:read', 'staff:manage'])).toBe(false)
    })
  })

  describe('canManage', () => {
    test('owner can manage manager', () => {
      const propertyId = 'property-' + crypto.randomUUID()

      const owner = PropertyStaff.create({
        id: 'owner-staff-id',
        propertyId,
        userId: 'owner-user-id',
        role: 'owner',
      })

      const manager = PropertyStaff.create({
        id: 'manager-staff-id',
        propertyId,
        userId: 'manager-user-id',
        role: 'manager',
      })

      expect(owner.canManage(manager)).toBe(true)
      expect(manager.canManage(owner)).toBe(false)
    })

    test('cannot manage staff at different property', () => {
      const owner = PropertyStaff.create({
        id: 'owner-staff-id',
        propertyId: 'property-1',
        userId: 'owner-user-id',
        role: 'owner',
      })

      const staff = PropertyStaff.create({
        id: 'staff-staff-id',
        propertyId: 'property-2',
        userId: 'staff-user-id',
        role: 'staff',
      })

      expect(owner.canManage(staff)).toBe(false)
    })

    test('staff without staff:manage permission cannot manage', () => {
      const propertyId = 'property-' + crypto.randomUUID()

      const staffMember = PropertyStaff.create({
        id: 'staff-1-id',
        propertyId,
        userId: 'staff-1-user-id',
        role: 'staff',
      })

      const viewer = PropertyStaff.create({
        id: 'viewer-id',
        propertyId,
        userId: 'viewer-user-id',
        role: 'viewer',
      })

      expect(staffMember.canManage(viewer)).toBe(false) // staff doesn't have staff:manage
    })
  })

  describe('role checks', () => {
    test('isAdmin returns correct values', () => {
      const ids = createTestIds()

      const owner = PropertyStaff.create({ ...ids, id: 'id-1', role: 'owner' })
      const manager = PropertyStaff.create({ ...ids, id: 'id-2', role: 'manager' })
      const staff = PropertyStaff.create({ ...ids, id: 'id-3', role: 'staff' })
      const viewer = PropertyStaff.create({ ...ids, id: 'id-4', role: 'viewer' })

      expect(owner.isAdmin).toBe(true)
      expect(manager.isAdmin).toBe(true)
      expect(staff.isAdmin).toBe(false)
      expect(viewer.isAdmin).toBe(false)
    })

    test('isOwner returns correct values', () => {
      const ids = createTestIds()

      const owner = PropertyStaff.create({ ...ids, id: 'id-1', role: 'owner' })
      const manager = PropertyStaff.create({ ...ids, id: 'id-2', role: 'manager' })

      expect(owner.isOwner).toBe(true)
      expect(manager.isOwner).toBe(false)
    })
  })

  describe('persistence', () => {
    test('toPersistence returns correct format', () => {
      const ids = createTestIds()

      const staff = PropertyStaff.create({
        id: ids.staffId,
        propertyId: ids.propertyId,
        userId: ids.userId,
        role: 'manager',
      })

      const persisted = staff.toPersistence()

      expect(persisted.id).toBe(ids.staffId)
      expect(persisted.property_id).toBe(ids.propertyId)
      expect(persisted.user_id).toBe(ids.userId)
      expect(persisted.role).toBe('manager')
      expect(persisted.permissions['reservations:read']).toBe(true)
      expect(typeof persisted.created_at).toBe('string')
      expect(typeof persisted.updated_at).toBe('string')
    })

    test('fromPersistence reconstitutes aggregate', () => {
      const ids = createTestIds()
      const createdAt = new Date('2024-01-01T00:00:00Z')
      const updatedAt = new Date('2024-01-02T00:00:00Z')

      const staff = PropertyStaff.fromPersistence(
        ids.staffId,
        ids.propertyId,
        ids.userId,
        StaffRole.MANAGER,
        Permissions.fromRole(StaffRole.MANAGER),
        createdAt,
        updatedAt
      )

      expect(staff.id).toBe(ids.staffId)
      expect(staff.propertyId).toBe(ids.propertyId)
      expect(staff.userId).toBe(ids.userId)
      expect(staff.role.value).toBe('manager')
      expect(staff.createdAt).toEqual(createdAt)
      expect(staff.updatedAt).toEqual(updatedAt)
    })

    test('round-trip persistence preserves data', () => {
      const ids = createTestIds()

      const original = PropertyStaff.create({
        id: ids.staffId,
        propertyId: ids.propertyId,
        userId: ids.userId,
        role: 'manager',
        customPermissions: ['reservations:read', 'guests:create'],
      })

      const persisted = original.toPersistence()

      const reconstituted = PropertyStaff.fromPersistence(
        persisted.id,
        persisted.property_id,
        persisted.user_id,
        StaffRole.fromString(persisted.role),
        Permissions.fromPersistence(persisted.permissions),
        new Date(persisted.created_at),
        new Date(persisted.updated_at)
      )

      expect(reconstituted.id).toBe(original.id)
      expect(reconstituted.propertyId).toBe(original.propertyId)
      expect(reconstituted.userId).toBe(original.userId)
      expect(reconstituted.role.value).toBe(original.role.value)
      expect(reconstituted.permissions.toArray().sort()).toEqual(
        original.permissions.toArray().sort()
      )
    })
  })
})
