import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { resolveDashboardNavVisibility } from "@/lib/dashboard/dashboard-layout-context"
import { HousekeepingPageContent } from "@/components/dashboard/housekeeping/housekeeping-page-content"
import { resolveModuleActionAccess } from "@/lib/dashboard/module-action-access"

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
): Promise<{ siteOptions: SelectOption[]; assigneeOptions: SelectOption[] }> {
  const { data: sites } = await supabase
    .from("sites")
    .select("id, site_number, site_name")
    .eq("property_id", propertyId)
    .eq("status", "housekeeping")
    .is("deleted_at", null)
    .order("site_number", { ascending: true })

  const siteOptions = (sites ?? []).map((site) => ({
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

  return {
    siteOptions,
    assigneeOptions,
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

  const [{ siteOptions, assigneeOptions }, taskActionAccess] = await Promise.all([
    getHousekeepingPageOptions(supabase, propertyId),
    resolveModuleActionAccess({
      supabase,
      propertyId,
      userId: user.id,
      moduleKey: "housekeeping",
      actions: ["create", "update", "delete"],
      fallbackForCategory: housekeepingFallbackForCategory,
    }),
  ])

  return (
    <HousekeepingPageContent
      propertyId={propertyId}
      propertyName={property.name}
      siteOptions={siteOptions}
      assigneeOptions={assigneeOptions}
      canCreateTask={taskActionAccess.create === true}
      canEditTask={taskActionAccess.update === true}
      canDeleteTask={taskActionAccess.delete === true}
    />
  )
}
