import { redirect } from "next/navigation"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { AccountSettingsTabs } from "@/components/dashboard/account/account-settings-tabs"

type PageProps = { params: Promise<{ propertyId: string }> }

export default async function AccountPage({ params }: PageProps) {
  const { propertyId } = await params
  const property = await getPropertyForUser(propertyId)

  if (!property) {
    redirect("/auth/login")
  }

  if (!property.company_id) {
    redirect(`/dashboard/${propertyId}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage company details and account security.
        </p>
      </div>

      <AccountSettingsTabs companyId={property.company_id} />
    </div>
  )
}
