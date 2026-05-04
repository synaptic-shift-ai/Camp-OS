import { redirect } from 'next/navigation'
import { getPropertyForUser } from '@/lib/dashboard/property-access'
import { resolveDashboardNavVisibility } from '@/lib/dashboard/dashboard-layout-context'
import { AutomationFormPageClient } from '../../automation-form-page-client'
import { createClient } from '@/lib/supabase/server'
import { getAutomationWithDetails } from '@/lib/automations/queries'
import { resolveUserPropertyAccess } from '@/lib/rbac/resolve-access'
import { resolveEffectivePermissionSet } from '@/lib/rbac/role-category-module-access'
import type { PermissionKey } from '@/lib/rbac/permissions'

export default async function EditAutomationPage({
    params,
    searchParams,
}: {
    params: Promise<{ propertyId: string; automationId: string }>
    searchParams: Promise<{ scope?: string }>
}) {
    const { propertyId, automationId } = await params
    const { scope } = await searchParams
    const property = await getPropertyForUser(propertyId)
    if (!property) redirect('/auth/login')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const navVisibility = await resolveDashboardNavVisibility(supabase, propertyId, user.id)
    if (!navVisibility.moduleNavVisible['automations']) redirect(`/dashboard/${propertyId}/access-denied`)

    const access = await resolveUserPropertyAccess(supabase, propertyId, user.id)
    const permissionKey: PermissionKey = scope === 'system' ? 'automations.edit_system_automations' : 'automations.edit_automations'
    const effectivePerms = await resolveEffectivePermissionSet(supabase, propertyId, user.id, access?.role ?? null, access?.rawRole ?? null)
    if (!access?.role || !effectivePerms.has(permissionKey)) {
        redirect(`/dashboard/${propertyId}/access-denied`)
    }

    const details = await getAutomationWithDetails(automationId)
    if (!details) {
        redirect(`/dashboard/${propertyId}/automations?tab=${scope === 'system' ? 'system-automations' : 'automations'}`)
    }

    return (
        <AutomationFormPageClient
            mode="edit"
            propertyId={propertyId}
            companyId={property.company_id ?? ''}
            automationId={automationId}
            systemMode={scope === 'system'}
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
