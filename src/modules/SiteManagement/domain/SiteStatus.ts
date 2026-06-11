/**
 * SiteStatus Enum
 *
 * Defines the operational status of a campsite.
 * IMPORTANT: Must match database schema exactly (sites.status CHECK constraint)
 */
export enum SiteStatus {
  AVAILABLE = 'available',
  RESERVED = 'reserved',
  BOOKED = 'booked',
  OCCUPIED = 'occupied',
  HOUSEKEEPING = 'housekeeping',
  MAINTENANCE = 'maintenance',
  UNAVAILABLE = 'unavailable',
}

export const SiteStatusLabels: Record<SiteStatus, string> = {
  [SiteStatus.AVAILABLE]: 'Available',
  [SiteStatus.RESERVED]: 'Reserved',
  [SiteStatus.BOOKED]: 'Booked',
  [SiteStatus.OCCUPIED]: 'Occupied',
  [SiteStatus.HOUSEKEEPING]: 'Housekeeping',
  [SiteStatus.MAINTENANCE]: 'Maintenance',
  [SiteStatus.UNAVAILABLE]: 'Unavailable',
}

const LEGACY_STATUS_ALIASES: Record<string, SiteStatus> = {
  needs_housekeeping: SiteStatus.HOUSEKEEPING,
  out_of_service: SiteStatus.UNAVAILABLE,
}

/**
 * Parse site status from string (case-insensitive)
 */
export function parseSiteStatus(value: string): SiteStatus {
  const normalized = value.toLowerCase().trim()
  const status =
    Object.values(SiteStatus).find((s) => s === normalized) ??
    LEGACY_STATUS_ALIASES[normalized]

  if (!status) {
    throw new Error(`Invalid site status: ${value}`)
  }

  return status
}

/**
 * Check if status transition is valid
 */
export function isValidStatusTransition(
  from: SiteStatus,
  to: SiteStatus
): boolean {
  const validTransitions: Record<SiteStatus, SiteStatus[]> = {
    [SiteStatus.AVAILABLE]: [
      SiteStatus.OCCUPIED,
      SiteStatus.RESERVED,
      SiteStatus.BOOKED,
      SiteStatus.MAINTENANCE,
      SiteStatus.UNAVAILABLE,
    ],
    [SiteStatus.OCCUPIED]: [
      SiteStatus.HOUSEKEEPING,
      SiteStatus.AVAILABLE,
    ],
    [SiteStatus.RESERVED]: [
      SiteStatus.OCCUPIED,
      SiteStatus.AVAILABLE,
      SiteStatus.BOOKED,
    ],
    [SiteStatus.BOOKED]: [
      SiteStatus.OCCUPIED,
      SiteStatus.AVAILABLE,
    ],
    [SiteStatus.HOUSEKEEPING]: [
      SiteStatus.AVAILABLE,
      SiteStatus.MAINTENANCE,
      SiteStatus.UNAVAILABLE,
    ],
    [SiteStatus.MAINTENANCE]: [
      SiteStatus.AVAILABLE,
      SiteStatus.HOUSEKEEPING,
    ],
    [SiteStatus.UNAVAILABLE]: [
      SiteStatus.AVAILABLE,
      SiteStatus.HOUSEKEEPING,
      SiteStatus.MAINTENANCE,
    ],
  }

  return validTransitions[from]?.includes(to) ?? false
}
