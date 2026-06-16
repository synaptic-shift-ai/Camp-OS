import { Suspense } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, DollarSign, Tent, Users, Globe, ExternalLink, Home, User, AlertTriangle } from "lucide-react"
import { getDashboardStats, getReservations, getTodaysArrivals } from "@/lib/dashboard/queries"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TodaysArrivalsCard } from "@/components/dashboard/reservations/todays-arrivals-card"
import type { ReservationStatus } from "@/contracts/booking"
import { DepartureCheckOutButton } from "@/components/dashboard/reservations/departure-check-out-button"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { LiveClock } from "@/components/dashboard/live-clock"
import { resolveDashboardAccess } from "@/lib/rbac/dashboard-guards"
import { redirect } from "next/navigation"

const statusColors: Record<ReservationStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  confirmed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  checked_in: "bg-green-500/10 text-green-500 border-green-500/20",
  checked_out: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
  no_show: "bg-orange-500/10 text-orange-500 border-orange-500/20",
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
  })
}

async function DashboardStats({
  propertyId,
  allowedSiteTypes,
}: {
  propertyId: string
  allowedSiteTypes?: string[] | null
}) {
  const stats = await getDashboardStats(propertyId, allowedSiteTypes?.length ? { allowedSiteTypes } : undefined)
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold sm:text-2xl">{formatMoney(stats.totalRevenue)}</div>
          <p className="text-[11px] text-muted-foreground sm:text-xs">All time earnings</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Reservations</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold sm:text-2xl">{stats.totalReservations}</div>
          <p className="text-[11px] text-muted-foreground sm:text-xs">Total bookings</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
          <Tent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold sm:text-2xl">{stats.occupancyRate}%</div>
          <p className="text-[11px] text-muted-foreground sm:text-xs">Last 30 days</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Guests</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold sm:text-2xl">{stats.totalGuests}</div>
          <p className="text-[11px] text-muted-foreground sm:text-xs">Active reservations</p>
        </CardContent>
      </Card>
    </div>
  )
}

const siteTypeLabels: Record<string, string> = {
  rv: "RV",
  tent: "Tent",
  cabin: "Cabin",
  glamping: "Glamping",
  yurt: "Yurt",
  other: "Other",
}
const siteTypeOrder = ["rv", "tent", "cabin", "glamping", "yurt", "other"]

async function CurrentlyCheckedIn({
  propertyId,
  allowedSiteTypes,
  canManageCheckInOut,
}: {
  propertyId: string
  allowedSiteTypes?: string[] | null
  canManageCheckInOut: boolean
}) {
  const todayStr = new Date().toISOString().split("T")[0]!
  const filters: { status: ("confirmed" | "checked_in")[]; allowedSiteTypes?: string[]; endDate?: string } = {
    status: ["confirmed", "checked_in"],
    endDate: todayStr,
  }
  if (allowedSiteTypes?.length) filters.allowedSiteTypes = allowedSiteTypes
  const { data: currentlyCheckedIn } = await getReservations(propertyId, filters, 1, 50)

  let countsBySiteType: Record<string, number> = {}
  const siteTypesToShow =
    allowedSiteTypes && allowedSiteTypes.length > 0
      ? siteTypeOrder.filter((t) =>
        (allowedSiteTypes as string[]).map((a) => a.toLowerCase()).includes(t)
      )
      : siteTypeOrder
  if (currentlyCheckedIn.length > 0) {
    const siteIds = [...new Set(currentlyCheckedIn.map((r) => r.siteId))]
    const supabase = await createClient()
    const { data: sites } = await supabase
      .from("sites")
      .select("id, site_type")
      .in("id", siteIds)
    const siteIdToType = new Map((sites ?? []).map((s) => [s.id, s.site_type ?? "other"]))
    countsBySiteType = currentlyCheckedIn.reduce<Record<string, number>>((acc, r) => {
      const type = siteIdToType.get(r.siteId) ?? "other"
      acc[type] = (acc[type] ?? 0) + 1
      return acc
    }, {})
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold sm:text-2xl">Currently Checked In</CardTitle>
        {currentlyCheckedIn.length > 0 ? (
          <CardDescription>
            {currentlyCheckedIn.length} guest{currentlyCheckedIn.length !== 1 ? "s" : ""} checked in
          </CardDescription>
        ) : (
          <CardDescription>No guests currently checked in</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {currentlyCheckedIn.length > 0 ? (
          <div className="mb-2 grid grid-cols-3 gap-2 md:mb-4 md:grid-cols-4">
            {siteTypesToShow.map((type) => {
              const count = countsBySiteType[type] ?? 0
              if (!canManageCheckInOut) {
                return (
                  <div
                    key={type}
                    className="flex min-h-16 w-full flex-col items-center justify-center rounded-lg border bg-muted/50 px-2 py-1.5 text-center md:min-h-20 md:px-3 md:py-2"
                  >
                    <p className="text-sm leading-tight text-muted-foreground md:text-base">
                      <span className="md:hidden">{siteTypeLabels[type]}</span>
                      <span className="hidden md:inline">{siteTypeLabels[type]} Site</span>
                    </p>
                    <p className="text-xl font-bold leading-none md:text-2xl">{count}</p>
                  </div>
                )
              }

              return (
                <Link
                  key={type}
                  href={`/dashboard/${propertyId}/reservations?siteType=${type}&status=checked_in`}
                  className="flex min-h-16 w-full cursor-pointer flex-col items-center justify-center rounded-lg border bg-muted/50 px-2 py-1.5 text-center transition-colors hover:bg-muted md:min-h-20 md:px-3 md:py-2"
                >
                  <p className="text-sm leading-tight text-muted-foreground md:text-base">
                    <span className="md:hidden">{siteTypeLabels[type]}</span>
                    <span className="hidden md:inline">{siteTypeLabels[type]} Site</span>
                  </p>
                  <p className="text-xl font-bold leading-none md:text-2xl">{count}</p>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No guests currently checked in</p>
            <p className="mt-1 text-xs text-muted-foreground">New check-ins will appear here once they arrive.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

async function TodaysArrivalsAndDepartures({
  propertyId,
  allowedSiteTypes,
  checkInTime,
  checkOutTime,
  canManageCheckInOut,
}: {
  propertyId: string
  allowedSiteTypes?: string[] | null
  checkInTime?: string | null
  checkOutTime?: string | null
  canManageCheckInOut: boolean
}) {
  const todayStr = new Date().toISOString().split("T")[0]!
  const resFilters: { status: ("confirmed" | "checked_in")[]; allowedSiteTypes?: string[]; endDate?: string } = {
    status: ["confirmed", "checked_in"],
    endDate: todayStr,
  }
  if (allowedSiteTypes?.length) resFilters.allowedSiteTypes = allowedSiteTypes
  const [arrivals, { data: presentGuests }] = await Promise.all([
    getTodaysArrivals(propertyId, allowedSiteTypes?.length ? { allowedSiteTypes } : undefined),
    getReservations(propertyId, resFilters, 1, 50),
  ])
  // Only checked_in guests can be checked out — filter departures to avoid showing
  // "Check Out" button for confirmed guests who were never checked in
  const departuresToday = presentGuests.filter(
    (r) => r.status === "checked_in" && r.checkOut.split("T")[0]! === todayStr
  )
  const departuresOverdue = presentGuests.filter(
    (r) => r.status === "checked_in" && r.checkOut.split("T")[0]! < todayStr
  ).sort((a, b) => new Date(a.checkOut).getTime() - new Date(b.checkOut).getTime())

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <TodaysArrivalsCard
          arrivals={arrivals}
          checkInTime={checkInTime}
          canManageCheckInOut={canManageCheckInOut}
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold sm:text-2xl">Departures</CardTitle>
            <CardDescription>Guests checking out today</CardDescription>
          </CardHeader>
          <CardContent>
            {departuresToday.length === 0 && departuresOverdue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="mb-3 h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No departures scheduled for today</p>
                <p className="mt-1 text-xs text-muted-foreground">Looks like everyone is staying another night.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {departuresToday.map((reservation) => {
                  const outstandingBalance = reservation.totalAmount - reservation.paidAmount
                  const hasBalance = outstandingBalance > 0
                  return (
                    <div
                      key={reservation.id}
                      className="flex flex-col gap-3 border-b border-border pb-3 last:border-0 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium capitalize">{reservation.guestName}</p>
                          {hasBalance && (
                            <Badge variant="outline" className="text-xs bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-950/30 dark:border-yellow-800 dark:text-yellow-400">
                              Balance Due
                            </Badge>
                          )}
                        </div>
                        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span className="flex min-w-0 items-center gap-1">
                            <Home className="h-3 w-3 shrink-0" />
                            <span className="break-words">
                              {reservation.siteName} • {formatDate(reservation.checkIn)} - {formatDate(reservation.checkOut)}
                            </span>
                          </span>
                        </p>
                      </div>
                      <div className="flex w-full shrink-0 flex-col items-start gap-2 sm:w-auto sm:items-end sm:text-right">
                        <div className="space-y-0.5">
                          <p className="font-medium">{formatMoney(reservation.totalAmount)}</p>
                          {hasBalance && (
                            <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
                              {formatMoney(outstandingBalance)} due
                            </p>
                          )}
                        </div>
                        {canManageCheckInOut ? (
                          <DepartureCheckOutButton
                            reservationId={reservation.id}
                            checkOutTime={checkOutTime}
                          />
                        ) : null}
                      </div>
                    </div>
                  )
                })}
                {departuresOverdue.length > 0 && (
                  <>
                    <div className="flex items-center gap-1.5 pt-3">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                      <span className="text-xs font-semibold text-red-600 dark:text-red-400">Overdue</span>
                    </div>
                    {departuresOverdue.map((reservation) => {
                      const outstandingBalance = reservation.totalAmount - reservation.paidAmount
                      const hasBalance = outstandingBalance > 0
                      return (
                        <div
                          key={reservation.id}
                          className="flex flex-col gap-3 border-b border-border pb-3 last:border-0 sm:flex-row sm:items-start sm:justify-between"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium capitalize">{reservation.guestName}</p>
                              <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300">
                                Overdue
                              </span>
                              {hasBalance && (
                                <Badge variant="outline" className="text-xs bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-950/30 dark:border-yellow-800 dark:text-yellow-400">
                                  Balance Due
                                </Badge>
                              )}
                            </div>
                            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                              <span className="flex min-w-0 items-center gap-1">
                                <Home className="h-3 w-3 shrink-0" />
                                <span className="break-words">
                                  {reservation.siteName} • {formatDate(reservation.checkIn)} - {formatDate(reservation.checkOut)}
                                </span>
                              </span>
                            </p>
                          </div>
                          <div className="flex w-full shrink-0 flex-col items-start gap-2 sm:w-auto sm:items-end sm:text-right">
                            <div className="space-y-0.5">
                              <p className="font-medium">{formatMoney(reservation.totalAmount)}</p>
                              {hasBalance && (
                                <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
                                  {formatMoney(outstandingBalance)} due
                                </p>
                              )}
                            </div>
                            {canManageCheckInOut ? (
                              <DepartureCheckOutButton
                                reservationId={reservation.id}
                                checkOutTime={checkOutTime}
                              />
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

async function RecentReservations({
  propertyId,
  allowedSiteTypes,
}: {
  propertyId: string
  allowedSiteTypes?: string[] | null
}) {
  const filters: { status: ("confirmed" | "pending")[]; allowedSiteTypes?: string[] } = {
    status: ["confirmed", "pending"],
  }
  if (allowedSiteTypes?.length) filters.allowedSiteTypes = allowedSiteTypes
  const { data: recentReservations } = await getReservations(propertyId, filters, 1, 10)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold sm:text-2xl">Recent Reservations</CardTitle>
        <CardDescription>Latest bookings at your property</CardDescription>
      </CardHeader>
      <CardContent>
        {recentReservations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Calendar className="mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No reservations yet</p>
            <p className="mt-1 text-xs text-muted-foreground">New bookings will appear here as guests reserve.</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <div className="space-y-4">
              {recentReservations.map((reservation) => {
                const outstandingBalance = reservation.totalAmount - reservation.paidAmount
                const hasBalance = outstandingBalance > 0
                return (
                  <div
                    key={reservation.id}
                    className="flex flex-col gap-3 border-b border-border pb-3 last:border-0 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium capitalize">{reservation.guestName}</p>
                        <Badge variant="outline" className={statusColors[reservation.status]}>
                          {reservation.status}
                        </Badge>
                        {hasBalance && (
                          <Badge variant="outline" className="text-xs bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-950/30 dark:border-yellow-800 dark:text-yellow-400">
                            Balance Due
                          </Badge>
                        )}
                      </div>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Home className="h-3 w-3 shrink-0" />
                          {reservation.siteName}
                        </span>
                        <span>•</span>
                        <span>{formatDate(reservation.checkIn)} - {formatDate(reservation.checkOut)}</span>
                        <span>•</span>
                        <span>{reservation.numNights} {reservation.numNights === 1 ? "night" : "nights"}</span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3 shrink-0" />
                          {reservation.numAdults + reservation.numChildren} guests
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-0.5 sm:items-end sm:text-right">
                      <p className="font-medium">{formatMoney(reservation.totalAmount)}</p>
                      {hasBalance && (
                        <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
                          {formatMoney(outstandingBalance)} due
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

async function BookingPortalCTA({ propertyId }: { propertyId: string }) {
  const supabase = await createClient()
  const { data: property } = await supabase
    .from("properties")
    .select("name, booking_page_slug")
    .eq("id", propertyId)
    .maybeSingle()

  if (!property?.booking_page_slug) return null

  const bookingPageUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/book/${property.booking_page_slug}`

  return (
    <Card className="overflow-hidden border border-rose-200/70 bg-gradient-to-br from-rose-50 via-background to-pink-50 dark:border-rose-900/60 dark:from-rose-950/20 dark:via-background dark:to-pink-950/20">
      <CardContent className="p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-center">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-sm">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Your Booking Portal is Live!</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Share this link with guests to start accepting online reservations.
                </p>
              </div>
            </div>

            <div className="rounded-md border border-rose-200/80 bg-background/90 p-3 dark:border-rose-900/60">
              <code className="block break-all text-sm font-mono text-primary">{bookingPageUrl}</code>
            </div>

            <Button size="lg" className="w-full sm:w-auto" asChild>
              <a href={bookingPageUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-5 w-5" />
                Open Booking Portal
              </a>
            </Button>
          </div>

          <div className="hidden lg:block">
            <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
              <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-800 px-3 py-2">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-300/80" />
                </div>
                <div className="mx-1 flex flex-1 items-center gap-2 rounded bg-slate-700 px-2 py-1 text-[11px] text-slate-300">
                  <Globe className="h-3 w-3 shrink-0" />
                  <span className="truncate">{bookingPageUrl}</span>
                </div>
              </div>

              <div className="relative h-[300px] overflow-hidden bg-white">
                <iframe
                  src={bookingPageUrl}
                  title="Booking Portal Preview"
                  sandbox="allow-same-origin allow-scripts"
                  className="absolute left-0 top-0 border-0"
                  style={{
                    width: "238%",
                    height: "238%",
                    transform: "scale(0.42)",
                    transformOrigin: "top left",
                  }}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-900/10" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

type PageProps = { params: Promise<{ propertyId: string }> }

function getAllowedSiteTypes(property: { site_type_config?: unknown }): string[] | null {
  const raw = (property?.site_type_config ?? null) as { allowed_site_types?: string[] } | null
  if (!Array.isArray(raw?.allowed_site_types) || raw.allowed_site_types.length === 0) return null
  return raw.allowed_site_types
}

export default async function DashboardOverviewPage({ params }: PageProps) {
  const { propertyId } = await params
  const property = await getPropertyForUser(propertyId)
  if (!property) redirect("/auth/login")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const access = await resolveDashboardAccess(supabase, propertyId, user.id)
  if (!access || !access.role) redirect("/auth/login")
  const canManageCheckInOut = access.role !== "staff"

  const allowedSiteTypes = getAllowedSiteTypes(property)

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight sm:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Welcome back! Here&apos;s what&apos;s happening with your property.
          </p>
        </div>
        <LiveClock timezone={property.timezone ?? ''} />
      </div>

      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle className="text-sm">Loading...</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        }
      >
        <DashboardStats propertyId={propertyId} allowedSiteTypes={allowedSiteTypes} />
      </Suspense>

      <Suspense
        fallback={
          <Card>
            <CardHeader>
              <CardTitle>Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-32 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        }
      >
        <TodaysArrivalsAndDepartures
          propertyId={propertyId}
          allowedSiteTypes={allowedSiteTypes}
          checkInTime={property.check_in_time}
          checkOutTime={property.check_out_time}
          canManageCheckInOut={canManageCheckInOut}
        />
      </Suspense>

      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="h-6 w-48 bg-muted animate-pulse rounded" />
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Loading...</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-32 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Loading...</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-32 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            </div>
          </div>
        }
      >
        <CurrentlyCheckedIn
          propertyId={propertyId}
          allowedSiteTypes={allowedSiteTypes}
          canManageCheckInOut={canManageCheckInOut}
        />
      </Suspense>

      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(2)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle>Loading...</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-32 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        }
      >
        <RecentReservations propertyId={propertyId} allowedSiteTypes={allowedSiteTypes} />
      </Suspense>

      <Suspense
        fallback={
          <Card>
            <CardContent className="pt-6">
              <div className="h-32 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        }
      >
        <BookingPortalCTA propertyId={propertyId} />
      </Suspense>
    </div>
  )
}
