import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { resolveDashboardNavVisibility } from "@/lib/dashboard/dashboard-layout-context"
import { resolveUserPropertyAccess } from "@/lib/rbac/resolve-access"

type LayoutProps = {
  children: ReactNode
  params: Promise<{ propertyId: string }>
}

function toUiRole(rawRole: string | null): 'owner' | 'admin' | 'manager' | 'staff' {
  const normalized = (rawRole ?? '').toLowerCase()
  if (normalized === 'owner') return 'owner'
  if (normalized === 'admin' || normalized === 'property_admin') return 'admin'
  if (normalized === 'manager') return 'manager'
  return 'staff'
}

function normalizeAccessPayload(
  raw: unknown,
): { moduleAccessControl?: Record<string, Record<string, boolean>> } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const maybe = raw as { moduleAccessControl?: unknown }
  if (
    !maybe.moduleAccessControl ||
    typeof maybe.moduleAccessControl !== 'object' ||
    Array.isArray(maybe.moduleAccessControl)
  ) {
    return null
  }
  return { moduleAccessControl: maybe.moduleAccessControl as Record<string, Record<string, boolean>> }
}

async function canCreateReservation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  userId: string,
): Promise<boolean> {
  const access = await resolveUserPropertyAccess(supabase, propertyId, userId)
  if (access?.isOwner) return true

  const { data: staffAssignment } = await supabase
    .from('property_staff')
    .select('role, role_category_id')
    .eq('property_id', propertyId)
    .eq('user_id', userId)
    .in('status', ['active', 'pending'])
    .maybeSingle()

  if (!staffAssignment?.role && access?.isElevated) return true
  const role = toUiRole(typeof staffAssignment?.role === 'string' ? staffAssignment.role : null)
  if (role === 'owner') return true

  const categoryIds = staffAssignment?.role_category_id ?? []
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
    return role === 'admin'
  }

  const { data: categoryRows } = await supabase
    .from('property_role_categories')
    .select('name, access')
    .eq('property_id', propertyId)
    .eq('role', role)
    .in('id', categoryIds)

  const rows = categoryRows ?? []
  if (rows.length === 0) return role === 'admin'

  const hasExplicitReservationsAccess = rows.some((row) => {
    const payload = normalizeAccessPayload(row.access)
    return Boolean(payload?.moduleAccessControl?.reservations)
  })

  if (hasExplicitReservationsAccess) {
    return rows.some((row) => {
      const payload = normalizeAccessPayload(row.access)
      return payload?.moduleAccessControl?.reservations?.create === true
    })
  }

  // Fallback defaults for category-only configs:
  // owner/admin and manager/staff front desk may create depending on role defaults.
  if (role === 'admin') return true
  return false
}

export default async function NewReservationLayout({ children, params }: LayoutProps) {
  const { propertyId } = await params
  const property = await getPropertyForUser(propertyId)
  if (!property) redirect("/auth/login")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const navVisibility = await resolveDashboardNavVisibility(supabase, propertyId, user.id)
  if (!navVisibility.moduleNavVisible.reservations) {
    redirect(`/dashboard/${propertyId}/access-denied`)
  }
  const createAllowed = await canCreateReservation(supabase, propertyId, user.id)
  if (!createAllowed) {
    redirect(`/dashboard/${propertyId}/access-denied`)
  }

  return children
}
