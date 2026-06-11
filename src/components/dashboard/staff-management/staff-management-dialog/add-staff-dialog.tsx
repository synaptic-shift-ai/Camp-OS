'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useDialogCloseGuard } from '@/hooks/use-dialog-close-guard'
import { isAccessDeniedError } from '@/lib/utils/is-access-denied-error'

type AddStaffDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  onSuccess: () => void
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

export default function AddStaffDialog({
  open,
  onOpenChange,
  propertyId,
  onSuccess,
}: AddStaffDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<DbRole | ''>('')
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categoriesByRole, setCategoriesByRole] = useState<CategoriesByRole>({})
  const [selectedRoleCategoryIds, setSelectedRoleCategoryIds] = useState<string[]>([])
  const cleanFormRef = useRef<string>('')

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
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setRole('')
    setSelectedRoleCategoryIds([])
    setCategoriesByRole({})
    cleanFormRef.current = JSON.stringify({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: '',
      selectedRoleCategoryIds: [],
    })

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
            description:
              "You don't have permission to view categories. Contact your property administrator if you believe this is an error.",
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

  const isDirty =
    JSON.stringify({ firstName, lastName, email, phone, role, selectedRoleCategoryIds }) !== cleanFormRef.current

  const { guardedOnOpenChange, unsavedChangesDialog } = useDialogCloseGuard({
    isDirty,
    open,
    onOpenChange,
  })

  const handleSubmit = async () => {
    if (isSubmitting) return

    const trimmedFirstName = firstName.trim()
    const trimmedLastName = lastName.trim()
    const trimmedEmail = email.trim()

    if (!trimmedFirstName) {
      toast({ title: 'First name is required', variant: 'destructive' })
      return
    }

    if (!trimmedLastName) {
      toast({ title: 'Last name is required', variant: 'destructive' })
      return
    }

    if (!trimmedEmail) {
      toast({ title: 'Email is required', variant: 'destructive' })
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmedEmail)) {
      toast({ title: 'Invalid email format', variant: 'destructive' })
      return
    }

    if (!role) {
      toast({ title: 'Role is required', variant: 'destructive' })
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
      setIsSubmitting(true)
      const res = await fetch(
        `/api/v1/properties/${propertyId}/staff-management/add-staff`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: trimmedFirstName,
            lastName: trimmedLastName,
            email: trimmedEmail,
            phone: phone.trim() || undefined,
            roleCategoryIds: selectedRoleCategoryIds,
          }),
        },
      )

      const json: {
        success?: boolean
        message?: string
        error?: { message?: string }
      } | null = await res.json().catch(() => null)
      if (!res.ok || json?.success !== true) {
        const errText =
          (typeof json?.message === 'string' && json.message) ||
          json?.error?.message ||
          'Failed to add staff'
        throw new Error(errText)
      }

      toast({
        title: `Staff member added. A setup email has been sent to ${trimmedEmail}.`,
        variant: 'success',
      })
      onOpenChange(false)
      onSuccess()
      router.refresh()
    } catch (err: unknown) {
      if (isAccessDeniedError(err)) {
        toast({
          title: 'Access denied',
          description:
            "You don't have permission for this action. Contact your property administrator if you believe this is an error.",
          variant: 'destructive',
        })
        return
      }
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast({
        title: 'Failed to add staff',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
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
      {categoriesForSelectedRole.map(({ id, name: catName }) => (
        <button
          key={id || catName}
          type="button"
          className={cn(
            'flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-3 text-left',
            'hover:bg-muted/50',
          )}
          onClick={() => {
            if (!id) return
            setSelectedRoleCategoryIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
            )
          }}
          disabled={isLoadingCategories || !id}
        >
          <Checkbox
            checked={id ? selectedRoleCategoryIds.includes(id) : false}
            aria-label={catName}
          />
          <span className="text-sm font-medium">{catName}</span>
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
    <>
      <Dialog open={open} onOpenChange={guardedOnOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="add-staff-first-name">First Name</Label>
              <Input
                id="add-staff-first-name"
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="add-staff-last-name">Last Name</Label>
              <Input
                id="add-staff-last-name"
                type="text"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="add-staff-email">Email</Label>
            <Input
              id="add-staff-email"
              type="email"
              placeholder="Enter email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="add-staff-phone">Phone</Label>
            <PhoneInput
              value={phone}
              onChange={(value) => setPhone(value)}
              id="add-staff-phone"
            />
          </div>

          <div>
            <Label htmlFor="add-staff-role">Role</Label>
            <Select
              value={role}
              onValueChange={(v) => {
                setRole(v as DbRole)
                setSelectedRoleCategoryIds([])
              }}
            >
              <SelectTrigger id="add-staff-role">
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
            <Button
              type="button"
              variant="outline"
              onClick={() => guardedOnOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Adding…' : 'Add Staff'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {unsavedChangesDialog}
    </>
  )
}
