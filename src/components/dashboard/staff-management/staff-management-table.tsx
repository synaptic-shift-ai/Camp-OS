"use client"

import { Eye, Pencil, UserMinus } from "lucide-react"
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

type StaffRow = {
  id: string
  name: string
  email: string
  role: "Admin" | "Manager" | "Staff"
  categories: string[] | "All Categories"
  status: "Active" | "Pending" | "Inactive"
  lastLogin: string
  pendingLabel?: string
}

const dummyRows: StaffRow[] = [
  {
    id: "1",
    name: "Sarah Chen",
    email: "sarah.chen@hotel.com",
    role: "Admin",
    categories: "All Categories",
    status: "Active",
    lastLogin: "Apr 8, 2026, 05:15 PM",
  },
  {
    id: "2",
    name: "Marcus Johnson",
    email: "marcus.j@hotel.com",
    role: "Manager",
    categories: ["Housekeeping", "Revenue"],
    status: "Active",
    lastLogin: "Apr 8, 2026, 12:45 AM",
  },
  {
    id: "3",
    name: "Elena Rodriguez",
    email: "elena.r@hotel.com",
    role: "Staff",
    categories: ["Housekeeping", "Front Desk"],
    status: "Active",
    lastLogin: "Apr 8, 2026, 03:30 PM",
  },
  {
    id: "4",
    name: "—",
    email: "new.hire@hotel.com",
    role: "Staff",
    categories: ["Maintenance"],
    status: "Pending",
    pendingLabel: "5d 0h left",
    lastLogin: "Never",
  },
  {
    id: "5",
    name: "James Liu",
    email: "james.liu@hotel.com",
    role: "Staff",
    categories: ["Housekeeping"],
    status: "Inactive",
    lastLogin: "Mar 15, 2026, 07:20 PM",
  },
  {
    id: "6",
    name: "Amara Obi",
    email: "amara.obi@hotel.com",
    role: "Staff",
    categories: "All Categories",
    status: "Active",
    lastLogin: "Apr 8, 2026, 04:00 PM",
  },
]

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

export function StaffManagementTable() {
  return (
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
          {dummyRows.map((row) => (
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
                <div className="flex items-center gap-3">
                  <StatusPill status={row.status} />
                  {row.pendingLabel ? (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {row.pendingLabel}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="py-1.5 text-sm text-muted-foreground whitespace-nowrap">
                {row.lastLogin}
              </TableCell>
              <TableCell className="py-0.5">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="xs" aria-label="View staff" className="h-8 w-8 p-0">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="xs" aria-label="Edit staff" className="h-8 w-8 p-0">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    aria-label="Remove staff"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

