"use client"

import { useCallback, useEffect, useState } from "react"
import { Eye, Pencil, UserCheck, UserMinus } from "lucide-react"
import type { EditStaffDialogStaff } from "@/components/dashboard/staff-management/staff-management-dialog/edit-staff-dialog"
import type { DeactivateStaffDialogTarget } from "@/components/dashboard/staff-management/staff-management-dialog/deactivate-staff-dialog"
import type { StaffDetailsDialogTarget } from "@/components/dashboard/staff-management/staff-management-dialog/staff-details-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { isAccessDeniedError } from "@/lib/utils/is-access-denied-error"
import { PermissionGate } from "@/components/ui/permission-gate"

type StaffRow = {
  id: string
  name: string
  email: string
  role: "Owner" | "Admin" | "Manager" | "Staff"
  categories: string[] | "All Categories"
  status: "Active" | "Pending" | "Inactive"
  lastLogin: string
}

type StaffManagementTableProps = {
  propertyId: string
  reloadKey?: number
  search?: string
  role?: string
  category?: string
  status?: string
  onFilterOptionsChange?: (options: {
    roles: string[]
    categories: string[]
    statuses: string[]
  }) => void
  onEditStaff?: (staff: EditStaffDialogStaff) => void
  onViewStaff?: (staff: StaffDetailsDialogTarget) => void
  onDeactivateStaff?: (staff: DeactivateStaffDialogTarget) => void
  onReactivateStaff?: (staff: { id: string; name: string }) => void
}

function initialsFromName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed || trimmed === "—") return "N"
  const words = trimmed.split(/\s+/).filter(Boolean)
  const first = words[0]?.[0] ?? ""
  const last = words.length > 1 ? words[words.length - 1]?.[0] ?? "" : ""
  return `${first}${last}`.toUpperCase() || "N"
}

function StatusPill({ status }: { status: StaffRow["status"] }) {
  const base =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border whitespace-nowrap"

  if (status === "Active") {
    return <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700`}>Active</span>
  }

  if (status === "Pending") {
    return <span className={`${base} border-amber-200 bg-amber-50 text-amber-700`}>Pending</span>
  }

  return <span className={`${base} border-muted bg-background text-muted-foreground`}>Inactive</span>
}

function RolePill({ role }: { role: StaffRow["role"] }) {
  return (
    <Badge
      variant="secondary"
      className="rounded-full bg-muted text-foreground font-medium normal-case border border-muted-foreground/10 px-3 py-1"
    >
      {role}
    </Badge>
  )
}

function CategoryChips({ categories }: { categories: StaffRow["categories"] }) {
  if (categories === "All Categories") {
    return (
      <Badge
        variant="secondary"
        className="rounded-full bg-muted/60 text-foreground font-medium normal-case border border-muted-foreground/10"
      >
        All Categories
      </Badge>
    )
  }

  if (categories.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((c) => (
        <Badge
          key={c}
          variant="secondary"
          className="rounded-full bg-muted/60 text-foreground font-medium normal-case border border-muted-foreground/10"
        >
          {c}
        </Badge>
      ))}
    </div>
  )
}

export function StaffManagementTable({
  propertyId,
  reloadKey = 0,
  search = "",
  role = "all",
  category = "all",
  status = "all",
  onFilterOptionsChange,
  onEditStaff,
  onViewStaff,
  onDeactivateStaff,
  onReactivateStaff,
}: StaffManagementTableProps) {
  const [rows, setRows] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { toast } = useToast()

  const loadStaff = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(
        `/api/v1/properties/${propertyId}/staff-management/staff`,
        { method: "GET" },
      )
      const json: { success?: boolean; data?: { staff?: StaffRow[] }; error?: { message?: string } } =
        await res.json().catch(() => ({}))
      if (!res.ok || json.success !== true) {
        throw new Error(json.error?.message ?? "Failed to load staff")
      }
      setRows(Array.isArray(json.data?.staff) ? json.data!.staff! : [])
    } catch (e: unknown) {
      setRows([])
      if (isAccessDeniedError(e)) {
        setLoadError('Access denied')
        toast({
          title: 'Access denied',
          description: "You don't have permission to view staff. Contact your property administrator if you believe this is an error.",
          variant: 'destructive',
        })
      } else {
        setLoadError(e instanceof Error ? e.message : "Failed to load staff")
      }
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useEffect(() => {
    void loadStaff()
  }, [loadStaff, reloadKey])

  useEffect(() => {
    if (!onFilterOptionsChange) return

    const roleSet = new Set<string>()
    const categorySet = new Set<string>()
    const statusSet = new Set<string>()

    for (const row of rows) {
      roleSet.add(row.role)
      statusSet.add(row.status)

      if (row.categories === "All Categories") {
        categorySet.add("All Categories")
      } else {
        for (const categoryName of row.categories) {
          categorySet.add(categoryName)
        }
      }
    }

    onFilterOptionsChange({
      roles: Array.from(roleSet).sort(),
      categories: Array.from(categorySet).sort(),
      statuses: Array.from(statusSet).sort(),
    })
  }, [onFilterOptionsChange, rows])

  const normalizedSearch = search.trim().toLowerCase()
  const filteredRows = rows.filter((row) => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      row.name.toLowerCase().includes(normalizedSearch) ||
      row.email.toLowerCase().includes(normalizedSearch)

    const matchesRole = role === "all" || row.role === role
    const matchesStatus = status === "all" || row.status === status

    const matchesCategory =
      category === "all" ||
      (row.categories === "All Categories"
        ? category === "All Categories"
        : row.categories.includes(category))

    return matchesSearch && matchesRole && matchesStatus && matchesCategory
  })

  return (
    <div className="border border-border/80 bg-card/50">
      {loadError ? (
        <div className="p-4 text-sm text-destructive">{loadError}</div>
      ) : null}
      <Table className="text-xs">
        <TableHeader className="sticky top-0 z-10 bg-red-50 dark:bg-red-950/30 uppercase">
          <TableRow className="h-8 hover:bg-transparent data-[state=selected]:bg-transparent">
            <TableHead className="w-[320px] py-1.5 dark:text-white/90 text-black/90 font-medium">
              Member
            </TableHead>
            <TableHead className="w-[140px] py-1.5 dark:text-white/90 text-black/90 font-medium">
              Role
            </TableHead>
            <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
              Categories
            </TableHead>
            <TableHead className="w-[140px] py-1.5 dark:text-white/90 text-black/90 font-medium">
              Status
            </TableHead>
            <TableHead className="w-[180px] py-1.5 dark:text-white/90 text-black/90 font-medium">
              Last Login
            </TableHead>
            <TableHead className="w-[140px] py-1.5 text-right dark:text-white/90 text-black/90 font-medium">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                Loading staff…
              </TableCell>
            </TableRow>
          ) : filteredRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                No staff matches the selected filters.
              </TableCell>
            </TableRow>
          ) : (
            filteredRows.map((row) => (
              <TableRow
                key={row.id}
                className="border-border/80 hover:bg-muted/30 data-[state=selected]:bg-muted/30"
              >
                <TableCell className="py-1.5">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-blue-50 text-blue-700 font-semibold">
                        {initialsFromName(row.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground truncate">{row.name}</div>
                      <div className="text-sm text-muted-foreground truncate">{row.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-1.5 whitespace-nowrap">
                  <RolePill role={row.role} />
                </TableCell>
                <TableCell className="py-1.5">
                  <CategoryChips categories={row.categories} />
                </TableCell>
                <TableCell className="py-1.5">
                  <StatusPill status={row.status} />
                </TableCell>
                <TableCell className="py-1.5 text-sm text-muted-foreground whitespace-nowrap">
                  {row.lastLogin}
                </TableCell>
                <TableCell className="py-0.5">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="xs"
                      aria-label="View staff"
                      className="h-8 w-8 p-0"
                      onClick={() =>
                        onViewStaff?.({
                          id: row.id,
                          name: row.name,
                          email: row.email,
                          role: row.role,
                          categories: row.categories,
                          status: row.status,
                          lastLogin: row.lastLogin,
                        })
                      }
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <PermissionGate permission="global.change_staff_role">
                      <Button
                        variant="ghost"
                        size="xs"
                        aria-label="Edit staff"
                        className="h-8 w-8 p-0"
                        disabled={row.role === "Owner"}
                        title={row.role === "Owner" ? "Owner role cannot be edited here" : "Edit role and access"}
                        onClick={() =>
                          onEditStaff?.({
                            id: row.id,
                            name: row.name,
                            role: row.role,
                            categories: row.categories,
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </PermissionGate>
                    <PermissionGate permission="global.deactivate_staff">
                      {row.status === "Inactive" ? (
                        <Button
                          variant="ghost"
                          size="xs"
                          aria-label="Reactivate staff"
                          className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                          disabled={row.role === "Owner"}
                          title={
                            row.role === "Owner"
                              ? "Owner status cannot be changed here"
                              : "Restore access for this staff member"
                          }
                          onClick={() => onReactivateStaff?.({ id: row.id, name: row.name })}
                        >
                          <UserCheck className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="xs"
                          aria-label="Deactivate staff"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                          disabled={row.role === "Owner"}
                          title={
                            row.role === "Owner"
                              ? "Owner cannot be deactivated"
                              : "Deactivate staff member"
                          }
                          onClick={() =>
                            onDeactivateStaff?.({
                              id: row.id,
                              name: row.name,
                              status: row.status,
                            })
                          }
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )}
                    </PermissionGate>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
