// GuestManagement Module Barrel Export

// Domain
export { Guest } from './domain/Guest'
export type { IGuestRepository } from './domain/IGuestRepository'
export * from './domain/events'
export { Address } from './domain/value-objects/Address'
export { ContactInfo } from './domain/value-objects/ContactInfo'
export { PersonName } from './domain/value-objects/PersonName'

// Application - Commands
export { CreateGuestCommandHandler } from './application/commands/CreateGuestCommand'
export { LinkStripeCustomerCommandHandler } from './application/commands/LinkStripeCustomerCommand'
export { UpdateGuestCommandHandler } from './application/commands/UpdateGuestCommand'

// Application - Queries
export { GetGuestQueryHandler } from './application/queries/GetGuestQuery'
export { ListGuestsQueryHandler } from './application/queries/ListGuestsQuery'

// Application - DTOs
export { GuestDTO } from './application/DTOs/GuestDTO'

// Infrastructure
export { SupabaseGuestRepository } from './infrastructure/SupabaseGuestRepository'
