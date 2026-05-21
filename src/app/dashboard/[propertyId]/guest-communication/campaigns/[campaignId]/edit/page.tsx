import { redirect } from 'next/navigation'
import { getPropertyForUser } from '@/lib/dashboard/property-access'
import { resolveDashboardNavVisibility } from '@/lib/dashboard/dashboard-layout-context'
import { createClient } from '@/lib/supabase/server'
import { CampaignEditorPage } from '@/components/dashboard/guest-communication/campaign-editor-page'

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ propertyId: string; campaignId: string }>
}) {
  const { propertyId, campaignId } = await params
  const property = await getPropertyForUser(propertyId)
  if (!property) redirect('/auth/login')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const navVisibility = await resolveDashboardNavVisibility(supabase, propertyId, user.id)
  if (!navVisibility.moduleNavVisible['guest-communication']) {
    redirect(`/dashboard/${propertyId}/access-denied`)
  }

  // Fetch campaign
  const companyId = property.company_id
  const { data: campaign } = await supabase
    .from('message_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (!campaign || (companyId && campaign.company_id !== companyId)) {
    redirect(`/dashboard/${propertyId}/guest-communication?tab=campaigns`)
  }

  return (
    <CampaignEditorPage
      propertyId={propertyId}
      companyId={companyId ?? ''}
      campaign={campaign as Record<string, unknown>}
    />
  )
}
