import { describe, expect, test } from 'vitest'
import {
  isBasicPropertyStaffRole,
  isElevatedPropertyStaffRole,
  isPropertyStaffRoleBlockedFromPropertySettings,
} from '@/lib/dashboard/property-staff-roles'

describe('isBasicPropertyStaffRole', () => {
  test('returns true only for role staff (case-insensitive)', () => {
    expect(isBasicPropertyStaffRole('staff')).toBe(true)
    expect(isBasicPropertyStaffRole('Staff')).toBe(true)
    expect(isBasicPropertyStaffRole('manager')).toBe(false)
    expect(isBasicPropertyStaffRole('admin')).toBe(false)
    expect(isBasicPropertyStaffRole('')).toBe(false)
    expect(isBasicPropertyStaffRole(null)).toBe(false)
    expect(isBasicPropertyStaffRole(undefined)).toBe(false)
  })
})

describe('isElevatedPropertyStaffRole', () => {
  test('returns true for owner, admin, property_admin, and manager roles', () => {
    expect(isElevatedPropertyStaffRole('owner')).toBe(true)
    expect(isElevatedPropertyStaffRole('Admin')).toBe(true)
    expect(isElevatedPropertyStaffRole('PROPERTY_ADMIN')).toBe(true)
    expect(isElevatedPropertyStaffRole('manager')).toBe(true)
  })

  test('returns false for basic staff and empty role', () => {
    expect(isElevatedPropertyStaffRole('staff')).toBe(false)
    expect(isElevatedPropertyStaffRole('')).toBe(false)
    expect(isElevatedPropertyStaffRole(null)).toBe(false)
    expect(isElevatedPropertyStaffRole(undefined)).toBe(false)
  })
})

describe('isPropertyStaffRoleBlockedFromPropertySettings', () => {
  test('returns true for staff and manager roles (case-insensitive)', () => {
    expect(isPropertyStaffRoleBlockedFromPropertySettings('staff')).toBe(true)
    expect(isPropertyStaffRoleBlockedFromPropertySettings('Staff')).toBe(true)
    expect(isPropertyStaffRoleBlockedFromPropertySettings('manager')).toBe(true)
    expect(isPropertyStaffRoleBlockedFromPropertySettings('MANAGER')).toBe(true)
  })

  test('returns false for owner, admin, property_admin, viewer, and empty role', () => {
    expect(isPropertyStaffRoleBlockedFromPropertySettings('owner')).toBe(false)
    expect(isPropertyStaffRoleBlockedFromPropertySettings('admin')).toBe(false)
    expect(isPropertyStaffRoleBlockedFromPropertySettings('property_admin')).toBe(false)
    expect(isPropertyStaffRoleBlockedFromPropertySettings('viewer')).toBe(false)
    expect(isPropertyStaffRoleBlockedFromPropertySettings('')).toBe(false)
    expect(isPropertyStaffRoleBlockedFromPropertySettings(null)).toBe(false)
    expect(isPropertyStaffRoleBlockedFromPropertySettings(undefined)).toBe(false)
  })
})
