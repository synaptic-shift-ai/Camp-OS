// StaffManagement Module Barrel Export

// Domain - Aggregate
export { PropertyStaff } from './domain/PropertyStaff'

// Domain - Repository Interface
export type { IPropertyStaffRepository } from './domain/IPropertyStaffRepository'

// Domain - Events
export * from './domain/events'

// Domain - Value Objects
export { StaffRole } from './domain/value-objects/StaffRole'
export type { StaffRoleType } from './domain/value-objects/StaffRole'
export { Permissions } from './domain/value-objects/Permissions'
export type { PermissionKey } from './domain/value-objects/Permissions'

// Application - Commands
export { AddStaffCommandHandler } from './application/commands/AddStaffCommand'
export type { AddStaffInput, AddStaffOutput } from './application/commands/AddStaffCommand'
export { RemoveStaffCommandHandler } from './application/commands/RemoveStaffCommand'
export type { RemoveStaffInput, RemoveStaffOutput } from './application/commands/RemoveStaffCommand'
export { UpdateStaffRoleCommandHandler } from './application/commands/UpdateStaffRoleCommand'
export type {
  UpdateStaffRoleInput,
  UpdateStaffRoleOutput,
} from './application/commands/UpdateStaffRoleCommand'
export { UpdateStaffPermissionsCommandHandler } from './application/commands/UpdateStaffPermissionsCommand'
export type {
  UpdateStaffPermissionsInput,
  UpdateStaffPermissionsOutput,
} from './application/commands/UpdateStaffPermissionsCommand'

// Application - Queries
export { GetPropertyStaffQueryHandler } from './application/queries/GetPropertyStaffQuery'
export type {
  GetPropertyStaffInput,
  GetPropertyStaffOutput,
} from './application/queries/GetPropertyStaffQuery'
export { ListPropertyStaffQueryHandler } from './application/queries/ListPropertyStaffQuery'
export type {
  ListPropertyStaffInput,
  ListPropertyStaffOutput,
} from './application/queries/ListPropertyStaffQuery'
export { GetStaffPermissionsQueryHandler } from './application/queries/GetStaffPermissionsQuery'
export type {
  GetStaffPermissionsInput,
  GetStaffPermissionsOutput,
} from './application/queries/GetStaffPermissionsQuery'

// Application - DTOs
export type { PropertyStaffDTO } from './application/DTOs/PropertyStaffDTO'
export { propertyStaffToDTO } from './application/DTOs/PropertyStaffDTO'

// Infrastructure
export { SupabasePropertyStaffRepository } from './infrastructure/SupabasePropertyStaffRepository'
