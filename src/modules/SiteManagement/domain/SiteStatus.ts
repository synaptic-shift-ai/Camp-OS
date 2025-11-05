/**
 * SiteStatus Enum
 *
 * Defines the operational status of a campsite.
 */
export enum SiteStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  RESERVED = 'reserved',
  NEEDS_HOUSEKEEPING = 'needs_housekeeping',
  OUT_OF_SERVICE = 'out_of_service',
  BOOKED = 'booked',
}

export const SiteStatusLabels: Record<SiteStatus, string> = {
  [SiteStatus.AVAILABLE]: 'Available',
  [SiteStatus.OCCUPIED]: 'Occupied',
  [SiteStatus.RESERVED]: 'Reserved',
  [SiteStatus.NEEDS_HOUSEKEEPING]: 'Needs Housekeeping',
  [SiteStatus.OUT_OF_SERVICE]: 'Out of Service',
  [SiteStatus.BOOKED]: 'Booked',
}

/**
 * Parse site status from string (case-insensitive)
 */
export function parseSiteStatus(value: string): SiteStatus {
  const normalized = value.toLowerCase().trim()
  const status = Object.values(SiteStatus).find((s) => s === normalized)

  if (!status) {
    throw new Error(`Invalid site status: ${value}`)
  }

  return status as SiteStatus
}

/**
 * Check if status transition is valid
 */
export function isValidStatusTransition(
  from: SiteStatus,
  to: SiteStatus
): boolean {
  // Define valid transitions
  const validTransitions: Record<SiteStatus, SiteStatus[]> = {
    [SiteStatus.AVAILABLE]: [
      SiteStatus.OCCUPIED,
      SiteStatus.RESERVED,
      SiteStatus.OUT_OF_SERVICE,
      SiteStatus.BOOKED,
    ],
    [SiteStatus.OCCUPIED]: [
      SiteStatus.NEEDS_HOUSEKEEPING,
      SiteStatus.AVAILABLE,
    ],
    [SiteStatus.RESERVED]: [
      SiteStatus.OCCUPIED,
      SiteStatus.AVAILABLE,
    ],
    [SiteStatus.NEEDS_HOUSEKEEPING]: [
      SiteStatus.AVAILABLE,
      SiteStatus.OUT_OF_SERVICE,
    ],
    [SiteStatus.OUT_OF_SERVICE]: [
      SiteStatus.AVAILABLE,
      SiteStatus.NEEDS_HOUSEKEEPING,
    ],
    [SiteStatus.BOOKED]: [
      SiteStatus.OCCUPIED,
      SiteStatus.AVAILABLE,
    ],
  }

  return validTransitions[from]?.includes(to) ?? false
}
