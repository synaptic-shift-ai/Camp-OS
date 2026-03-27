/**
 * Reservations API v1 - Get by ID
 *
 * Phase 2, Week 9-10: Booking Engine Module
 *
 * GET /api/v1/reservations/[id] - Get single reservation
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { GetReservationQueryHandler } from '@/modules/BookingEngine/application/queries/GetReservationQuery'
import { SupabaseReservationRepository } from '@/modules/BookingEngine/infrastructure/SupabaseReservationRepository'
import { toReservationDTO } from '@/modules/BookingEngine/application/DTOs/ReservationDTO'
import { computeRefundCentsFromCancellationPolicy } from '@/modules/BookingEngine/domain/services/CancellationPolicyRefundCalculator'
import {
  fetchPaymentCardDisplay,
  resolvePaymentIntentIdForReservation,
} from '@/lib/stripe/payment-intent-card-display'

const REFUND_ELIGIBILITY_SNAPSHOT_PREFIX = '[REFUND_ELIGIBILITY_SNAPSHOT]'

type RefundEligibilityStatus = 'full' | 'partial' | 'none'

type RefundEligibilitySnapshot = {
  status: RefundEligibilityStatus
  percentage: number
  suggested_refund_cents: number
  message: string
  evaluated_at: string
}

function parsePersistedRefundEligibility(notes: string | null): RefundEligibilitySnapshot | null {
  if (notes == null || notes.length === 0) return null

  const lines = notes.split('\n')
  const snapshotLine = [...lines]
    .reverse()
    .find((line) => line.trim().startsWith(REFUND_ELIGIBILITY_SNAPSHOT_PREFIX))

  if (!snapshotLine) return null

  const json = snapshotLine.replace(REFUND_ELIGIBILITY_SNAPSHOT_PREFIX, '').trim()
  try {
    const parsed = JSON.parse(json) as Partial<RefundEligibilitySnapshot>
    if (
      (parsed.status === 'full' || parsed.status === 'partial' || parsed.status === 'none') &&
      typeof parsed.percentage === 'number' &&
      typeof parsed.suggested_refund_cents === 'number' &&
      typeof parsed.message === 'string' &&
      typeof parsed.evaluated_at === 'string'
    ) {
      return parsed as RefundEligibilitySnapshot
    }
  } catch {
    return null
  }

  return null
}

/** Spouse columns shared by `guests` and `reservations` (manual booking stores spouse on guest). */
type SpouseSnapshotRow = {
  spouse_first_name: string | null
  spouse_last_name: string | null
  spouse_email: string | null
  spouse_phone: string | null
  spouse_is_alternate_contact: boolean | null
}

function hasSpouseSnapshotData(row: SpouseSnapshotRow | null | undefined): boolean {
  if (!row) return false
  return Boolean(
    row.spouse_first_name ||
      row.spouse_last_name ||
      row.spouse_email ||
      row.spouse_phone
  )
}

function spousePartnerPayload(row: SpouseSnapshotRow) {
  return {
    first_name: row.spouse_first_name,
    last_name: row.spouse_last_name,
    email: row.spouse_email,
    phone: row.spouse_phone,
    is_alternate_contact: row.spouse_is_alternate_contact,
  }
}

/**
 * GET /api/v1/reservations/[id]
 *
 * Get a single reservation by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_001, 'Unauthorized'),
        { status: 401 }
      )
    }

    // Get user's company (BP-4: Multi-tenant isolation)
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Company not found'),
        { status: 404 }
      )
    }

    // Execute query using application layer
    const repository = new SupabaseReservationRepository(supabase)
    const queryHandler = new GetReservationQueryHandler(repository)

    const reservation = await queryHandler.execute({ id })

    if (!reservation) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Reservation not found'),
        { status: 404 }
      )
    }

    // Verify tenant access (BP-4)
    // Check if property belongs to user's company
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, name, company_id, settings, booking_rules_config, cancellation_policy_config')
      .eq('id', reservation.propertyId)
      .single()

    if (propertyError || !property || property.company_id !== company.id) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - reservation belongs to different company'),
        { status: 403 }
      )
    }

    const config = property.cancellation_policy_config as { refund_tiers?: Array<{ id?: string; refund_percentage?: number; days_before_reservation?: number }> } | null
    const refund_tiers = config?.refund_tiers?.filter(
      (t): t is { id: string; refund_percentage: number; days_before_reservation: number } =>
        typeof t.refund_percentage === 'number' && typeof t.days_before_reservation === 'number'
    ).map((t) => ({
      id: t.id ?? '',
      refund_percentage: t.refund_percentage,
      days_before_reservation: t.days_before_reservation,
    })) ?? null

    const paidCents = reservation.paidAmount.amountInCents
    const totalCents = reservation.totalAmount.amountInCents
    const persistedRefundEligibility = parsePersistedRefundEligibility(reservation.notes)
    let suggestedRefundCents = computeRefundCentsFromCancellationPolicy(
      reservation.checkInDate,
      new Date(),
      paidCents,
      { refund_tiers: (refund_tiers != null && refund_tiers.length > 0) ? refund_tiers : undefined }
    )
    if (
      suggestedRefundCents === 0 &&
      paidCents > 0 &&
      paidCents < totalCents
    ) {
      suggestedRefundCents = paidCents
    }
    if (persistedRefundEligibility != null) {
      suggestedRefundCents = Math.max(
        0,
        Math.min(persistedRefundEligibility.suggested_refund_cents, paidCents)
      )
    }

    // Fetch guest info
    const { data: guest } = await supabase
      .from('guests')
      .select('first_name, last_name, email, phone, address, city, state, zip_code, spouse_first_name, spouse_last_name, spouse_email, spouse_phone, spouse_is_alternate_contact')
      .eq('id', reservation.guestId)
      .single()

    // Fetch site info
    const { data: site } = await supabase
      .from('sites')
      .select('site_number, site_name, status')
      .eq('id', reservation.siteId)
      .is('deleted_at', null)
      .single()

    const { data: latestPayment } = await supabase
      .from('payments')
      .select('stripe_payment_id, payment_method')
      .eq('reservation_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: reservationHousehold } = await supabase
      .from('reservations')
      .select('spouse_first_name, spouse_last_name, spouse_email, spouse_phone, spouse_is_alternate_contact')
      .eq('id', id)
      .eq('property_id', reservation.propertyId)
      .maybeSingle()

    const { data: reservationChildren } = await supabase
      .from('reservation_children')
      .select('first_name, date_of_birth, special_needs_allergies')
      .eq('reservation_id', id)
      .eq('property_id', reservation.propertyId)
      .order('created_at', { ascending: true })

    const paymentIntentId = resolvePaymentIntentIdForReservation(
      latestPayment?.stripe_payment_id,
      reservation.notes
    )

    let payment_card: {
      brand: string
      last4: string
      exp_month: number
      exp_year: number
    } | null = null

    if (paymentIntentId != null) {
      try {
        payment_card = await fetchPaymentCardDisplay(
          paymentIntentId,
          reservation.propertyId
        )
      } catch (cardErr) {
        console.warn('[Reservations API v1] GET payment card metadata failed', cardErr)
      }
    }

    // Convert to DTO and add guest/site info
    const reservationDTO = toReservationDTO(reservation)

    const spousePartnerFromReservation =
      hasSpouseSnapshotData(reservationHousehold) && reservationHousehold
        ? spousePartnerPayload(reservationHousehold)
        : null
    const spousePartnerFromGuest =
      guest && hasSpouseSnapshotData(guest) ? spousePartnerPayload(guest) : null
    const spouse_partner = spousePartnerFromReservation ?? spousePartnerFromGuest

    // Return in format expected by check-in/check-out dialogs
    return success({
      id: reservationDTO.id,
      confirmation_number: reservationDTO.confirmationNumber,
      status: reservationDTO.status,
      check_in_date: reservationDTO.checkInDate,
      check_out_date: reservationDTO.checkOutDate,
      total_amount: reservationDTO.totalAmountCents,
      paid_amount: reservationDTO.paidAmountCents,
      suggested_refund_cents: suggestedRefundCents,
      refund_eligibility: persistedRefundEligibility,
      num_adults: reservationDTO.occupancy.numAdults,
      num_children: reservationDTO.occupancy.numChildren,
      num_pets: reservationDTO.occupancy.numPets,
      checked_in_at: reservationDTO.checkedInAt,
      guest: guest || undefined,
      site: site || undefined,
      payment_card,
      payment_method: latestPayment?.payment_method ?? null,
      spouse_partner,
      children: reservationChildren ?? [],
      property_id: reservation.propertyId,
      property_name: property.name ?? null,
      property_settings: property.settings ?? null,
      booking_rules_config: property.booking_rules_config ?? null,
    })
  } catch (err: unknown) {
    console.error('[Reservations API v1] GET by ID error:', err)
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch reservation', {
        message: err instanceof Error ? err.message : undefined,
      }),
      { status: 500 }
    )
  }
}
