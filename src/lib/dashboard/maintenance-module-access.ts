/**
 * Fallback module toggles for `resolveModuleActionAccess` when a role category
 * has no explicit `moduleAccessControl.maintenance` entry for a given action.
 */

export type MaintenanceModuleUiRole = "owner" | "admin" | "manager" | "staff"

export function maintenanceFallbackForCategory(
  role: MaintenanceModuleUiRole,
  categoryName: string,
): Record<string, boolean> {
  if (role === "owner" || role === "admin") {
    return {
      view: true,
      create: true,
      update: true,
      delete: true,
      "assign-wo": true,
      "manage-vendors": true,
      "manage-pm-schedules": true,
      "view-cost-reports": true,
      "enter-labor-cost": true,
    }
  }
  const category = categoryName.trim().toLowerCase()
  if (role === "manager" && category === "maintenance") {
    return {
      view: true,
      create: true,
      update: true,
      delete: true,
      "assign-wo": true,
      "manage-vendors": true,
      "manage-pm-schedules": true,
      "view-cost-reports": true,
      "enter-labor-cost": true,
    }
  }
  if (role === "staff" && category === "maintenance") {
    return {
      view: true,
      create: true,
      update: true,
      delete: false,
      "assign-wo": false,
      "manage-vendors": false,
      "manage-pm-schedules": false,
      "view-cost-reports": false,
      "enter-labor-cost": false,
    }
  }
  return {
    view: false,
    create: false,
    update: false,
    delete: false,
    "assign-wo": false,
    "manage-vendors": false,
    "manage-pm-schedules": false,
    "view-cost-reports": false,
    "enter-labor-cost": false,
  }
}
