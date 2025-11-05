/**
 * PropertyStatus Enum
 *
 * Represents the operational status of a property.
 */

export enum PropertyStatus {
  /**
   * Property is active and accepting bookings
   */
  ACTIVE = 'active',

  /**
   * Property is inactive (not accepting bookings)
   */
  INACTIVE = 'inactive',

  /**
   * Property is temporarily closed
   */
  CLOSED = 'closed',

  /**
   * Property is in draft state (onboarding not complete)
   */
  DRAFT = 'draft',
}

/**
 * Check if property can accept bookings
 */
export function canAcceptBookings(status: PropertyStatus): boolean {
  return status === PropertyStatus.ACTIVE
}

/**
 * Get human-readable label for status
 */
export function getPropertyStatusLabel(status: PropertyStatus): string {
  switch (status) {
    case PropertyStatus.ACTIVE:
      return 'Active'
    case PropertyStatus.INACTIVE:
      return 'Inactive'
    case PropertyStatus.CLOSED:
      return 'Closed'
    case PropertyStatus.DRAFT:
      return 'Draft'
    default:
      return 'Unknown'
  }
}
