'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import StaffManagementPageHeader from '@/components/dashboard/staff-management/staff-management-page-header'
import {
  StaffManagementCategoriesDialog,
  type CategoryRow,
  type RoleId,
} from '@/components/dashboard/staff-management/staff-management-dialog/staff-management-categories-dialog'
import { useToast } from '@/hooks/use-toast'
import InviteStaffDialog from '@/components/dashboard/staff-management/staff-management-dialog/invite-staff-dialog'
import { StaffManagementTable } from '@/components/dashboard/staff-management/staff-management-table'
import StaffManagementFilter, {
  type StaffManagementFilterValue,
} from '@/components/dashboard/staff-management/staff-management-filter'

type StaffManagementStaffPageClientProps = {
  propertyName: string
}

const FILTER_DEBOUNCE_MS = 300

export default function StaffManagementStaffPageClient({
  propertyName,
}: StaffManagementStaffPageClientProps) {
  const params = useParams<{ propertyId: string }>()
  const propertyId =
    typeof params.propertyId === 'string'
      ? params.propertyId
      : Array.isArray(params.propertyId)
        ? (params.propertyId[0] ?? '')
        : ''
  const router = useRouter()
  const { toast } = useToast()
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [inviteStaffOpen, setInviteStaffOpen] = useState(false)
  const [isSavingCategories, setIsSavingCategories] = useState(false)
  const [staffTableReloadKey, setStaffTableReloadKey] = useState(0)
  const [filterValue, setFilterValue] = useState<StaffManagementFilterValue>({
    search: '',
    role: 'all',
    category: 'all',
    status: 'all',
  })
  const [debouncedFilterValue, setDebouncedFilterValue] =
    useState<StaffManagementFilterValue>(filterValue)
  const [filterOptions, setFilterOptions] = useState<{
    roles: string[]
    categories: string[]
    statuses: string[]
  }>({
    roles: [],
    categories: [],
    statuses: [],
  })

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedFilterValue(filterValue)
    }, FILTER_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [filterValue])

  const handleSaveCategories = async (categoriesByRole: Record<RoleId, CategoryRow[]>) => {
    if (isSavingCategories) return

    try {
      setIsSavingCategories(true)
      const res = await fetch(
        `/api/v1/properties/${propertyId}/staff-management/categories`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoriesByRole: {
              admin: categoriesByRole.admin.map((c) => ({ name: c.name })),
              manager: categoriesByRole.manager.map((c) => ({ name: c.name })),
              staff: categoriesByRole.staff.map((c) => ({ name: c.name })),
            },
          }),
        },
      )

      const json: any = await res.json().catch(() => null)
      if (!res.ok || json?.success !== true) {
        console.error('[StaffManagement] Save categories failed', {
          url: `/api/v1/properties/${propertyId}/staff-management/categories`,
          status: res.status,
          statusText: res.statusText,
          response: json,
        })
        throw new Error(json?.error?.message ?? 'Failed to save categories')
      }

      toast({ title: 'Categories saved' })
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast({
        title: 'Failed to save categories',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsSavingCategories(false)
    }
  }

  return (
    <>
      <div className="space-y-4 sm:space-y-6 px-6 pb-8">
        <StaffManagementPageHeader
          propertyName={propertyName}
          onCategoriesClick={() => setCategoriesOpen(true)}
          onInviteStaffClick={() => setInviteStaffOpen(true)}
        />

        <StaffManagementFilter
          value={filterValue}
          onChange={setFilterValue}
          roleOptions={filterOptions.roles}
          categoryOptions={filterOptions.categories}
          statusOptions={filterOptions.statuses}
        />

        <StaffManagementTable
          propertyId={propertyId}
          reloadKey={staffTableReloadKey}
          search={debouncedFilterValue.search}
          role={debouncedFilterValue.role}
          category={debouncedFilterValue.category}
          status={debouncedFilterValue.status}
          onFilterOptionsChange={setFilterOptions}
        />
      </div>

      <StaffManagementCategoriesDialog
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        onSave={handleSaveCategories}
        propertyId={propertyId}
      />

      <InviteStaffDialog
        open={inviteStaffOpen}
        onOpenChange={setInviteStaffOpen}
        propertyId={propertyId}
        onInviteSent={() => setStaffTableReloadKey((k) => k + 1)}
      />
    </>
  )
}
