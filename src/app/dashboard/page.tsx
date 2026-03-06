import { redirect } from "next/navigation"
import { getFirstPropertyId } from "@/lib/dashboard/property-access"

/**
 * Root /dashboard redirects to the first property's overview so all dashboard
 * routes are under /dashboard/[propertyId]/...
 */
export default async function DashboardRootPage() {
  const firstPropertyId = await getFirstPropertyId()

  if (!firstPropertyId) {
    redirect("/onboarding")
  }

  redirect(`/dashboard/${firstPropertyId}`)
}
