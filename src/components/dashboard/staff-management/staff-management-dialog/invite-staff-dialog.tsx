'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    Dialog, 
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { isAccessDeniedError } from '@/lib/utils/is-access-denied-error'

type InviteStaffDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  onInviteSent?: () => void
}

type DbRole = 'owner' | 'admin' | 'manager' | 'staff'
type CategoryRow = { id: string; name: string }
type CategoriesByRole = Partial<Record<'admin' | 'manager' | 'staff', CategoryRow[]>>

const ROLE_LABEL: Record<DbRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
}

const FALLBACK_CATEGORIES: Record<'admin' | 'manager' | 'staff', string[]> = {
  admin: ['Operations', 'Finance', 'Guest Services'],
  manager: ['Housekeeping', 'Maintenance', 'Front Desk'],
  staff: ['Housekeeping', 'Maintenance', 'Front Desk'],
}

export default function InviteStaffDialog({
  open,
  onOpenChange,
  propertyId,
  onInviteSent,
}: InviteStaffDialogProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [role, setRole] = useState<DbRole | ''>('')
    const [email, setEmail] = useState('')
    const [isLoadingCategories, setIsLoadingCategories] = useState(false)
    const [isInviting, setIsInviting] = useState(false)
    const [categoriesByRole, setCategoriesByRole] = useState<CategoriesByRole>({})
    const [selectedRoleCategoryIds, setSelectedRoleCategoryIds] = useState<string[]>([])

    const categoryRole = role === 'admin' || role === 'manager' || role === 'staff' ? role : null

    const categoriesForSelectedRole = useMemo(() => {
      if (!categoryRole) return []
      const fromApi = (categoriesByRole[categoryRole] ?? [])
        .map((c) => ({ id: c.id, name: c.name }))
        .filter((c) => c.id && c.name)
      const fallback = FALLBACK_CATEGORIES[categoryRole]
      const categories =
        fromApi.length > 0
          ? fromApi.sort((a, b) => a.name.localeCompare(b.name))
          : fallback.map((name) => ({ id: '', name })).sort((a, b) => a.name.localeCompare(b.name))
      return categories
    }, [categoriesByRole, categoryRole])

    useEffect(() => {
      if (!open) return
      setEmail('')
      setRole('')
      setSelectedRoleCategoryIds([])
      setCategoriesByRole({})

      void (async () => {
        try {
          setIsLoadingCategories(true)
          const res = await fetch(
            `/api/v1/properties/${propertyId}/staff-management/categories`,
            { method: 'GET' },
          )
          const json: any = await res.json().catch(() => null)
          if (!res.ok || json?.success !== true) {
            throw new Error(json?.error?.message ?? 'Failed to load categories')
          }
          const payload = json.data?.categoriesByRole as CategoriesByRole | undefined
          if (payload) setCategoriesByRole(payload)
        } catch (err: unknown) {
          if (isAccessDeniedError(err)) {
            toast({
              title: 'Access denied',
              description: "You don't have permission to view categories. Contact your property administrator if you believe this is an error.",
              variant: 'destructive',
            })
            return
          }
          const message = err instanceof Error ? err.message : 'Failed to load categories'
          toast({
            title: 'Failed to load categories',
            description: message,
            variant: 'destructive',
          })
        } finally {
          setIsLoadingCategories(false)
        }
      })()
    }, [open, propertyId, toast])

    const handleInvite = async () => {
      if (isInviting) return

      const trimmedEmail = email.trim()
      if (!trimmedEmail) {
        toast({ title: 'Email is required', variant: 'destructive' })
        return
      }

      if (!role) {
        toast({ title: 'Role is required', variant: 'destructive' })
        return
      }

      if (role === 'owner') {
        toast({
          title: 'Owner role cannot be invited',
          description: 'Please invite as Admin, Manager, or Staff.',
          variant: 'destructive',
        })
        return
      }

      if (selectedRoleCategoryIds.length === 0) {
        toast({
          title: 'Category is required',
          description: 'Please choose a category for this role.',
          variant: 'destructive',
        })
        return
      }

      try {
        setIsInviting(true)
        const res = await fetch(
          `/api/v1/properties/${propertyId}/staff-management/invite-staff`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: trimmedEmail,
              roleCategoryIds: selectedRoleCategoryIds,
              status: 'pending',
            }),
          },
        )

        const json: { success?: boolean; message?: string; error?: { message?: string } } | null =
          await res.json().catch(() => null)
        if (!res.ok || json?.success !== true) {
          const errText =
            (typeof json?.message === 'string' && json.message) ||
            json?.error?.message ||
            'Failed to invite staff'
          throw new Error(errText)
        }

        toast({
          title: 'Invite sent',
          variant: "success",
        })
        onOpenChange(false)
        onInviteSent?.()
        router.refresh()
      } catch (err: unknown) {
        if (isAccessDeniedError(err)) {
          toast({
            title: 'Access denied',
            description: "You don't have permission for this action. Contact your property administrator if you believe this is an error.",
            variant: 'destructive',
          })
          return
        }
        const message = err instanceof Error ? err.message : 'Unknown error'
        toast({
          title: 'Failed to invite staff',
          description: message,
          variant: 'destructive',
        })
      } finally {
        setIsInviting(false)
      }
    }

    const showConfigureCategoriesHint =
      !isLoadingCategories &&
      (role === 'admin' || role === 'manager' || role === 'staff') &&
      categoriesForSelectedRole.length > 0 &&
      !categoriesForSelectedRole.some((c) => c.id)

    const selectableCategoryIds = useMemo(
      () => categoriesForSelectedRole.map((c) => c.id).filter(Boolean),
      [categoriesForSelectedRole],
    )
    const hasSelectableCategories = selectableCategoryIds.length > 0
    const allCategoriesSelected =
      hasSelectableCategories &&
      selectableCategoryIds.every((id) => selectedRoleCategoryIds.includes(id))

    const categoryChoiceGrid = (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {categoriesForSelectedRole.map(({ id, name }) => (
          <button
            key={id || name}
            type="button"
            className={cn(
              'flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-3 text-left',
              'hover:bg-muted/50',
            )}
            onClick={() => {
              if (!id) return
              setSelectedRoleCategoryIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
              )
            }}
            disabled={isLoadingCategories || !id}
          >
            <Checkbox checked={id ? selectedRoleCategoryIds.includes(id) : false} aria-label={name} />
            <span className="text-sm font-medium">{name}</span>
          </button>
        ))}
        <button
          type="button"
          className={cn(
            'flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-3 text-left',
            'hover:bg-muted/50',
          )}
          onClick={() => {
            if (!hasSelectableCategories) return
            setSelectedRoleCategoryIds((prev) =>
              allCategoriesSelected
                ? prev.filter((id) => !selectableCategoryIds.includes(id))
                : selectableCategoryIds,
            )
          }}
          disabled={isLoadingCategories || !hasSelectableCategories}
        >
          <Checkbox checked={allCategoriesSelected} aria-label="All categories" />
          <span className="text-sm font-medium">All Categories</span>
        </button>
      </div>
    )

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Invite Staff Member</DialogTitle>
                </DialogHeader>
                <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="Enter email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={role}
                      onValueChange={(v) => {
                        setRole(v as DbRole)
                        setSelectedRoleCategoryIds([])
                      }}
                    >
                        <SelectTrigger id="role">
                            <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        
                        <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {role === 'admin' && (
                  <div className="space-y-2">
                    <div>
                      <div className="text-sm font-medium">Admin Categories</div>
                      <div className="text-sm text-muted-foreground">
                        Optionally assign categories to scope this admin&apos;s module access.
                      </div>
                    </div>
                    {showConfigureCategoriesHint && (
                      <p className="text-sm text-muted-foreground">
                        No saved categories for this property yet. Open{' '}
                        <span className="font-medium text-foreground">Manage Categories</span> on the
                        staff page, save your admin categories, then open this dialog again.
                      </p>
                    )}
                    {categoryChoiceGrid}
                  </div>
                )}

                {(role === 'manager' || role === 'staff') && (
                  <div className="space-y-2">
                    <div>
                      <div className="text-sm font-medium">
                        {ROLE_LABEL[role]} Categories
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Optionally assign categories to scope this{' '}
                        {ROLE_LABEL[role].toLowerCase()}&apos;s module access.
                      </div>
                    </div>
                    {showConfigureCategoriesHint && (
                      <p className="text-sm text-muted-foreground">
                        No saved categories for this property yet. Open{' '}
                        <span className="font-medium text-foreground">Manage Categories</span> on the
                        staff page, save your role categories, then open this dialog again.
                      </p>
                    )}
                    {categoryChoiceGrid}
                  </div>
                )}

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button type="button" onClick={handleInvite} disabled={isInviting}>
                      {isInviting ? 'Inviting…' : 'Invite'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}