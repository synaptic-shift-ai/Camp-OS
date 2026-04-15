import StaffManagementStaffPageClient from './staff-management-page-client'
import { getPropertyForUser } from '@/lib/dashboard/property-access'
import { resolveDashboardNavVisibility } from '@/lib/dashboard/dashboard-layout-context'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { StaffManagementQueries } from '@/lib/dashboard/staff-management-queries'
import { redirect } from 'next/navigation'

type pageProps = {
  params: Promise<{ propertyId: string }>
  searchParams: Promise<{
    page?: string
    pageSize?: string
    search?: string
    role?: string
    category?: string
    status?: string
    [key: string]: string | string[] | undefined
  }>
}

export default async function StaffManagementPage({ params, searchParams }: pageProps) {
  const { propertyId } = await params
  const property = await getPropertyForUser(propertyId)
  if (!property) redirect('/auth/login')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const navVisibility = await resolveDashboardNavVisibility(supabase, propertyId, user.id)
  if (!navVisibility.moduleNavVisible['staff-management']) {
    redirect(`/dashboard/${propertyId}/access-denied`)
  }

  // Parse pagination & filter params from URL
  const sp = await searchParams
  const currentPage = Number.isNaN(Number(sp.page)) || !sp.page ? 1 : Math.max(1, Number(sp.page))
  const parsedPageSize =
    Number.isNaN(Number(sp.pageSize)) || !sp.pageSize ? undefined : Number(sp.pageSize)
  const pageSize = parsedPageSize && parsedPageSize > 0 ? parsedPageSize : 10
  const search = typeof sp.search === 'string' ? sp.search : ''
  const role = typeof sp.role === 'string' ? sp.role : 'all'
  const category = typeof sp.category === 'string' ? sp.category : 'all'
  const status = typeof sp.status === 'string' ? sp.status : 'all'

  // Fetch paginated staff data server-side
  const q = new StaffManagementQueries(supabase as any)
  const admin = createServiceRoleClient()
  const { staff, total, filterOptions } = await q.listStaffForManagementTablePaginated(propertyId, admin, {
    page: currentPage,
    pageSize,
    search,
    role,
    category,
    status,
  })

  return (
    <StaffManagementStaffPageClient
      propertyName={property.name}
      staff={staff}
      total={total}
      currentPage={currentPage}
      pageSize={pageSize}
      search={search}
      role={role}
      category={category}
      status={status}
      filterOptions={filterOptions}
    />
  )
}
