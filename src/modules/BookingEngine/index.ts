// BookingEngine Module Barrel Export

// Domain
export { Reservation, ReservationStatus, PaymentStatus } from './domain/Reservation'
export type { IReservationRepository } from './domain/IReservationRepository'
export * from './domain/events'
export { DateRange } from './domain/value-objects/DateRange'
export { MoneyAmount } from './domain/value-objects/MoneyAmount'
export { ConfirmationNumber } from './domain/value-objects/ConfirmationNumber'
export { OccupancyInfo } from './domain/value-objects/OccupancyInfo'

// Application - Commands
export { CancelReservationCommandHandler } from './application/commands/CancelReservationCommand'
export { CheckInGuestCommandHandler } from './application/commands/CheckInGuestCommand'
export { CheckOutGuestCommandHandler } from './application/commands/CheckOutGuestCommand'
export { ConfirmReservationCommandHandler } from './application/commands/ConfirmReservationCommand'
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
