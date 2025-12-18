/**
 * BookingEngine Domain Services
 *
 * Domain services encapsulate domain logic that doesn't naturally
 * belong to a single entity or value object.
 */

// Availability Service
export type {
  IAvailabilityService,
  SiteAvailabilityResult,
  MultiSiteAvailabilityResult,
  AvailabilityCheckOptions,
  UnavailableReason,
} from './IAvailabilityService'

export { AvailabilityService } from './AvailabilityService'

// Pricing Calculator
export type {
  IPricingCalculator,
  PricingInput,
  PricingBreakdown,
  PricingOptions,
  SitePricingConfig,
  // PriceLineItem is internal to services - policies exports a more complex version
} from './IPricingCalculator'

export { PricingCalculator } from './PricingCalculator'
