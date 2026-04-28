import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { resolveDashboardNavVisibility } from "@/lib/dashboard/dashboard-layout-context"
import { HousekeepingPageContent } from "@/components/dashboard/housekeeping/housekeeping-page-content"
import { resolveModuleActionAccess } from "@/lib/dashboard/module-action-access"
import { resolveUserPropertyAccess } from "@/lib/rbac"

type PageProps = {
  params: Promise<{ propertyId: string }>
}

type SelectOption = {
  id: string
  label: string
}

function housekeepingFallbackForCategory(
  role: "owner" | "admin" | "manager" | "staff",
  categoryName: string,
): Record<string, boolean> {
  if (role === "owner" || role === "admin") return { view: true, create: true, update: true, delete: true }
  const category = categoryName.trim().toLowerCase()
  if (role === "manager" && category === "housekeeping") {
    return { view: true, create: true, update: true, delete: true }
  }
  if (role === "staff" && category === "housekeeping") {
    return { view: true, create: false, update: false, delete: false }
  }
  return { view: false, create: false, update: false, delete: false }
}

async function getHousekeepingPageOptions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
): Promise<{ siteOptions: SelectOption[]; assigneeOptions: SelectOption[]; checklistOptions: SelectOption[] }> {
  const toCanonicalSiteTypeKey = (siteType: string | null | undefined) =>
    (siteType ?? "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\bsite\b/g, "")
      .trim()

  const { data: property } = await supabase
    .from("properties")
    .select("site_type_config")
    .eq("id", propertyId)
    .maybeSingle()

  const housekeepingSiteTypeConfig =
    (
      property?.site_type_config as
        | { housekeeping?: Record<string, boolean>; allowed_site_types?: string[] }
        | null
        | undefined
    )?.housekeeping ?? {}
  const allowedSiteTypesConfig =
    (
      property?.site_type_config as
        | { housekeeping?: Record<string, boolean>; allowed_site_types?: string[] }
        | null
        | undefined
    )?.allowed_site_types ?? []
  const canonicalHousekeepingConfig = Object.fromEntries(
    Object.entries(housekeepingSiteTypeConfig).map(([key, value]) => [
      toCanonicalSiteTypeKey(key),
      value,
    ]),
  )
  const allowedSiteTypeSet = new Set(
    Array.isArray(allowedSiteTypesConfig)
      ? allowedSiteTypesConfig.map((siteType) => toCanonicalSiteTypeKey(siteType))
      : [],
  )

  // All non-deleted sites: tasks can reference a site after turnover (e.g. status becomes available);
  // restricting to housekeeping-only would leave Edit Task with no matching SelectItem and an empty Site field.
  const { data: sites } = await supabase
    .from("sites")
    .select("id, site_number, site_name, site_type")
    .eq("property_id", propertyId)
    .is("deleted_at", null)
    .order("site_number", { ascending: true })

  const siteOptions = (sites ?? [])
    .filter((site) => {
      const siteTypeKey = toCanonicalSiteTypeKey(site.site_type as string | null | undefined)
      if (!siteTypeKey) return true
      if (allowedSiteTypeSet.size > 0 && !allowedSiteTypeSet.has(siteTypeKey)) return false
      const isAllowed = canonicalHousekeepingConfig[siteTypeKey]
      return isAllowed !== false
    })
    .map((site) => ({
      id: site.id as string,
      label: (site.site_name as string | null)?.trim() || (site.site_number as string),
    }))

  const { data: staffCategories } = await supabase
    .from("property_role_categories")
    .select("id, name")
    .eq("property_id", propertyId)
    .eq("role", "staff")

  const housekeepingCategoryIds = (staffCategories ?? [])
    .filter((category) => category.name.trim().toLowerCase() === "housekeeping")
    .map((category) => category.id as string)

  let assigneeOptions: SelectOption[] = []
  if (housekeepingCategoryIds.length > 0) {
    const { data: housekeepingStaff } = await supabase
      .from("property_staff")
      .select("id, user_id")
      .eq("property_id", propertyId)
      .eq("role", "staff")
      .eq("status", "active")
      .overlaps("role_category_id", housekeepingCategoryIds)

    const adminClient = createServiceRoleClient()
    assigneeOptions = (
      await Promise.all(
        (housekeepingStaff ?? []).map(async (staffRow) => {
          if (!staffRow.user_id) return null
          const { data, error } = await adminClient.auth.admin.getUserById(staffRow.user_id)
          if (error || !data.user) return null

          const metadata = (data.user.user_metadata ?? {}) as Record<string, unknown>
          const fullName =
            typeof metadata.full_name === "string" ? metadata.full_name.trim() : ""
          const firstName =
            typeof metadata.first_name === "string" ? metadata.first_name.trim() : ""
          const lastName =
            typeof metadata.last_name === "string" ? metadata.last_name.trim() : ""
          const fallbackName = [firstName, lastName].filter(Boolean).join(" ").trim()
          const displayName = fullName || fallbackName || data.user.email || "Staff member"

          return {
            id: staffRow.id as string,
            label: displayName,
          }
        }),
      )
    )
      .filter((option): option is SelectOption => Boolean(option))
      .sort((a, b) => a.label.localeCompare(b.label))
  }

  const { data: checklists } = await supabase
    .from("checklist")
    .select("id, name")
    .eq("property_id", propertyId)
    .order("name", { ascending: true })

  const checklistOptions = (checklists ?? []).map((row) => ({
    id: row.id as string,
    label: (row.name as string).trim(),
  }))

  return {
    siteOptions,
    assigneeOptions,
    checklistOptions,
  }
}

export default async function HousekeepingPage({ params }: PageProps) {
  const { propertyId } = await params
  const property = await getPropertyForUser(propertyId)
  if (!property) redirect("/auth/login")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const navVisibility = await resolveDashboardNavVisibility(supabase, propertyId, user.id)
  if (!navVisibility.housekeepingNavVisible) {
    redirect(`/dashboard/${propertyId}/access-denied`)
  }

  const [{ siteOptions, assigneeOptions, checklistOptions }, taskActionAccess, propertyAccess] =
    await Promise.all([
      getHousekeepingPageOptions(supabase, propertyId),
      resolveModuleActionAccess({
        supabase,
        propertyId,
        userId: user.id,
        moduleKey: "housekeeping",
        actions: ["create", "update", "delete"],
        fallbackForCategory: housekeepingFallbackForCategory,
      }),
      resolveUserPropertyAccess(supabase, propertyId, user.id),
    ])

  const showAssigneeFilter = propertyAccess?.isElevated === true

  return (
    <HousekeepingPageContent
      propertyId={propertyId}
      propertyName={property.name}
      siteOptions={siteOptions}
      assigneeOptions={assigneeOptions}
      checklistOptions={checklistOptions}
      canCreateTask={taskActionAccess.create === true}
      canEditTask={taskActionAccess.update === true}
      canDeleteTask={taskActionAccess.delete === true}
      showAssigneeFilter={showAssigneeFilter}
    />
  )
}
