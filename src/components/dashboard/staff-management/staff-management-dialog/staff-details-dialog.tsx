'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export type StaffDetailsDialogTarget = {
  id: string
  name: string
  email: string
  role: 'Owner' | 'Admin' | 'Manager' | 'Staff'
  categories: string[] | 'All Categories'
  status: 'Active' | 'Pending' | 'Inactive'
  lastLogin: string
}

type StaffDetailsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff: StaffDetailsDialogTarget | null
}

function initialsFromName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed || trimmed === '—') return 'N'
  const words = trimmed.split(/\s+/).filter(Boolean)
  const first = words[0]?.[0] ?? ''
  const last = words.length > 1 ? words[words.length - 1]?.[0] ?? '' : ''
  return `${first}${last}`.toUpperCase() || 'N'
}

function StatusPill({ status }: { status: StaffDetailsDialogTarget['status'] }) {
  const base = 'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border whitespace-nowrap'
  if (status === 'Active') {
    return <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700`}>Active</span>
  }
  if (status === 'Pending') {
    return <span className={`${base} border-amber-200 bg-amber-50 text-amber-700`}>Pending</span>
  }
  return <span className={`${base} border-muted bg-background text-muted-foreground`}>Inactive</span>
}

export function StaffDetailsDialog({ open, onOpenChange, staff }: StaffDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-y-auto bg-background p-6 text-foreground sm:rounded-lg">
        {staff ? (
          <>
            <DialogHeader className="space-y-2 pb-5 text-left">
              <DialogTitle className="text-lg font-semibold leading-tight text-foreground">
                Staff Details
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                View details for this staff member.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-4">
                <Avatar className="h-11 w-11">
                  <AvatarFallback className="bg-blue-50 text-blue-700 font-semibold">
                    {initialsFromName(staff.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">{staff.name}</div>
                  <div className="text-sm text-muted-foreground truncate">{staff.email}</div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Role</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{staff.role}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                  <div className="mt-2">
                    <StatusPill status={staff.status} />
                  </div>
                </div>
                <div className="rounded-lg border border-border p-4 sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Categories</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {staff.categories === 'All Categories' ? (
                      <Badge
                        variant="secondary"
                        className="rounded-full bg-muted/60 text-foreground font-medium normal-case border border-muted-foreground/10"
                      >
                        All Categories
                      </Badge>
                    ) : staff.categories.length > 0 ? (
                      staff.categories.map((category) => (
                        <Badge
                          key={category}
                          variant="secondary"
                          className="rounded-full bg-muted/60 text-foreground font-medium normal-case border border-muted-foreground/10"
                        >
                          {category}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No categories assigned.</p>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-border p-4 sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Last Login</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{staff.lastLogin}</p>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

