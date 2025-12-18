/**
 * StaffRole Value Object
 *
 * Represents the role of a staff member at a property.
 * Roles determine default permission sets.
 */

import { ValueObject } from '@/shared/domain/ValueObject'

export type StaffRoleType = 'owner' | 'manager' | 'staff' | 'viewer'

interface StaffRoleProps {
  value: StaffRoleType
}

export class StaffRole extends ValueObject<StaffRoleProps> {
  public static readonly OWNER = new StaffRole({ value: 'owner' })
  public static readonly MANAGER = new StaffRole({ value: 'manager' })
  public static readonly STAFF = new StaffRole({ value: 'staff' })
  public static readonly VIEWER = new StaffRole({ value: 'viewer' })

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
      return StaffRole.VIEWER
    }

    const normalized = role.toLowerCase() as StaffRoleType

    switch (normalized) {
      case 'owner':
        return StaffRole.OWNER
      case 'manager':
        return StaffRole.MANAGER
      case 'staff':
        return StaffRole.STAFF
      case 'viewer':
        return StaffRole.VIEWER
      default:
        throw new Error(`Invalid staff role: ${role}`)
    }
  }

  /**
   * Check if this role has higher authority than another
   */
  public hasHigherAuthorityThan(other: StaffRole): boolean {
    const order: StaffRoleType[] = ['viewer', 'staff', 'manager', 'owner']
    return order.indexOf(this.props.value) > order.indexOf(other.props.value)
  }

  /**
   * Check if this is an admin role (owner or manager)
   */
  get isAdmin(): boolean {
    return this.props.value === 'owner' || this.props.value === 'manager'
  }

  /**
   * Check if this is the owner role
   */
  get isOwner(): boolean {
    return this.props.value === 'owner'
  }

  /**
   * Check if this role can manage staff
   */
  get canManageStaff(): boolean {
    return this.props.value === 'owner' || this.props.value === 'manager'
  }

  /**
   * Check if this role can manage financial data
   */
  get canManageFinancials(): boolean {
    return this.props.value === 'owner' || this.props.value === 'manager'
  }

  /**
   * Get display name for the role
   */
  get displayName(): string {
    const names: Record<StaffRoleType, string> = {
      owner: 'Owner',
      manager: 'Manager',
      staff: 'Staff',
      viewer: 'Viewer',
    }
    return names[this.props.value]
  }

  public override toString(): string {
    return this.props.value
  }
}
