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

type InviteStaffDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
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
}: InviteStaffDialogProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [role, setRole] = useState<DbRole | ''>('')
    const [email, setEmail] = useState('')
    const [isLoadingCategories, setIsLoadingCategories] = useState(false)
    const [isInviting, setIsInviting] = useState(false)
    const [categoriesByRole, setCategoriesByRole] = useState<CategoriesByRole>({})
    const [selectedRoleCategoryId, setSelectedRoleCategoryId] = useState<string>('')

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
      setSelectedRoleCategoryId('')
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
        } catch {
          // Fallback categories will still show
        } finally {
          setIsLoadingCategories(false)
        }
      })()
    }, [open, propertyId])

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

      if (!selectedRoleCategoryId) {
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
              roleCategoryId: selectedRoleCategoryId,
              status: 'pending',
            }),
          },
        )

        const json: any = await res.json().catch(() => null)
        if (!res.ok || json?.success !== true) {
          throw new Error(json?.error?.message ?? 'Failed to invite staff')
        }

        toast({ title: 'Invite sent' })
        onOpenChange(false)
        router.refresh()
      } catch (err: unknown) {
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
                        setSelectedRoleCategoryId('')
                      }}
                    >
                        <SelectTrigger id="role">
                            <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        
                        <SelectContent>
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {categoryRole && (
                  <div className="space-y-2">
                    <div>
                      <div className="text-sm font-medium">
                        {ROLE_LABEL[categoryRole]} Categories
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Optionally assign categories to scope this {ROLE_LABEL[categoryRole].toLowerCase()}'s module access.
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
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
                            setSelectedRoleCategoryId(id)
                          }}
                          disabled={isLoadingCategories || !id}
                        >
                          <Checkbox checked={id ? selectedRoleCategoryId === id : false} aria-label={name} />
                          <span className="text-sm font-medium">{name}</span>
                        </button>
                      ))}
                    </div>
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