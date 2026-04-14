'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Check, Save } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { isAccessDeniedError } from '@/lib/utils/is-access-denied-error'

export type EditStaffDialogStaff = {
  id: string
  name: string
  role: 'Owner' | 'Admin' | 'Manager' | 'Staff'
  categories: string[] | 'All Categories'
}

type EditStaffDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  propertyName: string
  staff: EditStaffDialogStaff | null
  onSaved?: () => void
}

type PatchRole = 'admin' | 'manager' | 'staff'
type CategoryRow = { id: string; name: string }
type CategoriesByRole = Partial<Record<PatchRole, CategoryRow[]>>

const ROLE_LABEL: Record<PatchRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
}

const FALLBACK_CATEGORIES: Record<PatchRole, string[]> = {
  admin: ['Operations', 'Finance', 'Guest Services'],
  manager: ['Housekeeping', 'Maintenance', 'Front Desk'],
  staff: ['Housekeeping', 'Maintenance', 'Front Desk'],
}

function uiRoleToPatchRole(role: EditStaffDialogStaff['role']): PatchRole {
  if (role === 'Manager') return 'manager'
  if (role === 'Staff') return 'staff'
  return 'admin'
}

function buildCategoryRowsForRole(
  payload: CategoriesByRole | undefined,
  role: PatchRole,
): CategoryRow[] {
  const fromApi = (payload?.[role] ?? [])
    .map((c) => ({ id: c.id, name: c.name }))
    .filter((c) => c.id && c.name)
  const fallback = FALLBACK_CATEGORIES[role]
  if (fromApi.length > 0) {
    return [...fromApi].sort((a, b) => a.name.localeCompare(b.name))
  }
  return fallback.map((name) => ({ id: '', name })).sort((a, b) => a.name.localeCompare(b.name))
}

function applyInitialCategorySelection(
  staff: EditStaffDialogStaff,
  categories: CategoryRow[],
): { allCategories: boolean; ids: string[] } {
  if (staff.categories === 'All Categories') {
    return { allCategories: true, ids: [] }
  }
  const withIds = categories.filter((c) => Boolean(c.id))
  if (withIds.length === 0) {
    return { allCategories: true, ids: [] }
  }
  const want = new Set(staff.categories)
  const ids = withIds.filter((c) => want.has(c.name)).map((c) => c.id)
  if (ids.length === 0) {
    return { allCategories: true, ids: [] }
  }
  return { allCategories: false, ids }
}

export function EditStaffDialog({
  open,
  onOpenChange,
  propertyId,
  propertyName,
  staff,
  onSaved,
}: EditStaffDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [role, setRole] = useState<PatchRole>('admin')
  const [allCategories, setAllCategories] = useState(true)
  const [selectedRoleCategoryIds, setSelectedRoleCategoryIds] = useState<string[]>([])
  const [categoriesByRole, setCategoriesByRole] = useState<CategoriesByRole>({})
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const categoryRole: PatchRole | null =
    role === 'admin' || role === 'manager' || role === 'staff' ? role : null

  const categoriesForSelectedRole = useMemo(() => {
    if (!categoryRole) return []
    return buildCategoryRowsForRole(categoriesByRole, categoryRole)
  }, [categoriesByRole, categoryRole])

  useEffect(() => {
    if (!open || !staff) return

    const staffSnapshot = staff
    setRole(uiRoleToPatchRole(staffSnapshot.role))
    setCategoriesByRole({})
    setSelectedRoleCategoryIds([])
    setAllCategories(true)

    void (async () => {
      try {
        setIsLoadingCategories(true)
        const res = await fetch(
          `/api/v1/properties/${propertyId}/staff-management/categories`,
          { method: 'GET' },
        )
        const json: { success?: boolean; data?: { categoriesByRole?: CategoriesByRole }; error?: { message?: string } } =
          await res.json().catch(() => ({}))
        if (!res.ok || json.success !== true) {
          throw new Error(json.error?.message ?? 'Failed to load categories')
        }
        const payload = json.data?.categoriesByRole
        if (payload) setCategoriesByRole(payload)

        const r = uiRoleToPatchRole(staffSnapshot.role)
        const list = buildCategoryRowsForRole(payload, r)
        const initial = applyInitialCategorySelection(staffSnapshot, list)
        setAllCategories(initial.allCategories)
        setSelectedRoleCategoryIds(initial.ids)
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
        const r = uiRoleToPatchRole(staffSnapshot.role)
        const list = buildCategoryRowsForRole(undefined, r)
        const initial = applyInitialCategorySelection(staffSnapshot, list)
        setAllCategories(initial.allCategories)
        setSelectedRoleCategoryIds(initial.ids)
      } finally {
        setIsLoadingCategories(false)
      }
    })()
  }, [open, propertyId, staff, toast])

  const showConfigureCategoriesHint =
    !isLoadingCategories &&
    categoryRole !== null &&
    categoriesForSelectedRole.length > 0 &&
    !categoriesForSelectedRole.some((c) => c.id)

  const toggleAllCategories = () => {
    setAllCategories(true)
    setSelectedRoleCategoryIds([])
  }

  const toggleCategoryId = (id: string) => {
    if (!id) return
    setAllCategories(false)
    setSelectedRoleCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleSave = async () => {
    if (!staff || isSaving) return

    if (!allCategories && selectedRoleCategoryIds.length === 0) {
      toast({
        title: 'Categories required',
        description: 'Choose All Categories or select one or more categories.',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsSaving(true)
      const res = await fetch(
        `/api/v1/properties/${propertyId}/staff-management/staff/${staff.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role,
            allCategories,
            roleCategoryIds: allCategories ? [] : selectedRoleCategoryIds,
          }),
        },
      )
      const json: { success?: boolean; error?: { message?: string } } = await res.json().catch(() => ({}))
      if (!res.ok || json.success !== true) {
        throw new Error(json.error?.message ?? 'Failed to update staff')
      }
      toast({ title: 'Changes saved' })
      onOpenChange(false)
      onSaved?.()
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
        title: 'Failed to save changes',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const categorySectionTitle = `${ROLE_LABEL[role]} Categories`

  const gridItems: { kind: 'category'; id: string; name: string }[] = categoriesForSelectedRole
    .filter((c) => c.name !== 'All Categories')
    .map((c) => ({ kind: 'category' as const, id: c.id, name: c.name }))

  const categoryCards = (
    <div className="grid grid-cols-2 gap-3">
      {gridItems.map(({ id, name }) => {
        const selected = !allCategories && Boolean(id) && selectedRoleCategoryIds.includes(id)
        return (
          <button
            key={id || name}
            type="button"
            disabled={isLoadingCategories || !id}
            className={cn(
              'flex min-h-[52px] items-center gap-3 rounded-lg border-2 px-3 py-3 text-left transition-colors',
              selected
                ? 'border-[#1d61f2] bg-[#1d61f2] text-white shadow-sm'
                : 'border-border bg-muted/30 hover:bg-muted/50',
            )}
            onClick={() => toggleCategoryId(id)}
          >
            {selected ? (
              <Check className="h-4 w-4 shrink-0 text-white" aria-hidden />
            ) : (
              <span
                className="h-4 w-4 shrink-0 rounded border border-muted-foreground/35 bg-background"
                aria-hidden
              />
            )}
            <span className="text-sm font-medium">{name}</span>
          </button>
        )
      })}
      <button
        type="button"
        className={cn(
          'flex min-h-[52px] items-center gap-3 rounded-lg border-2 px-3 py-3 text-left transition-colors',
          allCategories
            ? 'border-[#1d61f2] bg-[#1d61f2] text-white shadow-sm'
            : 'border-border bg-muted/30 hover:bg-muted/50',
        )}
        onClick={toggleAllCategories}
      >
        {allCategories ? (
          <Check className="h-4 w-4 shrink-0 text-white" aria-hidden />
        ) : (
          <span
            className="h-4 w-4 shrink-0 rounded border border-muted-foreground/35 bg-background"
            aria-hidden
          />
        )}
        <span className="text-sm font-medium">All Categories</span>
      </button>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-y-auto p-6 sm:rounded-lg">
        {staff ? (
          <>
            <DialogHeader className="space-y-2 pb-4 text-left">
              <DialogTitle className="text-lg font-semibold text-foreground">
                Edit Role &amp; Access
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Update role and category access for {staff.name}
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-start gap-3 rounded-lg bg-muted/50 px-4 py-3 text-sm">
              <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <p className="leading-snug">
                <span className="text-muted-foreground">Property: </span>
                <span className="font-semibold text-foreground">{propertyName}</span>
              </p>
            </div>

            <div className="mt-5 space-y-2">
              <Label htmlFor="edit-staff-role" className="text-sm font-semibold text-foreground">
                Role
              </Label>
              <Select
                value={role}
                onValueChange={(v) => {
                  setRole(v as PatchRole)
                  setAllCategories(true)
                  setSelectedRoleCategoryIds([])
                }}
              >
                <SelectTrigger
                  id="edit-staff-role"
                  className="h-11 rounded-lg border-2 border-[#1d61f2] bg-background text-left font-medium shadow-none focus:ring-2 focus:ring-[#1d61f2]/25"
                >
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {categoryRole ? (
              <div className="mt-6 space-y-3">
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold text-foreground">{categorySectionTitle}</span>
                    <span className="text-xs text-muted-foreground">(optional — scopes module access)</span>
                  </div>
                </div>
                {showConfigureCategoriesHint ? (
                  <p className="text-sm text-muted-foreground">
                    No saved categories for this property yet. Open{' '}
                    <span className="font-medium text-foreground">Manage Categories</span> on the staff page,
                    save your categories, then open this dialog again.
                  </p>
                ) : null}
                {categoryCards}
              </div>
            ) : null}

            <DialogFooter className="mt-8 flex w-full flex-row justify-end gap-2 border-t border-border/60 pt-6 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-lg"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-lg bg-[#1d63ed] hover:bg-[#1d63ed]/90"
                onClick={() => void handleSave()}
                disabled={isSaving || isLoadingCategories}
              >
                <Save className="mr-2 h-4 w-4" aria-hidden />
                {isSaving ? 'Saving…' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
