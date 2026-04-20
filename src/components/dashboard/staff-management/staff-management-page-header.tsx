'use client'

import { Button } from '@/components/ui/button'
import { ShieldCheckIcon, Tag, UserPlusIcon } from 'lucide-react'
import { PermissionGate } from '@/components/ui/permission-gate'
import { usePermissions } from '@/hooks/use-permissions'

type StaffManagementPageHeaderProps = {
  propertyName: string
  onAccessClick?: () => void
  onCategoriesClick?: () => void
  onInviteStaffClick?: () => void
}

export default function StaffManagementPageHeader({
  propertyName,
  onAccessClick,
  onCategoriesClick,
  onInviteStaffClick,
}: StaffManagementPageHeaderProps) {
    const { can, isRole, isLoading } = usePermissions()
    const showAccessButton =
      !isLoading && (isRole('owner') || can('global.manage_staff_module_access'))

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 className="text-2xl font-heading font-bold tracking-tight sm:text-3xl">Staff Management</h1>
                <p className="text-sm text-muted-foreground sm:text-base">{propertyName}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {showAccessButton && onAccessClick ? (
                  <Button type="button" variant="outline" onClick={onAccessClick}>
                      <ShieldCheckIcon className="h-4 w-4" />
                      Access
                  </Button>
                ) : null}
                {onCategoriesClick ? (
                    <PermissionGate
                      permission="global.change_staff_role"
                      anyOfRoles={['owner', 'admin']}
                    >
                      <Button type="button" variant="outline" onClick={onCategoriesClick}>
                          <Tag className="h-4 w-4" />
                          Categories
                      </Button>
                    </PermissionGate>
                ) : null}
                {onInviteStaffClick ? (
                    <PermissionGate permission="global.invite_staff">
                      <Button type="button" onClick={onInviteStaffClick}>
                          <UserPlusIcon className="h-4 w-4" />
                          Invite Staff
                      </Button>
                    </PermissionGate>
                ) : null}
            </div>
        </div>
    )
}