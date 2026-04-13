/**
 * StaffRole Value Object
 *
 * Represents the role of a staff member at a property.
 * Roles determine default permission sets.
 */

import { ValueObject } from '@/shared/domain/ValueObject'

export type StaffRoleType = 'owner' | 'admin' | 'manager' | 'staff'

interface StaffRoleProps {
  value: StaffRoleType
}

export class StaffRole extends ValueObject<StaffRoleProps> {
  public static readonly OWNER = new StaffRole({ value: 'owner' })
  public static readonly ADMIN = new StaffRole({ value: 'admin' })
  public static readonly MANAGER = new StaffRole({ value: 'manager' })
  public static readonly STAFF = new StaffRole({ value: 'staff' })

  /**
   * Get the role value
   */
  get value(): StaffRoleType {
    return this.props.value
  }

  /**
   * Factory method to create from string value
   *
   * @param role - Role string
   * @returns StaffRole instance
   * @throws Error if invalid role
   */
  public static fromString(role: string | null): StaffRole {
    if (!role) {
      return StaffRole.STAFF
    }

    const normalized = role.toLowerCase()

    switch (normalized) {
      case 'owner':
        return StaffRole.OWNER
      case 'admin':
      case 'property_admin':
        return StaffRole.ADMIN
      case 'manager':
        return StaffRole.MANAGER
      case 'staff':
        return StaffRole.STAFF
      case 'viewer':
        // Backward compatibility: viewer → staff
        console.warn('[StaffRole] "viewer" role is deprecated, mapping to "staff"')
        return StaffRole.STAFF
      default:
        throw new Error(`Invalid staff role: ${role}`)
    }
  }

  /**
   * Check if this role has higher authority than another
   */
  public hasHigherAuthorityThan(other: StaffRole): boolean {
    const order: StaffRoleType[] = ['staff', 'manager', 'admin', 'owner']
    return order.indexOf(this.props.value) > order.indexOf(other.props.value)
  }

  /**
   * Check if this is an admin role (owner or admin)
   */
  get isAdmin(): boolean {
    return this.props.value === 'owner' || this.props.value === 'admin'
  }

  /**
   * Check if this is the owner role
   */
  get isOwner(): boolean {
    return this.props.value === 'owner'
  }

  /**
   * Check if this role can manage staff (admin or above)
   */
  get canManageStaff(): boolean {
    return this.props.value === 'owner' || this.props.value === 'admin'
  }

  /**
   * Check if this role can manage financial data (admin or above)
   */
  get canManageFinancials(): boolean {
    return this.props.value === 'owner' || this.props.value === 'admin'
  }

  /**
   * Check if this is an elevated role (manager or above)
   */
  get isElevated(): boolean {
    return this.props.value !== 'staff'
  }

  /**
   * Get display name for the role
   */
  get displayName(): string {
    const names: Record<StaffRoleType, string> = {
      owner: 'Owner',
      admin: 'Admin',
      manager: 'Manager',
      staff: 'Staff',
    }
    return names[this.props.value]
  }

  public override toString(): string {
    return this.props.value
  }
}
