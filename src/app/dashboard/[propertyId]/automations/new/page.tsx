import { redirect } from 'next/navigation'
import { getPropertyForUser } from '@/lib/dashboard/property-access'
import { resolveDashboardNavVisibility } from '@/lib/dashboard/dashboard-layout-context'
import { AutomationFormPageClient } from '../automation-form-page-client'
import { createClient } from '@/lib/supabase/server'

export default async function NewAutomationPage({
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
    if (!navVisibility.moduleNavVisible['automations']) redirect(`/dashboard/${propertyId}/access-denied`)

    return (
        <AutomationFormPageClient
            mode="create"
            propertyId={propertyId}
            tenantId={property.company_id ?? ''}
        />
    )
}
