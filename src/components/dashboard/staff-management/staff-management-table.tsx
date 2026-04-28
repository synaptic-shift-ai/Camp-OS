"use client"

import { useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Eye, MoreVertical, Pencil, UserCheck, UserMinus } from "lucide-react"
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
import { Pagination } from "@/components/ui/pagination"
import { PageSizeSelector } from "@/components/ui/page-size-selector"
import { PermissionGate } from "@/components/ui/permission-gate"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { StaffManagementTableRow } from "@/lib/dashboard/staff-management-queries"

type StaffManagementTableProps = {
  propertyId: string
  staff: StaffManagementTableRow[]
  total: number
  currentPage: number
  pageSize: number
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

function StatusPill({ status }: { status: StaffManagementTableRow["status"] }) {
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

function RolePill({ role }: { role: StaffManagementTableRow["role"] }) {
  return (
    <Badge
      variant="secondary"
      className="rounded-full bg-muted text-foreground font-medium normal-case border border-muted-foreground/10 px-3 py-1"
    >
      {role}
    </Badge>
  )
}

function CategoryChips({ categories }: { categories: StaffManagementTableRow["categories"] }) {
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
  propertyId: _propertyId,
  staff,
  total,
  currentPage,
  pageSize,
  onEditStaff,
  onViewStaff,
  onDeactivateStaff,
  onReactivateStaff,
}: StaffManagementTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const clampedCurrentPage = Math.min(Math.max(currentPage, 1), totalPages)
  const startIndex = total === 0 ? 0 : (clampedCurrentPage - 1) * pageSize + 1
  const endIndex = Math.min(total, clampedCurrentPage * pageSize)

  const buildPageHref = (page: number, size?: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(page))
    params.set("pageSize", String(size ?? pageSize))
    const q = params.toString()
    return q ? `${pathname}?${q}` : pathname
  }

  const goToPage = (page: number) => {
    startTransition(() => {
      router.push(buildPageHref(page))
    })
  }

  const handlePageSizeChange = (nextPageSize: number) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("page", "1")
      params.set("pageSize", String(nextPageSize))
      const q = params.toString()
      router.push(q ? `${pathname}?${q}` : pathname)
    })
  }

  return (
    <>
      <div className="border border-border/80 bg-card/50">
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
            {staff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No staff matches the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              staff.map((row) => (
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
                    <div className="flex items-center justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="xs"
                            aria-label={`Actions for ${row.name}`}
                            className="h-8 w-8 p-0"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
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
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          <PermissionGate permission="global.change_staff_role">
                            <DropdownMenuItem
                              disabled={row.role === "Owner"}
                              onClick={() =>
                                onEditStaff?.({
                                  id: row.id,
                                  name: row.name,
                                  role: row.role,
                                  categories: row.categories,
                                })
                              }
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          </PermissionGate>
                          <PermissionGate permission="global.deactivate_staff">
                            {row.status === "Inactive" ? (
                              <DropdownMenuItem
                                disabled={row.role === "Owner"}
                                className="text-emerald-600 focus:text-emerald-600"
                                onClick={() => onReactivateStaff?.({ id: row.id, name: row.name })}
                              >
                                <UserCheck className="mr-2 h-4 w-4" />
                                Reactivate
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                disabled={row.role === "Owner"}
                                className="text-red-600 focus:text-red-600"
                                onClick={() =>
                                  onDeactivateStaff?.({
                                    id: row.id,
                                    name: row.name,
                                    status: row.status,
                                  })
                                }
                              >
                                <UserMinus className="mr-2 h-4 w-4" />
                                Deactivate
                              </DropdownMenuItem>
                            )}
                          </PermissionGate>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination footer — matches auditing/guests/reservations pattern */}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col items-center gap-2 text-xs text-muted-foreground sm:w-auto sm:flex-row sm:items-center sm:gap-4">
          <div>
            Showing{" "}
            <span className="font-medium">
              {startIndex}–{endIndex}
            </span>{" "}
            of <span className="font-medium">{total}</span> staff members
          </div>
          <PageSizeSelector
            value={pageSize}
            onChange={handlePageSizeChange}
            disabled={isPending}
          />
        </div>
        <div className="flex w-full justify-center sm:w-auto sm:justify-end">
          <Pagination
            currentPage={clampedCurrentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
            disabled={isPending}
            windowSize={2}
          />
        </div>
      </div>
    </>
  )
}
