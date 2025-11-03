import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, DollarSign, Tent, Users, Globe, ExternalLink } from "lucide-react"
import { getDashboardStats, getReservations, getTodaysArrivals } from "@/lib/dashboard/queries"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TodaysArrivalsCard } from "@/components/dashboard/reservations/todays-arrivals-card"
import type { ReservationStatus } from "@/src/contracts/booking"

const statusColors: Record<ReservationStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  confirmed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  checked_in: "bg-green-500/10 text-green-500 border-green-500/20",
  checked_out: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
  no_show: "bg-orange-500/10 text-orange-500 border-orange-500/20",
}

/**
 * Format money from integer cents to dollar display
 */
function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Get the current user's property ID
 * MVP: Assumes user has access to one property
 */
async function getCurrentPropertyId(): Promise<string | null> {
  const supabase = await createClient()

  // Get the currently authenticated user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get the first property owned by this user
  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  return property?.id || null
}

async function DashboardStats() {
  const propertyId = await getCurrentPropertyId()

  if (!propertyId) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No property found. Please contact support.</p>
      </div>
    )
  }

  const stats = await getDashboardStats(propertyId)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatMoney(stats.totalRevenue)}</div>
          <p className="text-xs text-muted-foreground">All time earnings</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Reservations</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalReservations}</div>
          <p className="text-xs text-muted-foreground">Total bookings</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
          <Tent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.occupancyRate}%</div>
          <p className="text-xs text-muted-foreground">Last 30 days</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Guests</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalGuests}</div>
          <p className="text-xs text-muted-foreground">Active reservations</p>
        </CardContent>
      </Card>
    </div>
  )
}

async function RecentActivity() {
  const propertyId = await getCurrentPropertyId()

  if (!propertyId) {
    return null
  }

  // Get recent reservations
  const { data: recentReservations } = await getReservations(propertyId, {}, 1, 5)

  // Get upcoming check-ins (reservations with check-in date today or tomorrow)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todayStr = today.toISOString().split('T')[0]!
  const tomorrowStr = tomorrow.toISOString().split('T')[0]!

  const { data: upcomingCheckIns } = await getReservations(
    propertyId,
    {
      startDate: todayStr,
      endDate: tomorrowStr,
      status: 'confirmed',
    },
    1,
    5
  )

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Recent Reservations</CardTitle>
          <CardDescription>Latest bookings at your property</CardDescription>
        </CardHeader>
        <CardContent>
          {recentReservations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No reservations yet</p>
          ) : (
            <div className="space-y-4">
              {recentReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="flex items-center justify-between border-b border-border pb-3 last:border-0"
                >
                  <div>
                    <p className="font-medium">{reservation.siteName}</p>
                    <p className="text-sm text-muted-foreground">
                      {reservation.guestName} • {reservation.numNights} nights
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatMoney(reservation.totalAmount)}</p>
                    <Badge variant="outline" className={statusColors[reservation.status]}>
                      {reservation.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Check-ins</CardTitle>
          <CardDescription>Guests arriving today and tomorrow</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingCheckIns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No upcoming check-ins</p>
          ) : (
            <div className="space-y-4">
              {upcomingCheckIns.map((reservation) => (
                <div
                  key={reservation.id}
                  className="flex items-center justify-between border-b border-border pb-3 last:border-0"
                >
                  <div>
                    <p className="font-medium">{reservation.guestName}</p>
                    <p className="text-sm text-muted-foreground">
                      {reservation.siteName} • {formatDate(reservation.checkIn)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-primary">Check-in</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

async function TodaysArrivals() {
  const propertyId = await getCurrentPropertyId()

  if (!propertyId) {
    return null
  }

  const arrivals = await getTodaysArrivals(propertyId)

  return <TodaysArrivalsCard arrivals={arrivals} />
}

async function BookingPortalCTA() {
  const propertyId = await getCurrentPropertyId()

  if (!propertyId) {
    return null
  }

  const supabase = await createClient()

  // Get property with booking page details
  const { data: property } = await supabase
    .from('properties')
    .select('name, booking_page_slug')
    .eq('id', propertyId)
    .single()

  if (!property?.booking_page_slug) {
    return null
  }

  const bookingPageUrl = `${process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/book/${property.booking_page_slug}`

  return (
    <Card className="border-0 bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 dark:from-red-950/20 dark:via-rose-950/20 dark:to-pink-950/20 overflow-hidden">
      <CardContent className="pt-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left side - CTA content */}
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
                <Globe className="h-6 w-6 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Your Booking Portal is Live!</h2>
            </div>
            <p className="text-muted-foreground mb-4">
              Share this link with your guests to start accepting online reservations
            </p>
            <div className="flex flex-col gap-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-950 rounded-md border border-red-200 dark:border-red-800">
                <code className="text-sm font-mono text-primary break-all">
                  {bookingPageUrl}
                </code>
              </div>
              <Button size="lg" className="bg-primary hover:bg-primary/90" asChild>
                <a href={bookingPageUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-5 w-5" />
                  Open Booking Portal
                </a>
              </Button>
            </div>
          </div>

          {/* Right side - Preview window */}
          <div className="hidden lg:block">
            <div className="bg-gray-900 rounded-lg overflow-hidden shadow-2xl border border-gray-700">
              {/* Browser chrome mockup */}
              <div className="bg-gray-800 px-3 py-2 flex items-center gap-2 border-b border-gray-700">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex-1 mx-2">
                  <div className="bg-gray-700 rounded px-3 py-1 text-xs text-gray-400 flex items-center gap-2">
                    <Globe className="h-3 w-3" />
                    <span className="truncate">{bookingPageUrl}</span>
                  </div>
                </div>
              </div>
              {/* Preview iframe */}
              <div className="relative bg-white" style={{ height: '300px' }}>
                <iframe
                  src={bookingPageUrl}
                  className="w-full h-full border-0"
                  title="Booking Portal Preview"
                  sandbox="allow-same-origin"
                />
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-gray-900/10" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default async function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's what's happening with your property.</p>
      </div>

      {/* Stats Grid */}
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
        <DashboardStats />
      </Suspense>

      {/* Today's Arrivals - Priority Widget */}
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
        <TodaysArrivals />
      </Suspense>

      {/* Recent Activity */}
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
        <RecentActivity />
      </Suspense>

      {/* Booking Portal CTA */}
      <Suspense
        fallback={
          <Card>
            <CardContent className="pt-6">
              <div className="h-32 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        }
      >
        <BookingPortalCTA />
      </Suspense>
    </div>
  )
}
