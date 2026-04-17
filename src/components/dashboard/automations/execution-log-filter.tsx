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

type ExecutionLogFilterProps = {
    automations: Array<{ id: string; name: string }>
    currentParams: {
        automationId?: string
        outcome?: string
        dateFrom?: string
        dateTo?: string
        search?: string
    }
    onFilterChange: (patch: Record<string, string | undefined>) => void
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

function handleDateChange(
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

export function ExecutionLogFilter({
    automations,
    currentParams,
    onFilterChange,
}: ExecutionLogFilterProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [searchInput, setSearchInput] = useState(currentParams.search ?? "")
    const [debouncedSearch, setDebouncedSearch] = useState((currentParams.search ?? "").trim())
    const [dateRange, setDateRange] = useState<DateRangeValue>(() =>
        ymdRangeFromDefaults(currentParams.dateFrom ?? "", currentParams.dateTo ?? "")
    )

    useEffect(() => {
        setSearchInput(currentParams.search ?? "")
        setDebouncedSearch((currentParams.search ?? "").trim())
    }, [currentParams.search])

    useEffect(() => {
        setDateRange(ymdRangeFromDefaults(currentParams.dateFrom ?? "", currentParams.dateTo ?? ""))
    }, [currentParams.dateFrom, currentParams.dateTo])

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(searchInput.trim())
        }, SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(t)
    }, [searchInput])

    useEffect(() => {
        const currentQ = searchParams.get("search") ?? ""
        if (debouncedSearch === currentQ) return
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
            onFilterChange(patch)
        },
        [pathname, router, searchParams, onFilterChange]
    )

    return (
        <div
            className="grid gap-4 border border-border/80 bg-card/50 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(9.5rem,0.9fr)_minmax(9.5rem,0.9fr)_minmax(13rem,1fr)] lg:items-end"
        >
            <div className="min-w-0 space-y-1 sm:col-span-2 lg:col-span-1">
                <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Search Entity
                </label>
                <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search automation or entity…"
                        className="h-9 rounded-none bg-card/50 pl-8 text-sm"
                        aria-label="Search automation or entity"
                    />
                </div>
            </div>

            <div className="min-w-0 space-y-1">
                <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Automation
                </label>
                <Select
                    value={currentParams.automationId ?? "all"}
                    onValueChange={(value) =>
                        pushPatch({ automationId: value === "all" ? undefined : value })
                    }
                >
                    <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
                        <SelectValue placeholder="All automations" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                        <SelectItem value="all">All Automations</SelectItem>
                        {automations.map((aut) => (
                            <SelectItem key={aut.id} value={aut.id}>
                                {aut.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="min-w-0 space-y-1">
                <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Outcome
                </label>
                <Select
                    value={currentParams.outcome ?? "all"}
                    onValueChange={(value) =>
                        pushPatch({ outcome: value === "all" ? undefined : value })
                    }
                >
                    <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
                        <SelectValue placeholder="All outcomes" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="passed">Passed</SelectItem>
                        <SelectItem value="skipped">Skipped</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
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
                    onChange={(next) => handleDateChange(next, pushPatch, setDateRange)}
                    numberOfMonths={1}
                />
            </div>
        </div>
    )
}
