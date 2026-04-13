/**
 * Route guard helpers for Camp-OS RBAC.
 *
 * These functions are designed for use in Next.js API route handlers.
 * They return `NextResponse` on denial (so the caller can `return` it directly)
 * or a `ResolvedAccess` object on success.
 */

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { EffectiveRole } from './roles'
import type { PermissionKey } from './permissions'
import type { StaffCategory } from './staff-categories'
import {
  resolveUserPropertyAccess,
  type ResolvedAccess,
} from './resolve-access'
import { hasPermission } from './permissions'
import { staffHasPermission } from './staff-categories'

// ─── Requirements interface ────────────────────────────────────────────────────

export interface AccessRequirements {
  propertyId: string
  /** Minimum effective role required. Checked before permission. */
  minimumRole?: EffectiveRole
  /** Specific permission key required. */
  permission?: PermissionKey
  /** Require at least one of these categories (staff role only). */
  anyCategory?: StaffCategory[]
  /** Any of these roles — alternative to minimumRole for multi-role paths. */
  anyOfRoles?: EffectiveRole[]
}

// ─── Guard result type ─────────────────────────────────────────────────────────

type GuardResult =
  | { access: ResolvedAccess; denied: false }
  | { denied: true; response: NextResponse }

function deny(status: number, message: string): GuardResult {
  return {
    denied: true,
    response: NextResponse.json(
      { success: false, error: { code: `AUTH_${status === 404 ? '004' : '003'}`, message } },
      { status },
    ),
  }
}

// ─── Main guard function ───────────────────────────────────────────────────────

/**
 * Check property access and optional permission/category requirements.
 *
 * Usage in route handlers:
 * ```ts
 * const result = await checkPropertyAccess(supabase, userId, {
 *   propertyId,
 *   minimumRole: 'admin',
 *   permission: 'financial.refund',
 * })
 * if (result.denied) return result.response
 * const { access } = result
 * ```
 */
export async function checkPropertyAccess(
  supabase: SupabaseClient,
  userId: string,
  requirements: AccessRequirements,
): Promise<GuardResult> {
  const { propertyId, minimumRole, permission, anyCategory, anyOfRoles } = requirements

  // Resolve base access
  const access = await resolveUserPropertyAccess(supabase, propertyId, userId)
  if (!access) {
    return deny(404, 'Property not found or access denied')
  }

  // Platform admin bypasses everything
  if (access.isPlatformAdmin) {
    return { access, denied: false }
  }

  const role = access.role

  // If no specific role required, just having access is enough
  if (!minimumRole && !anyOfRoles && !permission) {
    return { access, denied: false }
  }

  // Check minimum role
  if (minimumRole && role) {
    const ROLE_RANK: Record<EffectiveRole, number> = {
      owner: 40, admin: 30, manager: 20, staff: 10,
    }
    if ((ROLE_RANK[role] ?? 0) < (ROLE_RANK[minimumRole] ?? 0)) {
      return deny(403, 'Insufficient role for this operation')
    }
  }

  // Check anyOfRoles (alternative role check)
  if (anyOfRoles && role && !anyOfRoles.includes(role)) {
    return deny(403, 'Insufficient role for this operation')
  }

  // Check permission
  if (permission && role) {
    // First check the role's built-in permissions (for manager+)
    if (hasPermission(role, permission)) {
      return { access, denied: false }
    }

    // For staff role, check if any category grants this permission
    if (role === 'staff') {
      if (staffHasPermission(access.categories, permission)) {
        return { access, denied: false }
      }
    }

    return deny(403, 'Permission denied for this operation')
  }

  // Check category requirement
  if (anyCategory && anyCategory.length > 0 && role === 'staff') {
    const hasMatch = access.categories.includes('all') ||
      anyCategory.some((cat) => access.categories.includes(cat))
    if (!hasMatch) {
      return deny(403, 'Category access required for this operation')
    }
  }

  return { access, denied: false }
}

// ─── Convenience wrappers ──────────────────────────────────────────────────────

/**
 * Verify the user can access a property (any role, owner OR active staff).
 * Returns access on success or a 404 NextResponse on denial.
 */
export async function requirePropertyMembership(
  supabase: SupabaseClient,
  userId: string,
  propertyId: string,
): Promise<ResolvedAccess | NextResponse> {
  const result = await checkPropertyAccess(supabase, userId, { propertyId })
  if (result.denied) return result.response
  return result.access
}

/**
 * Verify the user meets role/permission/category requirements for an operation.
 */
export async function requirePropertyAccess(
  supabase: SupabaseClient,
  userId: string,
  requirements: AccessRequirements,
): Promise<ResolvedAccess | NextResponse> {
  const result = await checkPropertyAccess(supabase, userId, requirements)
  if (result.denied) return result.response
  return result.access
}

/**
 * Type guard to check if the result of requirePropertyAccess / requirePropertyMembership
 * is a NextResponse (denied) or ResolvedAccess (granted).
 */
export function isDenied(result: ResolvedAccess | NextResponse): result is NextResponse {
  return result instanceof NextResponse
}
