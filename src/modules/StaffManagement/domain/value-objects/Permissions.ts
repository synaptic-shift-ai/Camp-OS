/**
 * Permissions Value Object
 *
 * Represents the set of permissions for a staff member.
 * Permissions can be derived from roles or customized individually.
 *
 * NOTE: The authoritative authorization system lives in `src/lib/rbac/`.
 * For route-level authorization, use `requirePropertyAccess()` from `src/lib/rbac/require-access.ts`.
 * This class is a legacy domain convenience wrapper.
 */

import { ValueObject } from '@/shared/domain/ValueObject'
import type { StaffRole } from './StaffRole'

// Legacy permission keys (colon-separated). Used in the domain layer only.
export type PermissionKey =
  | 'reservations:read'
  | 'reservations:create'
  | 'reservations:update'
  | 'reservations:delete'
  | 'reservations:check_in'
  | 'reservations:check_out'
  | 'guests:read'
  | 'guests:create'
  | 'guests:update'
  | 'sites:read'
  | 'sites:update'
  | 'sites:create'
  | 'sites:delete'
  | 'financial:read'
  | 'financial:manage'
  | 'financial:refund'
  | 'staff:read'
  | 'staff:manage'
  | 'settings:read'
  | 'settings:manage'

interface PermissionsProps {
  permissions: Set<PermissionKey>
}

const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  owner: [
    'reservations:read', 'reservations:create', 'reservations:update', 'reservations:delete',
    'reservations:check_in', 'reservations:check_out',
    'guests:read', 'guests:create', 'guests:update',
    'sites:read', 'sites:update', 'sites:create', 'sites:delete',
    'financial:read', 'financial:manage', 'financial:refund',
    'staff:read', 'staff:manage',
    'settings:read', 'settings:manage',
  ],
  admin: [
    'reservations:read', 'reservations:create', 'reservations:update', 'reservations:delete',
    'reservations:check_in', 'reservations:check_out',
    'guests:read', 'guests:create', 'guests:update',
    'sites:read', 'sites:update', 'sites:create', 'sites:delete',
    'financial:read', 'financial:manage', 'financial:refund',
    'staff:read', 'staff:manage',
    'settings:read', 'settings:manage',
  ],
  manager: [
    'reservations:read', 'reservations:create', 'reservations:update',
    'reservations:check_in', 'reservations:check_out',
    'guests:read', 'guests:create', 'guests:update',
    'sites:read', 'sites:update',
    'financial:read',
    'staff:read',
    'settings:read',
  ],
  staff: [
    'reservations:read', 'reservations:create', 'reservations:update',
    'reservations:check_in', 'reservations:check_out',
    'guests:read', 'guests:create',
    'sites:read',
  ],
}

export class Permissions extends ValueObject<PermissionsProps> {
  /**
   * Get all permissions as a Set
   */
  get permissionSet(): ReadonlySet<PermissionKey> {
    return this.props.permissions
  }

  /**
   * Factory method to create from array of permission keys
   */
  public static create(permissions: PermissionKey[]): Permissions {
    return new Permissions({ permissions: new Set(permissions) })
  }

  /**
   * Create permissions from a role's default permissions
   */
  public static fromRole(role: StaffRole): Permissions {
    const rolePerms = ROLE_PERMISSIONS[role.value] || []
    return new Permissions({ permissions: new Set(rolePerms) })
  }

  /**
   * Create an empty permissions set
   */
  public static none(): Permissions {
    return new Permissions({ permissions: new Set() })
  }

  /**
   * Create with all permissions
   */
  public static all(): Permissions {
    const ownerPerms = ROLE_PERMISSIONS.owner
    return Permissions.create(ownerPerms ?? [])
  }

  /**
   * Reconstitute from persistence (JSON object or array)
   */
  public static fromPersistence(data: unknown): Permissions {
    if (!data) {
      return Permissions.none()
    }

    // Handle array format
    if (Array.isArray(data)) {
      return Permissions.create(data as PermissionKey[])
    }

    // Handle object format { permission: true/false }
    if (typeof data === 'object') {
      const perms: PermissionKey[] = []
      for (const [key, value] of Object.entries(data as Record<string, boolean>)) {
        if (value === true) {
          perms.push(key as PermissionKey)
        }
      }
      return Permissions.create(perms)
    }

    return Permissions.none()
  }

  /**
   * Check if a specific permission is granted
   */
  public has(permission: PermissionKey): boolean {
    return this.props.permissions.has(permission)
  }

  /**
   * Check if any of the given permissions are granted
   */
  public hasAny(permissions: PermissionKey[]): boolean {
    return permissions.some((p) => this.props.permissions.has(p))
  }

  /**
   * Check if all of the given permissions are granted
   */
  public hasAll(permissions: PermissionKey[]): boolean {
    return permissions.every((p) => this.props.permissions.has(p))
  }

  /**
   * Add a permission
   */
  public add(permission: PermissionKey): Permissions {
    const newPerms = new Set(this.props.permissions)
    newPerms.add(permission)
    return new Permissions({ permissions: newPerms })
  }

  /**
   * Remove a permission
   */
  public remove(permission: PermissionKey): Permissions {
    const newPerms = new Set(this.props.permissions)
    newPerms.delete(permission)
    return new Permissions({ permissions: newPerms })
  }

  /**
   * Merge with another permissions set
   */
  public merge(other: Permissions): Permissions {
    const merged = new Set([...this.props.permissions, ...other.props.permissions])
    return new Permissions({ permissions: merged })
  }

  /**
   * Convert to array for serialization
   */
  public toArray(): PermissionKey[] {
    return Array.from(this.props.permissions)
  }

  /**
   * Convert to object format for persistence
   */
  public toPersistence(): Record<PermissionKey, boolean> {
    const result: Partial<Record<PermissionKey, boolean>> = {}
    for (const perm of this.props.permissions) {
      result[perm] = true
    }
    return result as Record<PermissionKey, boolean>
  }

  /**
   * Get the count of permissions
   */
  get count(): number {
    return this.props.permissions.size
  }

  /**
   * Check if permissions set is empty
   */
  get isEmpty(): boolean {
    return this.props.permissions.size === 0
  }
}
