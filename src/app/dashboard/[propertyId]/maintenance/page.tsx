import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { canAccessMaintenanceModule, resolveDashboardAccess } from "@/lib/rbac/dashboard-guards"

type PageProps = {
  params: Promise<{ propertyId: string }>
}

export default async function MaintenancePage({ params }: PageProps) {
  const { propertyId } = await params
  const property = await getPropertyForUser(propertyId)
  if (!property) redirect("/auth/login")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const access = await resolveDashboardAccess(supabase, propertyId, user.id)
  if (!access || !canAccessMaintenanceModule(access)) {
    redirect(`/dashboard/${propertyId}/access-denied`)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight sm:text-3xl">Maintenance</h1>
        <p className="text-sm text-muted-foreground sm:text-base">{property.name}</p>
      </div>
      <div className="border border-border/80 bg-card/50 p-4 text-sm text-muted-foreground">
        Maintenance module is ready for assigned maintenance staff.
      </div>
    </div>
  )
}
