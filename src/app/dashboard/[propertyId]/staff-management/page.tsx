import StaffManagementStaffPageClient from './staff-management-page-client'
import { getPropertyForUser } from '@/lib/dashboard/property-access'
import { redirect } from 'next/navigation'

type pageProps = {
  params: Promise<{ propertyId: string }>
}

export default async function StaffManagementPage({ params }: pageProps) {
  const { propertyId } = await params
  const property = await getPropertyForUser(propertyId)
  if (!property) redirect('/auth/login')

  return <StaffManagementStaffPageClient propertyName={property.name} />
}
