/**
 * PropertyStaff Aggregate Root
 *
 * Represents a staff member's assignment to a property.
 * Encapsulates role-based access control (RBAC) logic.
 */

import { AggregateRoot } from '@/shared/domain/AggregateRoot'
import { StaffRole } from './value-objects/StaffRole'
import type { StaffRoleType } from './value-objects/StaffRole'
import { Permissions } from './value-objects/Permissions'
import type { PermissionKey } from './value-objects/Permissions'
import { StaffAddedEvent } from './events/StaffAddedEvent'
import { StaffRemovedEvent } from './events/StaffRemovedEvent'
import { StaffRoleChangedEvent } from './events/StaffRoleChangedEvent'
import { StaffPermissionsUpdatedEvent } from './events/StaffPermissionsUpdatedEvent'

interface PropertyStaffProps {
  propertyId: string
  userId: string
  role: StaffRole
  permissions: Permissions
  createdAt: Date
  updatedAt: Date
}

interface CreatePropertyStaffProps {
  id: string
  propertyId: string
  userId: string
  role: StaffRoleType
  customPermissions?: PermissionKey[]
}

export class PropertyStaff extends AggregateRoot<string> {
  private _propertyId: string
  private _userId: string
  private _role: StaffRole
  private _permissions: Permissions

  private constructor(id: string, props: PropertyStaffProps) {
    super(id, props.createdAt, props.updatedAt)
    this._propertyId = props.propertyId
    this._userId = props.userId
    this._role = props.role
    this._permissions = props.permissions
  }

  // Getters
  get propertyId(): string {
    return this._propertyId
  }

  get userId(): string {
    return this._userId
  }

  get role(): StaffRole {
    return this._role
  }

  get permissions(): Permissions {
    return this._permissions
  }

  /**
   * Factory method to create a new PropertyStaff assignment
   *
   * @param props - Staff creation properties
   * @returns PropertyStaff instance
   */
  public static create(props: CreatePropertyStaffProps): PropertyStaff {
    const now = new Date()
    const role = StaffRole.fromString(props.role)

    // Use custom permissions if provided, otherwise derive from role
    const permissions = props.customPermissions
      ? Permissions.create(props.customPermissions)
      : Permissions.fromRole(role)

    const staff = new PropertyStaff(props.id, {
      propertyId: props.propertyId,
      userId: props.userId,
      role,
      permissions,
      createdAt: now,
      updatedAt: now,
    })

    staff.addDomainEvent(
      new StaffAddedEvent({
        staffId: props.id,
        propertyId: props.propertyId,
        userId: props.userId,
        role: role.value,
        permissions: permissions.toArray(),
      })
    )

    return staff
  }

  /**
   * Change the staff member's role
   *
   * @param newRole - New role to assign
   * @param changedBy - User ID of who made the change
   * @param resetPermissions - Whether to reset permissions to role defaults (default: true)
   * @throws Error if trying to assign same role
   */
  public changeRole(newRole: StaffRoleType, changedBy: string, resetPermissions = true): void {
    const newRoleVO = StaffRole.fromString(newRole)

    if (this._role.equals(newRoleVO)) {
      throw new Error('Staff member already has this role')
    }

    const previousRole = this._role
    this._role = newRoleVO

    // Optionally reset permissions to new role defaults
    if (resetPermissions) {
      this._permissions = Permissions.fromRole(newRoleVO)
    }

    this.touch()

    this.addDomainEvent(
      new StaffRoleChangedEvent({
        staffId: this.id,
        propertyId: this._propertyId,
        userId: this._userId,
        previousRole: previousRole.value,
        newRole: newRoleVO.value,
        changedBy,
      })
    )
  }

  /**
   * Update specific permissions for this staff member
   *
   * @param permissions - New set of permissions
   * @param updatedBy - User ID of who made the change
   */
  public updatePermissions(permissions: PermissionKey[], updatedBy: string): void {
    const previousPermissions = this._permissions.toArray()
    this._permissions = Permissions.create(permissions)
    this.touch()

    this.addDomainEvent(
      new StaffPermissionsUpdatedEvent({
        staffId: this.id,
        propertyId: this._propertyId,
        userId: this._userId,
        previousPermissions,
        newPermissions: permissions,
        updatedBy,
      })
    )
  }

  /**
   * Add a specific permission
   *
   * @param permission - Permission to add
   * @param updatedBy - User ID of who made the change
   */
  public addPermission(permission: PermissionKey, updatedBy: string): void {
    if (this._permissions.has(permission)) {
      return // Already has permission, no-op
    }

    const previousPermissions = this._permissions.toArray()
    this._permissions = this._permissions.add(permission)
    this.touch()

    this.addDomainEvent(
      new StaffPermissionsUpdatedEvent({
        staffId: this.id,
        propertyId: this._propertyId,
        userId: this._userId,
        previousPermissions,
        newPermissions: this._permissions.toArray(),
        updatedBy,
      })
    )
  }

  /**
   * Remove a specific permission
   *
   * @param permission - Permission to remove
   * @param updatedBy - User ID of who made the change
   */
  public removePermission(permission: PermissionKey, updatedBy: string): void {
    if (!this._permissions.has(permission)) {
      return // Doesn't have permission, no-op
    }

    const previousPermissions = this._permissions.toArray()
    this._permissions = this._permissions.remove(permission)
    this.touch()

    this.addDomainEvent(
      new StaffPermissionsUpdatedEvent({
        staffId: this.id,
        propertyId: this._propertyId,
        userId: this._userId,
        previousPermissions,
        newPermissions: this._permissions.toArray(),
        updatedBy,
      })
    )
  }

  /**
   * Reset permissions to role defaults
   *
   * @param updatedBy - User ID of who made the change
   */
  public resetPermissionsToRoleDefaults(updatedBy: string): void {
    const previousPermissions = this._permissions.toArray()
    this._permissions = Permissions.fromRole(this._role)
    this.touch()

    this.addDomainEvent(
      new StaffPermissionsUpdatedEvent({
        staffId: this.id,
        propertyId: this._propertyId,
        userId: this._userId,
        previousPermissions,
        newPermissions: this._permissions.toArray(),
        updatedBy,
      })
    )
  }

  /**
   * Mark staff as removed (for event tracking)
   * Note: Actual deletion is handled by repository
   *
   * @param removedBy - User ID of who removed the staff
   */
  public markAsRemoved(removedBy: string): void {
    this.addDomainEvent(
      new StaffRemovedEvent({
        staffId: this.id,
        propertyId: this._propertyId,
        userId: this._userId,
        role: this._role.value,
        removedBy,
      })
    )
  }

  /**
   * Check if staff member has a specific permission
   *
   * @param permission - Permission to check
   * @returns True if permission is granted
   */
  public hasPermission(permission: PermissionKey): boolean {
    return this._permissions.has(permission)
  }

  /**
   * Check if staff member has any of the given permissions
   *
   * @param permissions - Permissions to check
   * @returns True if at least one permission is granted
   */
  public hasAnyPermission(permissions: PermissionKey[]): boolean {
    return this._permissions.hasAny(permissions)
  }

  /**
   * Check if staff member has all of the given permissions
   *
   * @param permissions - Permissions to check
   * @returns True if all permissions are granted
   */
  public hasAllPermissions(permissions: PermissionKey[]): boolean {
    return this._permissions.hasAll(permissions)
  }

  /**
   * Check if this staff member can manage another staff member
   *
   * @param other - Other staff member to compare
   * @returns True if can manage
   */
  public canManage(other: PropertyStaff): boolean {
    // Can only manage staff at same property
    if (this._propertyId !== other._propertyId) {
      return false
    }

    // Must have staff:manage permission
    if (!this._permissions.has('staff:manage')) {
      return false
    }

    // Must have higher authority
    return this._role.hasHigherAuthorityThan(other._role)
  }

  /**
   * Check if this is an admin (owner or manager)
   */
  get isAdmin(): boolean {
    return this._role.isAdmin
  }

  /**
   * Check if this is the property owner
   */
  get isOwner(): boolean {
    return this._role.isOwner
  }

  /**
   * Reconstitute PropertyStaff from persistence
   *
   * @param id - Staff ID
   * @param props - All properties from database
   * @returns PropertyStaff instance
   */
  public static fromPersistence(
    id: string,
    propertyId: string,
    userId: string,
    role: StaffRole,
    permissions: Permissions,
    createdAt: Date,
    updatedAt: Date
  ): PropertyStaff {
    return new PropertyStaff(id, {
      propertyId,
      userId,
      role,
      permissions,
      createdAt,
      updatedAt,
    })
  }

  /**
   * Convert PropertyStaff to persistence format
   *
   * @returns Database row format matching property_staff table schema
   */
  public toPersistence(): {
    id: string
    property_id: string
    user_id: string
    role: string
    permissions: Record<PermissionKey, boolean>
    created_at: string
    updated_at: string
  } {
    return {
      id: this.id,
      property_id: this._propertyId,
      user_id: this._userId,
      role: this._role.value,
      permissions: this._permissions.toPersistence(),
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
    }
  }
}
