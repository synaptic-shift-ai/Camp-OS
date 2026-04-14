import StaffManagementStaffPageClient from './staff-management-page-client'
import { getPropertyForUser } from '@/lib/dashboard/property-access'
import { resolveDashboardAccess, canViewStaffRoster } from '@/lib/rbac/dashboard-guards'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

type pageProps = {
  params: Promise<{ propertyId: string }>
}

export default async function StaffManagementPage({ params }: pageProps) {
  const { propertyId } = await params
  const property = await getPropertyForUser(propertyId)
  if (!property) redirect('/auth/login')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const access = await resolveDashboardAccess(supabase, propertyId, user.id)
  if (!access || !canViewStaffRoster(access)) {
    redirect(`/dashboard/${propertyId}/access-denied`)
  }

  return <StaffManagementStaffPageClient propertyName={property.name} />
}
