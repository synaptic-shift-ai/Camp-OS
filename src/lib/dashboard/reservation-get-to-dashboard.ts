import type { MoneyCents, ReservationPaymentStatus, ReservationStatus } from '@/contracts/booking'
import type { DashboardReservation } from '@/lib/dashboard/queries'

type ReservationGetPayload = {
  id?: unknown
  confirmation_number?: unknown
  status?: unknown
  check_in_date?: unknown
  check_out_date?: unknown
  total_amount?: unknown
  paid_amount?: unknown
  num_adults?: unknown
  num_children?: unknown
  num_pets?: unknown
  guest_id?: unknown
  site_id?: unknown
  payment_status?: unknown
  refund_amount_cents?: unknown
  created_at?: unknown
  special_requests?: unknown
  check_in_notes?: unknown
  nights?: unknown
  guest?: {
    id?: unknown
    first_name?: unknown
    last_name?: unknown
    email?: unknown
  }
  site?: {
    site_name?: unknown
    site_number?: unknown
    site_type?: unknown
  }
}

function normalizePaymentStatus(raw: unknown): ReservationPaymentStatus {
  if (typeof raw !== 'string') return 'pending'
  if (raw === 'partially_refunded') return 'partial'
  if (raw === 'pending' || raw === 'partial' || raw === 'paid' || raw === 'refunded') return raw
  return 'pending'
}

function normalizeReservationStatus(raw: unknown): ReservationStatus {
  if (typeof raw !== 'string') return 'confirmed'
  if (raw === 'completed' || raw === 'partially_refunded') return 'checked_out'
  if (
    raw === 'pending' ||
    raw === 'confirmed' ||
    raw === 'checked_in' ||
    raw === 'checked_out' ||
    raw === 'cancelled' ||
    raw === 'no_show'
  ) {
    return raw
  }
  return 'confirmed'
}

/**
 * Maps GET /api/v1/reservations/[id] `data` payload to DashboardReservation for UI dialogs.
 * Requires `guest_id`, `site_id`, `payment_status`, `refund_amount_cents`, `created_at`,
 * `special_requests`, `check_in_notes`, `nights` on the payload (see route handler).
 */
export function mapReservationGetPayloadToDashboardReservation(
  data: ReservationGetPayload
): DashboardReservation | null {
  if (typeof data.id !== 'string' || typeof data.confirmation_number !== 'string') return null
  if (typeof data.guest_id !== 'string' || typeof data.site_id !== 'string') return null

  const guest = data.guest
  const firstName = typeof guest?.first_name === 'string' ? guest.first_name : ''
  const lastName = typeof guest?.last_name === 'string' ? guest.last_name : ''
  const guestName = `${firstName} ${lastName}`.trim() || 'Guest'
  const guestEmail = typeof guest?.email === 'string' ? guest.email : ''

  const site = data.site
  const siteNumber = typeof site?.site_number === 'string' ? site.site_number : ''
  const siteNameRaw = typeof site?.site_name === 'string' ? site.site_name : ''
  const siteName = siteNameRaw || (siteNumber ? `Site ${siteNumber}` : 'Unknown site')
  const siteType = typeof site?.site_type === 'string' ? site.site_type : 'other'

  const checkIn = typeof data.check_in_date === 'string' ? data.check_in_date : ''
  const checkOut = typeof data.check_out_date === 'string' ? data.check_out_date : ''
  if (!checkIn || !checkOut) return null

  const numNights =
    typeof data.nights === 'number' && Number.isFinite(data.nights)
      ? data.nights
      : Math.max(
          1,
          Math.ceil(
            (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
          )
        )

  const totalAmount = typeof data.total_amount === 'number' ? data.total_amount : 0
  const paidAmount = typeof data.paid_amount === 'number' ? data.paid_amount : 0
  const refundRaw = data.refund_amount_cents
  const refundAmount =
    typeof refundRaw === 'number' && Number.isFinite(refundRaw) ? refundRaw : 0

  const status = normalizeReservationStatus(data.status)
  const createdAt = typeof data.created_at === 'string' ? data.created_at : new Date().toISOString()

  return {
    id: data.id,
    confirmationNumber: data.confirmation_number,
    guestId: data.guest_id,
    guestName,
    guestEmail,
    siteId: data.site_id,
    siteName,
    siteNumber,
    siteType,
    pricePerNight: 0 as MoneyCents,
    weeklyRateCents: null,
    monthlyRateCents: null,
    bookingType: 'nightly',
    checkIn,
    checkOut,
    numNights,
    numAdults: typeof data.num_adults === 'number' ? data.num_adults : 0,
    numChildren: typeof data.num_children === 'number' ? data.num_children : 0,
    numPets: typeof data.num_pets === 'number' ? data.num_pets : 0,
    totalAmount: totalAmount as MoneyCents,
    paidAmount: paidAmount as MoneyCents,
    refundAmount: refundAmount as MoneyCents,
    status,
    paymentStatus: normalizePaymentStatus(data.payment_status),
    createdAt,
    specialRequests:
      typeof data.special_requests === 'string'
        ? data.special_requests
        : data.special_requests === null
          ? null
          : null,
    checkInNotes:
      typeof data.check_in_notes === 'string'
        ? data.check_in_notes
        : data.check_in_notes === null
          ? null
          : null,
  }
}
