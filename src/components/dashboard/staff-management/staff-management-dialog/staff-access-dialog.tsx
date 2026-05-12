'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { isAccessDeniedError } from '@/lib/utils/is-access-denied-error'
import {
  DASHBOARD_ROLE_ACCESS_MODULES,
  type RoleAccessControlModuleKey,
} from '@/lib/dashboard/dashboard-nav-modules'
import { Button } from '@/components/ui/button'
import type { RoleCategoryAccess, UiRole } from '@/lib/dashboard/staff-management-queries'

const rowBase =
  'transition-colors hover:bg-muted/50 dark:hover:bg-muted/30'
const rowSelected = 'bg-[#F5F5F0] text-foreground dark:bg-accent dark:text-accent-foreground'
const rowUnselected = 'bg-transparent text-foreground'

/** Roles shown in Staff Access Management (owner is excluded; owner access is implicit). */
export const PROPERTY_STAFF_ACCESS_ROLES = ['admin', 'manager', 'staff'] as const

export type PropertyStaffAccessRole = (typeof PROPERTY_STAFF_ACCESS_ROLES)[number]

type RoleCategoryApiRole = 'owner' | 'admin' | 'manager' | 'staff'

type RoleCategoryRow = { id: string; name: string; access?: RoleCategoryAccess }

type PermissionRow = {
  id: string
  name: string
  group?: string
}

/** Placeholder capability rows per role-access module (UI only until wired to RBAC). */
const PERMISSIONS_BY_ROLE_ACCESS_MODULE: Record<RoleAccessControlModuleKey, PermissionRow[]> = {
  overview: [
    { id: 'view', name: 'View overview' },
    // { id: 'view-kpis', name: 'View KPIs' },
    // { id: 'view-activity', name: 'View activity feed' },
    // { id: 'view-checkins', name: 'View upcoming check-ins' },
  ],
  reservations: [
    { id: 'view', name: 'View reservations' },
    { id: 'create', name: 'Create reservations' },
    { id: 'modify', name: 'Modify reservations' },
    { id: 'check-in', name: 'Check-in guests' },
    { id: 'check-out', name: 'Check-out guests' },
    { id: 'cancel', name: 'Cancel reservations' },
  ],
  sites: [
    { id: 'view', name: 'View sites' },
    { id: 'create', name: 'Create sites' },
    { id: 'edit', name: 'Edit site details' },
    { id: 'delete', name: 'Delete sites' },
    { id: 'pricing', name: 'Manage pricing' },
  ],
  guests: [
    { id: 'view', name: 'View guests' },
    { id: 'edit', name: 'Edit guest profiles' },
    { id: 'delete', name: 'Delete guests' },
    { id: 'export', name: 'Export guest list' },
  ],
  'guest-communication': [
    { id: 'view', name: 'View guest communications' },
  ],
  payments: [
    { id: 'view', name: 'View payments' },
    // { id: 'refund', name: 'Issue refunds' },
    { id: 'export', name: 'Export payment list' },
  ],
  analytics: [
    { id: 'view', name: 'View analytics' },
    // { id: 'export', name: 'Export reports' },
  ],
  housekeeping: [
    { id: 'view', name: 'View tasks' },
    { id: 'create', name: 'Create tasks' },
    { id: 'update', name: 'Edit tasks' },
    { id: 'delete', name: 'Delete task' },
  ],
  maintenance: [
    { id: 'view', name: 'View WO' },
    { id: 'create', name: 'Create WO' },
    { id: 'update', name: 'Edit WO' },
    { id: 'delete', name: 'Delete WO' },
    { id: 'assign-wo', name: 'Assign WO' },
    { id: 'request-onhold', name: 'Request on hold' },
    { id: 'approve-onhold', name: 'Approve on hold' },
    { id: 'cancel-wo', name: 'Cancel WO' },
    { id: 'manage-vendors', name: 'Manage vendors' },
    { id: 'manage-pm-schedules', name: 'Manage PM schedules' },
    { id: 'view-cost-reports', name: 'View cost reports' },
  ],
  'staff-management': [
    { id: 'view', name: 'View staff' },
    { id: 'invite', name: 'Invite staff' },
    { id: 'edit', name: 'Change roles' },
    { id: 'deactivate', name: 'Deactivate staff' },
    { id: 'manage-access', name: 'Staff access management' },
  ],
  auditing: [
    { id: 'view', name: 'View audit log' },
    // { id: 'export', name: 'Export audit data' },
  ],
  automations: [
    // Dashboard
    { id: 'view-dashboard', name: 'View dashboard', group: 'Dashboard' },
    // Automations CRUD
    { id: 'view-automations', name: 'View automations', group: 'Automations' },
    { id: 'add-automations', name: 'Add automations', group: 'Automations' },
    { id: 'edit-automations', name: 'Edit automations', group: 'Automations' },
    { id: 'delete-automations', name: 'Delete automations', group: 'Automations' },
    // Execution Logs
    { id: 'view-execution-log', name: 'View execution logs', group: 'Execution Logs' },
    // Validation
    { id: 'view-validation', name: 'View validation', group: 'Validation' },
    // Email Templates
    { id: 'view-email-templates', name: 'View email templates', group: 'Email Templates' },
    { id: 'add-email-templates', name: 'Add email templates', group: 'Email Templates' },
    { id: 'edit-email-templates', name: 'Edit email templates', group: 'Email Templates' },
    { id: 'delete-email-templates', name: 'Delete email templates', group: 'Email Templates' },
    // System Automations
    { id: 'view-system-automations', name: 'View system automations', group: 'System Automations' },
    { id: 'add-system-automations', name: 'Add system automations', group: 'System Automations' },
    { id: 'edit-system-automations', name: 'Edit system automations', group: 'System Automations' },
    { id: 'delete-system-automations', name: 'Delete system automations', group: 'System Automations' },
  ],
  settings: [
    { id: 'view', name: 'View settings' },
    { id: 'edit', name: 'Edit property settings' },
  ],
  'account-profile': [
    { id: 'view', name: 'View profile' },
    { id: 'edit', name: 'Edit name and email' },
    { id: 'view-company', name: 'View company' },
    { id: 'change-password', name: 'Change password' },
  ],
}

function roleCategoriesApiRole(
  role: PropertyStaffAccessRole,
): RoleCategoryApiRole | null {
  return role
}

function buildDefaultPermissionState(): Record<string, boolean> {
  const next: Record<string, boolean> = {}
  for (const mod of DASHBOARD_ROLE_ACCESS_MODULES) {
    const perms = PERMISSIONS_BY_ROLE_ACCESS_MODULE[mod.key] ?? []
    for (const p of perms) {
      next[`${mod.key}:${p.id}`] = true
    }
  }
  return next
}

function buildStaffHousekeepingFallbackPermissionState(): Record<string, boolean> {
  const next: Record<string, boolean> = {}
  for (const mod of DASHBOARD_ROLE_ACCESS_MODULES) {
    const perms = PERMISSIONS_BY_ROLE_ACCESS_MODULE[mod.key] ?? []
    for (const p of perms) {
      next[`${mod.key}:${p.id}`] = false
    }
  }

  // Required defaults when staff + housekeeping has no stored access
  next['overview:view'] = true
  next['housekeeping:view'] = true

  const accountProfilePerms = PERMISSIONS_BY_ROLE_ACCESS_MODULE['account-profile'] ?? []
  for (const p of accountProfilePerms) {
    next[`account-profile:${p.id}`] = true
  }

  return next
}

function buildStaffMaintenanceFallbackPermissionState(): Record<string, boolean> {
  const next: Record<string, boolean> = {}
  for (const mod of DASHBOARD_ROLE_ACCESS_MODULES) {
    const perms = PERMISSIONS_BY_ROLE_ACCESS_MODULE[mod.key] ?? []
    for (const p of perms) {
      next[`${mod.key}:${p.id}`] = false
    }
  }

  // Required defaults when staff + maintenance has no stored access
  next['overview:view'] = true
  next['maintenance:view'] = true
  next['maintenance:create'] = true
  next['maintenance:update'] = true

  const accountProfilePerms = PERMISSIONS_BY_ROLE_ACCESS_MODULE['account-profile'] ?? []
  for (const p of accountProfilePerms) {
    next[`account-profile:${p.id}`] = true
  }

  return next
}

function buildAdminFallbackPermissionState(): Record<string, boolean> {
  const next = buildDefaultPermissionState()
  next['automations:add-system-automations'] = false
  next['automations:edit-system-automations'] = false
  next['automations:delete-system-automations'] = false
  return next
}

/** Matches new role-category DB defaults: overview view + full profile; all other modules off. */
function buildOverviewAndFullProfileDefaultPermissionState(): Record<string, boolean> {
  const next = buildEmptyPermissionState()
  next['overview:view'] = true
  const accountProfilePerms = PERMISSIONS_BY_ROLE_ACCESS_MODULE['account-profile'] ?? []
  for (const p of accountProfilePerms) {
    next[`account-profile:${p.id}`] = true
  }
  return next
}

function buildStaffFrontDeskFallbackPermissionState(): Record<string, boolean> {
  return buildOverviewAndFullProfileDefaultPermissionState()
}

function buildManagerFrontDeskFallbackPermissionState(): Record<string, boolean> {
  const next: Record<string, boolean> = {}
  for (const mod of DASHBOARD_ROLE_ACCESS_MODULES) {
    const perms = PERMISSIONS_BY_ROLE_ACCESS_MODULE[mod.key] ?? []
    for (const p of perms) {
      next[`${mod.key}:${p.id}`] = false
    }
  }

  // Required defaults when manager + front desk has no stored access
  next['overview:view'] = true
  next['staff-management:view'] = true
  next['reservations:view'] = true
  next['reservations:check-in'] = true
  next['reservations:check-out'] = true
  next['sites:view'] = true
  next['guests:view'] = true
  next['automations:view-dashboard'] = true
  next['automations:view-execution-log'] = true
  next['automations:view-validation'] = true
  next['automations:view-email-templates'] = true
  next['automations:view-system-automations'] = true
  next['automations:view-automations'] = true

  const accountProfilePerms = PERMISSIONS_BY_ROLE_ACCESS_MODULE['account-profile'] ?? []
  for (const p of accountProfilePerms) {
    next[`account-profile:${p.id}`] = true
  }

  return next
}

function buildEmptyPermissionState(): Record<string, boolean> {
  const next: Record<string, boolean> = {}
  for (const mod of DASHBOARD_ROLE_ACCESS_MODULES) {
    const perms = PERMISSIONS_BY_ROLE_ACCESS_MODULE[mod.key] ?? []
    for (const p of perms) {
      next[`${mod.key}:${p.id}`] = false
    }
  }
  return next
}

function buildManagerHousekeepingFallbackPermissionState(): Record<string, boolean> {
  const next: Record<string, boolean> = {}
  for (const mod of DASHBOARD_ROLE_ACCESS_MODULES) {
    const perms = PERMISSIONS_BY_ROLE_ACCESS_MODULE[mod.key] ?? []
    for (const p of perms) {
      next[`${mod.key}:${p.id}`] = false
    }
  }

  // Required defaults when manager + housekeeping has no stored access
  next['overview:view'] = true
  next['staff-management:view'] = true
  next['sites:view'] = true
  next['housekeeping:view'] = true
  next['housekeeping:create'] = true
  next['housekeeping:update'] = true
  next['housekeeping:delete'] = true
  next['automations:view-dashboard'] = true
  next['automations:view-execution-log'] = true
  next['automations:view-validation'] = true
  next['automations:view-email-templates'] = true
  next['automations:view-system-automations'] = true
  next['automations:view-automations'] = true

  const accountProfilePerms = PERMISSIONS_BY_ROLE_ACCESS_MODULE['account-profile'] ?? []
  for (const p of accountProfilePerms) {
    next[`account-profile:${p.id}`] = true
  }

  return next
}

function buildManagerMaintenanceFallbackPermissionState(): Record<string, boolean> {
  const next: Record<string, boolean> = {}
  for (const mod of DASHBOARD_ROLE_ACCESS_MODULES) {
    const perms = PERMISSIONS_BY_ROLE_ACCESS_MODULE[mod.key] ?? []
    for (const p of perms) {
      next[`${mod.key}:${p.id}`] = false
    }
  }

  // Required defaults when manager + maintenance has no stored access
  next['overview:view'] = true
  next['staff-management:view'] = true
  next['sites:view'] = true
  next['maintenance:view'] = true
  next['maintenance:create'] = true
  next['maintenance:update'] = true
  next['maintenance:delete'] = true
  next['maintenance:assign-wo'] = true
  next['maintenance:request-onhold'] = true
  next['maintenance:approve-onhold'] = true
  next['maintenance:cancel-wo'] = true
  next['maintenance:manage-vendors'] = true
  next['maintenance:manage-pm-schedules'] = true
  next['maintenance:view-cost-reports'] = true
  next['automations:view-dashboard'] = true
  next['automations:view-execution-log'] = true
  next['automations:view-validation'] = true
  next['automations:view-email-templates'] = true
  next['automations:view-system-automations'] = true
  next['automations:view-automations'] = true

  const accountProfilePerms = PERMISSIONS_BY_ROLE_ACCESS_MODULE['account-profile'] ?? []
  for (const p of accountProfilePerms) {
    next[`account-profile:${p.id}`] = true
  }

  return next
}

const sectionShell =
  'flex min-h-[min(52vh,420px)] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm sm:min-h-[min(56vh,480px)] xl:min-h-[min(62vh,620px)]'

const sectionHeader = 'border-b border-border px-3 py-3 sm:px-4'

export type StaffAccessDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
}

export function StaffAccessDialog({ open, onOpenChange, propertyId }: StaffAccessDialogProps) {
  const { toast } = useToast()
  const [selectedRole, setSelectedRole] = useState<PropertyStaffAccessRole>(
    PROPERTY_STAFF_ACCESS_ROLES[0],
  )
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedModuleKey, setSelectedModuleKey] = useState<RoleAccessControlModuleKey>(
    DASHBOARD_ROLE_ACCESS_MODULES[0]?.key ?? 'overview',
  )
  const [permissionEnabled, setPermissionEnabled] = useState<Record<string, boolean>>(() =>
    buildDefaultPermissionState(),
  )
  const [categoriesByRole, setCategoriesByRole] = useState<Record<
    RoleCategoryApiRole,
    RoleCategoryRow[]
  > | null>(null)
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [isSavingAccess, setIsSavingAccess] = useState(false)

  const selectedModule = useMemo(
    () =>
      DASHBOARD_ROLE_ACCESS_MODULES.find((m) => m.key === selectedModuleKey) ??
      DASHBOARD_ROLE_ACCESS_MODULES[0] ??
      null,
    [selectedModuleKey],
  )

  const permissionsForModule = selectedModule
    ? (PERMISSIONS_BY_ROLE_ACCESS_MODULE[selectedModule.key] ?? [])
    : []

  const hasGroupedPermissions = permissionsForModule.some((p) => p.group)

  const groupedPermissions = useMemo(() => {
    if (!hasGroupedPermissions) return null
    return permissionsForModule.reduce<Record<string, PermissionRow[]>>((acc, perm) => {
      const g = perm.group ?? 'Other'
      ;(acc[g] ??= []).push(perm)
      return acc
    }, {})
  }, [permissionsForModule, hasGroupedPermissions])

  const categoryRole = useMemo(
    () => roleCategoriesApiRole(selectedRole),
    [selectedRole],
  )

  const categoriesForSelectedRole = useMemo(() => {
    if (!categoryRole || !categoriesByRole) return []
    return categoriesByRole[categoryRole] ?? []
  }, [categoryRole, categoriesByRole])

  const selectedCategory = useMemo(
    () => categoriesForSelectedRole.find((c) => c.id === selectedCategoryId) ?? null,
    [categoriesForSelectedRole, selectedCategoryId],
  )

  useEffect(() => {
    if (!open) return
    setSelectedRole(PROPERTY_STAFF_ACCESS_ROLES[0])
    setSelectedCategoryId(null)
    setSelectedModuleKey(DASHBOARD_ROLE_ACCESS_MODULES[0]?.key ?? 'overview')
    setPermissionEnabled(buildDefaultPermissionState())
    setCategoriesByRole(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    if (!propertyId) {
      setCategoriesByRole({ owner: [], admin: [], manager: [], staff: [] })
      setCategoriesLoading(false)
      return
    }

    void (async () => {
      try {
        setCategoriesLoading(true)
        const res = await fetch(
          `/api/v1/properties/${propertyId}/staff-management/categories`,
          { method: 'GET' },
        )
        const json: {
          success?: boolean
          data?: { categoriesByRole?: Record<RoleCategoryApiRole, RoleCategoryRow[]> }
          error?: { message?: string }
        } | null = await res.json().catch(() => null)
        if (!res.ok || json?.success !== true) {
          throw new Error(json?.error?.message ?? 'Failed to load role categories')
        }
        const payload = json.data?.categoriesByRole
        if (payload) setCategoriesByRole(payload)
        else setCategoriesByRole({ owner: [], admin: [], manager: [], staff: [] })
      } catch (err: unknown) {
        if (isAccessDeniedError(err)) {
          toast({
            title: 'Access denied',
            description:
              "You don't have permission to load role categories. Contact your property administrator if you believe this is an error.",
            variant: 'destructive',
          })
          setCategoriesByRole({ owner: [], admin: [], manager: [], staff: [] })
          return
        }
        const message = err instanceof Error ? err.message : 'Failed to load role categories'
        toast({
          title: 'Failed to load role categories',
          description: message,
          variant: 'destructive',
        })
        setCategoriesByRole({ owner: [], admin: [], manager: [], staff: [] })
      } finally {
        setCategoriesLoading(false)
      }
    })()
  }, [open, propertyId, toast])

  useEffect(() => {
    const apiRole = roleCategoriesApiRole(selectedRole)
    if (!apiRole || !categoriesByRole) {
      setSelectedCategoryId(null)
      return
    }
    const list = categoriesByRole[apiRole] ?? []
    if (list.length === 0) {
      setSelectedCategoryId(null)
      return
    }
    setSelectedCategoryId((prev) => (prev && list.some((c) => c.id === prev) ? prev : list[0]?.id ?? null))
  }, [selectedRole, categoriesByRole])

  useEffect(() => {
    if (!selectedCategory) return

    const access = selectedCategory.access ?? {}
    if (access.selectedModuleKey) {
      setSelectedModuleKey(access.selectedModuleKey as RoleAccessControlModuleKey)
    }

    const mac = access.moduleAccessControl
    const hasExplicitModuleAccess =
      mac !== undefined &&
      mac !== null &&
      typeof mac === 'object' &&
      !Array.isArray(mac) &&
      Object.keys(mac).length > 0

    if (!hasExplicitModuleAccess) {
      const normalizedCategoryName = selectedCategory.name.trim().toLowerCase()
      const isStaffRole = selectedRole === 'staff'
      const isManagerRole = selectedRole === 'manager'
      const isAdminRole = selectedRole === 'admin'

      if (isAdminRole) {
        setPermissionEnabled(buildAdminFallbackPermissionState())
        return
      }

      if (isStaffRole && normalizedCategoryName === 'housekeeping') {
        setPermissionEnabled(buildStaffHousekeepingFallbackPermissionState())
        return
      }

      if (isStaffRole && normalizedCategoryName === 'maintenance') {
        setPermissionEnabled(buildStaffMaintenanceFallbackPermissionState())
        return
      }

      if (isStaffRole && normalizedCategoryName === 'front desk') {
        setPermissionEnabled(buildStaffFrontDeskFallbackPermissionState())
        return
      }

      if (isStaffRole) {
        setPermissionEnabled(buildOverviewAndFullProfileDefaultPermissionState())
        return
      }

      if (isManagerRole && normalizedCategoryName === 'front desk') {
        setPermissionEnabled(buildManagerFrontDeskFallbackPermissionState())
        return
      }

      if (isManagerRole && normalizedCategoryName === 'housekeeping') {
        setPermissionEnabled(buildManagerHousekeepingFallbackPermissionState())
        return
      }

      if (isManagerRole && normalizedCategoryName === 'maintenance') {
        setPermissionEnabled(buildManagerMaintenanceFallbackPermissionState())
        return
      }

      if (isManagerRole) {
        setPermissionEnabled(buildOverviewAndFullProfileDefaultPermissionState())
        return
      }

      setPermissionEnabled(buildOverviewAndFullProfileDefaultPermissionState())
      return
    }

    const storedModuleAccess = mac as Record<string, Record<string, boolean>>
    const nextPermissions = buildEmptyPermissionState()
    for (const [moduleKey, perms] of Object.entries(storedModuleAccess)) {
      for (const [permId, enabled] of Object.entries(perms)) {
        const key = `${moduleKey}:${permId}`
        if (Object.prototype.hasOwnProperty.call(nextPermissions, key)) {
          nextPermissions[key] = Boolean(enabled)
        }
      }
    }
    setPermissionEnabled(nextPermissions)
  }, [selectedCategory, selectedRole])

  const togglePermission = useCallback(
    (moduleKey: RoleAccessControlModuleKey, permissionId: string, checked: boolean) => {
      const key = `${moduleKey}:${permissionId}`
      setPermissionEnabled((prev) => ({ ...prev, [key]: checked }))
    },
    [],
  )

  const handleSaveAccess = useCallback(async () => {
    if (!selectedCategory) {
      toast({
        title: 'Role category required',
        description: 'Select a role category before saving access settings.',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsSavingAccess(true)
      const moduleAccessControl: Record<string, Record<string, boolean>> = {}
      for (const mod of DASHBOARD_ROLE_ACCESS_MODULES) {
        const perms = PERMISSIONS_BY_ROLE_ACCESS_MODULE[mod.key] ?? []
        const modulePermissions: Record<string, boolean> = {}
        for (const perm of perms) {
          modulePermissions[perm.id] = Boolean(
            permissionEnabled[`${mod.key}:${perm.id}`],
          )
        }
        moduleAccessControl[mod.key] = modulePermissions
      }

      const role = selectedRole as UiRole
      const payload: {
        categoryId: string
        role: UiRole
        access: RoleCategoryAccess
      } = {
        categoryId: selectedCategory.id,
        role,
        access: {
          selectedModuleKey,
          moduleAccessControl,
        },
      }

      const res = await fetch(
        `/api/v1/properties/${propertyId}/staff-management/categories`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )

      const json: { success?: boolean; error?: { message?: string } } | null =
        await res.json().catch(() => null)
      if (!res.ok || json?.success !== true) {
        throw new Error(json?.error?.message ?? 'Failed to save access settings')
      }

      toast({
        title: 'Access saved',
        variant: "success",
      })
      onOpenChange(false)
    } catch (err: unknown) {
      if (isAccessDeniedError(err)) {
        toast({
          title: 'Access denied',
          description:
            "You don't have permission to save access settings. Contact your property administrator if you believe this is an error.",
          variant: 'destructive',
        })
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to save access settings'
      toast({
        title: 'Save failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsSavingAccess(false)
    }
  }, [
    onOpenChange,
    permissionEnabled,
    propertyId,
    selectedCategory,
    selectedModuleKey,
    selectedRole,
    toast,
  ])

  const roleAccessSubtitle = selectedCategory
    ? `${selectedRole} · ${selectedCategory.name}`
    : selectedRole

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        wide
        className={cn(
          'flex min-h-[min(72vh,760px)] flex-col gap-4 overflow-hidden',
          'w-[75vw] max-w-[75vw] max-h-[96vh]',
          'p-4 sm:p-6 sm:gap-5',
        )}
        aria-describedby={undefined}
      >
        <DialogHeader className="shrink-0 space-y-1 text-left">
          <DialogTitle className="text-xl sm:text-2xl">Staff Access Management</DialogTitle>
        </DialogHeader>

        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          <section className={cn(sectionShell, 'min-w-0')}>
            <div className={sectionHeader}>
              <h2 className="text-sm font-semibold tracking-tight sm:text-base">Role</h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {PROPERTY_STAFF_ACCESS_ROLES.map((role) => (
                <div key={role}>
                  <button
                    type="button"
                    onClick={() => setSelectedRole(role)}
                    className={cn(
                      'flex w-full items-center px-3 py-3 text-left text-sm sm:px-4 sm:text-[15px]',
                      rowBase,
                      role === selectedRole ? rowSelected : rowUnselected,
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate font-mono font-medium">{role}</span>
                  </button>
                  <Separator />
                </div>
              ))}
            </div>
          </section>

          <section className={cn(sectionShell, 'min-w-0')}>
            <div className={sectionHeader}>
              <h2 className="text-sm font-semibold tracking-tight sm:text-base">Role categories</h2>
              <p className="mt-0.5 truncate text-xs text-muted-foreground font-mono">{selectedRole}</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {categoriesLoading ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">Loading categories…</div>
              ) : categoriesForSelectedRole.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">
                  No categories for this role yet. Use Categories on the staff page to add them.
                </div>
              ) : (
                categoriesForSelectedRole.map((cat) => (
                  <div key={cat.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={cn(
                        'flex w-full items-center px-3 py-3 text-left text-sm sm:px-4 sm:text-[15px]',
                        rowBase,
                        cat.id === selectedCategoryId ? rowSelected : rowUnselected,
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{cat.name}</span>
                    </button>
                    <Separator />
                  </div>
                ))
              )}
            </div>
          </section>

          <section className={cn(sectionShell, 'min-w-0')}>
            <div className={sectionHeader}>
              <h2 className="text-sm font-semibold tracking-tight sm:text-base">Role access control</h2>
              <p className="mt-0.5 truncate text-xs text-muted-foreground font-mono">{roleAccessSubtitle}</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {DASHBOARD_ROLE_ACCESS_MODULES.map((mod) => (
                <div key={mod.key}>
                  <button
                    type="button"
                    onClick={() => setSelectedModuleKey(mod.key)}
                    className={cn(
                      'w-full px-3 py-3 text-left text-sm font-medium sm:px-4 sm:text-[15px]',
                      rowBase,
                      mod.key === selectedModuleKey ? rowSelected : rowUnselected,
                    )}
                  >
                    {mod.name}
                  </button>
                  <Separator />
                </div>
              ))}
            </div>
          </section>

          <section className={cn(sectionShell, 'min-w-0')}>
            <div className={sectionHeader}>
              <h2 className="text-sm font-semibold tracking-tight sm:text-base">Module access control</h2>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {selectedModule ? selectedModule.name : '—'}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {hasGroupedPermissions && groupedPermissions ? (
                Object.entries(groupedPermissions).map(([groupName, perms], idx) => (
                  <Collapsible defaultOpen={false} key={groupName} className="group">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-center justify-between px-3 py-2 sm:px-4',
                          'font-medium text-sm bg-muted/50 hover:bg-muted rounded transition-colors',
                        )}
                      >
                        <span>{groupName}</span>
                        <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {perms.map((perm) => {
                        const moduleKey = selectedModule?.key ?? DASHBOARD_ROLE_ACCESS_MODULES[0].key
                        const checked = permissionEnabled[`${moduleKey}:${perm.id}`] ?? false
                        return (
                          <div key={perm.id}>
                            <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
                              <Switch
                                checked={checked}
                                onCheckedChange={(next) => togglePermission(moduleKey, perm.id, next)}
                                className="data-[state=checked]:bg-[#8b9568] data-[state=checked]:dark:bg-primary data-[state=unchecked]:bg-input"
                                aria-label={perm.name}
                              />
                              <span className="text-sm font-medium">{perm.name}</span>
                            </div>
                            <Separator />
                          </div>
                        )
                      })}
                    </CollapsibleContent>
                    {idx < Object.keys(groupedPermissions).length - 1 && <Separator />}
                  </Collapsible>
                ))
              ) : (
                permissionsForModule.map((perm) => {
                  const moduleKey = selectedModule?.key ?? DASHBOARD_ROLE_ACCESS_MODULES[0].key
                  const checked = permissionEnabled[`${moduleKey}:${perm.id}`] ?? false
                  return (
                    <div key={perm.id}>
                      <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
                        <Switch
                          checked={checked}
                          onCheckedChange={(next) => togglePermission(moduleKey, perm.id, next)}
                          className="data-[state=checked]:bg-[#8b9568] data-[state=checked]:dark:bg-primary data-[state=unchecked]:bg-input"
                          aria-label={perm.name}
                        />
                        <span className="text-sm font-medium">{perm.name}</span>
                      </div>
                      <Separator />
                    </div>
                  )
                })
              )}
            </div>
          </section>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-lg" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSaveAccess} disabled={isSavingAccess || !selectedCategory}>
            {isSavingAccess ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
