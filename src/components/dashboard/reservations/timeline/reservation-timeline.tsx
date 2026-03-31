"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ReservationStatus } from "@/contracts/booking"
import type { DashboardGuest, DashboardReservation, ReservationFilters } from "@/lib/dashboard/queries"
import type { BookingRulesConfig, RateDiscountsConfig } from "@/lib/config/types"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { GuestReservationsSheet } from "@/components/dashboard/guests/guest-reservations-sheet"
import { ReservationDetailDialog } from "@/components/dashboard/reservations/reservation-detail-dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import {
    formatUtcDateLabel,
    formatUtcDayNumber,
    formatUtcMonthShort,
    formatUtcYmd,
} from "@/lib/utils"
import {
    assignLanes,
    findBlockingReservationOnSiteForMove,
    getReservationRangeIndices,
    groupReservationsBySite,
    parseYmdToUtcMidnight,
    type SiteGroup,
    type TimelineSite,
    type TimelineUnit,
} from "@/lib/dashboard/reservations/reservation-timeline"
import { ReservationBlock } from "@/components/dashboard/reservations/timeline/reservation-block"

type SearchField = NonNullable<ReservationFilters["searchField"]>

type ReservationsTimelineProps = {
    propertyId: string
    reservations: DashboardReservation[]
    currentPage: number
    pageSize: number
    total: number
    siteType: string | null
    status: ReservationStatus | null
    searchQuery: string | null
    searchField: SearchField
    rateDiscountsConfig?: RateDiscountsConfig | null | undefined
    bookingRulesConfig?: BookingRulesConfig | null | undefined
    checkInTime?: string | null
    checkOutTime?: string | null
    sites: Array<{
        id: string
        siteName: string | null
        siteNumber: string
        siteType: string
    }>
    periodPreset: "day" | "week" | "month"
    periodStartYmd: string
}

const SITE_COL_WIDTH_DEFAULT_PX = 220
const SITE_COL_WIDTH_MIN_PX = 180
const SITE_COL_WIDTH_MAX_PX = 360
const LANE_HEIGHT_PX = 44
const DEFAULT_DAY_RANGE_DAYS = 1
const DEFAULT_WEEK_RANGE_DAYS = 7
const NAME_FONT_PX = 13
const NAME_FONT_WEIGHT = 600
const ACTION_MIN_WIDTH_PX = 0
const BLOCK_HORIZONTAL_PADDING_PX = 24

const COLUMN_MIN_BY_PRESET: Record<"day" | "week" | "month", number> = {
    day: 120,
    week: 92,
    month: 44,
}

const COLUMN_MAX_BY_PRESET: Record<"day" | "week" | "month", number> = {
    day: 520,
    week: 360,
    month: 360,
}
const COLUMN_ZOOM_STEP_BY_PRESET: Record<"day" | "week" | "month", number> = {
    day: 14,
    week: 10,
    month: 6,
}

const statusBlockStyles: Record<
    ReservationStatus,
    { bg: string; border: string; text: string; pillBg: string; pillText: string }
> = {
    pending: {
        bg: "bg-yellow-500/15",
        border: "border-yellow-500/30",
        text: "text-yellow-800 dark:text-yellow-200",
        pillBg: "bg-yellow-500/20",
        pillText: "text-yellow-900 dark:text-yellow-200",
    },
    confirmed: {
        bg: "bg-blue-500/15",
        border: "border-blue-500/30",
        text: "text-blue-800 dark:text-blue-200",
        pillBg: "bg-blue-500/20",
        pillText: "text-blue-900 dark:text-blue-200",
    },
    checked_in: {
        bg: "bg-green-500/15",
        border: "border-green-500/30",
        text: "text-green-800 dark:text-green-200",
        pillBg: "bg-green-500/20",
        pillText: "text-green-900 dark:text-green-200",
    },
    checked_out: {
        bg: "bg-gray-500/10",
        border: "border-gray-400/25",
        text: "text-gray-800 dark:text-gray-200",
        pillBg: "bg-gray-500/15",
        pillText: "text-gray-900 dark:text-gray-200",
    },
    cancelled: {
        bg: "bg-red-500/12",
        border: "border-red-500/30",
        text: "text-red-800 dark:text-red-200",
        pillBg: "bg-red-500/20",
        pillText: "text-red-900 dark:text-red-200",
    },
    no_show: {
        bg: "bg-orange-500/12",
        border: "border-orange-500/30",
        text: "text-orange-800 dark:text-orange-200",
        pillBg: "bg-orange-500/20",
        pillText: "text-orange-900 dark:text-orange-200",
    },
}

export function ReservationsTimeline({
    propertyId,
    reservations,
    currentPage,
    pageSize,
    total,
    siteType,
    status,
    searchQuery,
    searchField,
    rateDiscountsConfig,
    bookingRulesConfig,
    checkInTime,
    checkOutTime,
    sites,
    periodPreset,
    periodStartYmd,
}: ReservationsTimelineProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [isPending, startTransition] = useTransition()

    const scrollContainerRef = useRef<HTMLDivElement | null>(null)
    const mobileScrollContainerRef = useRef<HTMLDivElement | null>(null)
    const dragAutoScrollRef = useRef<{ rafId: number | null; speed: number; targetSpeed: number }>({
        rafId: null,
        speed: 0,
        targetSpeed: 0,
    })
    const gridReservations = reservations

    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const clampedCurrentPage = Math.min(Math.max(currentPage, 1), totalPages)
    const startIndex = (clampedCurrentPage - 1) * pageSize + 1
    const endIndex = Math.min(total, clampedCurrentPage * pageSize)

    const buildPageHref = (page: number) => {
        const params = new URLSearchParams()

        if (siteType) params.set("siteType", siteType)
        if (status) params.set("status", status)
        if (searchQuery) params.set("search", searchQuery)
        if (searchField !== "guest") params.set("searchBy", searchField)

        params.set("view", "timeline")
        return `/dashboard/${propertyId}/reservations?${params.toString()}`
    }

    const goToPage = (page: number) => {
        startTransition(() => {
            router.push(buildPageHref(page))
        })
    }

    const handlePageSizeChange = (nextPageSize: number) => {
        startTransition(() => {
            const params = new URLSearchParams()
            if (siteType) params.set("siteType", siteType)
            if (status) params.set("status", status)
            if (searchQuery) params.set("search", searchQuery)
            if (searchField !== "guest") params.set("searchBy", searchField)
            params.set("view", "timeline")
            router.push(`/dashboard/${propertyId}/reservations?${params.toString()}`)
        })
    }

    const [selectedReservation, setSelectedReservation] = useState<DashboardReservation | null>(null)
    const [guestSheetGuest, setGuestSheetGuest] = useState<DashboardGuest | null>(null)
    const [draggedReservation, setDraggedReservation] = useState<DashboardReservation | null>(null)
    const [isDraggingReservation, setIsDraggingReservation] = useState(false)
    const [dragOverSiteId, setDragOverSiteId] = useState<string | null>(null)
    const [pendingMove, setPendingMove] = useState<{
        reservation: DashboardReservation
        fromGroup: SiteGroup
        toGroup: SiteGroup
    } | null>(null)

    const preset = periodPreset
    const periodStartUtc = useMemo(() => {
        return new Date(`${periodStartYmd}T00:00:00.000Z`)
    }, [periodStartYmd])

    const pushPeriod = (nextPreset: "day" | "week" | "month", nextStartUtc: Date) => {
        const normalizedStartUtc =
            nextPreset === "month"
                ? new Date(
                    Date.UTC(
                        nextStartUtc.getUTCFullYear(),
                        nextStartUtc.getUTCMonth(),
                        1,
                        0,
                        0,
                        0,
                        0
                    )
                )
                : nextStartUtc

        startTransition(() => {
            const params = new URLSearchParams()

            if (siteType) params.set("siteType", siteType)
            if (status) params.set("status", status)
            if (searchQuery) params.set("search", searchQuery)
            if (searchField !== "guest") params.set("searchBy", searchField)

            params.set("view", "timeline")
            params.set("period", nextPreset)
            params.set("periodStart", formatUtcYmd(normalizedStartUtc))
            const periodDayCount =
                nextPreset === "day"
                    ? 1
                    : nextPreset === "week"
                        ? 7
                        : new Date(
                            Date.UTC(
                                normalizedStartUtc.getUTCFullYear(),
                                normalizedStartUtc.getUTCMonth() + 1,
                                0
                            )
                        ).getUTCDate()
            const endInclusiveUtc = new Date(
                normalizedStartUtc.getTime() + (periodDayCount - 1) * 24 * 60 * 60 * 1000
            )
            params.set("periodEnd", formatUtcYmd(endInclusiveUtc))

            router.push(`/dashboard/${propertyId}/reservations?${params.toString()}`)
        })
    }

    const [columnWidthPx, setColumnWidthPx] = useState<number>(() => COLUMN_MIN_BY_PRESET[preset])
    const [trailingFillPx, setTrailingFillPx] = useState(0)
    const [isManualColumnZoom, setIsManualColumnZoom] = useState(false)

    const longestGuestName = useMemo(() => {
        let max = ""
        for (const r of gridReservations) {
            if (r.guestName.length > max.length) max = r.guestName
        }
        return max
    }, [gridReservations])

    const [siteColWidthPx, setSiteColWidthPx] = useState<number>(SITE_COL_WIDTH_DEFAULT_PX)

    const longestSiteLabel = useMemo(() => {
        let max = ""
        for (const r of gridReservations) {
            if (r.siteName.length > max.length) max = r.siteName
            if (r.siteNumber) {
                const sn = `#${r.siteNumber}`
                if (sn.length > max.length) max = sn
            }
        }
        return max
    }, [gridReservations])

    // Auto size the sticky Sites column based on the longest visible label.
    useEffect(() => {
        const min = SITE_COL_WIDTH_MIN_PX
        const max = SITE_COL_WIDTH_MAX_PX

        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) {
            setSiteColWidthPx(SITE_COL_WIDTH_DEFAULT_PX)
            return
        }

        // Matches `text-sm font-medium` (approx) used in the site column.
        ctx.font = `500 14px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`
        const textWidth = longestSiteLabel ? ctx.measureText(longestSiteLabel).width : 0
        const desired = Math.ceil(textWidth + 24) // px-3 padding on both sides (approx)
        const clamped = Math.min(max, Math.max(min, desired))
        setSiteColWidthPx(clamped)
    }, [longestSiteLabel])

    const { timelineUnit, timelineColumnsCount, stepMs } = useMemo(() => {
        const ONE_DAY_MS = 24 * 60 * 60 * 1000
        if (preset === "month") {
            const monthDays = new Date(
                Date.UTC(periodStartUtc.getUTCFullYear(), periodStartUtc.getUTCMonth() + 1, 0)
            ).getUTCDate()
            return {
                timelineUnit: "day" as const,
                timelineColumnsCount: monthDays,
                stepMs: monthDays * ONE_DAY_MS,
            }
        }
        if (preset === "week") {
            return {
                timelineUnit: "day" as const,
                timelineColumnsCount: DEFAULT_WEEK_RANGE_DAYS,
                stepMs: DEFAULT_WEEK_RANGE_DAYS * ONE_DAY_MS,
            }
        }
        return {
            timelineUnit: "day" as const,
            timelineColumnsCount: DEFAULT_DAY_RANGE_DAYS,
            stepMs: DEFAULT_DAY_RANGE_DAYS * ONE_DAY_MS,
        }
    }, [preset, periodStartUtc])

    // Calculate column width based on text content
    useEffect(() => {
        if (isManualColumnZoom) return
        const min = COLUMN_MIN_BY_PRESET[preset]
        const max = COLUMN_MAX_BY_PRESET[preset]

        if (!longestGuestName) {
            setColumnWidthPx(min)
            return
        }

        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) {
            setColumnWidthPx(min)
            return
        }

        ctx.font = `${NAME_FONT_WEIGHT} ${NAME_FONT_PX}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`
        const textWidth = ctx.measureText(longestGuestName).width

        const desired = Math.ceil(textWidth + ACTION_MIN_WIDTH_PX + BLOCK_HORIZONTAL_PADDING_PX)
        const clamped = Math.min(max, Math.max(min, desired))
        setColumnWidthPx(clamped)
    }, [preset, longestGuestName, isManualColumnZoom])

    useEffect(() => {
        setIsManualColumnZoom(false)
    }, [preset])

    // Stretch columns to fill viewport
    useEffect(() => {
        const isMdUp = typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : true
        const el = isMdUp ? scrollContainerRef.current : mobileScrollContainerRef.current
        if (!el) return

        const recalc = () => {
            const viewportWidth = el.clientWidth
            // Desktop has a separate sticky "Sites" column; mobile does not.
            const availableForColumns = isMdUp ? viewportWidth - siteColWidthPx : viewportWidth
            if (availableForColumns <= 0) return

            if (!isManualColumnZoom) {
                const min = COLUMN_MIN_BY_PRESET[preset]
                const max = COLUMN_MAX_BY_PRESET[preset]
                const target = Math.floor(availableForColumns / timelineColumnsCount)
                const clamped = Math.min(max, Math.max(min, target))
                // Keep columns readable. If viewport is too small, overflow container handles scrolling.
                setColumnWidthPx(clamped)
                setTrailingFillPx(Math.max(0, availableForColumns - timelineColumnsCount * clamped))
                return
            }

            const remainder = Math.max(0, availableForColumns - timelineColumnsCount * columnWidthPx)
            setTrailingFillPx(remainder)
        }

        recalc()

        if (typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver(() => recalc())
        ro.observe(el)
        return () => ro.disconnect()
    }, [preset, timelineColumnsCount, siteColWidthPx, columnWidthPx, isManualColumnZoom])

    const timelineStartUtc = periodStartUtc
    const timelineEndExclusiveUtc = new Date(timelineStartUtc.getTime() + stepMs)

    const zoomConfigRef = useRef({ preset, siteColWidthPx, timelineColumnsCount })
    zoomConfigRef.current = { preset, siteColWidthPx, timelineColumnsCount }

    const handleNativeZoomWheel = useCallback((event: WheelEvent, isDesktop: boolean) => {
        const { preset: p, siteColWidthPx: scw, timelineColumnsCount: cols } = zoomConfigRef.current
        const container = isDesktop ? scrollContainerRef.current : mobileScrollContainerRef.current

        if (event.ctrlKey) {
            event.preventDefault()
            event.stopPropagation()
            setIsManualColumnZoom(true)

            const min = COLUMN_MIN_BY_PRESET[p]
            const max = COLUMN_MAX_BY_PRESET[p]
            const zoomStep = COLUMN_ZOOM_STEP_BY_PRESET[p]
            const direction = event.deltaY < 0 ? 1 : -1

            setColumnWidthPx((current) => {
                const next = Math.min(max, Math.max(min, current + direction * zoomStep))

                if (container) {
                    const availableForColumns = isDesktop
                        ? container.clientWidth - scw
                        : container.clientWidth
                    if (availableForColumns > 0) {
                        setTrailingFillPx(Math.max(0, availableForColumns - cols * next))
                    }
                }

                return next
            })
            return
        }

        if (event.shiftKey && container) {
            event.preventDefault()
            event.stopPropagation()
            const delta = Math.abs(event.deltaX) > 0 ? event.deltaX : event.deltaY
            container.scrollLeft += delta
        }
    }, [])

    useEffect(() => {
        const desktopEl = scrollContainerRef.current
        const mobileEl = mobileScrollContainerRef.current

        const desktopHandler = (e: WheelEvent) => handleNativeZoomWheel(e, true)
        const mobileHandler = (e: WheelEvent) => handleNativeZoomWheel(e, false)

        desktopEl?.addEventListener("wheel", desktopHandler, { passive: false })
        mobileEl?.addEventListener("wheel", mobileHandler, { passive: false })

        return () => {
            desktopEl?.removeEventListener("wheel", desktopHandler)
            mobileEl?.removeEventListener("wheel", mobileHandler)
        }
    }, [handleNativeZoomWheel])

    const renderedColumnWidthPx =
        timelineColumnsCount > 0 ? columnWidthPx + trailingFillPx / timelineColumnsCount : columnWidthPx
    const timelineWidthPx = timelineColumnsCount * renderedColumnWidthPx

    const timelineColumns: Date[] = useMemo(() => {
        const cols: Date[] = []
        const ONE_DAY_MS = 24 * 60 * 60 * 1000
        for (let i = 0; i < timelineColumnsCount; i++) {
            cols.push(new Date(timelineStartUtc.getTime() + i * ONE_DAY_MS))
        }
        return cols
    }, [timelineColumnsCount, timelineStartUtc])

    const timeline: { unit: TimelineUnit; timelineStartUtc: Date; columnStartsUtc: Date[] } = {
        unit: timelineUnit,
        timelineStartUtc,
        columnStartsUtc: timelineColumns,
    }

    const monthLabelFormatter = useMemo(
        () =>
            new Intl.DateTimeFormat("en-US", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
            }),
        []
    )

    const getShiftedPeriodStartUtc = (direction: -1 | 1): Date => {
        if (preset !== "month") {
            return new Date(periodStartUtc.getTime() + direction * stepMs)
        }
        const y = periodStartUtc.getUTCFullYear()
        const m = periodStartUtc.getUTCMonth()
        return new Date(Date.UTC(y, m + direction, 1, 0, 0, 0, 0))
    }

    const periodLabel = useMemo(() => {
        if (preset === "month") {
            return monthLabelFormatter.format(timelineStartUtc)
        }
        if (preset === "day") {
            return `${formatUtcDateLabel(timelineStartUtc)}`
        }

        const endInclusive = new Date(timelineEndExclusiveUtc.getTime() - 24 * 60 * 60 * 1000)
        return `${formatUtcDateLabel(timelineStartUtc)} - ${formatUtcDateLabel(endInclusive)}`
    }, [monthLabelFormatter, timelineEndExclusiveUtc, timelineStartUtc, preset])

    const siteGroups = useMemo(() => groupReservationsBySite(gridReservations, sites as TimelineSite[]), [gridReservations, sites])
    const useCompactDateHeader = preset === "month" && renderedColumnWidthPx < 56
    const todayUtcYmd = useMemo(() => {
        const now = new Date()
        const utcMidnightToday = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
        )
        return formatUtcYmd(utcMidnightToday)
    }, [])
    const isTodayColumn = (columnStartUtc: Date) => formatUtcYmd(columnStartUtc) === todayUtcYmd

    const siteGroupById = useMemo(() => {
        return new Map(siteGroups.map((group) => [group.siteId, group]))
    }, [siteGroups])

    useEffect(() => {
        return () => {
            if (dragAutoScrollRef.current.rafId != null) {
                window.cancelAnimationFrame(dragAutoScrollRef.current.rafId)
                dragAutoScrollRef.current.rafId = null
            }
            dragAutoScrollRef.current.speed = 0
            dragAutoScrollRef.current.targetSpeed = 0
        }
    }, [])

    const startAutoScroll = (targetSpeed: number) => {
        dragAutoScrollRef.current.targetSpeed = targetSpeed
        if (dragAutoScrollRef.current.rafId != null) return
        const tick = () => {
            const EASING = 0.2
            const STOP_EPSILON = 0.15
            const { speed, targetSpeed } = dragAutoScrollRef.current
            const nextSpeed = speed + (targetSpeed - speed) * EASING

            dragAutoScrollRef.current.speed = nextSpeed
            window.scrollBy({ top: nextSpeed })

            if (Math.abs(nextSpeed) < STOP_EPSILON && Math.abs(targetSpeed) < STOP_EPSILON) {
                dragAutoScrollRef.current.speed = 0
                dragAutoScrollRef.current.targetSpeed = 0
                dragAutoScrollRef.current.rafId = null
                return
            }

            dragAutoScrollRef.current.rafId = window.requestAnimationFrame(tick)
        }
        dragAutoScrollRef.current.rafId = window.requestAnimationFrame(tick)
    }

    const stopAutoScroll = () => {
        dragAutoScrollRef.current.targetSpeed = 0
    }

    const handleDragPointerAutoScroll = (clientY: number) => {
        const EDGE_THRESHOLD_PX = 110
        const MAX_SPEED = 18
        const viewportHeight = window.innerHeight
        const distanceToTop = clientY
        const distanceToBottom = viewportHeight - clientY

        if (distanceToTop < EDGE_THRESHOLD_PX) {
            const intensity = (EDGE_THRESHOLD_PX - distanceToTop) / EDGE_THRESHOLD_PX
            startAutoScroll(-Math.max(4, Math.round(MAX_SPEED * intensity)))
            return
        }

        if (distanceToBottom < EDGE_THRESHOLD_PX) {
            const intensity = (EDGE_THRESHOLD_PX - distanceToBottom) / EDGE_THRESHOLD_PX
            startAutoScroll(Math.max(4, Math.round(MAX_SPEED * intensity)))
            return
        }

        stopAutoScroll()
    }

    type MoveReservationToSiteResult =
        | { ok: true }
        | { ok: false; conflict: boolean; message: string }

    const moveReservationToSite = async (
        reservation: DashboardReservation,
        targetSiteId: string
    ): Promise<MoveReservationToSiteResult> => {
        let response: Response
        try {
            response = await fetch(`/api/v1/reservations/${reservation.id}/update`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    check_in_date: reservation.checkIn,
                    check_out_date: reservation.checkOut,
                    num_adults: reservation.numAdults,
                    num_children: reservation.numChildren,
                    num_pets: reservation.numPets,
                    special_requests: reservation.specialRequests ?? undefined,
                    site_id: targetSiteId,
                }),
            })
        } catch {
            return { ok: false, conflict: false, message: "Could not reach the server. Try again." }
        }

        let body: unknown = null
        try {
            body = await response.json()
        } catch {
            body = null
        }

        if (!response.ok) {
            const errEnvelope = body as { error?: { code?: string; message?: string } } | null
            const message =
                errEnvelope?.error?.message?.trim() ||
                "Failed to move reservation."
            const code = errEnvelope?.error?.code
            const conflict = response.status === 409 || code === "RES_009"
            return { ok: false, conflict, message }
        }

        return { ok: true }
    }

    const endReservationDragSession = () => {
        setDraggedReservation(null)
        setIsDraggingReservation(false)
        setDragOverSiteId(null)
        stopAutoScroll()
    }

    const toastMoveConflict = (message?: string) => {
        toast({
            title: "Dates unavailable",
            description:
                message?.trim() ||
                "This site is already booked for those dates. The move was cancelled.",
            variant: "destructive",
        })
    }

    const handleDropReservationToSite = async (targetGroup: SiteGroup) => {
        if (!draggedReservation) return
        if (draggedReservation.siteId === targetGroup.siteId) return
        const sourceGroup = siteGroupById.get(draggedReservation.siteId)
        if (!sourceGroup) return

        const blocking = findBlockingReservationOnSiteForMove({
            movingReservationId: draggedReservation.id,
            targetSiteId: targetGroup.siteId,
            checkIn: draggedReservation.checkIn,
            checkOut: draggedReservation.checkOut,
            reservations: gridReservations,
        })
        if (blocking) {
            toastMoveConflict()
            endReservationDragSession()
            return
        }

        if (sourceGroup.siteType !== targetGroup.siteType) {
            setPendingMove({
                reservation: draggedReservation,
                fromGroup: sourceGroup,
                toGroup: targetGroup,
            })
            return
        }

        const result = await moveReservationToSite(draggedReservation, targetGroup.siteId)
        endReservationDragSession()

        if (!result.ok) {
            if (result.conflict) {
                toastMoveConflict(result.message)
            } else {
                toast({
                    title: "Move failed",
                    description: result.message,
                    variant: "destructive",
                })
            }
            return
        }

        toast({
            title: "Reservation moved",
            description: `Moved to ${targetGroup.siteName}${targetGroup.siteNumber ? ` (#${targetGroup.siteNumber})` : ""}.`,
        })
        router.refresh()
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-2 border border-border/80 bg-card/50 rounded-md px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center justify-between gap-2 sm:justify-start">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Period</div>
                    <div className="inline-flex items-center rounded-md border border-border/80 bg-background/40 p-1">
                        {(["day", "week", "month"] as const).map((value) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => pushPeriod(value, periodStartUtc)}
                                disabled={isPending}
                                aria-disabled={isPending}
                                className={[
                                    "rounded-sm px-3 py-1 text-xs font-medium transition-colors",
                                    preset === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60",
                                    isPending ? "opacity-60 pointer-events-none" : "",
                                ].join(" ")}
                            >
                                {value === "day" ? "Day" : value === "week" ? "Week" : "Month"}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-center space-x-4 sm:justify-end">
                    <button
                        type="button"
                        onClick={() => pushPeriod(preset, getShiftedPeriodStartUtc(-1))}
                        disabled={isPending}
                        aria-disabled={isPending}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border/80 bg-background/60 hover:bg-background transition-colors"
                        aria-label="Previous period"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="text-sm font-medium text-center">{periodLabel}</div>
                    <button
                        type="button"
                        onClick={() => pushPeriod(preset, getShiftedPeriodStartUtc(1))}
                        disabled={isPending}
                        aria-disabled={isPending}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border/80 bg-background/60 hover:bg-background transition-colors"
                        aria-label="Next period"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
            <div className="hidden rounded-md border border-border/70 bg-background/30 px-3 py-2 text-[11px] text-muted-foreground md:block">
                <span className="font-medium text-foreground">Timeline controls:</span>{" "}
                Hold <span className="font-medium text-foreground">Ctrl</span> + scroll to zoom columns, hold{" "}
                <span className="font-medium text-foreground">Shift</span> + scroll to move horizontally, press{" "}
                <span className="font-medium text-foreground">Esc</span> to cancel drag & drop and timeline
                auto-scrolls up/down while dragging near window edges.
            </div>
            {/* Desktop: single resource grid */}
            <div className="hidden md:block">
                <div className="relative border border-border/80 bg-card/50 rounded-md">
                    {isPending ? (
                        <div
                            className="absolute inset-0 z-50 flex items-center justify-center bg-background/60"
                            aria-busy="true"
                            aria-label="Loading reservations"
                        >
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    ) : null}
                    <div
                        className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        ref={scrollContainerRef}
                    >
                        <div style={{ width: siteColWidthPx + timelineWidthPx }}>
                            {/* Header */}
                            <div className="sticky top-0 z-20 bg-card">
                                <div className="flex border-b border-border/80">
                                    <div
                                        className="sticky left-0 z-40 box-border shrink-0 border-r border-border/80 bg-card px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                                        style={{ width: siteColWidthPx }}
                                    >
                                        Sites
                                    </div>
                                    <div className="flex min-w-0">
                                        {timeline.columnStartsUtc.map((colStartUtc, i) => (
                                            <div
                                                key={`${colStartUtc.toISOString()}-${i}`}
                                                className={[
                                                    "box-border flex shrink-0 items-center justify-center overflow-hidden px-1 py-1.5 text-[10px] font-medium text-black/90 dark:text-white/90",
                                                    isTodayColumn(colStartUtc)
                                                        ? "bg-primary text-primary-foreground"
                                                        : "bg-red-50 dark:bg-red-950/30",
                                                    i === timeline.columnStartsUtc.length - 1 ? "" : "border-r border-border/80",
                                                ].join(" ")}
                                                style={{ width: renderedColumnWidthPx }}
                                            >
                                                {useCompactDateHeader ? (
                                                    <div className="flex flex-col items-center leading-none">
                                                        <span>{formatUtcMonthShort(colStartUtc)}</span>
                                                        <span className="mt-0.5">{formatUtcDayNumber(colStartUtc)}</span>
                                                    </div>
                                                ) : (
                                                    <span className="truncate whitespace-nowrap">{formatUtcDateLabel(colStartUtc)}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Site rows with reservations */}
                            {siteGroups.length ? (
                                siteGroups.map((group) => {
                                    const windowStartMs = timelineStartUtc.getTime()
                                    const windowEndMs = timelineEndExclusiveUtc.getTime()

                                    const laneIntervals = group.reservations
                                        .filter((r) => {
                                            const startMs = parseYmdToUtcMidnight(r.checkIn).getTime()
                                            const endMs = parseYmdToUtcMidnight(r.checkOut).getTime()
                                            return endMs > windowStartMs && startMs < windowEndMs
                                        })
                                        .map((r) => ({
                                            id: r.id,
                                            startMs: parseYmdToUtcMidnight(r.checkIn).getTime(),
                                            endMs: parseYmdToUtcMidnight(r.checkOut).getTime(),
                                        }))

                                    const { laneById, laneCount } = assignLanes(laneIntervals)
                                    const rowHeightPx = Math.max(LANE_HEIGHT_PX, laneCount * LANE_HEIGHT_PX)

                                    return (
                                        <div
                                            key={group.siteId}
                                            className="flex items-stretch border-b border-border/80"
                                            onDragOver={(event) => {
                                                if (!draggedReservation) return
                                                event.preventDefault()
                                                handleDragPointerAutoScroll(event.clientY)
                                                if (dragOverSiteId !== group.siteId) setDragOverSiteId(group.siteId)
                                            }}
                                            onDragLeave={(event) => {
                                                if (event.currentTarget.contains(event.relatedTarget as Node)) return
                                                if (dragOverSiteId === group.siteId) setDragOverSiteId(null)
                                            }}
                                            onDrop={(event) => {
                                                event.preventDefault()
                                                setDragOverSiteId(null)
                                                stopAutoScroll()
                                                void handleDropReservationToSite(group)
                                            }}
                                        >
                                            <div
                                                className="sticky left-0 z-30 box-border shrink-0 border-r border-border/80 bg-card px-3 py-2"
                                                style={{ width: siteColWidthPx, minHeight: rowHeightPx }}
                                            >
                                                <div className="text-sm font-medium">{group.siteName}</div>
                                                {group.siteNumber ? (
                                                    <div className="mt-0.5 text-xs text-muted-foreground">#{group.siteNumber}</div>
                                                ) : null}
                                            </div>

                                            <div
                                                className="relative z-0 min-w-0 overflow-hidden"
                                                style={{ width: timelineWidthPx, minHeight: rowHeightPx }}
                                            >
                                                {isDraggingReservation && dragOverSiteId === group.siteId ? (
                                                    <div className="pointer-events-none absolute inset-0 z-20 rounded-sm border-2 border-dashed border-primary/70 bg-primary/10">
                                                        <div className="absolute left-2 top-1 text-[10px] font-semibold uppercase tracking-wide text-primary/90">
                                                            Drop here
                                                        </div>
                                                    </div>
                                                ) : null}
                                                <div className="pointer-events-none absolute inset-0 z-0 flex h-full">
                                                    {timeline.columnStartsUtc.map((colStartUtc, i) => (
                                                        <div
                                                            key={`${group.siteId}-col-${colStartUtc.toISOString()}-${i}`}
                                                            className={[
                                                                "box-border h-full shrink-0",
                                                                i === timeline.columnStartsUtc.length - 1 ? "" : "border-r border-border/80",
                                                            ].join(" ")}
                                                            style={{ width: renderedColumnWidthPx }}
                                                        />
                                                    ))}
                                                </div>

                                                {group.reservations.map((reservation) => {
                                                    const lane = laneById.get(reservation.id) ?? 0
                                                    const rangeIndices = getReservationRangeIndices({
                                                        unit: timeline.unit,
                                                        timelineStartUtc: timeline.timelineStartUtc,
                                                        columnsCount: timelineColumnsCount,
                                                        reservation,
                                                    })
                                                    if (!rangeIndices) return null

                                                    const { startIndex: startCol, endIndexExclusive: endCol } = rangeIndices
                                                    const leftPx = startCol * renderedColumnWidthPx + 3
                                                    const widthPx = (endCol - startCol) * renderedColumnWidthPx - 6
                                                    const topPx = lane * LANE_HEIGHT_PX + 4
                                                    const heightPx = LANE_HEIGHT_PX - 8

                                                    const styleForStatus = statusBlockStyles[reservation.status]

                                                    return (
                                                        <ReservationBlock
                                                            key={reservation.id}
                                                            reservation={reservation}
                                                            lane={lane}
                                                            leftPx={leftPx}
                                                            topPx={topPx}
                                                            widthPx={widthPx}
                                                            heightPx={heightPx}
                                                            styleForStatus={styleForStatus}
                                                            onOpenDialog={(r) => {
                                                                if (isDraggingReservation) return
                                                                setGuestSheetGuest(null)
                                                                setSelectedReservation(r)
                                                            }}
                                                            onDragStartReservation={(r) => {
                                                                setDraggedReservation(r)
                                                                setIsDraggingReservation(true)
                                                            }}
                                                            onDragEndReservation={() => {
                                                                setIsDraggingReservation(false)
                                                                setDragOverSiteId(null)
                                                                stopAutoScroll()
                                                            }}
                                                            isDraggingReservation={isDraggingReservation}
                                                            columnWidthPx={columnWidthPx}
                                                        />
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })
                            ) : (
                                <div className="p-10 text-center text-sm text-muted-foreground w-full">
                                    No reservations found for this period.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile: per-site cards for better UX */}
            <div className="md:hidden">
                {siteGroups.length ? (
                    <div className="space-y-3">
                        {siteGroups.map((group) => {
                            const windowStartMs = timelineStartUtc.getTime()
                            const windowEndMs = timelineEndExclusiveUtc.getTime()

                            const laneIntervals = group.reservations
                                .filter((r) => {
                                    const startMs = parseYmdToUtcMidnight(r.checkIn).getTime()
                                    const endMs = parseYmdToUtcMidnight(r.checkOut).getTime()
                                    return endMs > windowStartMs && startMs < windowEndMs
                                })
                                .map((r) => ({
                                    id: r.id,
                                    startMs: parseYmdToUtcMidnight(r.checkIn).getTime(),
                                    endMs: parseYmdToUtcMidnight(r.checkOut).getTime(),
                                }))

                            const { laneById, laneCount } = assignLanes(laneIntervals)
                            const rowHeightPx = Math.max(LANE_HEIGHT_PX, laneCount * LANE_HEIGHT_PX)

                            return (
                                <div
                                    key={group.siteId}
                                    className="border border-border/80 bg-card/50 rounded-md overflow-hidden"
                                    onDragOver={(event) => {
                                        if (!draggedReservation) return
                                        event.preventDefault()
                                        handleDragPointerAutoScroll(event.clientY)
                                        if (dragOverSiteId !== group.siteId) setDragOverSiteId(group.siteId)
                                    }}
                                    onDragLeave={(event) => {
                                        if (event.currentTarget.contains(event.relatedTarget as Node)) return
                                        if (dragOverSiteId === group.siteId) setDragOverSiteId(null)
                                    }}
                                    onDrop={(event) => {
                                        event.preventDefault()
                                        setDragOverSiteId(null)
                                        stopAutoScroll()
                                        void handleDropReservationToSite(group)
                                    }}
                                >
                                    <div className="px-3 py-2 bg-background/40 border-b border-border/80">
                                        <div className="text-sm font-medium">{group.siteName}</div>
                                        {group.siteNumber ? (
                                            <div className="mt-0.5 text-xs text-muted-foreground">#{group.siteNumber}</div>
                                        ) : null}
                                    </div>

                                    <div
                                        ref={mobileScrollContainerRef}
                                        className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                                    >
                                        <div style={{ width: timelineWidthPx }}>
                                            <div className="flex border-b border-border/80 bg-red-50 dark:bg-red-950/30">
                                                {timeline.columnStartsUtc.map((colStartUtc, i) => (
                                                    <div
                                                        key={`${group.siteId}-m-col-${colStartUtc.toISOString()}-${i}`}
                                                        className={[
                                                            "box-border flex shrink-0 items-center justify-center overflow-hidden px-1 py-1.5 text-[10px] font-medium text-black/90 dark:text-white/90",
                                                            isTodayColumn(colStartUtc)
                                                                ? "bg-primary text-primary-foreground"
                                                                : "bg-red-50 dark:bg-red-950/30",
                                                            i === timeline.columnStartsUtc.length - 1 ? "" : "border-r border-border/80",
                                                        ].join(" ")}
                                                        style={{ width: renderedColumnWidthPx }}
                                                    >
                                                        {useCompactDateHeader ? (
                                                            <div className="flex flex-col items-center leading-none">
                                                                <span>{formatUtcMonthShort(colStartUtc)}</span>
                                                                <span className="mt-0.5">{formatUtcDayNumber(colStartUtc)}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="truncate whitespace-nowrap">{formatUtcDateLabel(colStartUtc)}</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            <div
                                                className="relative min-w-0 overflow-hidden"
                                                style={{ height: rowHeightPx }}
                                            >
                                                {isDraggingReservation && dragOverSiteId === group.siteId ? (
                                                    <div className="pointer-events-none absolute inset-0 z-20 rounded-sm border-2 border-dashed border-primary/70 bg-primary/10">
                                                        <div className="absolute left-2 top-1 text-[10px] font-semibold uppercase tracking-wide text-primary/90">
                                                            Drop here
                                                        </div>
                                                    </div>
                                                ) : null}
                                                <div className="pointer-events-none absolute inset-0 z-0 flex h-full">
                                                    {timeline.columnStartsUtc.map((colStartUtc, i) => (
                                                        <div
                                                            key={`${group.siteId}-m-grid-${colStartUtc.toISOString()}-${i}`}
                                                            className={[
                                                                "box-border h-full shrink-0",
                                                                i === timeline.columnStartsUtc.length - 1 ? "" : "border-r border-border/80",
                                                            ].join(" ")}
                                                            style={{ width: renderedColumnWidthPx }}
                                                        />
                                                    ))}
                                                </div>

                                                {group.reservations.map((reservation) => {
                                                    const lane = laneById.get(reservation.id) ?? 0
                                                    const rangeIndices = getReservationRangeIndices({
                                                        unit: timeline.unit,
                                                        timelineStartUtc: timeline.timelineStartUtc,
                                                        columnsCount: timelineColumnsCount,
                                                        reservation,
                                                    })
                                                    if (!rangeIndices) return null

                                                    const { startIndex: startCol, endIndexExclusive: endCol } = rangeIndices
                                                    const leftPx = startCol * renderedColumnWidthPx + 3
                                                    const widthPx = (endCol - startCol) * renderedColumnWidthPx - 6
                                                    const topPx = lane * LANE_HEIGHT_PX + 4
                                                    const heightPx = LANE_HEIGHT_PX - 8

                                                    const styleForStatus = statusBlockStyles[reservation.status]

                                                    return (
                                                        <ReservationBlock
                                                            key={reservation.id}
                                                            reservation={reservation}
                                                            lane={lane}
                                                            leftPx={leftPx}
                                                            topPx={topPx}
                                                            widthPx={widthPx}
                                                            heightPx={heightPx}
                                                            styleForStatus={styleForStatus}
                                                            onOpenDialog={(r) => {
                                                                if (isDraggingReservation) return
                                                                setGuestSheetGuest(null)
                                                                setSelectedReservation(r)
                                                            }}
                                                            onDragStartReservation={(r) => {
                                                                setDraggedReservation(r)
                                                                setIsDraggingReservation(true)
                                                            }}
                                                            onDragEndReservation={() => {
                                                                setIsDraggingReservation(false)
                                                                setDragOverSiteId(null)
                                                                stopAutoScroll()
                                                            }}
                                                            isDraggingReservation={isDraggingReservation}
                                                            columnWidthPx={columnWidthPx}
                                                        />
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="border border-border/80 bg-card/50 rounded-md overflow-hidden w-full">
                        <div className="px-3 py-2 bg-background/40 border-b border-border/80 text-sm font-medium">
                            Bookings
                        </div>
                        <div
                            ref={mobileScrollContainerRef}
                            className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        >
                            <div style={{ width: timelineWidthPx }}>
                                <div className="flex border-b border-border/80 bg-red-50 dark:bg-red-950/30">
                                    {timeline.columnStartsUtc.map((colStartUtc, i) => (
                                        <div
                                            key={`empty-col-${colStartUtc.toISOString()}-${i}`}
                                            className={[
                                                "box-border flex shrink-0 items-center justify-center overflow-hidden px-1 py-1.5 text-[10px] font-medium text-black/90 dark:text-white/90",
                                                isTodayColumn(colStartUtc)
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-red-50 dark:bg-red-950/30",
                                                i === timeline.columnStartsUtc.length - 1 ? "" : "border-r border-border/80",
                                            ].join(" ")}
                                            style={{ width: renderedColumnWidthPx }}
                                        >
                                            {useCompactDateHeader ? (
                                                <div className="flex flex-col items-center leading-none">
                                                    <span>{formatUtcMonthShort(colStartUtc)}</span>
                                                    <span className="mt-0.5">{formatUtcDayNumber(colStartUtc)}</span>
                                                </div>
                                            ) : (
                                                <span className="truncate whitespace-nowrap">{formatUtcDateLabel(colStartUtc)}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div
                                    className="relative"
                                    style={{
                                        height: LANE_HEIGHT_PX,
                                    }}
                                >
                                    <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                                        No reservations found for this period.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays className="h-4 w-4 opacity-70" />
                    <span>
                        Showing <span className="font-medium">{gridReservations.length}</span> reservations in this period
                    </span>
                </div>
            </div>

            <AlertDialog open={pendingMove != null} onOpenChange={(open) => {
                if (!open) setPendingMove(null)
            }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Site Change</AlertDialogTitle>
                        <AlertDialogDescription>
                            Current site: {pendingMove?.fromGroup.siteName ?? "—"}
                            {pendingMove?.fromGroup.siteNumber ? ` (#${pendingMove.fromGroup.siteNumber})` : ""}
                            <br />
                            New site: {pendingMove?.toGroup.siteName ?? "—"}
                            {pendingMove?.toGroup.siteNumber ? ` (#${pendingMove.toGroup.siteNumber})` : ""}
                            <br />
                            <br />
                            These site types have different configurations and pricing.
                            <br />
                            Are you sure you want to proceed?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            onClick={() => {
                                setPendingMove(null)
                                setDraggedReservation(null)
                                setIsDraggingReservation(false)
                                setDragOverSiteId(null)
                                stopAutoScroll()
                            }}
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                if (!pendingMove) return
                                const blocking = findBlockingReservationOnSiteForMove({
                                    movingReservationId: pendingMove.reservation.id,
                                    targetSiteId: pendingMove.toGroup.siteId,
                                    checkIn: pendingMove.reservation.checkIn,
                                    checkOut: pendingMove.reservation.checkOut,
                                    reservations: gridReservations,
                                })
                                if (blocking) {
                                    toastMoveConflict()
                                    setPendingMove(null)
                                    endReservationDragSession()
                                    return
                                }
                                const result = await moveReservationToSite(
                                    pendingMove.reservation,
                                    pendingMove.toGroup.siteId
                                )
                                setPendingMove(null)
                                endReservationDragSession()
                                if (!result.ok) {
                                    if (result.conflict) {
                                        toastMoveConflict(result.message)
                                    } else {
                                        toast({
                                            title: "Move failed",
                                            description: result.message,
                                            variant: "destructive",
                                        })
                                    }
                                    return
                                }
                                toast({
                                    title: "Reservation moved",
                                    description: `Moved to ${pendingMove.toGroup.siteName}${pendingMove.toGroup.siteNumber ? ` (#${pendingMove.toGroup.siteNumber})` : ""
                                        }.`,
                                })
                                router.refresh()
                            }}
                        >
                            Proceed
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <ReservationDetailDialog
                open={!!selectedReservation}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedReservation(null)
                        setGuestSheetGuest(null)
                    }
                }}
                reservation={selectedReservation}
                onPrimaryGuestClick={(guest) => setGuestSheetGuest(guest)}
                rateDiscountsConfig={rateDiscountsConfig}
                bookingRulesConfig={bookingRulesConfig}
                checkInTime={checkInTime ?? null}
                checkOutTime={checkOutTime ?? null}
            />

            {guestSheetGuest && (
                <GuestReservationsSheet
                    open
                    onOpenChange={(open) => {
                        if (!open) setGuestSheetGuest(null)
                    }}
                    guest={guestSheetGuest}
                    propertyId={propertyId}
                    disableReservationDetailFromSheet
                />
            )}
        </div>
    )
}