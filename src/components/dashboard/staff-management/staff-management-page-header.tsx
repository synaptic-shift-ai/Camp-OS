'use client'

import { Button } from '@/components/ui/button'
import { ShieldCheckIcon, Tag, UserPlusIcon } from 'lucide-react'

type StaffManagementPageHeaderProps = {
  propertyName: string
  onCategoriesClick?: () => void
  onInviteStaffClick?: () => void
}

export default function StaffManagementPageHeader({
  propertyName,
  onCategoriesClick,
  onInviteStaffClick,
}: StaffManagementPageHeaderProps) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 className="text-2xl font-heading font-bold tracking-tight sm:text-3xl">Staff Management</h1>
                <p className="text-sm text-muted-foreground sm:text-base">{propertyName}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Button type="button" variant="outline">
                    <ShieldCheckIcon className="h-4 w-4" />
                    Access
                </Button>
                <Button type="button" variant="outline" onClick={onCategoriesClick}>
                    <Tag className="h-4 w-4" />
                    Categories
                </Button>
                <Button type="button" onClick={onInviteStaffClick}>
                    <UserPlusIcon className="h-4 w-4" />
                    Invite Staff
                </Button>
            </div>
        </div>
    )
}