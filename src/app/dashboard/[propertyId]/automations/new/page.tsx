import { redirect } from 'next/navigation'
import { getPropertyForUser } from '@/lib/dashboard/property-access'
import { resolveDashboardNavVisibility } from '@/lib/dashboard/dashboard-layout-context'
import { AutomationFormPageClient } from '../automation-form-page-client'
import { createClient } from '@/lib/supabase/server'
import { resolveUserPropertyAccess } from '@/lib/rbac/resolve-access'
import { resolveEffectivePermissionSet } from '@/lib/rbac/role-category-module-access'
import type { PermissionKey } from '@/lib/rbac/permissions'

export default async function NewAutomationPage({
    params,
    searchParams,
}: {
    params: Promise<{ propertyId: string }>
    searchParams: Promise<{ scope?: string }>
}) {
    const { propertyId } = await params
    const { scope } = await searchParams
    const property = await getPropertyForUser(propertyId)
    if (!property) redirect('/auth/login')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const navVisibility = await resolveDashboardNavVisibility(supabase, propertyId, user.id)
    if (!navVisibility.moduleNavVisible['automations']) redirect(`/dashboard/${propertyId}/access-denied`)

    const access = await resolveUserPropertyAccess(supabase, propertyId, user.id)
    const permissionKey: PermissionKey = scope === 'system' ? 'automations.add_system_automations' : 'automations.add_automations'
    const effectivePerms = await resolveEffectivePermissionSet(supabase, propertyId, user.id, access?.role ?? null, access?.rawRole ?? null)
    if (!access?.role || !effectivePerms.has(permissionKey)) {
        redirect(`/dashboard/${propertyId}/access-denied`)
    }

    return (
        <AutomationFormPageClient
            mode="create"
            propertyId={propertyId}
            companyId={property.company_id ?? ''}
            systemMode={scope === 'system'}
        />
    )
}
