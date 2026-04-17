'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { isAccessDeniedError } from '@/lib/utils/is-access-denied-error'
import { Plus, Tag, Trash2 } from 'lucide-react'

export type RoleId = 'admin' | 'manager' | 'staff'

export type CategoryRow = {
  id: string
  name: string
  isDefault: boolean
}

const ROLE_LABEL: Record<RoleId, string> = {
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
}

const ROLE_ORDER: RoleId[] = ['admin', 'manager', 'staff']

function createId() {
  return `cat-${crypto.randomUUID()}`
}

const INITIAL_CATEGORIES: Record<RoleId, CategoryRow[]> = {
  admin: [
    { id: 'a1', name: 'Operations', isDefault: true },
    { id: 'a2', name: 'Finance', isDefault: true },
    { id: 'a3', name: 'Guest Services', isDefault: true },
  ],
  manager: [
    { id: 'm1', name: 'Housekeeping', isDefault: true },
    { id: 'm2', name: 'Maintenance', isDefault: true },
    { id: 'm3', name: 'Front Desk', isDefault: true },
  ],
  staff: [
    { id: 's1', name: 'Housekeeping', isDefault: true },
    { id: 's2', name: 'Maintenance', isDefault: true },
    { id: 's3', name: 'Front Desk', isDefault: true },
  ],
}

export type StaffManagementCategoriesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  onSave?: (categoriesByRole: Record<RoleId, CategoryRow[]>) => void
}

export function StaffManagementCategoriesDialog({
  open,
  onOpenChange,
  propertyId,
  onSave,
}: StaffManagementCategoriesDialogProps) {
  const { toast } = useToast()
  const [activeRole, setActiveRole] = useState<RoleId>('staff')
  const [byRole, setByRole] = useState<Record<RoleId, CategoryRow[]>>(() =>
    structuredClone(INITIAL_CATEGORIES),
  )
  const [newName, setNewName] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const mergeFromDb = useCallback((payload: Record<RoleId, { name: string }[]>) => {
    const defaultsByRole = INITIAL_CATEGORIES
    const next: Record<RoleId, CategoryRow[]> = {
      admin: [],
      manager: [],
      staff: [],
    }

    for (const role of ROLE_ORDER) {
      const defaultNames = new Set(defaultsByRole[role].map((c) => c.name))
      const rows = payload[role] ?? []
      if (rows.length === 0) {
        next[role] = structuredClone(defaultsByRole[role])
        continue
      }

      next[role] = rows.map((r) => ({
        id: createId(),
        name: r.name,
        isDefault: defaultNames.has(r.name),
      }))
    }

    return next
  }, [])

  useEffect(() => {
    if (!open) return
    setByRole(structuredClone(INITIAL_CATEGORIES))
    setActiveRole('staff')
    setNewName('')

    void (async () => {
      try {
        setIsLoading(true)
        const res = await fetch(
          `/api/v1/properties/${propertyId}/staff-management/categories`,
          { method: 'GET' },
        )
        const json: any = await res.json().catch(() => null)
        if (!res.ok || json?.success !== true) {
          throw new Error(json?.error?.message ?? 'Failed to load categories')
        }

        const categoriesByRole = json.data?.categoriesByRole as
          | Record<RoleId, { name: string }[]>
          | undefined

        if (categoriesByRole) {
          setByRole(mergeFromDb(categoriesByRole))
        }
      } catch (err: unknown) {
        if (isAccessDeniedError(err)) {
          toast({
            title: 'Access denied',
            description: "You don't have permission to view categories. Contact your property administrator if you believe this is an error.",
            variant: 'destructive',
          })
          return
        }
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[StaffManagement] Load categories failed', {
          propertyId,
          message,
        })
        toast({
          title: 'Failed to load categories',
          description: message,
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    })()
  }, [open, propertyId, mergeFromDb, toast])

  useEffect(() => {
    setNewName('')
  }, [activeRole])

  const counts = useMemo(() => {
    return ROLE_ORDER.reduce(
      (acc, role) => {
        acc[role] = byRole[role].length
        return acc
      },
      {} as Record<RoleId, number>,
    )
  }, [byRole])

  const addCategory = useCallback(() => {
    const trimmed = newName.trim()
    if (!trimmed) return
    setByRole((prev) => ({
      ...prev,
      [activeRole]: [
        ...prev[activeRole],
        { id: createId(), name: trimmed, isDefault: false },
      ],
    }))
    setNewName('')
  }, [activeRole, newName])

  const removeCategory = useCallback((role: RoleId, id: string) => {
    setByRole((prev) => ({
      ...prev,
      [role]: prev[role].filter((c) => {
        if (c.id !== id) return true
        if (c.isDefault) return true
        return false
      }),
    }))
  }, [])

  const handleSave = () => {
    onSave?.(structuredClone(byRole))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-6 sm:rounded-lg">
        <DialogHeader className="space-y-2 pb-4 text-left">
          <DialogTitle className="text-lg font-semibold">Manage Categories</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Each role has its own set of categories. Add custom categories per role.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeRole} onValueChange={(v) => setActiveRole(v as RoleId)} className="w-full">
          <TabsList className="flex h-11 w-full gap-1 rounded-lg bg-muted p-1">
            {ROLE_ORDER.map((role) => (
              <TabsTrigger
                key={role}
                value={role}
                className={cn(
                  'flex-1 rounded-md px-3 py-2 text-sm font-medium shadow-none',
                  'data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:shadow-sm',
                )}
              >
                {ROLE_LABEL[role]} ({counts[role]})
              </TabsTrigger>
            ))}
          </TabsList>

          {ROLE_ORDER.map((role) => (
            <TabsContent key={role} value={role} className="mt-4 space-y-4 outline-none">
              <p className="text-sm text-muted-foreground">
                Define categories available for the{' '}
                <span className="font-semibold text-foreground">{ROLE_LABEL[role]}</span> role. Default
                categories cannot be removed.
              </p>

              <ul className="flex max-h-[min(40vh,320px)] flex-col gap-2 overflow-y-auto pr-0.5">
                {byRole[role].map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
                  >
                    <Tag className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                      {row.name}
                    </span>
                    {row.isDefault ? (
                      <span className="shrink-0 text-sm text-muted-foreground">Default</span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remove ${row.name}`}
                        onClick={() => removeCategory(role, row.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </TabsContent>
          ))}
        </Tabs>

        <div className="mt-4 flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name"
            className="h-10 flex-1 rounded-lg border-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCategory()
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-lg border-input"
            aria-label="Add category"
            onClick={addCategory}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <DialogFooter className="mt-6 flex w-full flex-row justify-end gap-2 sm:gap-2">
          <Button type="button" variant="outline" className="rounded-lg" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-lg bg-[#1d63ed] hover:bg-[#1d63ed]/90"
            onClick={handleSave}
            disabled={isLoading}
          >
            Save Categories
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
