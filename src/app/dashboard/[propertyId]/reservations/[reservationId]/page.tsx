import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { resolveDashboardNavVisibility } from "@/lib/dashboard/dashboard-layout-context"
import { ReservationLedgerPage } from "@/components/dashboard/reservations/reservation-ledger-page"

type PageProps = {
  params: Promise<{ propertyId: string; reservationId: string }>
}

export default async function ReservationLedgerRoute({ params }: PageProps) {
  const { propertyId, reservationId } = await params

  const property = await getPropertyForUser(propertyId)
  if (!property) redirect("/auth/login")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const navVisibility = await resolveDashboardNavVisibility(supabase, propertyId, user.id)
  if (!navVisibility.moduleNavVisible?.reservations) {
    redirect(`/dashboard/${propertyId}/access-denied`)
  }

  return <ReservationLedgerPage propertyId={propertyId} reservationId={reservationId} />
}

