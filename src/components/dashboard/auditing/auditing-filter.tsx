"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { format } from "date-fns"
import { Search } from "lucide-react"
import {
    BookingDateRangePicker,
    type DateRangeValue,
} from "@/components/guest/booking-date-range-picker"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const SEARCH_DEBOUNCE_MS = 400

type AuditingFilterProps = {
    propertyId: string
    defaultSearch?: string
    defaultAction?: string
    defaultResource?: string
    defaultDateFrom?: string
    defaultDateTo?: string
    resourceOptions?: string[]
}

function buildAuditingHref(
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

function parseLocalYmd(s: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
    if (!m) return null
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function ymdRangeFromDefaults(from: string, to: string): DateRangeValue {
    if (!from || !to) return undefined
    const a = parseLocalYmd(from)
    const b = parseLocalYmd(to)
    if (!a || !b) return undefined
    return { from: a, to: b }
}

function handleAuditDateChange(
    next: DateRangeValue,
    pushPatch: (patch: Record<string, string | undefined>) => void,
    setDateRange: (v: DateRangeValue) => void
) {
    setDateRange(next)
    if (next?.from && next?.to) {
        pushPatch({
            dateFrom: format(next.from, "yyyy-MM-dd"),
            dateTo: format(next.to, "yyyy-MM-dd"),
        })
        return
    }
    if (next == null || (!next.from && !next.to)) {
        pushPatch({ dateFrom: undefined, dateTo: undefined })
    }
}

export default function AuditingFilter({
    propertyId,
    defaultSearch = "",
    defaultAction = "all",
    defaultResource = "all",
    defaultDateFrom = "",
    defaultDateTo = "",
    resourceOptions = [],
}: AuditingFilterProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [searchInput, setSearchInput] = useState(defaultSearch)
    const [debouncedSearch, setDebouncedSearch] = useState(defaultSearch.trim())
    const [dateRange, setDateRange] = useState<DateRangeValue>(() =>
        ymdRangeFromDefaults(defaultDateFrom, defaultDateTo)
    )

    useEffect(() => {
        setSearchInput(defaultSearch)
        setDebouncedSearch(defaultSearch.trim())
    }, [defaultSearch])

    useEffect(() => {
        setDateRange(ymdRangeFromDefaults(defaultDateFrom, defaultDateTo))
    }, [defaultDateFrom, defaultDateTo])

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(searchInput.trim())
        }, SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(t)
    }, [searchInput])

    useEffect(() => {
        const currentQ = searchParams.get("q") ?? ""
        if (debouncedSearch === currentQ) return
        const next = buildAuditingHref(pathname, searchParams, {
            q: debouncedSearch || undefined,
            page: "1",
        })
        router.replace(next)
    }, [debouncedSearch, pathname, router, searchParams])

    const pushPatch = useCallback(
        (patch: Record<string, string | undefined>) => {
            const next = buildAuditingHref(pathname, searchParams, { ...patch, page: "1" })
            router.replace(next)
        },
        [pathname, router, searchParams]
    )

    const normalizedResourceOptions = Array.from(
        new Set(resourceOptions.map((value) => value.trim()).filter(Boolean))
    )
    const selectedResourceValue = (
        defaultResource === "all" || normalizedResourceOptions.includes(defaultResource)
    )
        ? defaultResource
        : "all"

    const formatResourceLabel = (value: string): string =>
        value
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .replace(/\b\w/g, (char) => char.toUpperCase())

    return (
        <div
            className="grid gap-4 border border-border/80 bg-card/50 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(9.5rem,0.9fr)_minmax(9.5rem,0.9fr)_minmax(13rem,1fr)] lg:items-end"
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
                        placeholder="Search activity…"
                        className="h-9 rounded-none bg-card/50 pl-8 text-sm"
                        aria-label="Search activity"
                    />
                </div>
            </div>

            <div className="min-w-0 space-y-1">
                <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Actions
                </label>
                <Select
                    value={defaultAction}
                    onValueChange={(value) =>
                        pushPatch({ action: value === "all" ? undefined : value })
                    }
                >
                    <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
                        <SelectValue placeholder="Actions" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                        <SelectItem value="all">All actions</SelectItem>
                        <SelectItem value="login">Login</SelectItem>
                        <SelectItem value="logout">Logout</SelectItem>
                        <SelectItem value="password_change">Password change</SelectItem>
                        <SelectItem value="update">Update</SelectItem>
                        <SelectItem value="create">Create</SelectItem>
                        <SelectItem value="created">Created</SelectItem>
                        <SelectItem value="delete">Delete</SelectItem>
                        <SelectItem value="import">Import</SelectItem>
                        <SelectItem value="checked_in">Checked in</SelectItem>
                        <SelectItem value="checked_out">Checked out</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="updated">Updated</SelectItem>
                        <SelectItem value="extended">Extended</SelectItem>
                        <SelectItem value="no_show">No show</SelectItem>
                        <SelectItem value="refund_issued">Refund issued</SelectItem>
                        <SelectItem value="manual_payment">Manual payment</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="min-w-0 space-y-1">
                <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Resource
                </label>
                <Select
                    value={selectedResourceValue}
                    onValueChange={(value) =>
                        pushPatch({ resource: value === "all" ? undefined : value })
                    }
                >
                    <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
                        <SelectValue placeholder="Resource" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                        <SelectItem value="all">All resources</SelectItem>
                        {normalizedResourceOptions.map((resourceValue) => (
                            <SelectItem key={resourceValue} value={resourceValue}>
                                {formatResourceLabel(resourceValue)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="min-w-0 space-y-1 sm:col-span-2 lg:col-span-1">
                <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Dates
                </label>
                <BookingDateRangePicker
                    className={cn(
                        "!space-y-0",
                        "[&>button]:h-9 [&>button]:rounded-none [&>button]:px-2.5 [&>button]:text-sm",
                    )}
                    label=""
                    variant="dashboard"
                    allowPastDates
                    dropdownAlign="end"
                    value={dateRange}
                    onChange={(next) => handleAuditDateChange(next, pushPatch, setDateRange)}
                    numberOfMonths={1}
                />
            </div>
        </div>
    )
}
