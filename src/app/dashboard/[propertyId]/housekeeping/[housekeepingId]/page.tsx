import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { resolveDashboardNavVisibility } from "@/lib/dashboard/dashboard-layout-context"
import { resolveModuleActionAccess } from "@/lib/dashboard/module-action-access"
import { HousekeepingView } from "@/components/dashboard/housekeeping/housekeeping-view/housekeeping-view"

type PageProps = {
  params: Promise<{ propertyId: string; housekeepingId: string }>
}

type SelectOption = {
  id: string
  label: string
}

function authUserDisplayLabel(
  user: {
    email?: string | null
    user_metadata?: Record<string, unknown> | null
  },
  fallback = "Team member",
): string {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  const fullName = typeof metadata.full_name === "string" ? metadata.full_name.trim() : ""
  const firstName = typeof metadata.first_name === "string" ? metadata.first_name.trim() : ""
  const lastName = typeof metadata.last_name === "string" ? metadata.last_name.trim() : ""
  const fallbackName = [firstName, lastName].filter(Boolean).join(" ").trim()
  return fullName || fallbackName || user.email?.trim() || fallback
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

async function getHousekeepingAssigneeOptions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
): Promise<SelectOption[]> {
  const { data: staffCategories } = await supabase
    .from("property_role_categories")
    .select("id, name")
    .eq("property_id", propertyId)
    .eq("role", "staff")

  const housekeepingCategoryIds = (staffCategories ?? [])
    .filter((category) => category.name.trim().toLowerCase() === "housekeeping")
    .map((category) => category.id as string)

  if (housekeepingCategoryIds.length === 0) return []

  const { data: housekeepingStaff } = await supabase
    .from("property_staff")
    .select("id, user_id")
    .eq("property_id", propertyId)
    .eq("role", "staff")
    .eq("status", "active")
    .overlaps("role_category_id", housekeepingCategoryIds)

  const adminClient = createServiceRoleClient()
  const assigneeOptions = (
    await Promise.all(
      (housekeepingStaff ?? []).map(async (staffRow) => {
        if (!staffRow.user_id) return null
        const { data, error } = await adminClient.auth.admin.getUserById(staffRow.user_id)
        if (error || !data.user) return null

        return {
          id: staffRow.id as string,
          label: authUserDisplayLabel(data.user, "Staff member"),
        }
      }),
    )
  )
    .filter((option): option is SelectOption => Boolean(option))
    .sort((a, b) => a.label.localeCompare(b.label))

  return assigneeOptions
}

async function getPropertyUserDisplayNameById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  sessionUser: {
    id: string
    email?: string | null
    user_metadata?: Record<string, unknown> | null
  },
): Promise<Record<string, string>> {
  const byId: Record<string, string> = {}
  const adminClient = createServiceRoleClient()

  const { data: sessionAuth, error: sessionAuthError } = await adminClient.auth.admin.getUserById(
    sessionUser.id,
  )
  if (!sessionAuthError && sessionAuth?.user) {
    byId[sessionUser.id] = authUserDisplayLabel(sessionAuth.user)
  } else {
    byId[sessionUser.id] = authUserDisplayLabel(sessionUser)
  }

  const { data: staffRows } = await supabase
    .from("property_staff")
    .select("user_id")
    .eq("property_id", propertyId)
    .eq("status", "active")
    .not("user_id", "is", null)

  const userIds = [
    ...new Set((staffRows ?? []).map((row) => row.user_id as string).filter(Boolean)),
  ]

  for (const userId of userIds) {
    if (byId[userId]) continue
    const { data, error } = await adminClient.auth.admin.getUserById(userId)
    if (error || !data?.user) continue
    byId[userId] = authUserDisplayLabel(data.user)
  }

  return byId
}

export default async function HousekeepingDetailsPage({ params }: PageProps) {
  const { propertyId, housekeepingId } = await params
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

  const [assigneeOptions, taskActionAccess, userDisplayNameById] = await Promise.all([
    getHousekeepingAssigneeOptions(supabase, propertyId),
    resolveModuleActionAccess({
      supabase,
      propertyId,
      userId: user.id,
      moduleKey: "housekeeping",
      actions: ["update"],
      fallbackForCategory: housekeepingFallbackForCategory,
    }),
    getPropertyUserDisplayNameById(supabase, propertyId, user),
  ])

  return (
    <HousekeepingView
      propertyId={propertyId}
      propertyName={property.name}
      housekeepingId={housekeepingId}
      assigneeOptions={assigneeOptions}
      userDisplayNameById={userDisplayNameById}
      canEditTask={taskActionAccess.update === true}
    />
  )
}
