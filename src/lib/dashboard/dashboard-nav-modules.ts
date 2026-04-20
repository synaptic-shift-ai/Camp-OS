/**
 * Single source of truth for dashboard sidebar / navigation modules.
 * Keep in sync with icons and visibility rules in `app/dashboard/layout.tsx`.
 */
export const DASHBOARD_NAV_MODULES = [
  { key: 'overview', name: 'Overview', path: '' },
  { key: 'reservations', name: 'Reservations', path: '/reservations' },
  { key: 'sites', name: 'Sites', path: '/sites' },
  { key: 'guests', name: 'Guests', path: '/guests' },
  { key: 'payments', name: 'Payments', path: '/payments' },
  { key: 'analytics', name: 'Analytics', path: '/analytics' },
  { key: 'housekeeping', name: 'Housekeeping', path: '/housekeeping' },
  { key: 'maintenance', name: 'Maintenance', path: '/maintenance' },
  { key: 'automations', name: 'Automations', path: '/automations' },
  { key: 'staff-management', name: 'Staff Management', path: '/staff-management' },
  { key: 'auditing', name: 'Auditing', path: '/auditing' },
  { key: 'settings', name: 'Settings', path: '/settings' },
] as const

export type DashboardNavModule = (typeof DASHBOARD_NAV_MODULES)[number]

export type DashboardNavModuleKey = DashboardNavModule['key']

/**
 * Account settings page (`/dashboard/[propertyId]/account`) — Profile tab only
 * in role access (see `AccountSettingsTabs` for full account UI).
 */
export const DASHBOARD_PROFILE_MODULES = [
  { key: 'account-profile', name: 'Profile', path: '/account' },
] as const

export type DashboardProfileModule = (typeof DASHBOARD_PROFILE_MODULES)[number]

export type DashboardProfileModuleKey = DashboardProfileModule['key']

/** Main sidebar modules plus account/profile areas (staff access role control list). */
export const DASHBOARD_ROLE_ACCESS_MODULES = [
  ...DASHBOARD_NAV_MODULES,
  ...DASHBOARD_PROFILE_MODULES,
] as const

export type RoleAccessControlModule = (typeof DASHBOARD_ROLE_ACCESS_MODULES)[number]

export type RoleAccessControlModuleKey = RoleAccessControlModule['key']

/** Paths gated when `operationsModulesNavVisible` is false (matches layout filter). */
export const DASHBOARD_OPERATIONS_MODULE_PATHS = new Set<DashboardNavModule['path']>([
  '/reservations',
  '/sites',
  '/guests',
  '/payments',
  '/analytics',
  '/auditing',
])
