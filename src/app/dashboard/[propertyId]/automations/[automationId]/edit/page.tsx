import { redirect } from 'next/navigation'
import { getPropertyForUser } from '@/lib/dashboard/property-access'
import { resolveDashboardNavVisibility } from '@/lib/dashboard/dashboard-layout-context'
import { AutomationFormPageClient } from '../../automation-form-page-client'
import { createClient } from '@/lib/supabase/server'
import { getAutomationWithDetails } from '@/lib/automations/queries'

export default async function EditAutomationPage({
    params,
}: {
    params: Promise<{ propertyId: string; automationId: string }>
}) {
    const { propertyId, automationId } = await params
    const property = await getPropertyForUser(propertyId)
    if (!property) redirect('/auth/login')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const navVisibility = await resolveDashboardNavVisibility(supabase, propertyId, user.id)
    if (!navVisibility.moduleNavVisible['automations']) redirect(`/dashboard/${propertyId}/access-denied`)

    const details = await getAutomationWithDetails(automationId)
    if (!details) {
        redirect(`/dashboard/${propertyId}/automations?tab=automations`)
    }

    return (
        <AutomationFormPageClient
            mode="edit"
            propertyId={propertyId}
            tenantId={property.company_id ?? ''}
            automationId={automationId}
            initialData={{
                name: details.automation.name,
                description: details.automation.description,
                phase: details.automation.phase,
                trigger_type: details.automation.trigger_type,
                is_active: details.automation.is_active,
                is_terminal: details.automation.is_terminal,
                sort_order: details.automation.sort_order,
            }}
        />
    )
}
