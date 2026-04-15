"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const SEARCH_DEBOUNCE_MS = 300

type StaffManagementFilterProps = {
  propertyId: string
  defaultSearch?: string
  defaultRole?: string
  defaultCategory?: string
  defaultStatus?: string
  roleOptions: string[]
  categoryOptions: string[]
  statusOptions: string[]
}

function buildHref(
  pathname: string,
  base: URLSearchParams,
  patch: Record<string, string | undefined>
): string {
  const params = new URLSearchParams(base.toString())
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === "") {
      params.delete(key)
    } else {
      params.set(key, value)
    }
  }
  const q = params.toString()
  return q ? `${pathname}?${q}` : pathname
}

export type StaffManagementFilterValue = {
  search: string
  role: string
  category: string
  status: string
}

export default function StaffManagementFilter({
  propertyId,
  defaultSearch = "",
  defaultRole = "all",
  defaultCategory = "all",
  defaultStatus = "all",
  roleOptions,
  categoryOptions,
  statusOptions,
}: StaffManagementFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [searchInput, setSearchInput] = useState(defaultSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(defaultSearch.trim())

  // Sync local search input when server default changes (e.g. browser back/forward)
  useEffect(() => {
    setSearchInput(defaultSearch)
    setDebouncedSearch(defaultSearch.trim())
  }, [defaultSearch])

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [searchInput])

  // Push debounced search to URL (reset page to 1)
  useEffect(() => {
    const currentSearch = searchParams.get("search") ?? ""
    if (debouncedSearch === currentSearch) return
    const next = buildHref(pathname, searchParams, {
      search: debouncedSearch || undefined,
      page: "1",
    })
    router.replace(next)
  }, [debouncedSearch, pathname, router, searchParams])

  const pushPatch = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = buildHref(pathname, searchParams, { ...patch, page: "1" })
      router.replace(next)
    },
    [pathname, router, searchParams]
  )

  return (
    <div
      className="grid gap-4 border border-border/80 bg-card/50 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(9.5rem,0.9fr)_minmax(9.5rem,0.9fr)_minmax(9.5rem,0.9fr)] lg:items-end"
      data-property-id={propertyId}
    >
      <div className="min-w-0 space-y-1 sm:col-span-2 lg:col-span-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Search
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email..."
            className="h-9 rounded-none bg-card/50 pl-8 text-sm"
            aria-label="Search staff"
          />
        </div>
      </div>

      <div className="min-w-0 space-y-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Role
        </label>
        <Select
          value={defaultRole}
          onValueChange={(value) =>
            pushPatch({ role: value === "all" ? undefined : value })
          }
        >
          <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            <SelectItem value="all">All roles</SelectItem>
            {roleOptions.map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-0 space-y-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Categories
        </label>
        <Select
          value={defaultCategory}
          onValueChange={(value) =>
            pushPatch({ category: value === "all" ? undefined : value })
          }
        >
          <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
            <SelectValue placeholder="Categories" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            <SelectItem value="all">All categories</SelectItem>
            {categoryOptions.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-0 space-y-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Status
        </label>
        <Select
          value={defaultStatus}
          onValueChange={(value) =>
            pushPatch({ status: value === "all" ? undefined : value })
          }
        >
          <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            <SelectItem value="all">All statuses</SelectItem>
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
