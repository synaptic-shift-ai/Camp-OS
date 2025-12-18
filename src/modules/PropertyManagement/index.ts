// PropertyManagement Module Barrel Export

// Domain
export { Property } from './domain/Property'
export type { IPropertyRepository } from './domain/IPropertyRepository'
export { OnboardingStatus } from './domain/OnboardingStatus'
export { PropertySettings } from './domain/PropertySettings'
export { PropertyStatus, canAcceptBookings, getPropertyStatusLabel } from './domain/PropertyStatus'
export { PropertyType } from './domain/PropertyType'
export { StripeConnectInfo } from './domain/StripeConnectInfo'
export * from './domain/events'

// Application - Commands
export { CreatePropertyCommandHandler } from './application/commands/CreatePropertyCommand'
export { UpdatePropertyCommandHandler } from './application/commands/UpdatePropertyCommand'

// Application - Queries
export { GetPropertyQueryHandler } from './application/queries/GetPropertyQuery'
export { ListPropertiesQueryHandler } from './application/queries/ListPropertiesQuery'

// Application - DTOs
export { toPropertyDTO } from './application/DTOs/PropertyDTO'

// Infrastructure
export { SupabasePropertyRepository } from './infrastructure/SupabasePropertyRepository'
