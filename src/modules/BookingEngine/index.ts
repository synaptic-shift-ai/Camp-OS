// BookingEngine Module Barrel Export

// Domain
export { Reservation, ReservationStatus, PaymentStatus } from './domain/Reservation'
export type { IReservationRepository } from './domain/IReservationRepository'
export * from './domain/events'
export { DateRange } from './domain/value-objects/DateRange'
export { MoneyAmount } from './domain/value-objects/MoneyAmount'
export { ConfirmationNumber } from './domain/value-objects/ConfirmationNumber'
export { OccupancyInfo } from './domain/value-objects/OccupancyInfo'

// Domain - Policies (interfaces)
export type {
  IConfirmationPolicy,
  ConfirmationContext,
  PolicyResult,
  ConfirmationDenialCode,
  IPricingStrategy,
  PricingContext,
  PricingResult,
  PriceLineItem,
  PaymentIntent,
  IPriceAdjustment,
  AdjustmentContext,
  AdjustmentResult,
  AdjustmentConfig,
  IStrategyProvider,
  IStrategyRegistry,
  PropertyStrategyConfig,
} from './domain/policies'

// Domain - Policy Implementations
export {
  FullPaymentPolicy,
  MinimumDepositPolicy,
  NoPaymentPolicy,
} from './domain/policies/implementations'
export type { MinimumDepositPolicyConfig } from './domain/policies/implementations'

// Domain - Services
export type {
  IAvailabilityService,
  SiteAvailabilityResult,
  MultiSiteAvailabilityResult,
  AvailabilityCheckOptions,
  UnavailableReason,
  IPricingCalculator,
  PricingInput,
  PricingBreakdown,
  PricingOptions,
  SitePricingConfig,
  // Note: PriceLineItem is exported from ./domain/policies
} from './domain/services'
export { AvailabilityService, PricingCalculator } from './domain/services'

// Application - Commands
export { CancelReservationCommandHandler } from './application/commands/CancelReservationCommand'
export { CheckInGuestCommandHandler } from './application/commands/CheckInGuestCommand'
export { CheckOutGuestCommandHandler } from './application/commands/CheckOutGuestCommand'
export {
  ConfirmReservationCommandHandler,
  type ConfirmReservationDto,
  type ConfirmReservationResult,
  type ConfirmReservationError,
  type ConfirmReservationOutput,
} from './application/commands/ConfirmReservationCommand'
export { CreateManualReservationCommandHandler } from './application/commands/CreateManualReservationCommand'
export { CreateReservationCommandHandler } from './application/commands/CreateReservationCommand'
export { RecordPaymentCommandHandler } from './application/commands/RecordPaymentCommand'

// Application - Queries
export { CheckSiteAvailabilityQueryHandler } from './application/queries/CheckSiteAvailabilityQuery'
export { GetReservationQueryHandler } from './application/queries/GetReservationQuery'
export { ListReservationsQueryHandler } from './application/queries/ListReservationsQuery'

// Application - DTOs (export functions, not types)
export { toReservationDTO } from './application/DTOs/ReservationDTO'

// Infrastructure
export { SupabaseReservationRepository } from './infrastructure/SupabaseReservationRepository'
export {
  DefaultStrategyProvider,
  defaultStrategyProvider,
  ConfirmationPolicyType,
  DEFAULT_PROPERTY_CONFIG,
  type ConfirmationPolicyTypeName,
} from './infrastructure/DefaultStrategyProvider'
