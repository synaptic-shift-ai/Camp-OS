"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ReservationStatus } from "@/contracts/booking"
import type { DashboardReservation, ReservationFilters } from "@/lib/dashboard/queries"
import type { BookingRulesConfig, RateDiscountsConfig } from "@/lib/config/types"
import { ReservationActions } from "@/components/admin/reservation-actions"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    assignLanes,
    diffDaysUtc,
    parseYmdToUtcMidnight,
    type TimelineUnit,
} from "@/lib/dashboard/reservations/reservations-time-utils"
import {
    AmericanExpressFlatRoundedIcon,
    DiscoverFlatRoundedIcon,
    GenericFlatRoundedIcon,
    MastercardFlatRoundedIcon,
    VisaFlatRoundedIcon,
} from "react-svg-credit-card-payment-icons"

type SortBy = NonNullable<ReservationFilters["sortBy"]>
type SortOrder = NonNullable<ReservationFilters["sortOrder"]>
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
    sortBy: SortBy
    sortOrder: SortOrder
    searchField: SearchField
    rateDiscountsConfig?: RateDiscountsConfig | null | undefined
    bookingRulesConfig?: BookingRulesConfig | null | undefined
    checkInTime?: string | null
    checkOutTime?: string | null
    periodPreset: "day" | "week" | "month"
    periodStartYmd: string
}

const SITE_COL_WIDTH_DEFAULT_PX = 220
const SITE_COL_WIDTH_MIN_PX = 180
const SITE_COL_WIDTH_MAX_PX = 360
const LANE_HEIGHT_PX = 44
// Default timeline window
const DEFAULT_DAY_RANGE_DAYS = 1
const DEFAULT_WEEK_RANGE_DAYS = 7
const DEFAULT_MONTH_RANGE_DAYS = 30

// Column sizing constants
const NAME_FONT_PX = 13
const NAME_FONT_WEIGHT = 600
const ACTION_MIN_WIDTH_PX = 44
const BLOCK_HORIZONTAL_PADDING_PX = 24
const COLUMN_MIN_BY_PRESET: Record<"day" | "week" | "month", number> = {
    day: 120,
    week: 92,
    month: 120,
}
const COLUMN_MAX_BY_PRESET: Record<"day" | "week" | "month", number> = {
    day: 520,
    week: 360,
    month: 360,
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

const statusTextColors: Record<ReservationStatus, string> = {
    pending: "text-yellow-600",
    confirmed: "text-blue-600",
    checked_in: "text-green-600",
    checked_out: "text-gray-600",
    cancelled: "text-red-600",
    no_show: "text-orange-600",
}

function formatUtcDateLabel(dateUtcMidnight: Date): string {
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
    }).format(dateUtcMidnight)
}

function formatUtcMonthLabel(dateUtcMidnight: Date): string {
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    }).format(dateUtcMidnight)
}

function formatUtcYmd(date: Date): string {
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, "0")
    const d = String(date.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
}

function getStatusLabel(status: string): string {
    return status.replace("_", " ")
}

function formatMoney(cents: number): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format(cents / 100)
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    })
}

type PaymentCardDisplay = {
    brand: string
    last4: string
    exp_month: number
    exp_year: number
}

function PaymentCardLogo({ brand }: { brand: string }) {
    const normalized = brand.trim().toLowerCase()
    switch (normalized) {
        case "visa":
            return <VisaFlatRoundedIcon width={56} />
        case "mastercard":
            return <MastercardFlatRoundedIcon width={56} />
        case "amex":
        case "american express":
        case "americanexpress":
            return <AmericanExpressFlatRoundedIcon width={56} />
        case "discover":
            return <DiscoverFlatRoundedIcon width={56} />
        default:
            return <GenericFlatRoundedIcon width={56} />
    }
}

/**
 * Calculate the column range for a reservation within the timeline.
 * Returns null if the reservation doesn't overlap the visible timeline.
 */
function getReservationRangeIndices(params: {
    unit: TimelineUnit
    timelineStartUtc: Date
    columnsCount: number
    reservation: { checkIn: string; checkOut: string }
}): { startIndex: number; endIndexExclusive: number } | null {
    const { unit, timelineStartUtc, columnsCount, reservation } = params

    const checkInUtc = parseYmdToUtcMidnight(reservation.checkIn)
    const checkOutUtc = parseYmdToUtcMidnight(reservation.checkOut)

    // Calculate days from timeline start to reservation dates
    // Positive = after timeline start, Negative = before timeline start
    const offsetStartDays = diffDaysUtc(timelineStartUtc, checkInUtc)
    const offsetEndDays = diffDaysUtc(timelineStartUtc, checkOutUtc)

    let startIndex = offsetStartDays
    let endIndexExclusive = offsetEndDays

    // For week unit, convert to week indices
    if (unit === "week") {
        startIndex = Math.floor(offsetStartDays / 7)
        endIndexExclusive = Math.ceil(offsetEndDays / 7)
    }

    // Check if reservation is completely outside the timeline
    // endIndexExclusive <= 0 means reservation ends before timeline starts
    // startIndex >= columnsCount means reservation starts after timeline ends
    if (endIndexExclusive <= 0 || startIndex >= columnsCount) {
        return null
    }

    // Clamp to visible range
    const clampedStart = Math.max(0, startIndex)
    const clampedEnd = Math.min(columnsCount, endIndexExclusive)

    // Validate we have a visible range
    if (clampedEnd <= clampedStart) {
        return null
    }

    return { startIndex: clampedStart, endIndexExclusive: clampedEnd }
}

function groupReservationsBySite(reservations: DashboardReservation[]) {
    const map = new Map<
        string,
        { siteId: string; siteName: string; siteNumber: string; reservations: DashboardReservation[] }
    >()

    for (const reservation of reservations) {
        const existing = map.get(reservation.siteId)
        if (!existing) {
            map.set(reservation.siteId, {
                siteId: reservation.siteId,
                siteName: reservation.siteName,
                siteNumber: reservation.siteNumber,
                reservations: [reservation],
            })
            continue
        }
        existing.reservations.push(reservation)
    }

    const groups = Array.from(map.values())
    groups.sort((a, b) => {
        const aNum = Number.parseInt(a.siteNumber, 10)
        const bNum = Number.parseInt(b.siteNumber, 10)
        if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aNum !== bNum) return aNum - bNum
        return a.siteName.localeCompare(b.siteName)
    })

    return groups
}

type ReservationBlockPopoverProps = {
    reservation: DashboardReservation
    lane: number
    leftPx: number
    widthPx: number
    topPx: number
    heightPx: number
    styleForStatus: {
        bg: string
        border: string
        text: string
        pillBg: string
        pillText: string
    }
    rateDiscountsConfig?: RateDiscountsConfig | null | undefined
    bookingRulesConfig?: BookingRulesConfig | null | undefined
    checkInTime?: string | null
    checkOutTime?: string | null
    onOpenDialog: (reservation: DashboardReservation) => void
    columnWidthPx: number
}

function ReservationBlockPopover({
    reservation,
    lane,
    leftPx,
    widthPx,
    topPx,
    heightPx,
    styleForStatus,
    rateDiscountsConfig,
    bookingRulesConfig,
    checkInTime,
    checkOutTime,
    onOpenDialog,
    columnWidthPx,
}: ReservationBlockPopoverProps) {
    const [open, setOpen] = useState(false)
    const isPointerInPopoverRef = useRef(false)
    const closeTimerRef = useRef<number | null>(null)

    const amountDueCents = Math.max(0, reservation.totalAmount - reservation.paidAmount)
    const canRefund =
        reservation.status === "cancelled" &&
        reservation.paidAmount > 0 &&
        reservation.refundAmount < reservation.paidAmount
    const maxRefundableCents = Math.max(0, reservation.paidAmount - reservation.refundAmount)

    const cancelClose = () => {
        if (closeTimerRef.current != null) {
            window.clearTimeout(closeTimerRef.current)
            closeTimerRef.current = null
        }
    }

    const scheduleClose = () => {
        cancelClose()
        closeTimerRef.current = window.setTimeout(() => {
            closeTimerRef.current = null
            if (!isPointerInPopoverRef.current) setOpen(false)
        }, 60)
    }

    // Calculate minimum width for content
    const minBlockWidth = 80
    const actualWidth = Math.max(minBlockWidth, widthPx)

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next)
            }}
        >
            <PopoverTrigger asChild>
                {/* FIX: Removed 'relative' - only use 'absolute' positioning */}
                <div
                    className="absolute cursor-pointer"
                    style={{
                        left: leftPx,
                        top: topPx,
                        width: actualWidth,
                        height: heightPx,
                        // Keep below sticky site column (z-30); only stack within the timeline row.
                        zIndex: lane + 1,
                    }}
                    title={`${capitalizeGuestName(reservation.guestName)} • ${reservation.checkIn} to ${reservation.checkOut}`}
                    onClick={() => {
                        setOpen(false)
                        onOpenDialog(reservation)
                    }}
                >
                    <div
                        className={[
                            "flex h-full w-full items-center justify-between gap-1 overflow-hidden rounded-sm border px-2",
                            styleForStatus.bg,
                            styleForStatus.border,
                            styleForStatus.text,
                        ].join(" ")}
                    >
                        <div
                            className="shrink-0"
                            onClick={(e) => {
                                e.stopPropagation()
                            }}
                            onPointerEnter={() => {
                                // Do not open the hover-details popover from the action area.
                                // If the popover is already open, prevent it from closing while hovering actions.
                                cancelClose()
                            }}
                            onPointerLeave={() => {
                                scheduleClose()
                            }}
                        >
                            <ReservationActions
                                reservationId={reservation.id}
                                confirmationNumber={reservation.confirmationNumber}
                                guestName={reservation.guestName}
                                status={reservation.status}
                                checkIn={reservation.checkIn}
                                checkOut={reservation.checkOut}
                                numAdults={reservation.numAdults}
                                numChildren={reservation.numChildren}
                                numPets={reservation.numPets}
                                specialRequests={reservation.specialRequests}
                                siteNumber={reservation.siteNumber}
                                siteName={reservation.siteName}
                                pricePerNight={reservation.pricePerNight}
                                weeklyRateCents={reservation.weeklyRateCents ?? null}
                                monthlyRateCents={reservation.monthlyRateCents ?? null}
                                bookingType={reservation.bookingType}
                                totalAmount={reservation.totalAmount}
                                paidAmount={reservation.paidAmount}
                                hasOutstandingBalance={amountDueCents > 0}
                                canRefund={canRefund}
                                maxRefundableCents={maxRefundableCents}
                                rateDiscountsConfig={rateDiscountsConfig}
                                blackoutDates={bookingRulesConfig?.blackout_dates ?? []}
                                allowedCheckInDays={bookingRulesConfig?.allowed_checkin_days ?? []}
                                allowedCheckOutDays={bookingRulesConfig?.allowed_checkout_days ?? []}
                                checkInTime={checkInTime}
                                checkOutTime={checkOutTime}
                                actionTriggerClassName="hover:bg-transparent active:bg-transparent"
                            />
                        </div>
                        <div
                            className="min-w-0 flex-1"
                            onPointerEnter={() => {
                                cancelClose()
                                setOpen(true)
                            }}
                            onPointerLeave={() => {
                                scheduleClose()
                            }}
                        >
                            <p className="min-w-0 truncate text-[13px] font-semibold">{capitalizeGuestName(reservation.guestName)}</p>
                        </div>
                    </div>
                </div>
            </PopoverTrigger>

            <PopoverContent
                className="w-80 p-3 bg-card text-foreground border border-border/80 shadow-md rounded-md outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ring-0"
                align="center"
                sideOffset={4}
                tabIndex={-1}
                onClick={(e) => {
                    e.stopPropagation()
                    setOpen(false)
                    onOpenDialog(reservation)
                }}
                onPointerEnter={() => {
                    isPointerInPopoverRef.current = true
                    cancelClose()
                    setOpen(true)
                }}
                onPointerLeave={() => {
                    isPointerInPopoverRef.current = false
                    cancelClose()
                    setOpen(false)
                }}
            >
                <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{capitalizeGuestName(reservation.guestName)}</p>
                            <p className="mt-0.5 truncate text-xs font-semibold uppercase tracking-wide opacity-80">
                                {reservation.confirmationNumber}
                            </p>
                        </div>
                        <span
                            className={[
                                "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                styleForStatus.pillBg,
                                styleForStatus.pillText,
                            ].join(" ")}
                        >
                            {getStatusLabel(reservation.status)}
                        </span>
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1">
                        <div>
                            Site: {reservation.siteName}
                            {reservation.siteNumber ? ` (#${reservation.siteNumber})` : ""}
                        </div>
                        <div>
                            {formatDate(reservation.checkIn)} – {formatDate(reservation.checkOut)}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span>Paid</span>
                            <span className="font-medium text-foreground">{formatMoney(reservation.paidAmount)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span>Balance</span>
                            <span className="font-medium text-foreground">
                                {formatMoney(Math.max(0, reservation.totalAmount - reservation.paidAmount))}
                            </span>
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

function capitalizeGuestName(name: string): string {
    // Capitalize the first letter of each word (e.g., "mel Test" -> "Mel Test").
    // Keeps punctuation intact and avoids mangling spacing.
    return name
        .split(/(\s+)/)
        .map((part) => {
            if (/^\s+$/.test(part)) return part
            if (!part) return part
            const lower = part.toLowerCase()
            return lower.charAt(0).toUpperCase() + lower.slice(1)
        })
        .join("")
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
    sortBy,
    sortOrder,
    searchField,
    rateDiscountsConfig,
    bookingRulesConfig,
    checkInTime,
    checkOutTime,
    periodPreset,
    periodStartYmd,
}: ReservationsTimelineProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    const scrollContainerRef = useRef<HTMLDivElement | null>(null)
    const mobileScrollContainerRef = useRef<HTMLDivElement | null>(null)
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

        params.set("sortBy", sortBy)
        params.set("sortOrder", sortOrder)

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
            params.set("sortBy", sortBy)
            params.set("sortOrder", sortOrder)
            params.set("view", "timeline")
            router.push(`/dashboard/${propertyId}/reservations?${params.toString()}`)
        })
    }

    const [selectedReservation, setSelectedReservation] = useState<DashboardReservation | null>(null)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [paymentCard, setPaymentCard] = useState<PaymentCardDisplay | null>(null)
    const [paymentMethod, setPaymentMethod] = useState<string | null>(null)

    useEffect(() => {
        if (!selectedReservation?.id) return

        let cancelled = false
        setPreviewLoading(true)
        setPaymentCard(null)
        setPaymentMethod(null)

        fetch(`/api/v1/reservations/${selectedReservation.id}`)
            .then((res) => res.json())
            .then((json) => {
                if (cancelled) return
                const method = json?.data?.payment_method
                if (typeof method === "string" && method.length > 0) {
                    setPaymentMethod(method)
                }
                const pc = json?.data?.payment_card
                if (
                    json?.success === true &&
                    pc &&
                    typeof pc.last4 === "string" &&
                    typeof pc.brand === "string" &&
                    typeof pc.exp_month === "number" &&
                    typeof pc.exp_year === "number"
                ) {
                    setPaymentCard({
                        brand: pc.brand,
                        last4: pc.last4,
                        exp_month: pc.exp_month,
                        exp_year: pc.exp_year,
                    })
                }
            })
            .catch(() => {
                // keep paymentCard/paymentMethod null
            })
            .finally(() => {
                if (!cancelled) setPreviewLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [selectedReservation?.id])

    const preset = periodPreset
    const periodStartUtc = useMemo(() => {
        return new Date(`${periodStartYmd}T00:00:00.000Z`)
    }, [periodStartYmd])

    const pushPeriod = (nextPreset: "day" | "week" | "month", nextStartUtc: Date) => {
        startTransition(() => {
            const params = new URLSearchParams()

            if (siteType) params.set("siteType", siteType)
            if (status) params.set("status", status)
            if (searchQuery) params.set("search", searchQuery)
            if (searchField !== "guest") params.set("searchBy", searchField)

            params.set("sortBy", sortBy)
            params.set("sortOrder", sortOrder)

            params.set("view", "timeline")
            params.set("period", nextPreset)
            params.set("periodStart", formatUtcYmd(nextStartUtc))
            const periodDayCount = nextPreset === "day" ? 1 : nextPreset === "week" ? 7 : 30
            const endInclusiveUtc = new Date(
                nextStartUtc.getTime() + (periodDayCount - 1) * 24 * 60 * 60 * 1000
            )
            params.set("periodEnd", formatUtcYmd(endInclusiveUtc))

            router.push(`/dashboard/${propertyId}/reservations?${params.toString()}`)
        })
    }

    const [columnWidthPx, setColumnWidthPx] = useState<number>(() => COLUMN_MIN_BY_PRESET[preset])

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
            return {
                timelineUnit: "day" as const,
                timelineColumnsCount: DEFAULT_MONTH_RANGE_DAYS,
                stepMs: DEFAULT_MONTH_RANGE_DAYS * ONE_DAY_MS,
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
    }, [preset])

    // Calculate column width based on text content
    useEffect(() => {
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
    }, [preset, longestGuestName])

    // Stretch columns to fill viewport
    useEffect(() => {
        const isMdUp = typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : true
        const el = isMdUp ? scrollContainerRef.current : mobileScrollContainerRef.current
        if (!el) return

        const min = COLUMN_MIN_BY_PRESET[preset]
        const max = COLUMN_MAX_BY_PRESET[preset]

        const recalc = () => {
            const viewportWidth = el.clientWidth
            // Desktop has a separate sticky "Sites" column; mobile does not.
            const availableForColumns = isMdUp ? viewportWidth - siteColWidthPx : viewportWidth
            if (availableForColumns <= 0) return

            const target = Math.floor(availableForColumns / timelineColumnsCount)
            const clamped = Math.min(max, Math.max(min, target))

            setColumnWidthPx((prev) => Math.max(prev, clamped))
        }

        recalc()

        if (typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver(() => recalc())
        ro.observe(el)
        return () => ro.disconnect()
    }, [preset, timelineColumnsCount, siteColWidthPx])

    const timelineStartUtc = periodStartUtc
    const timelineEndExclusiveUtc = new Date(timelineStartUtc.getTime() + stepMs)

    const timelineWidthPx = timelineColumnsCount * columnWidthPx

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

    const periodLabel = useMemo(() => {
        if (preset === "month") {
            const endInclusive = new Date(timelineEndExclusiveUtc.getTime() - 24 * 60 * 60 * 1000)
            return `${formatUtcMonthLabel(timelineStartUtc)} • ${formatUtcDateLabel(timelineStartUtc)} - ${formatUtcDateLabel(endInclusive)}`
        }
        if (preset === "day") {
            return `${formatUtcDateLabel(timelineStartUtc)}`
        }

        const endInclusive = new Date(timelineEndExclusiveUtc.getTime() - 24 * 60 * 60 * 1000)
        return `${formatUtcDateLabel(timelineStartUtc)} - ${formatUtcDateLabel(endInclusive)}`
    }, [timelineEndExclusiveUtc, timelineStartUtc, preset])

    const siteGroups = useMemo(() => groupReservationsBySite(gridReservations), [gridReservations])

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

                <div className="flex items-center justify-center gap-2 sm:justify-end">
                    <button
                        type="button"
                        onClick={() => pushPeriod(preset, new Date(periodStartUtc.getTime() - stepMs))}
                        disabled={isPending}
                        aria-disabled={isPending}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border/80 bg-background/60 hover:bg-background transition-colors"
                        aria-label="Previous period"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="min-w-[180px] text-sm font-medium text-center">{periodLabel}</div>
                    <button
                        type="button"
                        onClick={() => pushPeriod(preset, new Date(periodStartUtc.getTime() + stepMs))}
                        disabled={isPending}
                        aria-disabled={isPending}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border/80 bg-background/60 hover:bg-background transition-colors"
                        aria-label="Next period"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
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
                                                className="box-border flex shrink-0 items-center justify-center border-r border-border/80 bg-red-50 dark:bg-red-950/30 px-1 py-2 text-[10px] font-medium text-black/90 dark:text-white/90"
                                                style={{ width: columnWidthPx }}
                                            >
                                                {formatUtcDateLabel(colStartUtc)}
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
                                        <div key={group.siteId} className="flex items-stretch border-b border-border/80">
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
                                                <div className="pointer-events-none absolute inset-0 z-0 flex h-full">
                                                    {timeline.columnStartsUtc.map((colStartUtc, i) => (
                                                        <div
                                                            key={`${group.siteId}-col-${colStartUtc.toISOString()}-${i}`}
                                                            className="box-border h-full shrink-0 border-r border-border/80"
                                                            style={{ width: columnWidthPx }}
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
                                                    const leftPx = startCol * columnWidthPx + 3
                                                    const widthPx = (endCol - startCol) * columnWidthPx - 6
                                                    const topPx = lane * LANE_HEIGHT_PX + 4
                                                    const heightPx = LANE_HEIGHT_PX - 8

                                                    const styleForStatus = statusBlockStyles[reservation.status]

                                                    return (
                                                        <ReservationBlockPopover
                                                            key={reservation.id}
                                                            reservation={reservation}
                                                            lane={lane}
                                                            leftPx={leftPx}
                                                            topPx={topPx}
                                                            widthPx={widthPx}
                                                            heightPx={heightPx}
                                                            styleForStatus={styleForStatus}
                                                            rateDiscountsConfig={rateDiscountsConfig}
                                                            bookingRulesConfig={bookingRulesConfig}
                                                            checkInTime={checkInTime ?? null}
                                                            checkOutTime={checkOutTime ?? null}
                                                            onOpenDialog={(r) => setSelectedReservation(r)}
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
                                                        className="box-border flex shrink-0 items-center justify-center border-r border-border/80 bg-red-50 dark:bg-red-950/30 px-1 py-2 text-[10px] font-medium text-black/90 dark:text-white/90"
                                                        style={{ width: columnWidthPx }}
                                                    >
                                                        {formatUtcDateLabel(colStartUtc)}
                                                    </div>
                                                ))}
                                            </div>

                                            <div
                                                className="relative min-w-0 overflow-hidden"
                                                style={{ height: rowHeightPx }}
                                            >
                                                <div className="pointer-events-none absolute inset-0 z-0 flex h-full">
                                                    {timeline.columnStartsUtc.map((colStartUtc, i) => (
                                                        <div
                                                            key={`${group.siteId}-m-grid-${colStartUtc.toISOString()}-${i}`}
                                                            className="box-border h-full shrink-0 border-r border-border/80"
                                                            style={{ width: columnWidthPx }}
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
                                                    const leftPx = startCol * columnWidthPx + 3
                                                    const widthPx = (endCol - startCol) * columnWidthPx - 6
                                                    const topPx = lane * LANE_HEIGHT_PX + 4
                                                    const heightPx = LANE_HEIGHT_PX - 8

                                                    const styleForStatus = statusBlockStyles[reservation.status]

                                                    return (
                                                        <ReservationBlockPopover
                                                            key={reservation.id}
                                                            reservation={reservation}
                                                            lane={lane}
                                                            leftPx={leftPx}
                                                            topPx={topPx}
                                                            widthPx={widthPx}
                                                            heightPx={heightPx}
                                                            styleForStatus={styleForStatus}
                                                            rateDiscountsConfig={rateDiscountsConfig}
                                                            bookingRulesConfig={bookingRulesConfig}
                                                            checkInTime={checkInTime ?? null}
                                                            checkOutTime={checkOutTime ?? null}
                                                            onOpenDialog={(r) => setSelectedReservation(r)}
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
                                            className="box-border flex shrink-0 items-center justify-center border-r border-border/80 bg-red-50 dark:bg-red-950/30 px-1 py-2 text-[10px] font-medium text-black/90 dark:text-white/90"
                                            style={{ width: columnWidthPx }}
                                        >
                                            {formatUtcDateLabel(colStartUtc)}
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

            <Dialog
                open={!!selectedReservation}
                onOpenChange={(open) => {
                    if (!open) setSelectedReservation(null)
                }}
            >
                <DialogContent className="max-w-xl">
                    {selectedReservation && (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    Reservation {selectedReservation.confirmationNumber}
                                </DialogTitle>
                                <DialogDescription className="capitalize">
                                    Detailed information for {selectedReservation.guestName}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="mt-3 space-y-6 text-sm">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="rounded-md border bg-muted/40 p-3">
                                        <div className="text-xs font-medium text-muted-foreground">
                                            Primary Guest
                                        </div>
                                        <div className="mt-1 font-medium capitalize">
                                            {selectedReservation.guestName}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {selectedReservation.guestEmail}
                                        </div>
                                    </div>
                                    <div className="rounded-md border bg-muted/40 p-3">
                                        <div className="text-xs font-medium text-muted-foreground">
                                            Site
                                        </div>
                                        <div className="mt-1 font-medium">
                                            {selectedReservation.siteName}{" "}
                                            {selectedReservation.siteNumber &&
                                                `(#${selectedReservation.siteNumber})`}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {selectedReservation.bookingType.replace("_", " ")}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="rounded-md border bg-muted/40 p-3">
                                        <div className="text-xs font-medium text-muted-foreground">
                                            Stay
                                        </div>
                                        <div className="mt-1 font-medium">
                                            {formatDate(selectedReservation.checkIn)} –{" "}
                                            {formatDate(selectedReservation.checkOut)}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {selectedReservation.numNights} nights •{" "}
                                            {selectedReservation.numAdults +
                                                selectedReservation.numChildren}{" "}
                                            guests • {selectedReservation.numPets} pets
                                        </div>
                                    </div>
                                    <div className="rounded-md border bg-muted/40 p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="text-xs font-medium text-muted-foreground">
                                                Status
                                            </div>
                                            <span
                                                className={`${statusTextColors[selectedReservation.status]} shrink-0 whitespace-nowrap text-xs font-medium capitalize`}
                                            >
                                                {selectedReservation.status.replace("_", " ")}
                                            </span>
                                        </div>
                                        <div className="mt-2 text-xs text-muted-foreground">
                                            <span className="font-medium text-foreground/80">Booked</span>{" "}
                                            {formatDate(selectedReservation.createdAt)}
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-md border bg-muted/40 p-3">
                                    <div className="text-xs font-medium text-muted-foreground">
                                        Payment Method
                                    </div>
                                    <div className="mt-1 font-medium">
                                        {paymentMethod ?? "—"}
                                    </div>
                                    {previewLoading ? (
                                        <div className="mt-2 text-xs text-muted-foreground">
                                            Loading card…
                                        </div>
                                    ) : paymentCard ? (
                                        <div className="mt-2 inline-flex items-center gap-3 align-middle">
                                            <span className="inline-flex h-10 w-14 shrink-0 items-center justify-center">
                                                <PaymentCardLogo brand={paymentCard.brand} />
                                            </span>
                                            <span className="font-mono text-base text-foreground">
                                                **** **** **** {paymentCard.last4}
                                            </span>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="rounded-md border bg-muted/40 p-3">
                                    <div className="text-xs font-medium text-muted-foreground">
                                        Financials
                                    </div>
                                    <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-4">
                                        <div>
                                            <dt className="text-xs text-muted-foreground">Total</dt>
                                            <dd className="font-medium">
                                                {formatMoney(selectedReservation.totalAmount)}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">Paid</dt>
                                            <dd className="font-medium">
                                                {formatMoney(selectedReservation.paidAmount)}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">
                                                Refunded
                                            </dt>
                                            <dd className="font-medium">
                                                {formatMoney(selectedReservation.refundAmount)}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">
                                                Balance
                                            </dt>
                                            <dd className="font-medium">
                                                {formatMoney(
                                                    Math.max(
                                                        0,
                                                        selectedReservation.totalAmount -
                                                        selectedReservation.paidAmount,
                                                    ),
                                                )}
                                            </dd>
                                        </div>
                                    </dl>
                                </div>

                                <div className="space-y-4">
                                    <div className="rounded-md border bg-muted/30 p-3">
                                        <div className="text-xs font-medium text-muted-foreground">
                                            Guest special requests
                                        </div>
                                        <div className="mt-1.5 whitespace-pre-wrap text-sm">
                                            {selectedReservation.specialRequests?.trim() || "None"}
                                        </div>
                                    </div>
                                    <div className="rounded-md border bg-muted/30 p-3">
                                        <div className="text-xs font-medium text-muted-foreground">
                                            Check-in notes
                                        </div>
                                        <div className="mt-1.5 whitespace-pre-wrap text-sm">
                                            {selectedReservation.checkInNotes?.trim() || "None"}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}