import { redirect } from 'next/navigation'
import { getPropertyForUser } from '@/lib/dashboard/property-access'
import { resolveDashboardNavVisibility } from '@/lib/dashboard/dashboard-layout-context'
import { createClient } from '@/lib/supabase/server'
import { CampaignEditorPage } from '@/components/dashboard/guest-communication/campaign-editor-page'

export default async function NewCampaignPage({
  params,
}: {
  params: Promise<{ propertyId: string }>
}) {
  const { propertyId } = await params
  const property = await getPropertyForUser(propertyId)
  if (!property) redirect('/auth/login')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const navVisibility = await resolveDashboardNavVisibility(supabase, propertyId, user.id)
  if (!navVisibility.moduleNavVisible['guest-communication']) {
    redirect(`/dashboard/${propertyId}/access-denied`)
  }

  return (
    <CampaignEditorPage
      propertyId={propertyId}
      companyId={property.company_id ?? ''}
    />
  )
}
