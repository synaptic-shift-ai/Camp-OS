/**
 * Permission keys and role-to-permission mapping for Camp-OS RBAC.
 *
 * Each key represents a discrete operation that can be checked independently.
 * Roles inherit all permissions of lower-ranked roles.
 *
 * Staff role has NO default permissions — access is granted via staff categories.
 */

import type { EffectiveRole } from './roles'
import { roleMeetsMinimum } from './roles'

// ─── Permission keys ───────────────────────────────────────────────────────────

export type PermissionKey =
  // Global
  | 'global.view_own_profile'
  | 'global.edit_own_profile'
  | 'global.view_company'
  | 'global.edit_company'
  | 'global.change_password'
  | 'global.view_staff_list'
  | 'global.invite_staff'
  | 'global.deactivate_staff'
  | 'global.change_staff_role'
  | 'global.manage_staff_module_access'
  | 'global.view_billing'
  | 'global.manage_property_settings'
  // Reservations
  | 'reservations.read'
  | 'reservations.create'
  | 'reservations.update'
  | 'reservations.check_in'
  | 'reservations.check_out'
  | 'reservations.cancel'
  | 'reservations.refund'
  | 'reservations.extend'
  | 'reservations.modify_dates'
  | 'reservations.modify_guests'
  | 'reservations.noshow'
  | 'reservations.renew'
  // Financial
  | 'financial.view_balance'
  | 'financial.view_transactions'
  | 'financial.record_payment'
  | 'financial.create_charge'
  | 'financial.refund'
  | 'financial.configure_schedule'
  | 'financial.view_processor_config'
  | 'financial.switch_processor'
  // Guest communications
  | 'guest_comms.view_delivery_log'
  | 'guest_comms.view_all_logs'
  | 'guest_comms.edit_templates'
  | 'guest_comms.configure_branding'
  | 'guest_comms.view_opt_out_list'
  // Housekeeping
  | 'housekeeping.view_all'
  | 'housekeeping.view_assigned'
  | 'housekeeping.create_manual'
  | 'housekeeping.reassign'
  | 'housekeeping.start_complete'
  | 'housekeeping.approve_site_ready'
  | 'housekeeping.manage_checklists'
  // Maintenance
  | 'maintenance.view_all'
  | 'maintenance.view_assigned'
  | 'maintenance.create_wo'
  | 'maintenance.assign_wo'
  | 'maintenance.update_assigned'
  | 'maintenance.request_onhold'
  | 'maintenance.approve_onhold'
  | 'maintenance.view_labor_rates'
  | 'maintenance.enter_labor_cost'
  | 'maintenance.cancel_wo'
  | 'maintenance.manage_vendors'
  | 'maintenance.manage_pm_schedules'
  | 'maintenance.manage_budgets'
  | 'maintenance.view_cost_reports'
  // Gate access
  | 'gate_access.view_log'
  | 'gate_access.view_health'
  | 'gate_access.configure_vendor'
  | 'gate_access.trigger_health_check'
  | 'gate_access.log_incident'
  // Marketing & SEO
  | 'marketing_seo.view_analytics'
  | 'marketing_seo.edit_listings'
  | 'marketing_seo.manage_photos'
  | 'marketing_seo.configure_seo'
  | 'marketing_seo.manage_reviews'
  | 'marketing_seo.manage_integrations'
  | 'marketing_seo.view_campaigns'
  // Activities
  | 'activities.view'
  | 'activities.schedule'
  | 'activities.book'
  // Documentation
  | 'docs.view_guest'
  | 'docs.view_staff_sops'
  | 'docs.create_edit'
  | 'docs.publish_archive'
  | 'docs.view_acknowledgment_log'
  | 'docs.override_acknowledgment'
  // Dynamic pricing
  | 'dynamic_pricing.view_config'
  | 'dynamic_pricing.update_config'
  | 'dynamic_pricing.enable_disable'
  | 'dynamic_pricing.view_revenue'
  | 'dynamic_pricing.view_audit_log'
  // Automations
  | 'automations.view_dashboard'
  | 'automations.view_automations'
  | 'automations.view_execution_log'
  | 'automations.view_validation'
  | 'automations.view_email_templates'
  | 'automations.add_email_templates'
  | 'automations.edit_email_templates'
  | 'automations.delete_email_templates'
  | 'automations.view_system_automations'
  | 'automations.add_system_automations'
  | 'automations.edit_system_automations'
  | 'automations.delete_system_automations'
  | 'automations.add_automations'
  | 'automations.edit_automations'
  | 'automations.delete_automations'

// ─── Role → permission sets ────────────────────────────────────────────────────

/** Full set for owner: all permissions. */
const OWNER_PERMISSIONS: ReadonlySet<PermissionKey> = new Set<PermissionKey>([
  // Global
  'global.view_own_profile',
  'global.edit_own_profile',
  'global.view_company',
  'global.edit_company',
  'global.change_password',
  'global.view_staff_list',
  'global.invite_staff', 'global.deactivate_staff', 'global.change_staff_role',
  'global.view_billing', 'global.manage_property_settings',
  // Reservations
  'reservations.read', 'reservations.create', 'reservations.update',
  'reservations.check_in', 'reservations.check_out', 'reservations.cancel',
  'reservations.refund', 'reservations.extend', 'reservations.modify_dates',
  'reservations.modify_guests', 'reservations.noshow', 'reservations.renew',
  // Financial
  'financial.view_balance', 'financial.view_transactions', 'financial.record_payment',
  'financial.create_charge', 'financial.refund', 'financial.configure_schedule',
  'financial.view_processor_config', 'financial.switch_processor',
  // Guest comms
  'guest_comms.view_delivery_log', 'guest_comms.view_all_logs',
  'guest_comms.edit_templates', 'guest_comms.configure_branding', 'guest_comms.view_opt_out_list',
  // Housekeeping
  'housekeeping.view_all', 'housekeeping.view_assigned', 'housekeeping.create_manual',
  'housekeeping.reassign', 'housekeeping.start_complete', 'housekeeping.approve_site_ready',
  'housekeeping.manage_checklists',
  // Maintenance
  'maintenance.view_all', 'maintenance.view_assigned', 'maintenance.create_wo',
  'maintenance.assign_wo', 'maintenance.update_assigned', 'maintenance.request_onhold',
  'maintenance.approve_onhold', 'maintenance.view_labor_rates', 'maintenance.enter_labor_cost',
  'maintenance.cancel_wo', 'maintenance.manage_vendors', 'maintenance.manage_pm_schedules',
  'maintenance.manage_budgets', 'maintenance.view_cost_reports',
  // Gate access
  'gate_access.view_log', 'gate_access.view_health', 'gate_access.configure_vendor',
  'gate_access.trigger_health_check', 'gate_access.log_incident',
  // Marketing & SEO
  'marketing_seo.view_analytics', 'marketing_seo.edit_listings', 'marketing_seo.manage_photos',
  'marketing_seo.configure_seo', 'marketing_seo.manage_reviews', 'marketing_seo.manage_integrations',
  'marketing_seo.view_campaigns',
  // Activities
  'activities.view', 'activities.schedule', 'activities.book',
  // Documentation
  'docs.view_guest', 'docs.view_staff_sops', 'docs.create_edit',
  'docs.publish_archive', 'docs.view_acknowledgment_log', 'docs.override_acknowledgment',
  // Dynamic pricing
  'dynamic_pricing.view_config', 'dynamic_pricing.update_config', 'dynamic_pricing.enable_disable',
  'dynamic_pricing.view_revenue', 'dynamic_pricing.view_audit_log',
  // Automations
  'automations.view_dashboard', 'automations.view_automations', 'automations.view_execution_log', 'automations.view_validation',
  'automations.view_email_templates', 'automations.add_email_templates', 'automations.edit_email_templates', 'automations.delete_email_templates',
  'automations.view_system_automations', 'automations.add_system_automations', 'automations.edit_system_automations', 'automations.delete_system_automations',
  'automations.add_automations', 'automations.edit_automations', 'automations.delete_automations',
])

/** Admin permissions: full operational access minus billing/plan/account management. */
const ADMIN_PERMISSIONS: ReadonlySet<PermissionKey> = new Set<PermissionKey>([
  // Global
  'global.view_own_profile',
  'global.edit_own_profile',
  'global.view_company',
  'global.edit_company',
  'global.change_password',
  'global.view_staff_list',
  'global.invite_staff', 'global.deactivate_staff', 'global.change_staff_role',
  'global.manage_property_settings',
  // Reservations
  'reservations.read', 'reservations.create', 'reservations.update',
  'reservations.check_in', 'reservations.check_out', 'reservations.cancel',
  'reservations.refund', 'reservations.extend', 'reservations.modify_dates',
  'reservations.modify_guests', 'reservations.noshow', 'reservations.renew',
  // Financial
  'financial.view_balance', 'financial.view_transactions', 'financial.record_payment',
  'financial.create_charge', 'financial.refund', 'financial.configure_schedule',
  'financial.view_processor_config', 'financial.switch_processor',
  // Guest comms
  'guest_comms.view_delivery_log', 'guest_comms.view_all_logs',
  'guest_comms.edit_templates', 'guest_comms.configure_branding', 'guest_comms.view_opt_out_list',
  // Housekeeping
  'housekeeping.view_all', 'housekeeping.view_assigned', 'housekeeping.create_manual',
  'housekeeping.reassign', 'housekeeping.start_complete', 'housekeeping.approve_site_ready',
  'housekeeping.manage_checklists',
  // Maintenance
  'maintenance.view_all', 'maintenance.view_assigned', 'maintenance.create_wo',
  'maintenance.assign_wo', 'maintenance.update_assigned', 'maintenance.request_onhold',
  'maintenance.approve_onhold', 'maintenance.view_labor_rates', 'maintenance.enter_labor_cost',
  'maintenance.cancel_wo', 'maintenance.manage_vendors', 'maintenance.manage_pm_schedules',
  'maintenance.manage_budgets', 'maintenance.view_cost_reports',
  // Gate access
  'gate_access.view_log', 'gate_access.view_health', 'gate_access.configure_vendor',
  'gate_access.trigger_health_check', 'gate_access.log_incident',
  // Marketing & SEO
  'marketing_seo.view_analytics', 'marketing_seo.edit_listings', 'marketing_seo.manage_photos',
  'marketing_seo.configure_seo', 'marketing_seo.manage_reviews', 'marketing_seo.manage_integrations',
  'marketing_seo.view_campaigns',
  // Activities
  'activities.view', 'activities.schedule', 'activities.book',
  // Documentation
  'docs.view_guest', 'docs.view_staff_sops', 'docs.create_edit',
  'docs.publish_archive', 'docs.view_acknowledgment_log', 'docs.override_acknowledgment',
  // Dynamic pricing
  'dynamic_pricing.view_config', 'dynamic_pricing.update_config', 'dynamic_pricing.enable_disable',
  'dynamic_pricing.view_revenue', 'dynamic_pricing.view_audit_log',
  // Automations
  'automations.view_dashboard', 'automations.view_automations', 'automations.view_execution_log', 'automations.view_validation',
  'automations.view_email_templates', 'automations.add_email_templates', 'automations.edit_email_templates', 'automations.delete_email_templates',
  'automations.view_system_automations',
  'automations.add_automations', 'automations.edit_automations', 'automations.delete_automations',
])

/** Manager permissions: elevated operational access, no pricing/financial config. */
const MANAGER_PERMISSIONS: ReadonlySet<PermissionKey> = new Set<PermissionKey>([
  // Global
  'global.view_own_profile',
  'global.edit_own_profile',
  'global.view_company',
  'global.edit_company',
  'global.change_password',
  'global.view_staff_list',
  // Reservations
  'reservations.read', 'reservations.create', 'reservations.update',
  'reservations.check_in', 'reservations.check_out', 'reservations.cancel',
  'reservations.extend', 'reservations.modify_dates', 'reservations.modify_guests',
  'reservations.noshow', 'reservations.renew',
  // Financial
  'financial.view_balance', 'financial.view_transactions', 'financial.record_payment', 'financial.create_charge',
  // Guest comms
  'guest_comms.view_delivery_log', 'guest_comms.view_all_logs',
  // Housekeeping
  'housekeeping.view_all', 'housekeeping.view_assigned', 'housekeeping.create_manual',
  'housekeeping.reassign', 'housekeeping.start_complete',
  // Maintenance
  'maintenance.view_all', 'maintenance.view_assigned', 'maintenance.create_wo',
  'maintenance.assign_wo', 'maintenance.update_assigned', 'maintenance.request_onhold',
  'maintenance.approve_onhold', 'maintenance.view_labor_rates', 'maintenance.enter_labor_cost',
  // Gate access
  'gate_access.view_log', 'gate_access.view_health', 'gate_access.log_incident',
  // Marketing & SEO
  'marketing_seo.view_analytics', 'marketing_seo.edit_listings', 'marketing_seo.manage_photos',
  'marketing_seo.manage_reviews', 'marketing_seo.view_campaigns',
  // Activities
  'activities.view', 'activities.schedule', 'activities.book',
  // Documentation
  'docs.view_guest', 'docs.view_staff_sops', 'docs.override_acknowledgment',
  // Dynamic pricing
  'dynamic_pricing.view_config', 'dynamic_pricing.view_revenue',
  // Automations
  'automations.view_dashboard', 'automations.view_automations', 'automations.view_execution_log', 'automations.view_validation',
  'automations.view_email_templates', 'automations.view_system_automations',
])

/**
 * Staff base permissions.
 *
 * By design, staff have NO operational permissions by default.
 * All access is granted through staff categories (front_desk, housekeeping, etc.).
 * This set intentionally only contains global profile permissions.
 */
const STAFF_PERMISSIONS: ReadonlySet<PermissionKey> = new Set<PermissionKey>([
  'global.view_own_profile',
  'global.change_password',
  'docs.view_guest',
])

// ─── Permission look-up ────────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Readonly<Record<EffectiveRole, ReadonlySet<PermissionKey>>> = {
  owner: OWNER_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
  staff: STAFF_PERMISSIONS,
}

/** Get the full permission set for a given role. */
export function getPermissionsForRole(role: EffectiveRole): ReadonlySet<PermissionKey> {
  return ROLE_PERMISSIONS[role] ?? STAFF_PERMISSIONS
}

/** Check whether a role has a specific permission. */
export function hasPermission(role: EffectiveRole, key: PermissionKey): boolean {
  return getPermissionsForRole(role).has(key)
}

/** Check whether a role has any of the given permissions. */
export function hasAnyPermission(role: EffectiveRole, keys: readonly PermissionKey[]): boolean {
  const perms = getPermissionsForRole(role)
  return keys.some((k) => perms.has(k))
}

/** Check whether a role has all of the given permissions. */
export function hasAllPermissions(role: EffectiveRole, keys: readonly PermissionKey[]): boolean {
  const perms = getPermissionsForRole(role)
  return keys.every((k) => perms.has(k))
}

/**
 * Check if a role meets a minimum authority level AND has the specific permission.
 * Useful for operations that require both a minimum role AND a permission.
 */
export function roleCanPerform(role: EffectiveRole, minimumRole: EffectiveRole, key: PermissionKey): boolean {
  return roleMeetsMinimum(role, minimumRole) && hasPermission(role, key)
}
