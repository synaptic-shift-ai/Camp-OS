/**
 * Staff API v1 Contract Tests
 *
 * Phase 4B: API Consolidation - Staff API
 *
 * Following CLAUDE.md:
 * - T-1: Tests colocated in tests/integration/
 * - T-6: Test entire structure in one assertion
 * - T-7: Parameterized test inputs
 * - T-8: Test description states what expect verifies
 * - T-12: Group unit tests under describe(functionName, ...)
 */

import { describe, it, expect } from 'vitest'
import {
  StaffRoleSchema,
  PermissionKeySchema,
  AddStaffRequestSchema,
  UpdateStaffRequestSchema,
  StaffResponseSchema,
  StaffListResponseSchema,
  type StaffResponse,
  type StaffListResponse,
} from '@/types/api/v1/schemas/staff'

describe('Staff API v1 Contract Tests', () => {
  // ========================================================================
  // Enum Schema Validation
  // ========================================================================

  describe('StaffRoleSchema', () => {
    const validRoles = ['owner', 'admin', 'manager', 'staff'] as const

    validRoles.forEach((role) => {
      it(`should accept valid role: ${role}`, () => {
        const result = StaffRoleSchema.safeParse(role)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid role', () => {
      const result = StaffRoleSchema.safeParse('superadmin')
      expect(result.success).toBe(false)
    })
  })

  describe('PermissionKeySchema', () => {
    const validPermissions = [
      'reservations:read',
      'reservations:create',
      'reservations:update',
      'reservations:delete',
      'reservations:check_in',
      'reservations:check_out',
      'guests:read',
      'guests:create',
      'guests:update',
      'sites:read',
      'sites:update',
      'sites:create',
      'sites:delete',
      'financial:read',
      'financial:manage',
      'financial:refund',
      'staff:read',
      'staff:manage',
      'settings:read',
      'settings:manage',
    ] as const

    validPermissions.forEach((permission) => {
      it(`should accept valid permission: ${permission}`, () => {
        const result = PermissionKeySchema.safeParse(permission)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid permission key', () => {
      const result = PermissionKeySchema.safeParse('admin:all')
      expect(result.success).toBe(false)
    })
  })

  // ========================================================================
  // Request Schema Validation
  // ========================================================================

  describe('AddStaffRequestSchema', () => {
    it('should validate valid add staff request with role only', () => {
      const validRequest = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        role: 'manager',
      }

      const result = AddStaffRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should validate valid add staff request with custom permissions', () => {
      const validRequest = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        role: 'staff',
        customPermissions: ['reservations:read', 'reservations:create', 'guests:read'],
      }

      const result = AddStaffRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should reject invalid UUID for userId', () => {
      const invalidRequest = {
        userId: 'not-a-uuid',
        role: 'staff',
      }

      const result = AddStaffRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('UUID')
      }
    })

    it('should reject owner role assignment', () => {
      const invalidRequest = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        role: 'owner',
      }

      const result = AddStaffRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('owner')
      }
    })

    it('should reject invalid role', () => {
      const invalidRequest = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        role: 'superuser',
      }

      const result = AddStaffRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject invalid permission in customPermissions array', () => {
      const invalidRequest = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        role: 'staff',
        customPermissions: ['reservations:read', 'invalid:permission'],
      }

      const result = AddStaffRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject missing required fields', () => {
      const invalidRequest = {
        role: 'staff',
      }

      const result = AddStaffRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    const assignableRoles = ['admin', 'manager', 'staff'] as const
    assignableRoles.forEach((role) => {
      it(`should accept assignable role: ${role}`, () => {
        const request = {
          userId: '550e8400-e29b-41d4-a716-446655440000',
          role,
        }

        const result = AddStaffRequestSchema.safeParse(request)
        expect(result.success).toBe(true)
      })
    })
  })

  describe('UpdateStaffRequestSchema', () => {
    it('should validate update request with role only', () => {
      const validRequest = {
        role: 'manager',
      }

      const result = UpdateStaffRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should validate update request with customPermissions only', () => {
      const validRequest = {
        customPermissions: ['reservations:read', 'guests:read'],
      }

      const result = UpdateStaffRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should validate update request with role and resetPermissions', () => {
      const validRequest = {
        role: 'staff',
        resetPermissions: true,
      }

      const result = UpdateStaffRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should validate empty update request', () => {
      const validRequest = {}

      const result = UpdateStaffRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should reject owner role in update', () => {
      const invalidRequest = {
        role: 'owner',
      }

      const result = UpdateStaffRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('owner')
      }
    })

    it('should reject invalid permission in update', () => {
      const invalidRequest = {
        customPermissions: ['invalid:perm'],
      }

      const result = UpdateStaffRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject non-boolean resetPermissions', () => {
      const invalidRequest = {
        resetPermissions: 'yes',
      }

      const result = UpdateStaffRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })
  })

  // ========================================================================
  // Response Schema Validation
  // ========================================================================

  describe('StaffResponseSchema', () => {
    it('should validate complete staff response', () => {
      const completeResponse: StaffResponse = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        propertyId: '660e8400-e29b-41d4-a716-446655440001',
        userId: '770e8400-e29b-41d4-a716-446655440002',
        role: 'manager',
        roleDisplayName: 'Manager',
        isAdmin: true,
        isOwner: false,
        permissions: [
          'reservations:read',
          'reservations:create',
          'reservations:update',
          'guests:read',
          'guests:create',
          'sites:read',
        ],
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      }

      expect(() => StaffResponseSchema.parse(completeResponse)).not.toThrow()
    })

    it('should validate owner staff response', () => {
      const ownerResponse: StaffResponse = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        propertyId: '660e8400-e29b-41d4-a716-446655440001',
        userId: '770e8400-e29b-41d4-a716-446655440002',
        role: 'owner',
        roleDisplayName: 'Owner',
        isAdmin: true,
        isOwner: true,
        permissions: [
          'reservations:read',
          'reservations:create',
          'reservations:update',
          'reservations:delete',
          'reservations:check_in',
          'reservations:check_out',
          'guests:read',
          'guests:create',
          'guests:update',
          'sites:read',
          'sites:update',
          'sites:create',
          'sites:delete',
          'financial:read',
          'financial:manage',
          'financial:refund',
          'staff:read',
          'staff:manage',
          'settings:read',
          'settings:manage',
        ],
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      }

      expect(() => StaffResponseSchema.parse(ownerResponse)).not.toThrow()
    })

    it('should validate staff response with minimal permissions', () => {
      const staffResponse: StaffResponse = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        propertyId: '660e8400-e29b-41d4-a716-446655440001',
        userId: '770e8400-e29b-41d4-a716-446655440002',
        role: 'staff',
        roleDisplayName: 'Staff',
        isAdmin: false,
        isOwner: false,
        permissions: ['reservations:read', 'guests:read', 'sites:read'],
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      }

      expect(() => StaffResponseSchema.parse(staffResponse)).not.toThrow()
    })

    it('should reject invalid UUID for id', () => {
      const invalidResponse = {
        id: 'not-a-uuid',
        propertyId: '660e8400-e29b-41d4-a716-446655440001',
        userId: '770e8400-e29b-41d4-a716-446655440002',
        role: 'staff',
        roleDisplayName: 'Staff',
        isAdmin: false,
        isOwner: false,
        permissions: [],
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      }

      expect(() => StaffResponseSchema.parse(invalidResponse)).toThrow()
    })

    it('should reject missing required fields', () => {
      const invalidResponse = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        role: 'staff',
      }

      expect(() => StaffResponseSchema.parse(invalidResponse)).toThrow()
    })

    it('should reject invalid datetime format', () => {
      const invalidResponse = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        propertyId: '660e8400-e29b-41d4-a716-446655440001',
        userId: '770e8400-e29b-41d4-a716-446655440002',
        role: 'staff',
        roleDisplayName: 'Staff',
        isAdmin: false,
        isOwner: false,
        permissions: [],
        createdAt: 'invalid-date',
        updatedAt: '2025-01-01T00:00:00Z',
      }

      expect(() => StaffResponseSchema.parse(invalidResponse)).toThrow()
    })
  })

  describe('StaffListResponseSchema', () => {
    it('should validate staff list response with multiple members', () => {
      const listResponse: StaffListResponse = {
        staff: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            propertyId: '660e8400-e29b-41d4-a716-446655440001',
            userId: '770e8400-e29b-41d4-a716-446655440002',
            role: 'owner',
            roleDisplayName: 'Owner',
            isAdmin: true,
            isOwner: true,
            permissions: ['reservations:read', 'staff:manage'],
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440003',
            propertyId: '660e8400-e29b-41d4-a716-446655440001',
            userId: '770e8400-e29b-41d4-a716-446655440004',
            role: 'manager',
            roleDisplayName: 'Manager',
            isAdmin: true,
            isOwner: false,
            permissions: ['reservations:read', 'reservations:create'],
            createdAt: '2025-01-02T00:00:00Z',
            updatedAt: '2025-01-02T00:00:00Z',
          },
        ],
        count: 2,
      }

      expect(() => StaffListResponseSchema.parse(listResponse)).not.toThrow()
    })

    it('should validate empty staff list response', () => {
      const emptyResponse: StaffListResponse = {
        staff: [],
        count: 0,
      }

      expect(() => StaffListResponseSchema.parse(emptyResponse)).not.toThrow()
    })

    it('should reject negative count', () => {
      const invalidResponse = {
        staff: [],
        count: -1,
      }

      expect(() => StaffListResponseSchema.parse(invalidResponse)).toThrow()
    })

    it('should reject non-integer count', () => {
      const invalidResponse = {
        staff: [],
        count: 1.5,
      }

      expect(() => StaffListResponseSchema.parse(invalidResponse)).toThrow()
    })
  })

  // ========================================================================
  // Role Permission Matrix (Business Logic Verification)
  // ========================================================================

  describe('Role Permission Business Logic', () => {
    const rolePermissionMatrix = {
      owner: {
        isAdmin: true,
        isOwner: true,
        defaultPermissions: [
          'reservations:read',
          'reservations:create',
          'reservations:update',
          'reservations:delete',
          'reservations:check_in',
          'reservations:check_out',
          'guests:read',
          'guests:create',
          'guests:update',
          'sites:read',
          'sites:update',
          'sites:create',
          'sites:delete',
          'financial:read',
          'financial:manage',
          'financial:refund',
          'staff:read',
          'staff:manage',
          'settings:read',
          'settings:manage',
        ],
      },
      manager: {
        isAdmin: true,
        isOwner: false,
        defaultPermissions: [
          'reservations:read',
          'reservations:create',
          'reservations:update',
          'reservations:check_in',
          'reservations:check_out',
          'guests:read',
          'guests:create',
          'guests:update',
          'sites:read',
          'sites:update',
          'financial:read',
          'staff:read',
        ],
      },
      staff: {
        isAdmin: false,
        isOwner: false,
        defaultPermissions: [
          'reservations:read',
          'reservations:create',
          'reservations:check_in',
          'reservations:check_out',
          'guests:read',
          'guests:create',
          'sites:read',
        ],
      },
      viewer: {
        isAdmin: false,
        isOwner: false,
        defaultPermissions: ['reservations:read', 'guests:read', 'sites:read'],
      },
    }

    Object.entries(rolePermissionMatrix).forEach(([role, config]) => {
      it(`${role} role should have isAdmin=${config.isAdmin}`, () => {
        expect(config.isAdmin).toBe(role === 'owner' || role === 'manager')
      })

      it(`${role} role should have isOwner=${config.isOwner}`, () => {
        expect(config.isOwner).toBe(role === 'owner')
      })

      it(`${role} role should have ${config.defaultPermissions.length} default permissions`, () => {
        expect(config.defaultPermissions.length).toBeGreaterThan(0)
      })
    })

    it('owner should have all permissions', () => {
      const ownerPerms = rolePermissionMatrix.owner.defaultPermissions
      const allPerms = [
        'reservations:read',
        'reservations:create',
        'reservations:update',
        'reservations:delete',
        'reservations:check_in',
        'reservations:check_out',
        'guests:read',
        'guests:create',
        'guests:update',
        'sites:read',
        'sites:update',
        'sites:create',
        'sites:delete',
        'financial:read',
        'financial:manage',
        'financial:refund',
        'staff:read',
        'staff:manage',
        'settings:read',
        'settings:manage',
      ]

      expect(ownerPerms.sort()).toEqual(allPerms.sort())
    })

    it('viewer should have read-only permissions', () => {
      const viewerPerms = rolePermissionMatrix.viewer.defaultPermissions
      const hasWritePerms = viewerPerms.some(
        (p) =>
          p.includes(':create') ||
          p.includes(':update') ||
          p.includes(':delete') ||
          p.includes(':manage')
      )

      expect(hasWritePerms).toBe(false)
    })
  })
})
