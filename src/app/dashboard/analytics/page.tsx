import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DollarSign, TrendingUp, Users, Calendar } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import {
  getDashboardStats,
  getRevenueOverTime,
  getTopPerformingSites,
  getBookingSourcesBreakdown,
  getRevenueByPaymentMethod,
  getRevenueByPaymentStatus,
  getAverageBookingValue,
  getOccupancyByMonth,
} from "@/lib/dashboard/queries"
import type { MoneyCents } from "@/contracts/booking"
import { RevenueChart } from "@/components/analytics/revenue-chart"
import { DateRangeFilter } from "@/components/analytics/date-range-filter"
import { getStartDate, type DateRange } from "@/lib/analytics/date-utils"

/**
 * Format money from integer cents to dollar display
 */
function formatMoney(cents: MoneyCents): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
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

async function AnalyticsOverview() {
  const propertyId = await getCurrentPropertyId()

  if (!propertyId) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No property found. Please contact support.</p>
      </div>
    )
  }

  // Fetch all analytics data in parallel
  const [stats, revenueData, topSites, bookingSources] = await Promise.all([
    getDashboardStats(propertyId),
    getRevenueOverTime(propertyId, 6),
    getTopPerformingSites(propertyId, 5),
    getBookingSourcesBreakdown(propertyId),
  ])

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Total paid amount from all bookings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReservations}</div>
            <p className="text-xs text-muted-foreground">
              Total active reservations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Occupancy</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.occupancyRate}%</div>
            <p className="text-xs text-muted-foreground">
              Last 30 days occupancy rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Guests</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalGuests}</div>
            <p className="text-xs text-muted-foreground">
              Active guests (adults + children)
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue Overview</CardTitle>
          <CardDescription>Monthly revenue for the past 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          {revenueData.length > 0 ? (
            <RevenueChart data={revenueData} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No revenue data available yet
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Sites</CardTitle>
            <CardDescription>Sites with highest booking revenue</CardDescription>
          </CardHeader>
          <CardContent>
            {topSites.length > 0 ? (
              <div className="space-y-4">
                {topSites.map((site) => (
                  <div key={site.siteId} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{site.siteName}</p>
                      <p className="text-sm text-muted-foreground">{site.bookings} bookings</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatMoney(site.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No booking data available yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Booking Sources</CardTitle>
            <CardDescription>Where your bookings come from</CardDescription>
          </CardHeader>
          <CardContent>
            {bookingSources.length > 0 ? (
              <div className="space-y-4">
                {bookingSources.map((source) => (
                  <div key={source.source} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{source.source}</span>
                      <span className="text-muted-foreground">
                        {source.percentage}% ({source.bookings})
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${source.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No booking data available yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

async function RevenueTab({ propertyId, dateRange }: { propertyId: string; dateRange: DateRange | undefined }) {
  // For "all time", don't filter by date at all
  let startDate: Date | undefined
  if (dateRange && dateRange !== 'all') {
    startDate = getStartDate(dateRange)
  }

  // Fetch revenue analytics data
  const [paymentMethods, paymentStatuses, avgBookingValue] = await Promise.all([
    getRevenueByPaymentMethod(propertyId, startDate),
    getRevenueByPaymentStatus(propertyId, startDate),
    getAverageBookingValue(propertyId, startDate),
  ])

  const totalRevenue = paymentMethods.reduce((sum, item) => sum + item.revenue, 0) as MoneyCents

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              {dateRange === 'all' ? 'All time' : dateRange ? `Last ${dateRange}` : 'All time'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Booking Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(avgBookingValue)}</div>
            <p className="text-xs text-muted-foreground">
              Average per reservation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {paymentMethods.reduce((sum, item) => sum + item.count, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Completed payments
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Payment Method</CardTitle>
            <CardDescription>Breakdown of revenue by payment type</CardDescription>
          </CardHeader>
          <CardContent>
            {paymentMethods.length > 0 ? (
              <div className="space-y-4">
                {paymentMethods.map((method) => {
                  const percentage = totalRevenue > 0
                    ? Math.round((method.revenue / totalRevenue) * 100)
                    : 0
                  return (
                    <div key={method.method} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{method.method}</span>
                        <span className="text-muted-foreground">
                          {percentage}% ({method.count}) - {formatMoney(method.revenue)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No payment data available yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Status */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Payment Status</CardTitle>
            <CardDescription>Payment completion breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {paymentStatuses.length > 0 ? (
              <div className="space-y-4">
                {paymentStatuses.map((status) => {
                  const percentage = totalRevenue > 0
                    ? Math.round((status.revenue / totalRevenue) * 100)
                    : 0
                  return (
                    <div key={status.status} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium capitalize">{status.status.replace('_', ' ')}</span>
                        <span className="text-muted-foreground">
                          {percentage}% ({status.count}) - {formatMoney(status.revenue)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No payment data available yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

async function OccupancyTab({ propertyId }: { propertyId: string }) {
  const occupancyData = await getOccupancyByMonth(propertyId, 12)

  // Calculate average occupancy rate
  const avgOccupancy = occupancyData.length > 0
    ? Math.round(occupancyData.reduce((sum, month) => sum + month.occupancyRate, 0) / occupancyData.length)
    : 0

  const totalBookedNights = occupancyData.reduce((sum, month) => sum + month.bookedNights, 0)
  const totalRevenue = occupancyData.reduce((sum, month) => sum + month.revenue, 0) as MoneyCents

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Occupancy Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgOccupancy}%</div>
            <p className="text-xs text-muted-foreground">
              Last 12 months average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Booked Nights</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBookedNights}</div>
            <p className="text-xs text-muted-foreground">
              Last 12 months
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Last 12 months
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Occupancy Breakdown</CardTitle>
          <CardDescription>Detailed occupancy metrics for the past 12 months</CardDescription>
        </CardHeader>
        <CardContent>
          {occupancyData.length > 0 ? (
            <div className="space-y-4">
              {occupancyData.map((month) => (
                <div key={month.month} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{month.month}</span>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{month.occupancyRate}% occupancy</span>
                      <span>{month.bookedNights}/{month.totalNights} nights</span>
                      <span className="font-medium text-foreground">{formatMoney(month.revenue)}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${month.occupancyRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No occupancy data available yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: DateRange }>
}) {
  const params = await searchParams
  const dateRange = params.range
  const propertyId = await getCurrentPropertyId()

  if (!propertyId) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No property found. Please contact support.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">Track your property performance and insights</p>
        </div>
        <DateRangeFilter />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
          <TabsTrigger value="guests" disabled>Guests</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Suspense
            fallback={
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading analytics...</p>
              </div>
            }
          >
            <AnalyticsOverview />
          </Suspense>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <Suspense
            fallback={
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading revenue analytics...</p>
              </div>
            }
          >
            <RevenueTab propertyId={propertyId} dateRange={dateRange} />
          </Suspense>
        </TabsContent>

        <TabsContent value="occupancy" className="space-y-4">
          <Suspense
            fallback={
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading occupancy data...</p>
              </div>
            }
          >
            <OccupancyTab propertyId={propertyId} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
