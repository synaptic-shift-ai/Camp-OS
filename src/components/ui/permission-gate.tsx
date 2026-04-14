'use client'

import type { ReactNode } from 'react'
import { usePermissions } from '@/hooks/use-permissions'
import type { PermissionKey } from '@/lib/rbac'
import type { EffectiveRole } from '@/lib/rbac/roles'
import type { StaffCategory } from '@/lib/rbac/staff-categories'

interface PermissionGateProps {
  children: ReactNode
  /** Specific permission key required. */
  permission?: PermissionKey
  /** Minimum effective role required. */
  minimumRole?: EffectiveRole
  /** Require at least one of these categories. */
  anyCategory?: StaffCategory[]
  /** Require any of these specific roles. */
  anyOfRoles?: EffectiveRole[]
  /** Rendered when permission check fails. Default: null (hidden). */
  fallback?: ReactNode
}

/**
 * Conditionally renders children based on the current user's permissions.
 *
 * Default behavior: HIDDEN (renders null) when permission check fails.
 * Use `fallback` prop to render a disabled element or message instead.
 */
export function PermissionGate({
  children,
  permission,
  minimumRole,
  anyCategory,
  anyOfRoles,
  fallback = null,
}: PermissionGateProps) {
  const { can, isAtLeastRole, hasCategory, isRole, isLoading } = usePermissions()

  // While loading, show nothing (safe default)
  if (isLoading) return null

  // Check minimum role
  if (minimumRole && !isAtLeastRole(minimumRole)) return <>{fallback}</>

  // Check anyOfRoles
  if (anyOfRoles && !anyOfRoles.some((r) => isRole(r))) return <>{fallback}</>

  // Check permission
  if (permission && !can(permission)) return <>{fallback}</>

  // Check category
  if (anyCategory && anyCategory.length > 0 && !anyCategory.some((c) => hasCategory(c))) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
