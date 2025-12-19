/**
 * Staff API v1 - Zod Schemas
 *
 * Phase 4B: API Consolidation - Staff API
 *
 * Validation schemas for staff management API requests and responses.
 */

import { z } from 'zod'

// ============================================================================
// Enum Schemas
// ============================================================================

export const StaffRoleSchema = z.enum(['owner', 'manager', 'staff', 'viewer'])

export const PermissionKeySchema = z.enum([
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
])

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Add Staff Request
 * POST /api/v1/properties/[propertyId]/staff
 */
export const AddStaffRequestSchema = z.object({
  userId: z.string().uuid('User ID must be a valid UUID'),
  role: StaffRoleSchema.refine(
    (val) => val !== 'owner',
    { message: 'Cannot assign owner role via API. Owner is set during property creation.' }
  ),
  customPermissions: z.array(PermissionKeySchema).optional(),
})

export type AddStaffRequest = z.infer<typeof AddStaffRequestSchema>

/**
 * Update Staff Role Request
 * PATCH /api/v1/properties/[propertyId]/staff/[staffId]
 */
export const UpdateStaffRequestSchema = z.object({
  role: StaffRoleSchema.refine(
    (val) => val !== 'owner',
    { message: 'Cannot assign owner role' }
  ).optional(),
  customPermissions: z.array(PermissionKeySchema).optional(),
  resetPermissions: z.boolean().optional(),
})

export type UpdateStaffRequest = z.infer<typeof UpdateStaffRequestSchema>

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Staff Member Response
 */
export const StaffResponseSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  userId: z.string().uuid(),
  role: StaffRoleSchema,
  roleDisplayName: z.string(),
  isAdmin: z.boolean(),
  isOwner: z.boolean(),
  permissions: z.array(PermissionKeySchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type StaffResponse = z.infer<typeof StaffResponseSchema>

/**
 * Staff List Response
 * GET /api/v1/properties/[propertyId]/staff
 */
export const StaffListResponseSchema = z.object({
  staff: z.array(StaffResponseSchema),
  count: z.number().int().nonnegative(),
})

export type StaffListResponse = z.infer<typeof StaffListResponseSchema>
