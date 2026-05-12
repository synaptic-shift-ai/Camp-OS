import { createClient } from "@/lib/supabase/server"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { resolveDashboardNavVisibility } from "@/lib/dashboard/dashboard-layout-context"
import { GuestCommunicationPageContent } from "@/components/dashboard/guest-communication/guest-communication-page-content"
import { redirect } from "next/navigation"

type PageProps = {
  params: Promise<{ propertyId: string }>
}

export default async function GuestCommunicationPage({ params }: PageProps) {
  const { propertyId } = await params
  const property = await getPropertyForUser(propertyId)
  if (!property) redirect("/auth/login")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const navVisibility = await resolveDashboardNavVisibility(supabase, propertyId, user.id)
  if (!navVisibility.moduleNavVisible["guest-communication"]) {
    redirect(`/dashboard/${propertyId}/access-denied`)
  }

  return (
    <GuestCommunicationPageContent propertyId={propertyId} propertyName={property.name} />
  )
}
