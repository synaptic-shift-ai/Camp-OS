import type { createClient } from "@/lib/supabase/server"
import { resolveUserPropertyAccess } from "@/lib/rbac/resolve-access"

type UiRole = "owner" | "admin" | "manager" | "staff"

type FallbackResolver = (role: UiRole, categoryName: string) => Record<string, boolean>

type ResolveModuleActionAccessInput = {
  supabase: Awaited<ReturnType<typeof createClient>>
  propertyId: string
  userId: string
  moduleKey: string
  actions: readonly string[]
  fallbackForCategory: FallbackResolver
}

function toUiRole(rawRole: string | null): UiRole {
  const normalized = (rawRole ?? "").toLowerCase()
  if (normalized === "owner") return "owner"
  if (normalized === "admin" || normalized === "property_admin") return "admin"
  if (normalized === "manager") return "manager"
  return "staff"
}

function normalizeAccessPayload(
  raw: unknown,
): { moduleAccessControl?: Record<string, Record<string, boolean>> } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const maybe = raw as { moduleAccessControl?: unknown }
  if (
    !maybe.moduleAccessControl ||
    typeof maybe.moduleAccessControl !== "object" ||
    Array.isArray(maybe.moduleAccessControl)
  ) {
    return null
  }
  return { moduleAccessControl: maybe.moduleAccessControl as Record<string, Record<string, boolean>> }
}

function buildEmptyActions(actions: readonly string[]): Record<string, boolean> {
  return Object.fromEntries(actions.map((action) => [action, false]))
}

function buildFullActions(actions: readonly string[]): Record<string, boolean> {
  return Object.fromEntries(actions.map((action) => [action, true]))
}

export async function resolveModuleActionAccess({
  supabase,
  propertyId,
  userId,
  moduleKey,
  actions,
  fallbackForCategory,
}: ResolveModuleActionAccessInput): Promise<Record<string, boolean>> {
  const resolvedAccess = await resolveUserPropertyAccess(supabase, propertyId, userId)
  if (resolvedAccess?.isOwner) {
    return buildFullActions(actions)
  }

  const { data: staffAssignment } = await supabase
    .from("property_staff")
    .select("role, role_category_id")
    .eq("property_id", propertyId)
    .eq("user_id", userId)
    .in("status", ["active", "pending"])
    .maybeSingle()

  // Elevated users with no explicit staff assignment keep full module actions.
  if (!staffAssignment?.role && resolvedAccess?.isElevated) {
    return buildFullActions(actions)
  }

  const role = toUiRole(typeof staffAssignment?.role === "string" ? staffAssignment.role : null)
  if (role === "owner") {
    return buildFullActions(actions)
  }

  const categoryIds = staffAssignment?.role_category_id ?? []
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
    return role === "admin" ? buildFullActions(actions) : buildEmptyActions(actions)
  }

  const { data: categoryRows } = await supabase
    .from("property_role_categories")
    .select("name, access")
    .eq("property_id", propertyId)
    .eq("role", role)
    .in("id", categoryIds)

  const rows = categoryRows ?? []
  if (rows.length === 0) {
    return role === "admin" ? buildFullActions(actions) : buildEmptyActions(actions)
  }

  const resolved = buildEmptyActions(actions)
  for (const row of rows) {
    const fallback = fallbackForCategory(role, row.name ?? "")
    const access = normalizeAccessPayload(row.access)
    const moduleAccess = access?.moduleAccessControl?.[moduleKey] ?? null

    for (const action of actions) {
      const hasExplicitToggle = moduleAccess != null && Object.prototype.hasOwnProperty.call(moduleAccess, action)
      const allowedForRow = hasExplicitToggle
        ? moduleAccess?.[action] === true
        : fallback[action] === true
      resolved[action] = resolved[action] || allowedForRow
    }
  }

  return resolved
}
