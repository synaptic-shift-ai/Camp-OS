'use client'

import { useCallback, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import StaffManagementPageHeader from '@/components/dashboard/staff-management/staff-management-page-header'
import {
  StaffManagementCategoriesDialog,
  type CategoryRow,
  type RoleId,
} from '@/components/dashboard/staff-management/staff-management-dialog/staff-management-categories-dialog'
import { useToast } from '@/hooks/use-toast'
import InviteStaffDialog from '@/components/dashboard/staff-management/staff-management-dialog/invite-staff-dialog'
import AddStaffDialog from '@/components/dashboard/staff-management/staff-management-dialog/add-staff-dialog'
import { StaffAccessDialog } from '@/components/dashboard/staff-management/staff-management-dialog/staff-access-dialog'
import {
  EditStaffDialog,
  type EditStaffDialogStaff,
} from '@/components/dashboard/staff-management/staff-management-dialog/edit-staff-dialog'
import {
  DeactivateStaffDialog,
  type DeactivateStaffDialogTarget,
} from '@/components/dashboard/staff-management/staff-management-dialog/deactivate-staff-dialog'
import {
  StaffDetailsDialog,
  type StaffDetailsDialogTarget,
} from '@/components/dashboard/staff-management/staff-management-dialog/staff-details-dialog'
import { StaffManagementTable } from '@/components/dashboard/staff-management/staff-management-table'
import StaffManagementFilter from '@/components/dashboard/staff-management/staff-management-filter'
import type { StaffManagementTableRow } from '@/lib/dashboard/staff-management-queries'

type StaffManagementStaffPageClientProps = {
  propertyName: string
  staff: StaffManagementTableRow[]
  total: number
  currentPage: number
  pageSize: number
  search: string
  role: string
  category: string
  status: string
  filterOptions: {
    roles: string[]
    categories: string[]
    statuses: string[]
  }
}

export default function StaffManagementStaffPageClient({
  propertyName,
  staff,
  total,
  currentPage,
  pageSize,
  search,
  role,
  category,
  status,
  filterOptions,
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
  const [staffAccessOpen, setStaffAccessOpen] = useState(false)
  const [inviteStaffOpen, setInviteStaffOpen] = useState(false)
  const [addStaffOpen, setAddStaffOpen] = useState(false)
  const [staffDetailsOpen, setStaffDetailsOpen] = useState(false)
  const [staffDetailsTarget, setStaffDetailsTarget] = useState<StaffDetailsDialogTarget | null>(null)
  const [editStaffOpen, setEditStaffOpen] = useState(false)
  const [editStaffTarget, setEditStaffTarget] = useState<EditStaffDialogStaff | null>(null)
  const [deactivateStaffOpen, setDeactivateStaffOpen] = useState(false)
  const [deactivateStaffTarget, setDeactivateStaffTarget] =
    useState<DeactivateStaffDialogTarget | null>(null)
  const [isSavingCategories, setIsSavingCategories] = useState(false)

  const handleResendSetupEmail = useCallback(
    async (target: { id: string; name: string }) => {
      try {
        const res = await fetch(
          `/api/v1/properties/${propertyId}/staff-management/staff/${target.id}/resend-invite`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' } },
        )
        const json = await res.json().catch(() => ({})) as { success?: boolean; error?: { message?: string } }
        if (!res.ok || json.success !== true) {
          throw new Error(json.error?.message ?? 'Failed to resend setup email')
        }
        toast({ title: 'Setup email resent', description: `A new setup email has been sent.` })
        router.refresh()
      } catch (err) {
        toast({ title: 'Failed to resend setup email', variant: 'destructive' })
      }
    },
    [propertyId, router, toast],
  )

  const handleReactivateStaff = useCallback(
    async (target: { id: string; name: string }) => {
      try {
        const res = await fetch(
          `/api/v1/properties/${propertyId}/staff-management/staff/${target.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'active' }),
          },
        )
        const json: { success?: boolean; error?: { message?: string } } = await res.json().catch(() => ({}))
        if (!res.ok || json.success !== true) {
          throw new Error(json.error?.message ?? 'Failed to reactivate staff member')
        }
        toast({
          title: 'Staff member reactivated', description: `${target.name} can access this property again.`,
          variant: "success",
        })
        router.refresh()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        toast({
          title: 'Reactivation failed',
          description: message,
          variant: 'destructive',
        })
      }
    },
    [propertyId, router, toast],
  )

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

      toast({
        title: 'Categories saved',
        variant: "success",
      })
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
          onAccessClick={() => setStaffAccessOpen(true)}
          onCategoriesClick={() => setCategoriesOpen(true)}
          onInviteStaffClick={() => setInviteStaffOpen(true)}
          onAddStaffClick={() => setAddStaffOpen(true)}
        />

        <StaffManagementFilter
          propertyId={propertyId}
          defaultSearch={search}
          defaultRole={role}
          defaultCategory={category}
          defaultStatus={status}
          roleOptions={filterOptions.roles}
          categoryOptions={filterOptions.categories}
          statusOptions={filterOptions.statuses}
        />

        <StaffManagementTable
          propertyId={propertyId}
          staff={staff}
          total={total}
          currentPage={currentPage}
          pageSize={pageSize}
          onViewStaff={(staffMember: StaffDetailsDialogTarget) => {
            setStaffDetailsTarget(staffMember)
            setStaffDetailsOpen(true)
          }}
          onEditStaff={(staffMember: EditStaffDialogStaff) => {
            setEditStaffTarget(staffMember)
            setEditStaffOpen(true)
          }}
          onDeactivateStaff={(target: DeactivateStaffDialogTarget) => {
            setDeactivateStaffTarget(target)
            setDeactivateStaffOpen(true)
          }}
          onReactivateStaff={handleReactivateStaff}
          onResendSetupEmail={handleResendSetupEmail}
        />
      </div>

      <StaffAccessDialog
        open={staffAccessOpen}
        onOpenChange={setStaffAccessOpen}
        propertyId={propertyId}
      />

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
        onInviteSent={() => router.refresh()}
      />

      <AddStaffDialog
        open={addStaffOpen}
        onOpenChange={setAddStaffOpen}
        propertyId={propertyId}
        onSuccess={() => router.refresh()}
      />

      <StaffDetailsDialog
        open={staffDetailsOpen}
        onOpenChange={(next) => {
          setStaffDetailsOpen(next)
          if (!next) setStaffDetailsTarget(null)
        }}
        staff={staffDetailsTarget}
      />

      <EditStaffDialog
        open={editStaffOpen}
        onOpenChange={(next) => {
          setEditStaffOpen(next)
          if (!next) setEditStaffTarget(null)
        }}
        propertyId={propertyId}
        propertyName={propertyName}
        staff={editStaffTarget}
        onSaved={() => router.refresh()}
      />

      <DeactivateStaffDialog
        open={deactivateStaffOpen}
        onOpenChange={(next) => {
          setDeactivateStaffOpen(next)
          if (!next) setDeactivateStaffTarget(null)
        }}
        propertyId={propertyId}
        staff={deactivateStaffTarget}
        onDeactivated={() => router.refresh()}
      />
    </>
  )
}
