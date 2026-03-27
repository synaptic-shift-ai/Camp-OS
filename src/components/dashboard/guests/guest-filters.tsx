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

type GuestFiltersProps = {
  propertyId: string
  siteTypes: { siteType: string }[]
  allowedSiteTypes: string[] | null
}

const siteTypeLabels: Record<string, string> = {
  rv: 'RV Sites',
  tent: 'Tent Sites',
  cabin: 'Cabins',
  glamping: 'Glamping',
  yurt: 'Yurts',
  other: 'Other Sites',
}

const sortOptions = [
  { value: 'guest', label: 'Primary Guest' },
  { value: 'totalStays', label: 'Total Stays' },
  { value: 'totalSpent', label: 'Total Spent' },
  { value: 'lastVisit', label: 'Last Visit' },
] as const

const searchByOptions = [
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
] as const

export function GuestFilters({ propertyId, siteTypes, allowedSiteTypes }: GuestFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const currentSearch = searchParams.get('search') ?? ''
  const currentSearchBy = (searchParams.get('searchBy') ?? 'name') as 'name' | 'email'
  const currentSiteType = searchParams.get('siteType') ?? 'all'
  const currentSortBy = searchParams.get('sortBy') ?? 'totalSpent'
  const currentSortOrder = searchParams.get('sortOrder') ?? 'desc'
  const searchPlaceholder =
    currentSearchBy === 'email' ? 'Search email...' : 'Search primary guest name...'

  // Draft values for the mobile dialog (apply only on Save)
  const [draftSearchBy, setDraftSearchBy] = useState(currentSearchBy)
  const [draftSiteType, setDraftSiteType] = useState(currentSiteType)
  const [draftSortBy, setDraftSortBy] = useState(currentSortBy)
  const [draftSortOrder, setDraftSortOrder] = useState(currentSortOrder)

  useEffect(() => {
    if (!mobileFiltersOpen) return
    setDraftSearchBy(currentSearchBy)
    setDraftSiteType(currentSiteType)
    setDraftSortBy(currentSortBy)
    setDraftSortOrder(currentSortOrder)
  }, [mobileFiltersOpen, currentSearchBy, currentSiteType, currentSortBy, currentSortOrder])

  const baseOptions =
    siteTypes.length > 0
      ? siteTypes
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
      if (!value) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })

    params.set('page', '1')

    const query = params.toString()
    const href =
      query.length > 0
        ? `/dashboard/${propertyId}/guests?${query}`
        : `/dashboard/${propertyId}/guests`

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dashboard-table-loading-start'))
    }

    startTransition(() => {
      router.push(href)
    })
  }

  const applyDraftFilters = () => {
    updateParams({
      searchBy: draftSearchBy === 'name' ? null : draftSearchBy,
      siteType: draftSiteType === 'all' ? null : draftSiteType,
      sortBy: draftSortBy,
      sortOrder: draftSortOrder,
    })
  }

  return (
    <div className="flex flex-col gap-2 border border-border/80 bg-card/50 p-2 sm:flex-row sm:items-end sm:gap-2 xl:flex-row xl:items-end xl:gap-2">
      <div className="grid grid-cols-1 gap-2 sm:flex-1 sm:grid-cols-[120px_minmax(0,1fr)] xl:flex-1 xl:w-full xl:grid-cols-[120px_minmax(0,1fr)]">
        <div className="hidden space-y-0.5 sm:block">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Search Type
          </label>
          <Select
            value={currentSearchBy}
            onValueChange={(value) => updateParams({ searchBy: value === 'name' ? null : value })}
            disabled={isPending}
          >
            <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
              <SelectValue placeholder="Name" />
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
        <div className="space-y-0.5">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Search
          </label>
          <div className="flex items-end gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                defaultValue={currentSearch}
                placeholder={searchPlaceholder}
                className="h-9 rounded-none bg-card/50 pl-8 text-sm"
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
            <div className="sm:hidden">
              <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-none bg-card/50" disabled={isPending}>
                    <SlidersHorizontal className="h-4 w-4" />
                    <span className="sr-only">Open filters</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Guest Filters</DialogTitle>
                    <DialogDescription>Search type, site, sort, and order controls.</DialogDescription>
                  </DialogHeader>
                  <div className="mt-4 space-y-3">
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Search Type
                      </label>
                      <Select
                        value={draftSearchBy}
                        onValueChange={(value) => setDraftSearchBy(value as 'name' | 'email')}
                        disabled={isPending}
                      >
                        <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
                          <SelectValue placeholder="Name" />
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
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Sites
                      </label>
                      <Select
                        value={draftSiteType}
                        onValueChange={(value) => setDraftSiteType(value)}
                        disabled={isPending}
                      >
                        <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
                          <SelectValue placeholder="All site types" />
                        </SelectTrigger>
                        <SelectContent>
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
                        Sort By
                      </label>
                      <Select
                        value={draftSortBy}
                        onValueChange={(value) => setDraftSortBy(value)}
                        disabled={isPending}
                      >
                        <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                          {sortOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Order
                      </label>
                      <Select
                        value={draftSortOrder}
                        onValueChange={(value) => setDraftSortOrder(value)}
                        disabled={isPending}
                      >
                        <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
                          <SelectValue placeholder="Order" />
                        </SelectTrigger>
                        <SelectContent>
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
      </div>

      <div className="hidden sm:block xl:hidden">
        <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-none bg-card/50" disabled={isPending}>
              <SlidersHorizontal className="h-4 w-4" />
              <span className="sr-only">Open filters</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Guest Filters</DialogTitle>
              <DialogDescription>Search type, site, sort, and order controls.</DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              <div className="space-y-0.5">
                <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Search Type
                </label>
                <Select
                  value={draftSearchBy}
                  onValueChange={(value) => setDraftSearchBy(value as 'name' | 'email')}
                  disabled={isPending}
                >
                  <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
                    <SelectValue placeholder="Name" />
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
              <div className="space-y-0.5">
                <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Sites
                </label>
                <Select
                  value={draftSiteType}
                  onValueChange={(value) => setDraftSiteType(value)}
                  disabled={isPending}
                >
                  <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
                    <SelectValue placeholder="All site types" />
                  </SelectTrigger>
                  <SelectContent>
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
                  Sort By
                </label>
                <Select
                  value={draftSortBy}
                  onValueChange={(value) => setDraftSortBy(value)}
                  disabled={isPending}
                >
                  <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Order
                </label>
                <Select
                  value={draftSortOrder}
                  onValueChange={(value) => setDraftSortOrder(value)}
                  disabled={isPending}
                >
                  <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
                    <SelectValue placeholder="Order" />
                  </SelectTrigger>
                  <SelectContent>
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

      <div className="hidden xl:contents">
        <div className="space-y-0.5 xl:w-[170px]">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Sites</label>
          <Select
            value={currentSiteType}
            onValueChange={(value) => {
              updateParams({ siteType: value === 'all' ? null : value })
            }}
            disabled={isPending}
          >
            <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
              <SelectValue placeholder="All site types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All site types</SelectItem>
              {options.map(({ siteType }) => (
                <SelectItem key={siteType} value={siteType}>
                  {siteTypeLabels[siteType] ?? siteType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

      </div>
    </div>
  )
}
