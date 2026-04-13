import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { redirectIfOperationsDashboardModulesForbidden } from "@/lib/dashboard/operations-modules-page-access"

type LayoutProps = {
  children: ReactNode
  params: Promise<{ propertyId: string }>
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
  await redirectIfOperationsDashboardModulesForbidden(supabase, propertyId, user.id)

  return children
}
