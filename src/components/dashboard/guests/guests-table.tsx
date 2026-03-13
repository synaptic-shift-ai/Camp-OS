"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/components/ui/pagination"
import { Mail, Phone } from "lucide-react"
import { GuestActions } from "./guest-actions"
import type { DashboardGuest } from "@/lib/dashboard/queries"

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

type GuestsTableProps = {
  propertyId: string
  guests: DashboardGuest[]
  currentPage: number
  pageSize: number
  total: number
  searchQuery: string | null
}

export function GuestsTable({
  propertyId,
  guests,
  currentPage,
  pageSize,
  total,
  searchQuery,
}: GuestsTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (!guests.length) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        {searchQuery ? "No guests found matching your search." : "No guests yet. Your first reservation will appear here!"}
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
    if (searchQuery) params.set("search", searchQuery)
    return `/dashboard/${propertyId}/guests?${params.toString()}`
  }

  const goToPage = (page: number) => {
    startTransition(() => {
      router.push(buildPageHref(page))
    })
  }

  return (
    <>
      <div className="relative">
        {isPending && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center rounded-md bg-background/60"
            aria-busy="true"
            aria-label="Loading guests"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        <div className="max-h-[calc(100vh-260px)] overflow-y-auto border rounded-md">
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
                <TableRow key={guest.id} className="h-8">
                  <TableCell className="py-1.5">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src="/generic-placeholder-graphic.png?height=40&width=40" />
                        <AvatarFallback className="text-xs">
                          {guest.name.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{guest.name}</span>
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
                  <TableCell className="py-1.5">{formatMoney(guest.totalSpent)}</TableCell>
                  <TableCell className="py-1.5">
                    {guest.lastVisit
                      ? new Date(guest.lastVisit).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "N/A"}
                  </TableCell>
                  <TableCell className="py-0.5">
                    <GuestActions guest={guest} propertyId={propertyId} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          Showing{" "}
          <span className="font-medium">
            {startIndex}–{endIndex}
          </span>{" "}
          of <span className="font-medium">{total}</span> guests
        </div>
        <Pagination
          currentPage={clampedCurrentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          disabled={isPending}
          windowSize={4}
        />
      </div>
    </>
  )
}
