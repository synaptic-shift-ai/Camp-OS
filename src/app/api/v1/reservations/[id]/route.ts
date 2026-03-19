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
      .select('id, company_id, settings, cancellation_policy_config')
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
      .select('first_name, last_name, email')
      .eq('id', reservation.guestId)
      .single()

    // Fetch site info
    const { data: site } = await supabase
      .from('sites')
      .select('site_number, site_name')
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
