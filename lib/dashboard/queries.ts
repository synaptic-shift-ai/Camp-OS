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
  const pendingPayments = (payments || [])
    .filter((p) => p.payment_status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0) as MoneyCents

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
