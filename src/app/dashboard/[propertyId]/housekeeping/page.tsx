import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { resolveDashboardNavVisibility } from "@/lib/dashboard/dashboard-layout-context"
import { HousekeepingPageContent } from "@/components/dashboard/housekeeping/housekeeping-page-content"

type PageProps = {
  params: Promise<{ propertyId: string }>
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

  return <HousekeepingPageContent propertyName={property.name} />
}
