"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Mail, Phone } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/components/ui/pagination"
import { PageSizeSelector } from "@/components/ui/page-size-selector"
import { GuestActions } from "./guest-actions"
import { GuestReservationsSheet } from "./guest-reservations-sheet"
import type { DashboardGuest } from "@/lib/dashboard/queries"
import { formatMoney, getInitials } from "@/lib/utils"

type GuestsTableProps = {
  propertyId: string
  guests: DashboardGuest[]
  currentPage: number
  pageSize: number
  total: number
  searchQuery: string | null
  siteType: string | null
  sortBy: "guest" | "totalStays" | "totalSpent" | "lastVisit"
  sortOrder: "asc" | "desc"
  searchField: "name" | "email"
}

export function GuestsTable({
  propertyId,
  guests,
  currentPage,
  pageSize,
  total,
  searchQuery,
  siteType,
  sortBy,
  sortOrder,
  searchField,
}: GuestsTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isExternalLoading, setIsExternalLoading] = useState(false)
  const [selectedGuest, setSelectedGuest] = useState<DashboardGuest | null>(null)
  const [reservationsOpen, setReservationsOpen] = useState(false)


  useEffect(() => {
    if (typeof window === "undefined") return
    const handleLoadingStart = () => setIsExternalLoading(true)
    window.addEventListener("dashboard-table-loading-start", handleLoadingStart)
    return () => window.removeEventListener("dashboard-table-loading-start", handleLoadingStart)
  }, [])

  useEffect(() => {
    setIsExternalLoading(false)
  }, [guests, currentPage, pageSize, total])

  if (!guests.length) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        {searchQuery
          ? "No guests found matching your search."
          : "No guests yet. Your first reservation will appear here!"}
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const clampedCurrentPage = Math.min(Math.max(currentPage, 1), totalPages)
  const startIndex = (clampedCurrentPage - 1) * pageSize + 1
  const endIndex = Math.min(total, clampedCurrentPage * pageSize)

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams()
    params.set("page", String(page))
    params.set("pageSize", String(pageSize))
    if (searchQuery) params.set("search", searchQuery)
    if (searchField !== "name") params.set("searchBy", searchField)
    if (siteType) params.set("siteType", siteType)
    params.set("sortBy", sortBy)
    params.set("sortOrder", sortOrder)
    return `/dashboard/${propertyId}/guests?${params.toString()}`
  }

  const goToPage = (page: number) => {
    startTransition(() => {
      router.push(buildPageHref(page))
    })
  }

  const handlePageSizeChange = (nextPageSize: number) => {
    startTransition(() => {
      const params = new URLSearchParams()
      params.set("page", "1")
      params.set("pageSize", String(nextPageSize))
      if (searchQuery) params.set("search", searchQuery)
      if (searchField !== "name") params.set("searchBy", searchField)
      if (siteType) params.set("siteType", siteType)
      params.set("sortBy", sortBy)
      params.set("sortOrder", sortOrder)
      router.push(`/dashboard/${propertyId}/guests?${params.toString()}`)
    })
  }

  const handleViewReservations = (guest: DashboardGuest) => {
    setSelectedGuest(guest)
    setReservationsOpen(true)
  }

  return (
    <>
      <div className="relative">
        {(isPending || isExternalLoading) && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center rounded-md bg-background/60"
            aria-busy="true"
            aria-label="Loading guests"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        <div className="border rounded-md">
          <Table className="text-xs">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow className="h-8">
                <TableHead className="py-1.5">Guest</TableHead>
                <TableHead className="py-1.5">Contact</TableHead>
                <TableHead className="py-1.5">Total Stays</TableHead>
                <TableHead className="py-1.5">Total Spent</TableHead>
                <TableHead className="py-1.5">Last Visit</TableHead>
                <TableHead className="w-[50px] py-1.5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {guests.map((guest) => (
                <TableRow
                  key={guest.id}
                  className="h-8 cursor-pointer hover:bg-muted/50"
                  onClick={() => handleViewReservations(guest)}
                >
                  <TableCell className="py-1.5">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-slate-200 text-slate-600 font-medium uppercase">
                          {getInitials(guest.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium capitalize">{guest.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{guest.email}</span>
                      </div>
                      {guest.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{guest.phone}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-1.5">{guest.totalStays}</TableCell>
                  <TableCell className="py-1.5">
                    {formatMoney(guest.totalSpent)}
                  </TableCell>
                  <TableCell className="py-1.5">
                    {guest.lastVisit
                      ? new Date(guest.lastVisit).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                      : "N/A"}
                  </TableCell>
                  <TableCell className="py-0.5" onClick={(event) => event.stopPropagation()}>
                    <GuestActions
                      guest={guest}
                      propertyId={propertyId}
                      onViewReservations={handleViewReservations}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
          <div>
            Showing{" "}
            <span className="font-medium">
              {startIndex}–{endIndex}
            </span>{" "}
            of <span className="font-medium">{total}</span> guests
          </div>
          <PageSizeSelector
            value={pageSize}
            onChange={handlePageSizeChange}
            disabled={isPending}
          />
        </div>
        <Pagination
          currentPage={clampedCurrentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          disabled={isPending}
          windowSize={2}
        />
      </div>

      {selectedGuest && (
        <GuestReservationsSheet
          open={reservationsOpen}
          onOpenChange={setReservationsOpen}
          guest={selectedGuest}
          propertyId={propertyId}
        />
      )}
    </>
  )
}
