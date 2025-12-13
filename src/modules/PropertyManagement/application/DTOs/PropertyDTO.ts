/**
 * PropertyDTO
 *
 * Data Transfer Object for Property API responses.
 * Maps from domain entity to API-friendly format.
 *
 * CRITICAL: Includes ALL fields to prevent Oct 30 incident
 * (onboarding_completed and all related fields must be present)
 */
import type { Property } from '../../domain/Property'
import { PropertyStatus, getPropertyStatusLabel } from '../../domain/PropertyStatus'
import { PropertyType, getPropertyTypeLabel } from '../../domain/PropertyType'
import { OnboardingStatus, getOnboardingStatusLabel } from '../../domain/OnboardingStatus'

export type PropertyDTO = {
  id: string
  companyId: string
  ownerId: string | null
  name: string
  slug: string
  description: string | null
  propertyType: PropertyType | null
  propertyTypeLabel: string | null
  status: PropertyStatus
  statusLabel: string

  // Location
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  country: string | null

  // Contact
  phone: string | null
  email: string | null

  // Branding
  subdomain: string | null
  bookingPageSlug: string | null
  heroImageUrl: string | null

  // Settings
  settings: {
    checkInTime: string | null
    checkOutTime: string | null
    timezone: string | null
    cancellationPolicy: string | null
    minStayNights: number | null
    maxStayNights: number | null
    bookingLeadTimeDays: number | null
    customRules: string | null
  }

  // Amenities
  amenities: string[] | null

  // Guest Instructions
  checkInInstructions: string | null
  checkOutInstructions: string | null
  houseRules: string | null

  // Onboarding (CRITICAL - Oct 30 fix)
  onboardingStatus: OnboardingStatus
  onboardingStatusLabel: string
  onboardingCompleted: boolean // CRITICAL: Must always be present
  onboardingCompletedAt: string | null

  // Stripe Connect (CRITICAL - required for payments)
  stripeAccountId: string | null
  stripeConnectedAt: string | null
  stripeConnected: boolean

  // Capabilities
  canAcceptBookings: boolean

  // Timestamps
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

/**
 * Map Property domain entity to DTO
 *
 * CRITICAL: All fields must be explicitly mapped
 * Missing fields would be caught by TypeScript
 */
export function toPropertyDTO(property: Property): PropertyDTO {
  return {
    id: property.id,
    companyId: property.companyId,
    ownerId: property.ownerId,
    name: property.name,
    slug: property.slug,
    description: property.description,
    propertyType: property.propertyType,
    propertyTypeLabel: property.propertyType
      ? getPropertyTypeLabel(property.propertyType)
      : null,
    status: property.status,
    statusLabel: getPropertyStatusLabel(property.status),

    // Location
    address: property.address,
    city: property.city,
    state: property.state,
    zipCode: property.zipCode,
    country: property.country,

    // Contact
    phone: property.phone,
    email: property.email,

    // Branding
    subdomain: property.subdomain,
    bookingPageSlug: property.bookingPageSlug,
    heroImageUrl: property.heroImageUrl,

    // Settings
    settings: {
      checkInTime: property.settings.checkInTime,
      checkOutTime: property.settings.checkOutTime,
      timezone: property.settings.timezone,
      cancellationPolicy: property.settings.cancellationPolicy,
      minStayNights: property.settings.minStayNights,
      maxStayNights: property.settings.maxStayNights,
      bookingLeadTimeDays: property.settings.bookingLeadTimeDays,
      customRules: property.settings.customRules,
    },

    // Amenities
    amenities: property.amenities,

    // Guest Instructions
    checkInInstructions: property.checkInInstructions,
    checkOutInstructions: property.checkOutInstructions,
    houseRules: property.houseRules,

    // Onboarding (CRITICAL - Oct 30 fix)
    onboardingStatus: property.onboardingStatus,
    onboardingStatusLabel: getOnboardingStatusLabel(property.onboardingStatus),
    onboardingCompleted: property.isOnboardingComplete(), // CRITICAL
    onboardingCompletedAt: property.onboardingCompletedAt
      ? property.onboardingCompletedAt.toISOString()
      : null,

    // Stripe Connect
    stripeAccountId: property.stripeConnectInfo.accountId,
    stripeConnectedAt: property.stripeConnectInfo.connectedAt
      ? property.stripeConnectInfo.connectedAt.toISOString()
      : null,
    stripeConnected: property.stripeConnectInfo.isConnected(),

    // Capabilities
    canAcceptBookings: property.canAcceptBookings(),

    // Timestamps
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
  }
}

/**
 * Map array of Properties to DTOs
 */
export function toPropertyDTOs(properties: Property[]): PropertyDTO[] {
  return properties.map(toPropertyDTO)
}
