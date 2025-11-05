/**
 * PropertyType Enum
 *
 * Represents the type of campground property.
 */

export enum PropertyType {
  CAMPGROUND = 'campground',
  RV_PARK = 'rv_park',
  GLAMPING = 'glamping',
  CABIN_RESORT = 'cabin_resort',
  MIXED = 'mixed',
}

/**
 * Get human-readable label for property type
 */
export function getPropertyTypeLabel(type: PropertyType): string {
  switch (type) {
    case PropertyType.CAMPGROUND:
      return 'Campground'
    case PropertyType.RV_PARK:
      return 'RV Park'
    case PropertyType.GLAMPING:
      return 'Glamping'
    case PropertyType.CABIN_RESORT:
      return 'Cabin Resort'
    case PropertyType.MIXED:
      return 'Mixed'
    default:
      return 'Unknown'
  }
}
