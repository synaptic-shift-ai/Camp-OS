/**
 * Core access resolver for Camp-OS RBAC.
 *
 * Resolves the current user's role, company, and staff categories for a property
 * in a single pass. Follows the proven `verifyPropertyAccess()` pattern from
 * staff-management-queries.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { EffectiveRole } from './roles'
import { toEffectiveRole, isDbRole } from './roles'
import type { StaffCategory } from './staff-categories'
import { normaliseCategories } from './staff-categories'

// ─── Resolved access type ──────────────────────────────────────────────────────

export interface ResolvedAccess {
  userId: string
  propertyId: string
  companyId: string | null
  /** Normalised role for application logic (property_admin → admin). */
  role: EffectiveRole | null
  /** Original raw role from the database. */
  rawRole: string | null
  /** Staff categories assigned to the user. Empty if none or non-staff. */
  categories: StaffCategory[]
  /** True when user is the company owner (companies.owner_id === userId). */
  isOwner: boolean
  /** True for owner, admin, or manager roles. */
  isElevated: boolean
  /** True when user has a platform_admin flag in user_metadata. */
  isPlatformAdmin: boolean
}

// ─── Category name resolution ──────────────────────────────────────────────────

/**
 * Resolve category names from `property_role_categories` UUIDs.
 *
 * The `property_staff.role_category_id` column stores an array of UUIDs
 * referencing `property_role_categories.id`. This function fetches the
 * corresponding category names and normalises them.
 */
async function resolveCategoryNames(
  supabase: SupabaseClient,
  categoryIds: string[] | null | undefined,
  propertyId: string,
): Promise<StaffCategory[]> {
  if (!categoryIds || categoryIds.length === 0) return []

  const { data } = await supabase
    .from('property_role_categories')
    .select('name')
    .eq('property_id', propertyId)
    .in('id', categoryIds)

  if (!data || data.length === 0) return []

  const normalizedNames = data.map((row) => {
    const rawName = typeof row.name === 'string' ? row.name.trim().toLowerCase() : ''
    return rawName.replace(/[\s-]+/g, '_')
  })

  return normaliseCategories(normalizedNames)
}

// ─── Resolver ──────────────────────────────────────────────────────────────────

/**
 * Resolve a user's access to a property.
 *
 * Returns `null` when the user has no access to the property.
 * Throws no errors — callers should treat `null` as "not found / 404".
 */
export async function resolveUserPropertyAccess(
  supabase: SupabaseClient,
  propertyId: string,
  userId: string,
): Promise<ResolvedAccess | null> {
  // 1. Get property → company
  const { data: property } = await supabase
    .from('properties')
    .select('company_id, owner_id')
    .eq('id', propertyId)
    .maybeSingle()

  if (!property) return null

  // 2. Check if user is the company owner
  const companyId: string | null = property.company_id
  const isOwner = property.owner_id === userId

  if (isOwner) {
    return {
      userId,
      propertyId,
      companyId,
      role: 'owner',
      rawRole: 'owner',
      categories: [],
      isOwner: true,
      isElevated: true,
      isPlatformAdmin: false,
    }
  }

  // 3. Check company ownership via companies table
  if (companyId) {
    const { data: company } = await supabase
      .from('companies')
      .select('owner_id')
      .eq('id', companyId)
      .maybeSingle()

    if (company?.owner_id === userId) {
      return {
        userId,
        propertyId,
        companyId,
        role: 'owner',
        rawRole: 'owner',
        categories: [],
        isOwner: true,
        isElevated: true,
        isPlatformAdmin: false,
      }
    }
  }

  // 4. Check property_staff assignment
  const { data: staffRow } = await supabase
    .from('property_staff')
    .select('role, role_category_id')
    .eq('property_id', propertyId)
    .eq('user_id', userId)
    .in('status', ['active', 'pending'])
    .maybeSingle()

  if (!staffRow?.role) return null

  const rawRole = staffRow.role as string
  const effectiveRole = isDbRole(rawRole) ? toEffectiveRole(rawRole) : 'staff'
  const categories = await resolveCategoryNames(supabase, staffRow.role_category_id, propertyId)

  // Backward compatibility: staff with no categories get 'all' category
  // This ensures existing staff assignments aren't suddenly locked out
  const resolvedCategories = effectiveRole === 'staff' && categories.length === 0
    ? ['all' as StaffCategory]
    : categories

  return {
    userId,
    propertyId,
    companyId,
    role: effectiveRole,
    rawRole,
    categories: resolvedCategories,
    isOwner: false,
    isElevated: effectiveRole !== 'staff',
    isPlatformAdmin: false,
  }
}

/**
 * Resolve user access or throw a structured error.
 *
 * This is a convenience wrapper for use in route handlers where you want
 * to short-circuit with a 404 if the user has no access.
 *
 * For platform admin detection, pass `userMetadata` and this function will
 * set `isPlatformAdmin: true` when `userMetadata.user_type === 'platform_admin'`.
 */
export async function resolveUserPropertyAccessOrThrow(
  supabase: SupabaseClient,
  propertyId: string,
  userId: string,
  userMetadata?: Record<string, unknown> | null,
): Promise<ResolvedAccess> {
  const access = await resolveUserPropertyAccess(supabase, propertyId, userId)

  if (!access) {
    throw new AccessDeniedError('Property not found or access denied', 404)
  }

  // Check platform admin flag
  if (userMetadata && typeof userMetadata.user_type === 'string' && userMetadata.user_type === 'platform_admin') {
    access.isPlatformAdmin = true
  }

  return access
}

// ─── Error type ────────────────────────────────────────────────────────────────

export class AccessDeniedError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 403,
  ) {
    super(message)
    this.name = 'AccessDeniedError'
  }
}
