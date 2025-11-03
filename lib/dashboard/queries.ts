/**
 * Dashboard Data Queries
 *
 * Server-side data fetching functions for dashboard pages.
 * All queries enforce multi-tenant isolation via property_id.
 */

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/src/contracts/db'
import type {
  ReservationStatus,
  ReservationPaymentStatus,
  PaymentStatus,
  PaymentMethod,
  MoneyCents,
} from '@/src/contracts/booking'

// ============================================================================
// Types
// ============================================================================

type DbReservation = Database['public']['Tables']['reservations']['Row']
type DbPayment = Database['public']['Tables']['payments']['Row']
type DbSite = Database['public']['Tables']['sites']['Row']
type DbGuest = Database['public']['Tables']['guests']['Row']

export interface DashboardReservation {
  id: string
  confirmationNumber: string
  guestId: string
  guestName: string
  guestEmail: string
  siteId: string
  siteName: string
  checkIn: string
  checkOut: string
  numNights: number
  numAdults: number
  numChildren: number
  numPets: number
  totalAmount: MoneyCents
  paidAmount: MoneyCents
  status: ReservationStatus
  paymentStatus: ReservationPaymentStatus
  createdAt: string
}

export interface DashboardPayment {
  id: string
  reservationId: string
  confirmationNumber: string
  guestName: string
  amount: MoneyCents
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  stripePaymentId: string | null
  processedAt: string | null
  createdAt: string
}

export interface DashboardStats {
  totalRevenue: MoneyCents
  totalReservations: number
  occupancyRate: number
  totalGuests: number
  pendingPayments: MoneyCents
  completedPayments: MoneyCents
  cancelledPayments: MoneyCents
}

export interface ReservationFilters {
  status?: ReservationStatus
  paymentStatus?: ReservationPaymentStatus
  search?: string
  startDate?: string
  endDate?: string
}

export interface PaymentFilters {
  status?: PaymentStatus
  startDate?: string
  endDate?: string
}

// ============================================================================
// Reservations Queries
// ============================================================================

/**
 * Fetch reservations for a property with optional filters
 */
export async function getReservations(
  propertyId: string,
  filters: ReservationFilters = {},
  page = 1,
  limit = 50
): Promise<{ data: DashboardReservation[]; total: number }> {
  const supabase = await createClient()
  const offset = (page - 1) * limit

  // Build query with tenant isolation
  let query = supabase
    .from('reservations')
    .select(
      `
      id,
      confirmation_number,
      guest_id,
      site_id,
      check_in_date,
      check_out_date,
      num_adults,
      num_children,
      num_pets,
      total_amount,
      paid_amount,
      status,
      payment_status,
      created_at,
      guests (
        first_name,
        last_name,
        email
      ),
      sites (
        site_name,
        site_number
      )
    `,
      { count: 'exact' }
    )
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Apply filters
  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.paymentStatus) {
    query = query.eq('payment_status', filters.paymentStatus)
  }
  if (filters.startDate) {
    query = query.gte('check_in_date', filters.startDate)
  }
  if (filters.endDate) {
    query = query.lte('check_out_date', filters.endDate)
  }
  if (filters.search) {
    query = query.or(
      `confirmation_number.ilike.%${filters.search}%,guests.first_name.ilike.%${filters.search}%,guests.last_name.ilike.%${filters.search}%`
    )
  }

  const { data, error, count } = await query

  if (error) {
    throw new Error(`Failed to fetch reservations: ${error.message}`)
  }

  // Transform database results to dashboard format
  const reservations: DashboardReservation[] = (data || []).map((reservation) => {
    const guest = reservation.guests as unknown as DbGuest
    const site = reservation.sites as unknown as DbSite
    const checkIn = new Date(reservation.check_in_date)
    const checkOut = new Date(reservation.check_out_date)
    const numNights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
    )

    return {
      id: reservation.id,
      confirmationNumber: reservation.confirmation_number,
      guestId: reservation.guest_id!,
      guestName: `${guest.first_name} ${guest.last_name}`,
      guestEmail: guest.email,
      siteId: reservation.site_id!,
      siteName: site.site_name || `Site ${site.site_number}`,
      checkIn: reservation.check_in_date,
      checkOut: reservation.check_out_date,
      numNights,
      numAdults: reservation.num_adults || 0,
      numChildren: reservation.num_children || 0,
      numPets: reservation.num_pets || 0,
      totalAmount: reservation.total_amount as MoneyCents,
      paidAmount: reservation.paid_amount as MoneyCents,
      status: reservation.status as ReservationStatus,
      paymentStatus: reservation.payment_status as ReservationPaymentStatus,
      createdAt: reservation.created_at!,
    }
  })

  return {
    data: reservations,
    total: count || 0,
  }
}

/**
 * Get a single reservation by ID
 */
export async function getReservation(
  propertyId: string,
  reservationId: string
): Promise<DashboardReservation | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('reservations')
    .select(
      `
      id,
      confirmation_number,
      guest_id,
      site_id,
      check_in_date,
      check_out_date,
      num_adults,
      num_children,
      num_pets,
      total_amount,
      paid_amount,
      status,
      payment_status,
      created_at,
      guests (
        first_name,
        last_name,
        email
      ),
      sites (
        site_name,
        site_number
      )
    `
    )
    .eq('property_id', propertyId)
    .eq('id', reservationId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch reservation: ${error.message}`)
  }

  const guest = data.guests as unknown as DbGuest
  const site = data.sites as unknown as DbSite
  const checkIn = new Date(data.check_in_date)
  const checkOut = new Date(data.check_out_date)
  const numNights = Math.ceil(
    (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
  )

  return {
    id: data.id,
    confirmationNumber: data.confirmation_number,
    guestId: data.guest_id!,
    guestName: `${guest.first_name} ${guest.last_name}`,
    guestEmail: guest.email,
    siteId: data.site_id!,
    siteName: site.site_name || `Site ${site.site_number}`,
    checkIn: data.check_in_date,
    checkOut: data.check_out_date,
    numNights,
    numAdults: data.num_adults || 0,
    numChildren: data.num_children || 0,
    numPets: data.num_pets || 0,
    totalAmount: data.total_amount as MoneyCents,
    paidAmount: data.paid_amount as MoneyCents,
    status: data.status as ReservationStatus,
    paymentStatus: data.payment_status as ReservationPaymentStatus,
    createdAt: data.created_at!,
  }
}

// ============================================================================
// Payments Queries
// ============================================================================

/**
 * Fetch payments for a property with optional filters
 */
export async function getPayments(
  propertyId: string,
  filters: PaymentFilters = {},
  page = 1,
  limit = 50
): Promise<{ data: DashboardPayment[]; total: number }> {
  const supabase = await createClient()
  const offset = (page - 1) * limit

  // Build query with tenant isolation
  let query = supabase
    .from('payments')
    .select(
      `
      id,
      reservation_id,
      amount,
      payment_method,
      payment_status,
      stripe_payment_id,
      processed_at,
      created_at,
      reservations (
        confirmation_number,
        guests (
          first_name,
          last_name
        )
      )
    `,
      { count: 'exact' }
    )
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Apply filters
  if (filters.status) {
    query = query.eq('payment_status', filters.status)
  }
  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate)
  }
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate)
  }

  const { data, error, count } = await query

  if (error) {
    throw new Error(`Failed to fetch payments: ${error.message}`)
  }

  // Transform database results to dashboard format
  const payments: DashboardPayment[] = (data || []).map((payment) => {
    const reservation = payment.reservations as unknown as DbReservation & {
      guests: DbGuest
    }
    const guest = reservation.guests

    return {
      id: payment.id,
      reservationId: payment.reservation_id!,
      confirmationNumber: reservation.confirmation_number,
      guestName: `${guest.first_name} ${guest.last_name}`,
      amount: payment.amount as MoneyCents,
      paymentMethod: payment.payment_method as PaymentMethod,
      paymentStatus: payment.payment_status as PaymentStatus,
      stripePaymentId: payment.stripe_payment_id,
      processedAt: payment.processed_at,
      createdAt: payment.created_at!,
    }
  })

  return {
    data: payments,
    total: count || 0,
  }
}

// ============================================================================
// Stats Queries
// ============================================================================

/**
 * Calculate dashboard statistics for a property
 */
export async function getDashboardStats(
  propertyId: string
): Promise<DashboardStats> {
  const supabase = await createClient()

  // Fetch all reservations for stats calculation
  const { data: reservations, error: reservationsError } = await supabase
    .from('reservations')
    .select('total_amount, paid_amount, status, payment_status')
    .eq('property_id', propertyId)

  if (reservationsError) {
    throw new Error(`Failed to fetch reservation stats: ${reservationsError.message}`)
  }

  // Fetch all payments for stats calculation
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('amount, payment_status')
    .eq('property_id', propertyId)

  if (paymentsError) {
    throw new Error(`Failed to fetch payment stats: ${paymentsError.message}`)
  }

  // Calculate total revenue (sum of paid amounts)
  const totalRevenue = reservations.reduce(
    (sum, r) => sum + (r.paid_amount || 0),
    0
  ) as MoneyCents

  // Count total reservations (excluding cancelled)
  const totalReservations = reservations.filter(
    (r) => r.status !== 'cancelled'
  ).length

  // Calculate total guests (sum of adults + children from confirmed/checked in reservations)
  const { data: activeReservations } = await supabase
    .from('reservations')
    .select('num_adults, num_children')
    .eq('property_id', propertyId)
    .in('status', ['confirmed', 'checked_in'])

  const totalGuests = (activeReservations || []).reduce(
    (sum, r) => sum + (r.num_adults || 0) + (r.num_children || 0),
    0
  )

  // Calculate occupancy rate (for current period - last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: recentReservations } = await supabase
    .from('reservations')
    .select('check_in_date, check_out_date')
    .eq('property_id', propertyId)
    .gte('check_in_date', thirtyDaysAgo.toISOString().split('T')[0])
    .in('status', ['confirmed', 'checked_in', 'checked_out'])

  const { data: sites } = await supabase
    .from('sites')
    .select('id')
    .eq('property_id', propertyId)
    .eq('status', 'available')

  const totalSites = sites?.length || 1 // Avoid division by zero
  const totalNightsPossible = totalSites * 30

  const occupiedNights = (recentReservations || []).reduce((sum, r) => {
    const checkIn = new Date(r.check_in_date)
    const checkOut = new Date(r.check_out_date)
    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
    )
    return sum + nights
  }, 0)

  const occupancyRate = totalNightsPossible > 0
    ? (occupiedNights / totalNightsPossible) * 100
    : 0

  // Calculate payment stats
  // Pending payments = sum of unpaid amounts on reservations (total_amount - paid_amount)
  const pendingPayments = reservations
    .filter((r) => r.status !== 'cancelled') // Exclude cancelled reservations
    .reduce((sum, r) => {
      const unpaidAmount = r.total_amount - (r.paid_amount || 0)
      return sum + (unpaidAmount > 0 ? unpaidAmount : 0)
    }, 0) as MoneyCents

  const completedPayments = (payments || [])
    .filter((p) => p.payment_status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0) as MoneyCents

  const cancelledPayments = (payments || [])
    .filter((p) => p.payment_status === 'failed')
    .reduce((sum, p) => sum + p.amount, 0) as MoneyCents

  return {
    totalRevenue,
    totalReservations,
    occupancyRate: Math.round(occupancyRate * 10) / 10, // Round to 1 decimal
    totalGuests,
    pendingPayments,
    completedPayments,
    cancelledPayments,
  }
}

// ============================================================================
// Sites Queries
// ============================================================================

export interface DashboardSite {
  id: string
  siteNumber: string
  siteName: string | null
  siteType: string
  maxOccupancy: number
  basePrice: MoneyCents
  status: string
  hookups: string[]
  amenities: string[]
  description: string | null
  imageUrl: string | null
  createdAt: string
}

export interface SiteFilters {
  status?: string
  type?: string
  search?: string
}

export interface SiteStats {
  total: number
  available: number
  occupied: number
  maintenance: number
  unavailable: number
}

/**
 * Fetch sites for a property with optional filters
 */
export async function getSites(
  propertyId: string,
  filters: SiteFilters = {}
): Promise<{ data: DashboardSite[]; total: number }> {
  const supabase = await createClient()

  // Build query with tenant isolation
  let query = supabase
    .from('sites')
    .select('*', { count: 'exact' })
    .eq('property_id', propertyId)
    .order('site_number', { ascending: true })

  // Apply filters
  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.type) {
    query = query.eq('site_type', filters.type)
  }
  if (filters.search) {
    query = query.or(
      `site_number.ilike.%${filters.search}%,site_name.ilike.%${filters.search}%`
    )
  }

  const { data, error, count } = await query

  if (error) {
    throw new Error(`Failed to fetch sites: ${error.message}`)
  }

  // Transform database results to dashboard format
  const sites: DashboardSite[] = (data || []).map((site) => ({
    id: site.id,
    siteNumber: site.site_number,
    siteName: site.site_name,
    siteType: site.site_type,
    maxOccupancy: site.max_occupancy || 0,
    basePrice: site.base_price as MoneyCents,
    status: site.status,
    hookups: (site.hookups as string[]) || [],
    amenities: (site.amenities as string[]) || [],
    description: site.description,
    imageUrl: site.image_url,
    createdAt: site.created_at!,
  }))

  return {
    data: sites,
    total: count || 0,
  }
}

/**
 * Calculate site statistics for a property
 */
export async function getSiteStats(propertyId: string): Promise<SiteStats> {
  const supabase = await createClient()

  // Fetch all sites for the property
  const { data: sites, error } = await supabase
    .from('sites')
    .select('status')
    .eq('property_id', propertyId)

  if (error) {
    throw new Error(`Failed to fetch site stats: ${error.message}`)
  }

  const total = sites?.length || 0
  const available = sites?.filter((s) => s.status === 'available').length || 0
  const occupied = sites?.filter((s) => s.status === 'occupied').length || 0
  const maintenance = sites?.filter((s) => s.status === 'maintenance').length || 0
  const unavailable = sites?.filter((s) => s.status === 'unavailable').length || 0

  return {
    total,
    available,
    occupied,
    maintenance,
    unavailable,
  }
}

/**
 * =============================================================================
 * Guests
 * =============================================================================
 */

export interface DashboardGuest {
  id: string
  name: string
  email: string
  phone: string | null
  totalStays: number
  totalSpent: MoneyCents
  lastVisit: string | null
  firstVisit: string | null
}

export interface GuestFilters {
  search: string | undefined
}

export async function getGuests(
  propertyId: string,
  filters: GuestFilters = { search: undefined }
): Promise<{ data: DashboardGuest[]; total: number }> {
  const supabase = await createClient()

  // Get all reservations for this property to aggregate guest data
  // Must join with guests table to get guest information
  const query = supabase
    .from('reservations')
    .select(`
      id,
      guest_id,
      check_in_date,
      total_amount,
      guests (
        id,
        first_name,
        last_name,
        email,
        phone
      )
    `)
    .eq('property_id', propertyId)

  const { data: reservations, error } = await query

  if (error) {
    throw new Error(`Failed to fetch guest data: ${error.message}`)
  }

  // Aggregate reservations by guest ID to build guest profiles
  const guestMap = new Map<string, DashboardGuest>()

  reservations?.forEach((reservation) => {
    const guest = reservation.guests as unknown as DbGuest
    if (!guest || !guest.email) return

    const guestId = reservation.guest_id!
    const existing = guestMap.get(guestId)

    if (existing) {
      // Update existing guest
      existing.totalStays += 1
      existing.totalSpent = (existing.totalSpent + reservation.total_amount) as MoneyCents

      // Update last visit if this reservation is more recent
      if (
        reservation.check_in_date &&
        (!existing.lastVisit || reservation.check_in_date > existing.lastVisit)
      ) {
        existing.lastVisit = reservation.check_in_date
      }

      // Update first visit if this reservation is older
      if (
        reservation.check_in_date &&
        (!existing.firstVisit || reservation.check_in_date < existing.firstVisit)
      ) {
        existing.firstVisit = reservation.check_in_date
      }
    } else {
      // Create new guest entry
      guestMap.set(guestId, {
        id: guest.id,
        name: `${guest.first_name} ${guest.last_name}`,
        email: guest.email,
        phone: guest.phone,
        totalStays: 1,
        totalSpent: reservation.total_amount as MoneyCents,
        lastVisit: reservation.check_in_date,
        firstVisit: reservation.check_in_date,
      })
    }
  })

  // Convert map to array and apply filters
  let guests = Array.from(guestMap.values())

  // Apply search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    guests = guests.filter(
      (guest) =>
        guest.name.toLowerCase().includes(searchLower) ||
        guest.email.toLowerCase().includes(searchLower) ||
        (guest.phone && guest.phone.includes(searchLower))
    )
  }

  // Sort by total spent (highest first)
  guests.sort((a, b) => b.totalSpent - a.totalSpent)

  return {
    data: guests,
    total: guests.length,
  }
}

export async function getGuestStats(propertyId: string): Promise<{
  totalGuests: number
  returningGuests: number
  averageStays: number
  totalRevenue: MoneyCents
}> {
  const { data: guests } = await getGuests(propertyId)

  const totalGuests = guests.length
  const returningGuests = guests.filter((g) => g.totalStays > 1).length
  const totalStays = guests.reduce((sum, g) => sum + g.totalStays, 0)
  const averageStays = totalGuests > 0 ? totalStays / totalGuests : 0
  const totalRevenue = guests.reduce((sum, g) => sum + g.totalSpent, 0) as MoneyCents

  return {
    totalGuests,
    returningGuests,
    averageStays,
    totalRevenue,
  }
}

// ============================================================================
// Analytics Queries
// ============================================================================

export interface RevenueDataPoint {
  month: string
  revenue: number
  bookings: number
}

export interface TopPerformingSite {
  siteId: string
  siteName: string
  bookings: number
  revenue: MoneyCents
}

export interface BookingSource {
  source: string
  bookings: number
  percentage: number
  revenue: MoneyCents
}

/**
 * Get revenue data grouped by month for the last 6 months
 */
export async function getRevenueOverTime(
  propertyId: string,
  months: number = 6
): Promise<RevenueDataPoint[]> {
  const supabase = await createClient()

  // Calculate start date (N months ago)
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months)
  const startDateStr = startDate.toISOString().split('T')[0]

  // Fetch reservations from the last N months
  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('check_in_date, paid_amount, created_at')
    .eq('property_id', propertyId)
    .gte('check_in_date', startDateStr)
    .not('status', 'eq', 'cancelled')

  if (error) {
    throw new Error(`Failed to fetch revenue data: ${error.message}`)
  }

  // Group by month
  const monthlyData = new Map<string, { revenue: number; bookings: number }>()

  reservations?.forEach((reservation) => {
    const date = new Date(reservation.check_in_date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    const existing = monthlyData.get(monthKey)
    if (existing) {
      existing.revenue += reservation.paid_amount
      existing.bookings += 1
    } else {
      monthlyData.set(monthKey, {
        revenue: reservation.paid_amount,
        bookings: 1,
      })
    }
  })

  // Convert to array and format month names
  const result: RevenueDataPoint[] = []
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

    const data = monthlyData.get(monthKey) || { revenue: 0, bookings: 0 }
    result.push({
      month: monthName,
      revenue: data.revenue / 100, // Convert cents to dollars for chart
      bookings: data.bookings,
    })
  }

  return result
}

/**
 * Get top performing sites by revenue
 */
export async function getTopPerformingSites(
  propertyId: string,
  limit: number = 5
): Promise<TopPerformingSite[]> {
  const supabase = await createClient()

  // Fetch reservations with site information
  const { data: reservations, error } = await supabase
    .from('reservations')
    .select(`
      site_id,
      total_amount,
      sites (
        site_name,
        site_number
      )
    `)
    .eq('property_id', propertyId)
    .not('status', 'eq', 'cancelled')

  if (error) {
    throw new Error(`Failed to fetch top sites: ${error.message}`)
  }

  // Group by site
  const siteData = new Map<string, { siteName: string; bookings: number; revenue: number }>()

  reservations?.forEach((reservation) => {
    const siteId = reservation.site_id!
    const site = reservation.sites as unknown as DbSite
    const siteName = site.site_name || `Site ${site.site_number}`

    const existing = siteData.get(siteId)
    if (existing) {
      existing.bookings += 1
      existing.revenue += reservation.total_amount
    } else {
      siteData.set(siteId, {
        siteName,
        bookings: 1,
        revenue: reservation.total_amount,
      })
    }
  })

  // Convert to array and sort by revenue
  const result: TopPerformingSite[] = Array.from(siteData.entries())
    .map(([siteId, data]) => ({
      siteId,
      siteName: data.siteName,
      bookings: data.bookings,
      revenue: data.revenue as MoneyCents,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)

  return result
}

/**
 * Get booking sources breakdown
 */
export async function getBookingSourcesBreakdown(
  propertyId: string
): Promise<BookingSource[]> {
  const supabase = await createClient()

  // Fetch all reservations with source information
  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('source, total_amount')
    .eq('property_id', propertyId)
    .not('status', 'eq', 'cancelled')

  if (error) {
    throw new Error(`Failed to fetch booking sources: ${error.message}`)
  }

  // Group by source
  const sourceData = new Map<string, { bookings: number; revenue: number }>()
  let totalBookings = 0

  reservations?.forEach((reservation) => {
    const source = reservation.source || 'Unknown'
    totalBookings += 1

    const existing = sourceData.get(source)
    if (existing) {
      existing.bookings += 1
      existing.revenue += reservation.total_amount
    } else {
      sourceData.set(source, {
        bookings: 1,
        revenue: reservation.total_amount,
      })
    }
  })

  // Convert to array with percentages
  const result: BookingSource[] = Array.from(sourceData.entries())
    .map(([source, data]) => ({
      source: source.charAt(0).toUpperCase() + source.slice(1), // Capitalize
      bookings: data.bookings,
      percentage: totalBookings > 0 ? Math.round((data.bookings / totalBookings) * 100) : 0,
      revenue: data.revenue as MoneyCents,
    }))
    .sort((a, b) => b.bookings - a.bookings)

  return result
}

/**
 * Get revenue breakdown by payment method
 */
export async function getRevenueByPaymentMethod(
  propertyId: string,
  startDate?: Date
): Promise<Array<{ method: string; revenue: MoneyCents; count: number }>> {
  const supabase = await createClient()

  // Build query
  let query = supabase
    .from('payments')
    .select('payment_method, amount')
    .eq('property_id', propertyId)
    .eq('payment_status', 'completed')

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString())
  }

  const { data: payments, error } = await query

  if (error) {
    throw new Error(`Failed to fetch payment methods: ${error.message}`)
  }

  // Group by payment method
  const methodData = new Map<string, { revenue: number; count: number }>()

  payments?.forEach((payment) => {
    const method = payment.payment_method || 'Unknown'
    const existing = methodData.get(method)

    if (existing) {
      existing.revenue += payment.amount
      existing.count += 1
    } else {
      methodData.set(method, {
        revenue: payment.amount,
        count: 1,
      })
    }
  })

  // Convert to array and sort by revenue
  return Array.from(methodData.entries())
    .map(([method, data]) => ({
      method: method.charAt(0).toUpperCase() + method.slice(1).replace('_', ' '),
      revenue: data.revenue as MoneyCents,
      count: data.count,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

/**
 * Get revenue breakdown by payment status
 */
export async function getRevenueByPaymentStatus(
  propertyId: string,
  startDate?: Date
): Promise<Array<{ status: string; revenue: MoneyCents; count: number }>> {
  const supabase = await createClient()

  // Build query
  let query = supabase
    .from('payments')
    .select('payment_status, amount')
    .eq('property_id', propertyId)

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString())
  }

  const { data: payments, error } = await query

  if (error) {
    throw new Error(`Failed to fetch payment status: ${error.message}`)
  }

  // Group by status
  const statusData = new Map<string, { revenue: number; count: number }>()

  payments?.forEach((payment) => {
    const status = payment.payment_status || 'Unknown'
    const existing = statusData.get(status)

    if (existing) {
      existing.revenue += payment.amount
      existing.count += 1
    } else {
      statusData.set(status, {
        revenue: payment.amount,
        count: 1,
      })
    }
  })

  // Convert to array
  return Array.from(statusData.entries())
    .map(([status, data]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      revenue: data.revenue as MoneyCents,
      count: data.count,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

/**
 * Get average booking value
 */
export async function getAverageBookingValue(
  propertyId: string,
  startDate?: Date
): Promise<MoneyCents> {
  const supabase = await createClient()

  let query = supabase
    .from('reservations')
    .select('total_amount')
    .eq('property_id', propertyId)
    .not('status', 'eq', 'cancelled')

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString())
  }

  const { data: reservations, error } = await query

  if (error) {
    throw new Error(`Failed to fetch average booking value: ${error.message}`)
  }

  if (!reservations || reservations.length === 0) {
    return 0 as MoneyCents
  }

  const total = reservations.reduce((sum, r) => sum + r.total_amount, 0)
  return Math.round(total / reservations.length) as MoneyCents
}

export interface OccupancyMonth {
  month: string
  occupancyRate: number
  bookedNights: number
  totalNights: number
  revenue: MoneyCents
}

/**
 * Get occupancy breakdown by month
 */
export async function getOccupancyByMonth(
  propertyId: string,
  months: number = 12
): Promise<OccupancyMonth[]> {
  const supabase = await createClient()

  // Get total number of sites
  const { data: sites } = await supabase
    .from('sites')
    .select('id')
    .eq('property_id', propertyId)
    .eq('status', 'available')

  const totalSites = sites?.length || 1

  // Calculate start date
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months)

  // Fetch reservations
  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('check_in_date, check_out_date, total_amount')
    .eq('property_id', propertyId)
    .gte('check_in_date', startDate.toISOString().split('T')[0])
    .in('status', ['confirmed', 'checked_in', 'checked_out'])

  if (error) {
    throw new Error(`Failed to fetch occupancy data: ${error.message}`)
  }

  // Group by month
  const monthlyData = new Map<
    string,
    { bookedNights: number; revenue: number }
  >()

  reservations?.forEach((reservation) => {
    const checkIn = new Date(reservation.check_in_date)
    const checkOut = new Date(reservation.check_out_date)
    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Assign nights to the check-in month
    const monthKey = `${checkIn.getFullYear()}-${String(
      checkIn.getMonth() + 1
    ).padStart(2, '0')}`

    const existing = monthlyData.get(monthKey)
    if (existing) {
      existing.bookedNights += nights
      existing.revenue += reservation.total_amount
    } else {
      monthlyData.set(monthKey, {
        bookedNights: nights,
        revenue: reservation.total_amount,
      })
    }
  })

  // Build result for all months (most recent first)
  const result: OccupancyMonth[] = []
  for (let i = 0; i < months; i++) {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    const monthKey = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, '0')}`
    const monthName = date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    })

    // Calculate days in month
    const daysInMonth = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0
    ).getDate()
    const totalNights = daysInMonth * totalSites

    const data = monthlyData.get(monthKey) || { bookedNights: 0, revenue: 0 }
    const occupancyRate =
      totalNights > 0 ? (data.bookedNights / totalNights) * 100 : 0

    result.push({
      month: monthName,
      occupancyRate: Math.round(occupancyRate * 10) / 10, // Round to 1 decimal
      bookedNights: data.bookedNights,
      totalNights,
      revenue: data.revenue as MoneyCents,
    })
  }

  return result
}

// ============================================================================
// Check-in/Check-out Queries
// ============================================================================

/**
 * Get today's arrivals (reservations with check-in date = today)
 * Returns reservations that need check-in or have already been checked in today
 */
export async function getTodaysArrivals(propertyId: string) {
  const supabase = await createClient()

  // Get today's date in YYYY-MM-DD format
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]!

  const { data, error } = await supabase
    .from('reservations')
    .select(
      `
      *,
      guest:guests (*),
      site:sites (*)
      `
    )
    .eq('property_id', propertyId)
    .eq('check_in_date', todayStr)
    .in('status', ['confirmed', 'checked_in']) // Only show confirmed (pending check-in) and checked_in
    .order('checked_in_at', { ascending: false, nullsFirst: false }) // Show pending first

  if (error) {
    console.error('Error fetching todays arrivals:', error)
    return []
  }

  return data || []
}
