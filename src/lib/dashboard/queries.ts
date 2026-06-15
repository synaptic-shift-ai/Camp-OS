/**
 * Dashboard Data Queries
 *
 * Server-side data fetching functions for dashboard pages.
 * All queries enforce multi-tenant isolation via property_id.
 */

import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { Database } from '@/contracts/db'
import type {
  ReservationStatus,
  ReservationPaymentStatus,
  PaymentStatus,
  PaymentMethod,
  MoneyCents,
} from '@/contracts/booking'
import { parseReservationTypesConfigFromDB } from '@/lib/config/resolution'
import type { PropertyReservationTypesConfig } from '@/lib/config/types'
import { getPricingSourceType } from '@/lib/site-pricing-source'

// ============================================================================
// Types
// ============================================================================

type DbReservation = Database['public']['Tables']['reservations']['Row']
type DbSite = Database['public']['Tables']['sites']['Row']
type DbGuest = Database['public']['Tables']['guests']['Row']

/** Site row as returned from join; may include enabled_reservation_types_override from migration */
type SiteWithOverride = DbSite & {
  enabled_reservation_types_override?: string[] | null
  pricing_override?: unknown
  weekly_rate_cents?: number | null
  monthly_rate_cents?: number | null
}

/**
 * Resolve effective display rates for a reservation's site.
 * When the site uses property defaults (enabled_reservation_types_override is null/undefined),
 * use property's reservation_type_config rates; otherwise use the site's base_price and rate fields.
 *
 * Note: site can be null when the join fails or the site is missing.
 */
function getEffectiveRatesForReservation(
  site: SiteWithOverride | null,
  propertyConfig: PropertyReservationTypesConfig | null
): { pricePerNight: MoneyCents; weeklyRateCents: number | null; monthlyRateCents: number | null } {
  if (!site) {
    return {
      pricePerNight: 0 as MoneyCents,
      weeklyRateCents: null,
      monthlyRateCents: null,
    }
  }

  const usesPropertyDefaults = getPricingSourceType(
    site.pricing_override,
    site.enabled_reservation_types_override
  ) !== 'manual'

  if (usesPropertyDefaults && propertyConfig) {
    const nightly =
      propertyConfig.nightly?.rate_cents != null
        ? propertyConfig.nightly.rate_cents
        : site.base_price
    const weekly =
      propertyConfig.weekly?.rate_cents != null ? propertyConfig.weekly.rate_cents : null
    const monthly =
      propertyConfig.monthly?.rate_cents != null ? propertyConfig.monthly.rate_cents : null
    return {
      pricePerNight: nightly as MoneyCents,
      weeklyRateCents: weekly,
      monthlyRateCents: monthly,
    }
  }

  return {
    pricePerNight: site.base_price as MoneyCents,
    weeklyRateCents: site.weekly_rate_cents ?? null,
    monthlyRateCents: site.monthly_rate_cents ?? null,
  }
}

export interface DashboardReservation {
  id: string
  confirmationNumber: string
  guestId: string
  guestName: string
  guestEmail: string
  siteId: string
  siteName: string
  siteNumber: string
  siteType: string
  pricePerNight: MoneyCents
  weeklyRateCents: number | null
  monthlyRateCents: number | null
  bookingType: 'seasonal' | 'monthly' | 'weekly' | 'nightly' | 'long_term'
  checkIn: string
  checkOut: string
  numNights: number
  numAdults: number
  numChildren: number
  numPets: number
  totalAmount: MoneyCents
  paidAmount: MoneyCents
  refundAmount: MoneyCents
  status: ReservationStatus
  paymentStatus: ReservationPaymentStatus
  createdAt: string
  specialRequests: string | null
  checkInNotes: string | null
}

export interface DashboardActivityLog {
  /** Primary key UUID; stable row identity (not shown in the ID column). */
  rowId: string
  /** Per-property sequence for UI only: 001 = oldest log for this property, counts up with each new log. */
  displayId: string
  action: string
  resource: string
  userDisplayName: string
  createdAt: string
  details: string | null
}

export type TransactionType =
  | 'payment'
  | 'refund'
  | 'charge'
  | 'deposit'
  | 'deposit_release'
  | 'deposit_deduction'
  | 'expense'
  | 'platform_fee'
  | 'payout'

export type RecognitionStatus = 'pending' | 'recognized' | 'deferred' | 'written_off'

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
  transactionType: TransactionType | null
  recognitionStatus: RecognitionStatus | null
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
  status?: ReservationStatus | ReservationStatus[]
  paymentStatus?: ReservationPaymentStatus
  search?: string
  startDate?: string
  endDate?: string
  checkOutDate?: string
  siteType?: string
  allowedSiteTypes?: string[]
  sortBy?:
  | 'confirmation'
  | 'guest'
  | 'site'
  | 'checkIn'
  | 'checkOut'
  | 'nights'
  | 'guests'
  | 'totalAmount'
  | 'paidAmount'
  | 'balanceOwed'
  | 'refundedAmount'
  | 'status'
  sortOrder?: 'asc' | 'desc'
  searchField?: 'confirmation' | 'guest' | 'site'
}

export interface PaymentFilters {
  status?: PaymentStatus
  type?: TransactionType
  startDate?: string
  endDate?: string
}

// ============================================================================
// Activity Logs Queries
// ============================================================================

function formatPropertyActivityDisplayId(sequence: number, totalForProperty: number): string {
  const width = Math.max(3, String(totalForProperty).length)
  return String(sequence).padStart(width, '0')
}

function displayNameFromAuthUser(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const fullName = typeof meta?.full_name === 'string' ? meta.full_name.trim() : ''
  if (fullName.length > 0) return fullName
  const firstName = typeof meta?.first_name === 'string' ? meta.first_name.trim() : ''
  const lastName = typeof meta?.last_name === 'string' ? meta.last_name.trim() : ''
  const combinedName = [firstName, lastName].filter(Boolean).join(' ').trim()
  if (combinedName.length > 0) return combinedName
  return user.email ?? 'Unknown user'
}

async function resolveActivityLogActorDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))]
  const map = new Map<string, string>()
  if (unique.length === 0) return map

  const service = createServiceRoleClient()
  await Promise.all(
    unique.map(async (id) => {
      const { data, error } = await service.auth.admin.getUserById(id)
      if (error || !data?.user) {
        map.set(id, 'Unknown user')
        return
      }
      map.set(id, displayNameFromAuthUser(data.user))
    })
  )
  return map
}

export type ActivityLogListFilters = {
  search?: string | null
  action?: string | null
  resource?: string | null
  /** Inclusive start day, `yyyy-MM-dd` (interpreted in the Node runtime local timezone). */
  dateFrom?: string | null
  /** Inclusive end day, `yyyy-MM-dd` (interpreted in the Node runtime local timezone). */
  dateTo?: string | null
  sortBy?: 'displayId' | 'action' | 'resource' | 'userDisplayName' | 'createdAt' | 'details'
  sortOrder?: 'asc' | 'desc'
}

function activityLogParseYmdLocalMidnight(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const start = new Date(y, mo, d, 0, 0, 0, 0)
  if (start.getFullYear() !== y || start.getMonth() !== mo || start.getDate() !== d) return null
  return start
}

function activityLogLocalDayStartIso(ymd: string): string | null {
  const start = activityLogParseYmdLocalMidnight(ymd)
  return start ? start.toISOString() : null
}

function activityLogLocalDayEndExclusiveIso(ymd: string): string | null {
  const start = activityLogParseYmdLocalMidnight(ymd)
  if (!start) return null
  const endExclusive = new Date(start)
  endExclusive.setDate(endExclusive.getDate() + 1)
  return endExclusive.toISOString()
}

function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export async function getPropertyActivityLogs(
  propertyId: string,
  page = 1,
  limit = 10,
  filters: ActivityLogListFilters = {}
): Promise<{ data: DashboardActivityLog[]; total: number }> {
  const supabase = await createClient()

  const { data: propertyRow, error: propertyLookupError } = await supabase
    .from('properties')
    .select('company_id')
    .eq('id', propertyId)
    .single()

  if (propertyLookupError || !propertyRow?.company_id) {
    console.error('Failed to resolve property for activity logs', propertyLookupError)
    return { data: [], total: 0 }
  }

  const companyId = propertyRow.company_id
  const activityScope = `property_id.eq.${propertyId},and(company_id.eq.${companyId},property_id.is.null)`

  const actionFilter = filters.action?.trim()
  const resourceFilter = filters.resource?.trim()
  const searchRaw = filters.search?.trim() ?? ''
  const searchEscaped = searchRaw.length > 0 ? escapeIlikePattern(searchRaw) : null

  let dateFromYmd = filters.dateFrom?.trim() ?? null
  let dateToYmd = filters.dateTo?.trim() ?? null
  if (dateFromYmd && dateToYmd && dateFromYmd > dateToYmd) {
    ;[dateFromYmd, dateToYmd] = [dateToYmd, dateFromYmd]
  }
  const createdAtGte = dateFromYmd ? activityLogLocalDayStartIso(dateFromYmd) : null
  const createdAtLt = dateToYmd ? activityLogLocalDayEndExclusiveIso(dateToYmd) : null

  let countBuilder = supabase
    .from('activity_log')
    .select('*', { count: 'exact', head: true })
    .or(activityScope)

  if (actionFilter && actionFilter !== 'all') {
    countBuilder = countBuilder.eq('action', actionFilter)
  }
  if (resourceFilter && resourceFilter !== 'all') {
    countBuilder = countBuilder.eq('resource', resourceFilter)
  }
  if (searchEscaped != null) {
    countBuilder = countBuilder.or(
      `details.ilike.%${searchEscaped}%,action.ilike.%${searchEscaped}%,resource.ilike.%${searchEscaped}%`
    )
  }
  if (createdAtGte) {
    countBuilder = countBuilder.gte('created_at', createdAtGte)
  }
  if (createdAtLt) {
    countBuilder = countBuilder.lt('created_at', createdAtLt)
  }

  const { count: totalCount, error: countError } = await countBuilder

  if (countError) {
    console.error('Failed to count activity logs', countError)
    return { data: [], total: 0 }
  }

  const total = totalCount ?? 0
  const safeLimit = limit > 0 ? limit : 10
  const safePage = page > 0 ? page : 1
  const offset = (safePage - 1) * safeLimit
  const rangeEnd = offset + safeLimit - 1

  let dataBuilder = supabase
    .from('activity_log')
    .select('id, action, resource, user_id, created_at, details')
    .or(activityScope)

  if (actionFilter && actionFilter !== 'all') {
    dataBuilder = dataBuilder.eq('action', actionFilter)
  }
  if (resourceFilter && resourceFilter !== 'all') {
    dataBuilder = dataBuilder.eq('resource', resourceFilter)
  }
  if (searchEscaped != null) {
    dataBuilder = dataBuilder.or(
      `details.ilike.%${searchEscaped}%,action.ilike.%${searchEscaped}%,resource.ilike.%${searchEscaped}%`
    )
  }
  if (createdAtGte) {
    dataBuilder = dataBuilder.gte('created_at', createdAtGte)
  }
  if (createdAtLt) {
    dataBuilder = dataBuilder.lt('created_at', createdAtLt)
  }

  const sortBy = filters.sortBy ?? 'createdAt'
  const sortOrder = filters.sortOrder ?? 'desc'

  // Determine if we need to sort in DB or post-fetch
  const needsPostFetchSort = sortBy === 'displayId' || sortBy === 'userDisplayName'

  if (!needsPostFetchSort) {
    const dbColumn = sortBy === 'createdAt' ? 'created_at' : sortBy
    dataBuilder = dataBuilder.order(dbColumn, { ascending: sortOrder === 'asc' })
  }

  const { data, error } = await dataBuilder.range(offset, rangeEnd)

  if (error) {
    console.error('Failed to fetch activity logs', error)
    return { data: [], total }
  }

  const rows = data ?? []
  const actorIds = rows.map((r) => r.user_id).filter((id): id is string => id != null)
  const displayNameByUserId = await resolveActivityLogActorDisplayNames(actorIds)

  const dataResult = rows.map((row, index) => {
    const sequence = total - offset - index
    const userDisplayName =
      row.user_id == null ? 'System' : (displayNameByUserId.get(row.user_id) ?? 'Unknown user')
    return {
      rowId: row.id,
      displayId: formatPropertyActivityDisplayId(sequence, total),
      action: row.action,
      resource: row.resource,
      userDisplayName,
      createdAt: row.created_at,
      details: row.details ?? null,
    }
  })

  // Post-fetch sorting for computed fields (displayId, userDisplayName)
  if (needsPostFetchSort) {
    dataResult.sort((a, b) => {
      let comparison = 0
      if (sortBy === 'displayId') {
        comparison = a.displayId.localeCompare(b.displayId)
      } else if (sortBy === 'userDisplayName') {
        comparison = a.userDisplayName.localeCompare(b.userDisplayName)
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })
  }

  return { data: dataResult, total }
}

export async function getPropertyActivityLogResources(propertyId: string): Promise<string[]> {
  const supabase = await createClient()

  const { data: propertyRow, error: propertyLookupError } = await supabase
    .from('properties')
    .select('company_id')
    .eq('id', propertyId)
    .single()

  if (propertyLookupError || !propertyRow?.company_id) {
    console.error('Failed to resolve property for activity log resources', propertyLookupError)
    return []
  }

  const companyId = propertyRow.company_id
  const activityScope = `property_id.eq.${propertyId},and(company_id.eq.${companyId},property_id.is.null)`

  const { data, error } = await supabase
    .from('activity_log')
    .select('resource')
    .or(activityScope)

  if (error) {
    console.error('Failed to fetch activity log resources', error)
    return []
  }

  const resources = [...new Set((data ?? []).map((row) => row.resource).filter(Boolean))]
  return resources.sort((a, b) => a.localeCompare(b))
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

  const { data: propertyRow } = await supabase
    .from('properties')
    .select('reservation_type_config')
    .eq('id', propertyId)
    .single()

  const propertyConfig = propertyRow?.reservation_type_config
    ? parseReservationTypesConfigFromDB(propertyRow.reservation_type_config)
    : null

  // If filtering by site type, first resolve matching site IDs for this property
  let siteIdsFilter: string[] | null = null
  if (filters.siteType) {
    const { data: siteRows, error: siteError } = await supabase
      .from('sites')
      .select('id')
      .eq('property_id', propertyId)
      .eq('site_type', filters.siteType)

    if (siteError) {
      throw new Error(`Failed to fetch sites for filter: ${siteError.message}`)
    }

    const ids = (siteRows ?? []).map((s) => s.id as string)
    if (ids.length === 0) {
      // No matching sites → no matching reservations
      return { data: [], total: 0 }
    }

    siteIdsFilter = ids
  } else if (Array.isArray(filters.allowedSiteTypes) && filters.allowedSiteTypes.length > 0) {
    const allowedLower = new Set(filters.allowedSiteTypes.map((t) => t.toLowerCase()))
    const { data: siteRows, error: siteError } = await supabase
      .from('sites')
      .select('id, site_type')
      .eq('property_id', propertyId)
    if (siteError) {
      throw new Error(`Failed to fetch sites for allowed types filter: ${siteError.message}`)
    }
    const ids = (siteRows ?? [])
      .filter((s) => s.site_type && allowedLower.has((s.site_type as string).toLowerCase()))
      .map((s) => s.id as string)
    if (ids.length === 0) {
      return { data: [], total: 0 }
    }
    siteIdsFilter = ids
  }

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
      special_requests,
      check_in_notes,
      total_amount,
      paid_amount,
      refund_amount_cents,
      status,
      payment_status,
      booking_type,
      created_at,
      guests (
        first_name,
        last_name,
        email
      ),
      sites!inner (
        site_name,
        site_number,
        base_price,
        weekly_rate_cents,
        monthly_rate_cents,
        pricing_override,
        enabled_reservation_types_override,
        site_type
      )
    `
    )
    .eq('property_id', propertyId)

  if (siteIdsFilter) {
    query = query.in('site_id', siteIdsFilter)
  }

  // Apply filters
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status)
    } else {
      query = query.eq('status', filters.status)
    }
  }
  if (filters.paymentStatus) {
    query = query.eq('payment_status', filters.paymentStatus)
  }
  if (filters.startDate) {
    query = query.gte('check_in_date', filters.startDate)
  }
  if (filters.endDate) {
    query = query.lte('check_in_date', filters.endDate)
  }
  if (filters.checkOutDate) {
    query = query.eq('check_out_date', filters.checkOutDate)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch reservations: ${error.message}`)
  }

  // Transform database results to dashboard format
  let reservations: DashboardReservation[] = (data || []).map((reservation) => {
    const guest = reservation.guests as unknown as DbGuest
    const site = reservation.sites as unknown as SiteWithOverride | null
    const checkIn = new Date(reservation.check_in_date)
    const checkOut = new Date(reservation.check_out_date)
    const numNights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
    )
    const rates = getEffectiveRatesForReservation(site, propertyConfig)

    const siteName =
      site?.site_name ||
      (site?.site_number ? `Site ${site.site_number}` : "Unknown site")
    const siteNumber = site?.site_number ?? ""

    return {
      id: reservation.id,
      confirmationNumber: reservation.confirmation_number,
      guestId: reservation.guest_id!,
      guestName: `${guest.first_name} ${guest.last_name}`,
      guestEmail: guest.email,
      siteId: reservation.site_id!,
      siteName,
      siteNumber,
      siteType: site?.site_type ?? 'other',
      pricePerNight: rates.pricePerNight,
      weeklyRateCents: rates.weeklyRateCents,
      monthlyRateCents: rates.monthlyRateCents,
      bookingType: (reservation.booking_type as any) || 'nightly',
      checkIn: reservation.check_in_date,
      checkOut: reservation.check_out_date,
      numNights,
      numAdults: reservation.num_adults || 0,
      numChildren: reservation.num_children || 0,
      numPets: reservation.num_pets || 0,
      totalAmount: reservation.total_amount as MoneyCents,
      paidAmount: reservation.paid_amount as MoneyCents,
      refundAmount: ((reservation as { refund_amount_cents?: number }).refund_amount_cents ?? 0) as MoneyCents,
      status: reservation.status as ReservationStatus,
      paymentStatus: reservation.payment_status as ReservationPaymentStatus,
      createdAt: reservation.created_at!,
      specialRequests: (reservation as { special_requests?: string | null }).special_requests ?? null,
      checkInNotes: (reservation as { check_in_notes?: string | null }).check_in_notes ?? null,
    }
  })

  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    const searchField = filters.searchField ?? 'guest'
    reservations = reservations.filter((reservation) => {
      const confirmation = reservation.confirmationNumber.toLowerCase()
      const guestName = reservation.guestName.toLowerCase()
      const siteName = reservation.siteName.toLowerCase()
      const siteNumber = reservation.siteNumber.toLowerCase()

      if (searchField === 'confirmation') {
        return confirmation.includes(searchLower)
      }
      if (searchField === 'guest') {
        return guestName.includes(searchLower)
      }
      if (searchField === 'site') {
        return siteName.includes(searchLower) || siteNumber.includes(searchLower)
      }

      // Default: guest
      return guestName.includes(searchLower)
    })
  }

  const sortBy = filters.sortBy ?? 'checkIn'
  const sortOrder = filters.sortOrder ?? 'desc'
  reservations.sort((a, b) => {
    let comparison = 0
    if (sortBy === 'confirmation') comparison = a.confirmationNumber.localeCompare(b.confirmationNumber)
    else if (sortBy === 'guest') comparison = a.guestName.localeCompare(b.guestName)
    else if (sortBy === 'site') comparison = a.siteName.localeCompare(b.siteName)
    else if (sortBy === 'checkIn') comparison = new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime()
    else if (sortBy === 'checkOut')
      comparison = new Date(a.checkOut).getTime() - new Date(b.checkOut).getTime()
    else if (sortBy === 'nights') comparison = a.numNights - b.numNights
    else if (sortBy === 'guests')
      comparison = a.numAdults + a.numChildren - (b.numAdults + b.numChildren)
    else if (sortBy === 'totalAmount') comparison = a.totalAmount - b.totalAmount
    else if (sortBy === 'paidAmount') comparison = a.paidAmount - b.paidAmount
    else if (sortBy === 'balanceOwed')
      comparison = a.totalAmount - a.paidAmount - (b.totalAmount - b.paidAmount)
    else if (sortBy === 'refundedAmount') comparison = a.refundAmount - b.refundAmount
    else comparison = a.status.localeCompare(b.status)

    return sortOrder === 'asc' ? comparison : -comparison
  })

  const total = reservations.length
  const paginatedReservations = reservations.slice(offset, offset + limit)

  return {
    data: paginatedReservations,
    total,
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

  const [
    { data: propertyRow },
    { data, error },
  ] = await Promise.all([
    supabase
      .from('properties')
      .select('reservation_type_config')
      .eq('id', propertyId)
      .single(),
    supabase
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
      booking_type,
      created_at,
      guests (
        first_name,
        last_name,
        email
      ),
      sites (
        site_name,
        site_number,
        site_type,
        base_price,
        weekly_rate_cents,
        monthly_rate_cents,
        pricing_override,
        enabled_reservation_types_override
      )
    `
      )
      .eq('property_id', propertyId)
      .eq('id', reservationId)
      .single(),
  ])

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch reservation: ${error.message}`)
  }

  const propertyConfig = propertyRow?.reservation_type_config
    ? parseReservationTypesConfigFromDB(propertyRow.reservation_type_config)
    : null

  const guest = data.guests as unknown as DbGuest
  const site = data.sites as unknown as SiteWithOverride
  const checkIn = new Date(data.check_in_date)
  const checkOut = new Date(data.check_out_date)
  const numNights = Math.ceil(
    (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
  )
  const rates = getEffectiveRatesForReservation(site, propertyConfig)

  return {
    id: data.id,
    confirmationNumber: data.confirmation_number,
    guestId: data.guest_id!,
    guestName: `${guest.first_name} ${guest.last_name}`,
    guestEmail: guest.email,
    siteId: data.site_id!,
    siteName: site.site_name || `Site ${site.site_number}`,
    siteNumber: site.site_number,
    siteType: site.site_type ?? 'other',
    pricePerNight: rates.pricePerNight,
    weeklyRateCents: rates.weeklyRateCents,
    monthlyRateCents: rates.monthlyRateCents,
    bookingType: (data.booking_type as any) || 'nightly',
    checkIn: data.check_in_date,
    checkOut: data.check_out_date,
    numNights,
    numAdults: data.num_adults || 0,
    numChildren: data.num_children || 0,
    numPets: data.num_pets || 0,
    totalAmount: data.total_amount as MoneyCents,
    paidAmount: data.paid_amount as MoneyCents,
    refundAmount: ((data as { refund_amount_cents?: number }).refund_amount_cents ?? 0) as MoneyCents,
    status: data.status as ReservationStatus,
    paymentStatus: data.payment_status as ReservationPaymentStatus,
    createdAt: data.created_at!,
    specialRequests: (data as { special_requests?: string | null }).special_requests ?? null,
    checkInNotes: (data as { check_in_notes?: string | null }).check_in_notes ?? null,
  }
}

// ============================================================================
// Payments Queries
// ============================================================================

/**
 * Fetch payments for a property with optional filters.
 * Primary: financial_transactions. Fallback: legacy payments table (payments only, no type filter).
 */
export async function getPayments(
  propertyId: string,
  filters: PaymentFilters = {},
  page = 1,
  limit = 50
): Promise<{ data: DashboardPayment[]; total: number }> {
  const supabase = await createClient()
  const offset = (page - 1) * limit

  // Legacy payments table only stores payment rows (no refund/charge type column).
  const canUseLegacyPaymentsFallback =
    !filters.type || filters.type === 'payment'

  // Try unified ledger first
  let query = supabase
    .from('financial_transactions')
    .select(
      `
      id,
      reservation_id,
      type,
      amount_cents,
      payment_method,
      status,
      recognition_status,
      stripe_payment_intent_id,
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
    .in('type', ['payment', 'refund', 'charge'])
    .neq('is_voided', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.type) {
    query = query.eq('type', filters.type)
  }
  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate)
  }
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate)
  }

  const { data, error: txnsError, count } = await query

  const ledgerTotal = count ?? 0

  // Fall back only when the ledger has no matching rows and filter allows legacy payments.
  if (!txnsError && ledgerTotal === 0 && canUseLegacyPaymentsFallback) {
    let fallbackQuery = supabase
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

    if (filters.status) {
      fallbackQuery = fallbackQuery.eq('payment_status', filters.status)
    }
    if (filters.startDate) {
      fallbackQuery = fallbackQuery.gte('created_at', filters.startDate)
    }
    if (filters.endDate) {
      fallbackQuery = fallbackQuery.lte('created_at', filters.endDate)
    }

    const fallbackResult = await fallbackQuery

    // Use fallback format
    if (!fallbackResult.error && fallbackResult.data && fallbackResult.data.length > 0) {
      const payments: DashboardPayment[] = fallbackResult.data.map((payment) => {
        const reservation = payment.reservations as unknown as DbReservation & { guests: DbGuest }
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
          transactionType: 'payment',
          recognitionStatus: null,
        }
      })
      return { data: payments, total: fallbackResult.count || 0 }
    }
  }

  if (txnsError) {
    throw new Error(`Failed to fetch payments: ${txnsError.message}`)
  }

  // Transform ledger results to dashboard format
  const payments: DashboardPayment[] = (data || []).map((payment) => {
    const reservation = payment.reservations as unknown as DbReservation & { guests: DbGuest }
    const guest = reservation.guests
    return {
      id: payment.id,
      reservationId: payment.reservation_id!,
      confirmationNumber: reservation.confirmation_number,
      guestName: `${guest.first_name} ${guest.last_name}`,
      amount: payment.amount_cents as MoneyCents,
      paymentMethod: payment.payment_method as PaymentMethod,
      paymentStatus: payment.status as PaymentStatus,
      stripePaymentId: payment.stripe_payment_intent_id,
      processedAt: payment.processed_at,
      createdAt: payment.created_at!,
      transactionType: (payment.type as TransactionType) ?? null,
      recognitionStatus: (payment.recognition_status as RecognitionStatus) ?? null,
    }
  })

  return {
    data: payments,
    total: count || 0,
  }
}

/**
 * Fetch distinct site types that exist for a property (for filters, dropdowns).
 */
export async function getDistinctSiteTypes(propertyId: string): Promise<{ siteType: string }[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sites')
    .select('site_type')
    .eq('property_id', propertyId)
    .is('deleted_at', null)

  if (error) {
    throw new Error(`Failed to fetch distinct site types: ${error.message}`)
  }

  const distinct = [...new Set((data ?? []).map((row) => row.site_type).filter(Boolean))]
  return distinct.sort().map((siteType) => ({ siteType }))
}

// ============================================================================
// Stats Queries
// ============================================================================

/**
 * Calculate dashboard statistics for a property
 */
export async function getDashboardStats(
  propertyId: string,
  options?: { allowedSiteTypes?: string[] }
): Promise<DashboardStats> {
  const supabase = await createClient()

  let siteIdsFilter: string[] | null = null
  if (Array.isArray(options?.allowedSiteTypes) && options.allowedSiteTypes.length > 0) {
    const allowedLower = new Set(options.allowedSiteTypes.map((t) => t.toLowerCase()))
    const { data: siteRows } = await supabase
      .from('sites')
      .select('id, site_type')
      .eq('property_id', propertyId)
      .is('deleted_at', null)
    const ids = (siteRows ?? [])
      .filter((s) => s.site_type && allowedLower.has((s.site_type as string).toLowerCase()))
      .map((s) => s.id as string)
    if (ids.length > 0) siteIdsFilter = ids
    else
      return {
        totalRevenue: 0 as MoneyCents,
        totalReservations: 0,
        occupancyRate: 0,
        totalGuests: 0,
        pendingPayments: 0 as MoneyCents,
        completedPayments: 0 as MoneyCents,
        cancelledPayments: 0 as MoneyCents,
      }
  }

  let reservationsQuery = supabase
    .from('reservations')
    .select('total_amount, paid_amount, status, payment_status')
    .eq('property_id', propertyId)
  if (siteIdsFilter) reservationsQuery = reservationsQuery.in('site_id', siteIdsFilter)
  const { data: reservations, error: reservationsError } = await reservationsQuery

  if (reservationsError) {
    throw new Error(`Failed to fetch reservation stats: ${reservationsError.message}`)
  }

  // Fetch all transactions for payment stats calculation
  // Try unified ledger first, fall back to legacy payments table
  const { data: transactions, error: transactionsError } = await supabase
    .from('financial_transactions')
    .select('type, amount_cents, status')
    .eq('property_id', propertyId)
    .neq('is_voided', true)
    .in('type', ['payment', 'refund'])

  let completedPaymentsAmount = 0
  let cancelledPaymentsAmount = 0

  if (!transactionsError && transactions && transactions.length > 0) {
    for (const txn of transactions) {
      if (txn.status === 'completed' && txn.type === 'payment') {
        completedPaymentsAmount += txn.amount_cents
      } else if (txn.status === 'failed') {
        cancelledPaymentsAmount += txn.amount_cents
      }
    }
  } else {
    // Fallback: legacy payments table
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('amount, payment_status')
      .eq('property_id', propertyId)

    if (!paymentsError && payments) {
      completedPaymentsAmount = payments
        .filter((p) => p.payment_status === 'completed')
        .reduce((sum, p) => sum + p.amount, 0)
      cancelledPaymentsAmount = payments
        .filter((p) => p.payment_status === 'failed')
        .reduce((sum, p) => sum + p.amount, 0)
    }
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
  let activeReservationsQuery = supabase
    .from('reservations')
    .select('num_adults, num_children')
    .eq('property_id', propertyId)
    .in('status', ['confirmed', 'checked_in'])
  if (siteIdsFilter) activeReservationsQuery = activeReservationsQuery.in('site_id', siteIdsFilter)
  const { data: activeReservations } = await activeReservationsQuery

  const totalGuests = (activeReservations || []).reduce(
    (sum, r) => sum + (r.num_adults || 0) + (r.num_children || 0),
    0
  )

  // Calculate occupancy rate (for current period - last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  let recentReservationsQuery = supabase
    .from('reservations')
    .select('check_in_date, check_out_date')
    .eq('property_id', propertyId)
    .gte('check_in_date', thirtyDaysAgo.toISOString().split('T')[0])
    .in('status', ['confirmed', 'checked_in', 'checked_out'])
  if (siteIdsFilter) recentReservationsQuery = recentReservationsQuery.in('site_id', siteIdsFilter)
  const { data: recentReservations } = await recentReservationsQuery

  let sitesQuery = supabase
    .from('sites')
    .select('id')
    .eq('property_id', propertyId)
    .eq('status', 'available')
  if (siteIdsFilter) sitesQuery = sitesQuery.in('id', siteIdsFilter)
  const { data: sites } = await sitesQuery

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

  const completedPayments = completedPaymentsAmount as MoneyCents

  const cancelledPayments = cancelledPaymentsAmount as MoneyCents

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
  siteType?: string
  allowedSiteTypes?: string[]
  sortBy?: 'guest' | 'totalStays' | 'totalSpent' | 'lastVisit'
  sortOrder?: 'asc' | 'desc'
  searchField?: 'name' | 'email'
}

export async function getGuests(
  propertyId: string,
  filters: GuestFilters = { search: undefined, sortBy: 'totalSpent', sortOrder: 'desc' },
  page = 1,
  limit = 50
): Promise<{ data: DashboardGuest[]; total: number }> {
  const supabase = await createClient()

  // If restricting by allowed site types, resolve the matching site IDs first
  // (similar to getReservations()) and then filter reservations by `site_id`.
  let siteIdsFilter: string[] | null = null
  if (Array.isArray(filters.allowedSiteTypes) && filters.allowedSiteTypes.length > 0) {
    const allowedLower = new Set(filters.allowedSiteTypes.map((t) => t.toLowerCase().trim()).filter(Boolean))

    if (allowedLower.size > 0) {
      const { data: siteRows, error: siteError } = await supabase
        .from("sites")
        .select("id, site_type")
        .eq("property_id", propertyId)

      if (siteError) {
        throw new Error(`Failed to fetch sites for guest filter: ${siteError.message}`)
      }

      const ids = (siteRows ?? [])
        .filter((s) => s.site_type && allowedLower.has((s.site_type as string).toLowerCase().trim()))
        .map((s) => s.id as string)

      if (ids.length === 0) {
        return { data: [], total: 0 }
      }

      siteIdsFilter = ids
    }
  }

  // Get all reservations for this property to aggregate guest data
  // Must join with guests table to get guest information
  let query = supabase
    .from('reservations')
    .select(`
      id,
      guest_id,
      check_in_date,
      paid_amount,
      sites!inner (
        site_type
      ),
      guests (
        id,
        first_name,
        last_name,
        email,
        phone,
        deleted_at
      )
    `)
    .eq('property_id', propertyId)

  if (filters.siteType) {
    query = query.eq('sites.site_type', filters.siteType)
  } else if (Array.isArray(filters.allowedSiteTypes) && filters.allowedSiteTypes.length > 0) {
    query = query.in('sites.site_type', filters.allowedSiteTypes)
  }

  const { data: reservations, error } = await query

  if (error) {
    throw new Error(`Failed to fetch guest data: ${error.message}`)
  }

  // Aggregate reservations by guest ID to build guest profiles
  const guestMap = new Map<string, DashboardGuest>()

  reservations?.forEach((reservation) => {
    const guest = reservation.guests as unknown as DbGuest & { deleted_at?: string | null }
    if (!guest || !guest.email || guest.deleted_at) return

    const guestId = reservation.guest_id!
    const existing = guestMap.get(guestId)

    const paidAmount = reservation.paid_amount || 0

    if (existing) {
      // Update existing guest
      existing.totalStays += 1
      existing.totalSpent = (existing.totalSpent + paidAmount) as MoneyCents

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
        totalSpent: paidAmount as MoneyCents,
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
    // Default search field: name
    if (filters.searchField === 'email') {
      guests = guests.filter((guest) => guest.email.toLowerCase().includes(searchLower))
    } else {
      guests = guests.filter((guest) => guest.name.toLowerCase().includes(searchLower))
    }
  }

  const sortBy = filters.sortBy ?? 'totalSpent'
  const sortOrder = filters.sortOrder ?? 'desc'

  guests.sort((a, b) => {
    let compareValue = 0

    if (sortBy === 'guest') {
      compareValue = a.name.localeCompare(b.name)
    } else if (sortBy === 'totalStays') {
      compareValue = a.totalStays - b.totalStays
    } else if (sortBy === 'lastVisit') {
      const aLastVisit = a.lastVisit ? new Date(a.lastVisit).getTime() : 0
      const bLastVisit = b.lastVisit ? new Date(b.lastVisit).getTime() : 0
      compareValue = aLastVisit - bLastVisit
    } else {
      compareValue = a.totalSpent - b.totalSpent
    }

    return sortOrder === 'asc' ? compareValue : -compareValue
  })

  const total = guests.length
  const offset = (page - 1) * limit
  const data = guests.slice(offset, offset + limit)

  return {
    data,
    total,
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
      paid_amount,
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
    const revenue = reservation.paid_amount || 0

    const existing = siteData.get(siteId)
    if (existing) {
      existing.bookings += 1
      existing.revenue += revenue
    } else {
      siteData.set(siteId, {
        siteName,
        bookings: 1,
        revenue: revenue,
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
    .select('source, paid_amount')
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
    const revenue = reservation.paid_amount || 0
    totalBookings += 1

    const existing = sourceData.get(source)
    if (existing) {
      existing.bookings += 1
      existing.revenue += revenue
    } else {
      sourceData.set(source, {
        bookings: 1,
        revenue: revenue,
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
 * Get revenue breakdown by payment method.
 * Primary: financial_transactions. Fallback: legacy payments table.
 */
export async function getRevenueByPaymentMethod(
  propertyId: string,
  startDate?: Date
): Promise<Array<{ method: string; revenue: MoneyCents; count: number }>> {
  const supabase = await createClient()

  // Try unified ledger first
  let query = supabase
    .from('financial_transactions')
    .select('payment_method, amount_cents')
    .eq('property_id', propertyId)
    .eq('status', 'completed')
    .eq('type', 'payment')
    .neq('is_voided', true)

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString())
  }

  const { data: txns, error: txnsError } = await query

  if (!txnsError && txns && txns.length > 0) {
    // Use ledger data
    const methodData = new Map<string, { revenue: number; count: number }>()
    txns.forEach((txn) => {
      const method = txn.payment_method || 'Unknown'
      const existing = methodData.get(method)
      if (existing) {
        existing.revenue += txn.amount_cents
        existing.count += 1
      } else {
        methodData.set(method, { revenue: txn.amount_cents, count: 1 })
      }
    })
    return Array.from(methodData.entries())
      .map(([method, data]) => ({
        method: method.charAt(0).toUpperCase() + method.slice(1).replace('_', ' '),
        revenue: data.revenue as MoneyCents,
        count: data.count,
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }

  // Fallback: legacy payments table
  let fallbackQuery = supabase
    .from('payments')
    .select('payment_method, amount')
    .eq('property_id', propertyId)
    .eq('payment_status', 'completed')

  if (startDate) {
    fallbackQuery = fallbackQuery.gte('created_at', startDate.toISOString())
  }

  const { data: payments, error } = await fallbackQuery

  if (error) {
    throw new Error(`Failed to fetch payment methods: ${error.message}`)
  }

  const methodData = new Map<string, { revenue: number; count: number }>()
  payments?.forEach((payment) => {
    const method = payment.payment_method || 'Unknown'
    const existing = methodData.get(method)
    if (existing) {
      existing.revenue += payment.amount
      existing.count += 1
    } else {
      methodData.set(method, { revenue: payment.amount, count: 1 })
    }
  })

  return Array.from(methodData.entries())
    .map(([method, data]) => ({
      method: method.charAt(0).toUpperCase() + method.slice(1).replace('_', ' '),
      revenue: data.revenue as MoneyCents,
      count: data.count,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

/**
 * Get revenue breakdown by payment status.
 * Primary: financial_transactions. Fallback: legacy payments table.
 */
export async function getRevenueByPaymentStatus(
  propertyId: string,
  startDate?: Date
): Promise<Array<{ status: string; revenue: MoneyCents; count: number }>> {
  const supabase = await createClient()

  // Try unified ledger first
  let query = supabase
    .from('financial_transactions')
    .select('status, amount_cents')
    .eq('property_id', propertyId)
    .neq('is_voided', true)
    .in('type', ['payment', 'refund'])

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString())
  }

  const { data: txns, error: txnsError } = await query

  if (!txnsError && txns && txns.length > 0) {
    const statusData = new Map<string, { revenue: number; count: number }>()
    txns.forEach((txn) => {
      const status = txn.status || 'Unknown'
      const existing = statusData.get(status)
      if (existing) {
        existing.revenue += txn.amount_cents
        existing.count += 1
      } else {
        statusData.set(status, { revenue: txn.amount_cents, count: 1 })
      }
    })
    return Array.from(statusData.entries())
      .map(([status, data]) => ({
        status: status.charAt(0).toUpperCase() + status.slice(1),
        revenue: data.revenue as MoneyCents,
        count: data.count,
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }

  // Fallback: legacy payments table
  let fallbackQuery = supabase
    .from('payments')
    .select('payment_status, amount')
    .eq('property_id', propertyId)

  if (startDate) {
    fallbackQuery = fallbackQuery.gte('created_at', startDate.toISOString())
  }

  const { data: payments, error } = await fallbackQuery

  if (error) {
    throw new Error(`Failed to fetch payment status: ${error.message}`)
  }

  const statusData = new Map<string, { revenue: number; count: number }>()
  payments?.forEach((payment) => {
    const status = payment.payment_status || 'Unknown'
    const existing = statusData.get(status)
    if (existing) {
      existing.revenue += payment.amount
      existing.count += 1
    } else {
      statusData.set(status, { revenue: payment.amount, count: 1 })
    }
  })

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
    .select('check_in_date, check_out_date, paid_amount')
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

    const revenue = reservation.paid_amount || 0
    const existing = monthlyData.get(monthKey)
    if (existing) {
      existing.bookedNights += nights
      existing.revenue += revenue
    } else {
      monthlyData.set(monthKey, {
        bookedNights: nights,
        revenue: revenue,
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
 * Get today's arrivals and late arrivals
 * Returns:
 * - Reservations with check_in_date = today (confirmed or checked_in)
 * - Late arrivals: confirmed reservations with check_in_date before today
 */
export async function getTodaysArrivals(
  propertyId: string,
  options?: { allowedSiteTypes?: string[] }
) {
  const supabase = await createClient()

  let siteIdsFilter: string[] | null = null
  if (Array.isArray(options?.allowedSiteTypes) && options.allowedSiteTypes.length > 0) {
    const allowedLower = new Set(options.allowedSiteTypes.map((t) => t.toLowerCase()))
    const { data: siteRows } = await supabase
      .from('sites')
      .select('id, site_type')
      .eq('property_id', propertyId)
    const ids = (siteRows ?? [])
      .filter((s) => s.site_type && allowedLower.has((s.site_type as string).toLowerCase()))
      .map((s) => s.id as string)
    if (ids.length === 0) return []
    siteIdsFilter = ids
  }

  // Get today's date in YYYY-MM-DD format
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]!

  let todaysQuery = supabase
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
    .eq('status', 'confirmed')
    .order('checked_in_at', { ascending: false, nullsFirst: false })
  if (siteIdsFilter) todaysQuery = todaysQuery.in('site_id', siteIdsFilter)
  const { data: todaysData, error: todaysError } = await todaysQuery

  if (todaysError) {
    console.error('Error fetching todays arrivals:', todaysError)
    return []
  }

  // Get late arrivals (check-in date before today, still in confirmed status)
  let lateQuery = supabase
    .from('reservations')
    .select(
      `
      *,
      guest:guests (*),
      site:sites (*)
      `
    )
    .eq('property_id', propertyId)
    .lt('check_in_date', todayStr)
    .eq('status', 'confirmed')
    .order('check_in_date', { ascending: true })
  if (siteIdsFilter) lateQuery = lateQuery.in('site_id', siteIdsFilter)
  const { data: lateData, error: lateError } = await lateQuery

  if (lateError) {
    console.error('Error fetching late arrivals:', lateError)
  }

  // Combine: late arrivals first (they need attention), then today's arrivals
  const lateArrivals = lateData || []
  const todaysArrivals = todaysData || []

  return [...lateArrivals, ...todaysArrivals]
}
