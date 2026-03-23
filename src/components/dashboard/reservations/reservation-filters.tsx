'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type ReservationFiltersProps = {
  propertyId: string
  allowedSiteTypes?: string[] | null
  siteTypesFromDb: { siteType: string }[]
}

const siteTypeLabels: Record<string, string> = {
  rv: 'RV Sites',
  tent: 'Tent Sites',
  cabin: 'Cabins',
  glamping: 'Glamping',
  yurt: 'Yurts',
  other: 'Other Sites',
}

const sortByOptions = [
  { value: 'confirmation', label: 'Confirmation' },
  { value: 'guest', label: 'Primary Guest' },
  { value: 'site', label: 'Site' },
  { value: 'checkIn', label: 'Check-in' },
  { value: 'checkOut', label: 'Check-out' },
  { value: 'nights', label: 'Nights' },
  { value: 'guests', label: 'Total Guests' },
  { value: 'totalAmount', label: 'Total Amount' },
  { value: 'paidAmount', label: 'Paid Amount' },
  { value: 'balanceOwed', label: 'Balance Owed' },
  { value: 'refundedAmount', label: 'Refunded Amount' },
  { value: 'status', label: 'Status' },
] as const

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'checked_in', label: 'Checked In' },
  { value: 'checked_out', label: 'Checked Out' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
] as const

const searchByOptions = [
  { value: 'confirmation', label: 'Confirmation' },
  { value: 'guest', label: 'Primary Guest' },
  { value: 'site', label: 'Site' },
] as const

export function ReservationFilters({
  propertyId,
  allowedSiteTypes,
  siteTypesFromDb,
}: ReservationFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const currentSearch = searchParams.get('search') ?? ''
  const currentSearchBy = searchParams.get('searchBy') ?? 'guest'
  const currentSiteType = searchParams.get('siteType') ?? 'all'
  const currentStatus = searchParams.get('status') ?? 'all'
  const currentSortBy = searchParams.get('sortBy') ?? 'checkIn'
  const currentSortOrder = searchParams.get('sortOrder') ?? 'desc'

  // Draft values for the mobile dialog (apply only on Save)
  const [draftSiteType, setDraftSiteType] = useState(currentSiteType)
  const [draftStatus, setDraftStatus] = useState(currentStatus)
  const [draftSortBy, setDraftSortBy] = useState(currentSortBy)
  const [draftSortOrder, setDraftSortOrder] = useState(currentSortOrder)

  useEffect(() => {
    if (!mobileFiltersOpen) return
    setDraftSiteType(currentSiteType)
    setDraftStatus(currentStatus)
    setDraftSortBy(currentSortBy)
    setDraftSortOrder(currentSortOrder)
  }, [mobileFiltersOpen, currentSiteType, currentStatus, currentSortBy, currentSortOrder])
  const searchPlaceholder =
    currentSearchBy === 'confirmation'
      ? 'Search confirmation...'
      : currentSearchBy === 'site'
        ? 'Search site...'
        : 'Search primary guest...'

  const baseOptions =
    siteTypesFromDb.length > 0
      ? siteTypesFromDb
      : (['rv', 'tent', 'cabin', 'glamping', 'yurt', 'other'] as const).map((siteType) => ({
        siteType,
      }))

  const options =
    Array.isArray(allowedSiteTypes) && allowedSiteTypes.length > 0
      ? baseOptions.filter(({ siteType }) =>
        allowedSiteTypes.map((t) => t.toLowerCase()).includes(siteType.toLowerCase())
      )
      : baseOptions

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) params.delete(key)
      else params.set(key, value)
    })

    params.set('page', '1')

    const query = params.toString()
    const href =
      query.length > 0
        ? `/dashboard/${propertyId}/reservations?${query}`
        : `/dashboard/${propertyId}/reservations`
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dashboard-table-loading-start'))
    }
    startTransition(() => {
      router.push(href)
    })
  }

  const applyDraftFilters = () => {
    updateParams({
      siteType: draftSiteType === 'all' ? null : draftSiteType,
      status: draftStatus === 'all' ? null : draftStatus,
      sortBy: draftSortBy,
      sortOrder: draftSortOrder,
    })
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2 2xl:flex-row 2xl:items-end 2xl:gap-2">
      <div className="grid grid-cols-1 gap-2 sm:flex-1 sm:grid-cols-[140px_minmax(0,1fr)] 2xl:flex-1 2xl:w-full 2xl:grid-cols-[140px_minmax(0,1fr)]">
        <div className="space-y-0.5">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Search Type
          </label>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Select
                value={currentSearchBy}
                onValueChange={(value) => updateParams({ searchBy: value === 'guest' ? null : value })}
                disabled={isPending}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Primary Guest" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {searchByOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:hidden">
              <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9" disabled={isPending}>
                    <SlidersHorizontal className="h-4 w-4" />
                    <span className="sr-only">Open filters</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Reservation Filters</DialogTitle>
                    <DialogDescription>Site, status, sort, and order controls.</DialogDescription>
                  </DialogHeader>
                  <div className="mt-4 space-y-3">
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Site
                      </label>
                      <Select
                        value={draftSiteType}
                        onValueChange={(value) => setDraftSiteType(value)}
                        disabled={isPending}
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="All site types" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          <SelectItem value="all">All site types</SelectItem>
                          {options.map(({ siteType }) => (
                            <SelectItem key={siteType} value={siteType}>
                              {siteTypeLabels[siteType] ?? siteType}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Status
                      </label>
                      <Select
                        value={draftStatus}
                        onValueChange={(value) => setDraftStatus(value)}
                        disabled={isPending}
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          <SelectItem value="all">All statuses</SelectItem>
                          {statusOptions.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Sort By
                      </label>
                      <Select
                        value={draftSortBy}
                        onValueChange={(value) => setDraftSortBy(value)}
                        disabled={isPending}
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {sortByOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Order by
                      </label>
                      <Select
                        value={draftSortOrder}
                        onValueChange={(value) => setDraftSortOrder(value)}
                        disabled={isPending}
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Order" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          <SelectItem value="desc">Descending</SelectItem>
                          <SelectItem value="asc">Ascending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => setMobileFiltersOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        applyDraftFilters()
                        setMobileFiltersOpen(false)
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
        <div className="space-y-0.5">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Search
          </label>
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              defaultValue={currentSearch}
              placeholder={searchPlaceholder}
              className="h-9 pl-8 text-sm"
              disabled={isPending}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                const value = (event.currentTarget as HTMLInputElement).value.trim()
                updateParams({ search: value.length > 0 ? value : null })
              }}
              onBlur={(event) => {
                const value = event.currentTarget.value.trim()
                if (value === currentSearch) return
                updateParams({ search: value.length > 0 ? value : null })
              }}
            />
            {isPending && (
              <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="hidden sm:block 2xl:hidden">
        <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="h-9 w-9" disabled={isPending}>
              <SlidersHorizontal className="h-4 w-4" />
              <span className="sr-only">Open filters</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reservation Filters</DialogTitle>
              <DialogDescription>Site, status, sort, and order controls.</DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              <div className="space-y-0.5">
                <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Site
                </label>
                <Select
                  value={draftSiteType}
                  onValueChange={(value) => setDraftSiteType(value)}
                  disabled={isPending}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="All site types" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="all">All site types</SelectItem>
                    {options.map(({ siteType }) => (
                      <SelectItem key={siteType} value={siteType}>
                        {siteTypeLabels[siteType] ?? siteType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-0.5">
                <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Status
                </label>
                <Select
                  value={draftStatus}
                  onValueChange={(value) => setDraftStatus(value)}
                  disabled={isPending}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="all">All statuses</SelectItem>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-0.5">
                <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Sort By
                </label>
                <Select
                  value={draftSortBy}
                  onValueChange={(value) => setDraftSortBy(value)}
                  disabled={isPending}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {sortByOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-0.5">
                <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Order by
                </label>
                <Select
                  value={draftSortOrder}
                  onValueChange={(value) => setDraftSortOrder(value)}
                  disabled={isPending}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Order" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="desc">Descending</SelectItem>
                    <SelectItem value="asc">Ascending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setMobileFiltersOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isPending}
                onClick={() => {
                  applyDraftFilters()
                  setMobileFiltersOpen(false)
                }}
              >
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="hidden 2xl:contents">
        <div className="space-y-0.5 2xl:w-[170px]">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Site</label>
          <Select
            value={currentSiteType}
            onValueChange={(value) => updateParams({ siteType: value === 'all' ? null : value })}
            disabled={isPending}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="All site types" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">All site types</SelectItem>
              {options.map(({ siteType }) => (
                <SelectItem key={siteType} value={siteType}>
                  {siteTypeLabels[siteType] ?? siteType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-0.5 2xl:w-[170px]">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Status
          </label>
          <Select
            value={currentStatus}
            onValueChange={(value) => updateParams({ status: value === 'all' ? null : value })}
            disabled={isPending}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">All statuses</SelectItem>
              {statusOptions.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-0.5 2xl:w-[170px]">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Sort By
          </label>
          <Select
            value={currentSortBy}
            onValueChange={(value) => updateParams({ sortBy: value })}
            disabled={isPending}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {sortByOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-0.5 2xl:w-[170px]">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Order by
          </label>
          <Select
            value={currentSortOrder}
            onValueChange={(value) => updateParams({ sortOrder: value })}
            disabled={isPending}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Order" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="desc">Descending</SelectItem>
              <SelectItem value="asc">Ascending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
