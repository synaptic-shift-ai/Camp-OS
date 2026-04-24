import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { resolveDashboardNavVisibility } from "@/lib/dashboard/dashboard-layout-context"
import { resolveModuleActionAccess } from "@/lib/dashboard/module-action-access"
import { maintenanceFallbackForCategory } from "@/lib/dashboard/maintenance-module-access"
import { MaintenanceView } from "@/components/dashboard/maintenance/maintenance-view/maintenance-view"

type PageProps = {
  params: Promise<{ propertyId: string; maintenanceId: string }>
}

type SelectOption = {
  id: string
  label: string
}

async function getMaintenanceAssigneeOptions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
): Promise<SelectOption[]> {
  const { data: staffCategories } = await supabase
    .from("property_role_categories")
    .select("id, name")
    .eq("property_id", propertyId)
    .eq("role", "staff")

  const maintenanceCategoryIds = (staffCategories ?? [])
    .filter((category) => category.name.trim().toLowerCase() === "maintenance")
    .map((category) => category.id as string)

  if (maintenanceCategoryIds.length === 0) return []

  const { data: maintenanceStaff } = await supabase
    .from("property_staff")
    .select("id, user_id")
    .eq("property_id", propertyId)
    .eq("role", "staff")
    .eq("status", "active")
    .overlaps("role_category_id", maintenanceCategoryIds)

  const adminClient = createServiceRoleClient()
  const assigneeOptions = (
    await Promise.all(
      (maintenanceStaff ?? []).map(async (staffRow) => {
        if (!staffRow.user_id) return null
        const { data, error } = await adminClient.auth.admin.getUserById(staffRow.user_id)
        if (error || !data.user) return null

        const metadata = (data.user.user_metadata ?? {}) as Record<string, unknown>
        const fullName = typeof metadata.full_name === "string" ? metadata.full_name.trim() : ""
        const firstName = typeof metadata.first_name === "string" ? metadata.first_name.trim() : ""
        const lastName = typeof metadata.last_name === "string" ? metadata.last_name.trim() : ""
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

  return assigneeOptions
}

export default async function MaintenanceDetailsPage({ params }: PageProps) {
  const { propertyId, maintenanceId } = await params
  const property = await getPropertyForUser(propertyId)
  if (!property) redirect("/auth/login")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const navVisibility = await resolveDashboardNavVisibility(supabase, propertyId, user.id)
  if (!navVisibility.maintenanceNavVisible) {
    redirect(`/dashboard/${propertyId}/access-denied`)
  }

  const [assigneeOptions, actionAccess] = await Promise.all([
    getMaintenanceAssigneeOptions(supabase, propertyId),
    resolveModuleActionAccess({
      supabase,
      propertyId,
      userId: user.id,
      moduleKey: "maintenance",
      actions: [
        "update",
        "assign-wo",
        "request-onhold",
        "approve-onhold",
        "cancel-wo",
        "enter-labor-cost",
      ],
      fallbackForCategory: maintenanceFallbackForCategory,
    }),
  ])

  return (
    <MaintenanceView
      propertyId={propertyId}
      propertyName={property.name}
      maintenanceId={maintenanceId}
      assigneeOptions={assigneeOptions}
      canEditTask={actionAccess.update === true}
      canAssignWo={actionAccess["assign-wo"] === true}
      canHold={actionAccess["request-onhold"] === true}
      canResume={actionAccess["approve-onhold"] === true}
      canCancel={actionAccess["cancel-wo"] === true}
    />
  )
}
