import StaffManagementStaffPageClient from './staff-management-page-client'
import { getPropertyForUser } from '@/lib/dashboard/property-access'
import {
  userCanManagePropertyStaffRoster,
  userCanViewPropertyStaffRoster,
} from '@/lib/dashboard/staff-management-page-access'
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

  const canViewStaff = await userCanViewPropertyStaffRoster(supabase, propertyId, user.id)
  if (!canViewStaff) {
    redirect(`/dashboard/${propertyId}`)
  }

  const canManageStaff = await userCanManagePropertyStaffRoster(supabase, propertyId, user.id)

  return <StaffManagementStaffPageClient propertyName={property.name} canManageStaff={canManageStaff} />
}
