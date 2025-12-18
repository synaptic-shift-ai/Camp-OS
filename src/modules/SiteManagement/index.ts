// SiteManagement Module Barrel Export

// Domain
export { Site } from './domain/Site'
export type { ISiteRepository } from './domain/ISiteRepository'
export { Pricing } from './domain/Pricing'
export { SiteStatus, SiteStatusLabels, parseSiteStatus, isValidStatusTransition } from './domain/SiteStatus'
export { SiteType } from './domain/SiteType'
export * from './domain/events'
export * from './domain/value-objects'

// Application - Commands
export { CreateSiteCommandHandler } from './application/commands/CreateSiteCommand'
export { UpdateSiteCommandHandler } from './application/commands/UpdateSiteCommand'
export { UpdateSiteStatusCommandHandler } from './application/commands/UpdateSiteStatusCommand'

// Application - Queries
export { GetSiteQueryHandler } from './application/queries/GetSiteQuery'
export { ListSitesQueryHandler } from './application/queries/ListSitesQuery'

// Application - DTOs
export { toSiteDTO } from './application/DTOs/SiteDTO'

// Infrastructure
export { SupabaseSiteRepository } from './infrastructure/SupabaseSiteRepository'
