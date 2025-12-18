// CompanyManagement Module Barrel Export

// Domain - Aggregate
export { Company } from './domain/Company'

// Domain - Repository Interface
export type { ICompanyRepository } from './domain/ICompanyRepository'

// Domain - Value Objects
export { CompanyName } from './domain/value-objects/CompanyName'
export { SubscriptionPlan } from './domain/value-objects/SubscriptionPlan'
export type { SubscriptionPlanType } from './domain/value-objects/SubscriptionPlan'
export { SubscriptionStatus } from './domain/value-objects/SubscriptionStatus'
export type { SubscriptionStatusType } from './domain/value-objects/SubscriptionStatus'
export { BillingCycle } from './domain/value-objects/BillingCycle'
export type { BillingCycleType } from './domain/value-objects/BillingCycle'
export { OnboardingToken } from './domain/value-objects/OnboardingToken'

// Domain - Events
export { CompanyCreatedEvent } from './domain/events/CompanyCreatedEvent'
export { CompanyUpdatedEvent } from './domain/events/CompanyUpdatedEvent'
export { SubscriptionActivatedEvent } from './domain/events/SubscriptionActivatedEvent'
export { SubscriptionCancelledEvent } from './domain/events/SubscriptionCancelledEvent'
export { SubscriptionPlanChangedEvent } from './domain/events/SubscriptionPlanChangedEvent'
export { InviteGeneratedEvent } from './domain/events/InviteGeneratedEvent'

// Application - DTOs
export { companyToDTO } from './application/DTOs/CompanyDTO'
export type { CompanyDTO, SubscriptionDTO, OnboardingTokenDTO } from './application/DTOs/CompanyDTO'

// Application - Commands
export { CreateCompanyCommandHandler } from './application/commands/CreateCompanyCommand'
export type { CreateCompanyInput, CreateCompanyOutput } from './application/commands/CreateCompanyCommand'
export { UpdateCompanyCommandHandler } from './application/commands/UpdateCompanyCommand'
export type { UpdateCompanyInput, UpdateCompanyOutput } from './application/commands/UpdateCompanyCommand'
export { ActivateSubscriptionCommandHandler } from './application/commands/ActivateSubscriptionCommand'
export type { ActivateSubscriptionInput, ActivateSubscriptionOutput } from './application/commands/ActivateSubscriptionCommand'
export { CancelSubscriptionCommandHandler } from './application/commands/CancelSubscriptionCommand'
export type { CancelSubscriptionInput, CancelSubscriptionOutput } from './application/commands/CancelSubscriptionCommand'
export { ChangePlanCommandHandler } from './application/commands/ChangePlanCommand'
export type { ChangePlanInput, ChangePlanOutput } from './application/commands/ChangePlanCommand'
export { GenerateInviteTokenCommandHandler } from './application/commands/GenerateInviteTokenCommand'
export type { GenerateInviteTokenInput, GenerateInviteTokenOutput } from './application/commands/GenerateInviteTokenCommand'

// Application - Queries
export { GetCompanyQueryHandler } from './application/queries/GetCompanyQuery'
export type { GetCompanyInput, GetCompanyOutput } from './application/queries/GetCompanyQuery'
export { GetCompanyByOwnerQueryHandler } from './application/queries/GetCompanyByOwnerQuery'
export type { GetCompanyByOwnerInput, GetCompanyByOwnerOutput } from './application/queries/GetCompanyByOwnerQuery'
export { GetSubscriptionStatusQueryHandler } from './application/queries/GetSubscriptionStatusQuery'
export type { GetSubscriptionStatusInput, GetSubscriptionStatusOutput } from './application/queries/GetSubscriptionStatusQuery'

// Infrastructure - Repository Implementation
export { SupabaseCompanyRepository } from './infrastructure/SupabaseCompanyRepository'
