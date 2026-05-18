import { redirect } from 'next/navigation'
import { getPropertyForUser } from '@/lib/dashboard/property-access'
import { resolveDashboardNavVisibility } from '@/lib/dashboard/dashboard-layout-context'
import { createClient } from '@/lib/supabase/server'
import { resolveUserPropertyAccess } from '@/lib/rbac/resolve-access'
import { resolveEffectivePermissionSet } from '@/lib/rbac/role-category-module-access'
import type { PermissionKey } from '@/lib/rbac/permissions'
import { EmailTemplateEditorPage } from '@/components/dashboard/automations/email-template-editor-page'

export default async function NewEmailTemplatePage({
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

  const access = await resolveUserPropertyAccess(supabase, propertyId, user.id)
  const permissionKey: PermissionKey = 'automations.add_email_templates'
  const effectivePerms = await resolveEffectivePermissionSet(supabase, propertyId, user.id, access?.role ?? null, access?.rawRole ?? null)
  if (!access?.role || !effectivePerms.has(permissionKey)) {
    redirect(`/dashboard/${propertyId}/access-denied`)
  }

  return (
    <EmailTemplateEditorPage
      propertyId={propertyId}
      companyId={property.company_id ?? ''}
      template={null}
    />
  )
}
