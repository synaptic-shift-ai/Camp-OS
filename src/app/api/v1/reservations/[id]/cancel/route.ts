/**
 * Reservations API v1 - Cancel Reservation
 *
 * Phase 2, Week 9-10: Booking Engine Module
 *
 * POST /api/v1/reservations/[id]/cancel - Cancel reservation with refund
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { canCancelReservationsModule } from '@/lib/dashboard/reservations-module-access'
import { CancelReservationRequestSchema,
  type CancelReservationRequest,
} from '@/types/api/v1/schemas/reservations'
import { CancelReservationCommandHandler } from '@/modules/BookingEngine/application/commands/CancelReservationCommand'
import { GetReservationQueryHandler } from '@/modules/BookingEngine/application/queries/GetReservationQuery'
import { SupabaseReservationRepository } from '@/modules/BookingEngine/infrastructure/SupabaseReservationRepository'
import { toReservationDTO } from '@/modules/BookingEngine/application/DTOs/ReservationDTO'
import { computeRefundCentsFromCancellationPolicy } from '@/modules/BookingEngine/domain/services/CancellationPolicyRefundCalculator'
import { sendCancellationNotice } from '@/lib/email/send'
import { getTenantStripeClient } from '@/lib/stripe/tenant-client'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * POST /api/v1/reservations/[id]/cancel
 *
 * Cancel a reservation and process refund if applicable.
 */
const LOG_PREFIX = '[CancelReservation]'
const REFUND_ELIGIBILITY_SNAPSHOT_PREFIX = '[REFUND_ELIGIBILITY_SNAPSHOT]'

type RefundEligibilityStatus = 'full' | 'partial' | 'none'

function getRefundEligibilitySnapshot(
  paidCents: number,
  suggestedRefundCents: number
): {
  status: RefundEligibilityStatus
  percentage: number
  suggested_refund_cents: number
  message: string
  evaluated_at: string
} {
  const safePaidCents = Math.max(0, paidCents)
  const safeSuggestedRefundCents = Math.max(0, Math.min(suggestedRefundCents, safePaidCents))
  const percentage =
    safePaidCents > 0 ? Math.round((safeSuggestedRefundCents / safePaidCents) * 100) : 0

  if (safeSuggestedRefundCents <= 0) {
    return {
      status: 'none',
      percentage: 0,
      suggested_refund_cents: 0,
      message: 'Your Cancellation is not eligible for a refund due to late cancellation.',
      evaluated_at: new Date().toISOString(),
    }
  }

  if (safeSuggestedRefundCents >= safePaidCents) {
    return {
      status: 'full',
      percentage: 100,
      suggested_refund_cents: safePaidCents,
      message: 'Your Cancellation is Eligible for full refund.',
      evaluated_at: new Date().toISOString(),
    }
  }

  return {
    status: 'partial',
    percentage,
    suggested_refund_cents: safeSuggestedRefundCents,
    message: `Your Cancellation is Eligible for ${percentage}% refund.`,
    evaluated_at: new Date().toISOString(),
  }
}

function appendRefundEligibilitySnapshotToNotes(
  existingNotes: string | null,
  snapshot: ReturnType<typeof getRefundEligibilitySnapshot>
): string {
  const snapshotLine = `${REFUND_ELIGIBILITY_SNAPSHOT_PREFIX} ${JSON.stringify(snapshot)}`
  return existingNotes?.trim() ? `${existingNotes}\n${snapshotLine}` : snapshotLine
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, 'Unauthorized', 401)
    }

    // Verify reservation exists
    const repository = new SupabaseReservationRepository(supabase)
    const queryHandler = new GetReservationQueryHandler(repository)
    const existingReservation = await queryHandler.execute({ id: reservationId })

    if (!existingReservation) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, 'Reservation not found', 404)
    }

    // RBAC: verify user has cancel access to this property
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: existingReservation.propertyId,
      minimumRole: 'staff',
    })
    if (isDenied(access)) return access

    const canCancel = await canCancelReservationsModule(
      supabase,
      existingReservation.propertyId,
      user.id,
    )
    if (!canCancel) {
      return error(
        ErrorCodes.AUTH_006.code,
        'You do not have permission to cancel the reservation',
        ErrorCodes.AUTH_006.status,
      )
    }

    // Fetch property for cancellation policy
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, company_id, settings, cancellation_policy_config')
      .eq('id', existingReservation.propertyId)
      .single()

    if (propertyError || !property) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, 'Property not found', 404)
    }


    // Parse and validate request body
    const body = await request.json()

    let validatedRequest: CancelReservationRequest
    try {
      validatedRequest = CancelReservationRequestSchema.parse(body)
    } catch (validationError: any) {
      return error('VALIDATION_ERROR', 'Invalid request body', 400, undefined, {
        errors: validationError.errors,
      })
    }

    console.log(LOG_PREFIX, 'Cancel requested', {
      reservationId,
      reason: validatedRequest.reason ?? null,
      refundAmountCents: validatedRequest.refundAmountCents,
      refundPaymentMethod: validatedRequest.refundPaymentMethod ?? null,
    })

    const config = property.cancellation_policy_config as { refund_tiers?: Array<{ id?: string; refund_percentage?: number; days_before_reservation?: number }> } | null
    const refund_tiers = config?.refund_tiers?.filter(
      (t): t is { id: string; refund_percentage: number; days_before_reservation: number } =>
        typeof t.refund_percentage === 'number' && typeof t.days_before_reservation === 'number'
    ).map((t) => ({
      id: t.id ?? '',
      refund_percentage: t.refund_percentage,
      days_before_reservation: t.days_before_reservation,
    })) ?? null

    const paidCents = existingReservation.paidAmount.amountInCents
    const totalCents = existingReservation.totalAmount.amountInCents
    const policyRefundCents = computeRefundCentsFromCancellationPolicy(
      existingReservation.checkInDate,
      new Date(),
      paidCents,
      { refund_tiers: (refund_tiers != null && refund_tiers.length > 0) ? refund_tiers : undefined },
    )
    const effectivePolicyRefundCents =
      policyRefundCents === 0 && paidCents > 0 && paidCents < totalCents
        ? paidCents
        : policyRefundCents
    const refundAmountCents = Math.min(
      validatedRequest.refundAmountCents,
      effectivePolicyRefundCents
    )
    const refundEligibilitySnapshot = getRefundEligibilitySnapshot(
      paidCents,
      effectivePolicyRefundCents
    )
    const notesWithSnapshot = appendRefundEligibilitySnapshotToNotes(
      existingReservation.notes,
      refundEligibilitySnapshot
    )

    console.log(LOG_PREFIX, 'Refund amount computed', {
      reservationId,
      paidCents,
      totalCents,
      policyRefundCents,
      effectivePolicyRefundCents,
      refundAmountCents,
    })

    let stripeRefundId: string | null = null

    // If refund is requested to card and amount > 0, attempt Stripe refund
    if (refundAmountCents > 0 && validatedRequest.refundPaymentMethod === 'card') {
      // Look up the latest Stripe PaymentIntent ID for this reservation
      // Try unified ledger first, fall back to legacy payments table
      const { data: ledgerRow } = await supabase
        .from('financial_transactions')
        .select('stripe_payment_intent_id')
        .eq('reservation_id', reservationId)
        .eq('type', 'payment')
        .eq('status', 'completed')
        .neq('is_voided', true)
        .not('stripe_payment_intent_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let paymentIntentId: string | null = null
      let paymentIntentSource: 'financial_transactions' | 'payments_table' | 'reservation_notes' | null = null

      if (ledgerRow?.stripe_payment_intent_id) {
        paymentIntentId = ledgerRow.stripe_payment_intent_id as string
        paymentIntentSource = 'financial_transactions'
      } else {
        // Fallback: legacy payments table
        const { data: paymentRow, error: paymentError } = await supabase
          .from('payments')
          .select('stripe_payment_id')
          .eq('reservation_id', reservationId)
          .not('stripe_payment_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!paymentError && paymentRow?.stripe_payment_id) {
          paymentIntentId = paymentRow.stripe_payment_id as string
          paymentIntentSource = 'payments_table'
        } else {
          // Fallback: parse PaymentIntent ID from reservation notes
          const { data: reservationRow, error: reservationRowError } = await supabase
            .from('reservations')
            .select('notes')
            .eq('id', reservationId)
            .single()

          if (!reservationRowError && typeof reservationRow?.notes === 'string') {
            const notes = reservationRow.notes as string
            const match =
              notes.match(/Stripe PaymentIntent:\s*(pi_[A-Za-z0-9_]+)/i) ??
              notes.match(/PaymentIntent:\s*(pi_[A-Za-z0-9_]+)/i)
            if (match) {
              paymentIntentId = match[1]!
              paymentIntentSource = 'reservation_notes'
            }
          }
        }
      }

      if (!paymentIntentId) {
        console.log(LOG_PREFIX, 'Stripe refund skipped: no PaymentIntent found', {
          reservationId,
          refundPaymentMethod: validatedRequest.refundPaymentMethod,
        })
        return error(
          'VALIDATION_ERROR',
          "Failed to cancel reservation. Can't find PaymentIntent ID in Stripe. Choose different refund method.",
          400
        )
      }

      console.log(LOG_PREFIX, 'Stripe refund: PaymentIntent resolved', {
        reservationId,
        paymentIntentId,
        paymentIntentSource,
        refundAmountCents,
      })

      // Get tenant-aware Stripe client (ensures property has connected Stripe account)
      const tenantStripeResult = await getTenantStripeClient(existingReservation.propertyId)
      if (!tenantStripeResult.success) {
        console.warn(LOG_PREFIX, 'Stripe refund skipped: tenant Stripe not connected', {
          reservationId,
          propertyId: existingReservation.propertyId,
          error: tenantStripeResult.error,
        })
        return error('VALIDATION_ERROR', tenantStripeResult.error, 400)
      }

      const { stripe } = tenantStripeResult

      try {
        // Ensure PaymentIntent exists and succeeded before refunding
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
        if (paymentIntent.status !== 'succeeded') {
          console.warn(LOG_PREFIX, 'Stripe refund skipped: PaymentIntent not succeeded', {
            reservationId,
            paymentIntentId,
            status: paymentIntent.status,
          })
          return error(
            'VALIDATION_ERROR',
            `Cannot refund payment with status "${paymentIntent.status}".`,
            400
          )
        }

        const refund = await stripe.refunds.create({
          payment_intent: paymentIntentId,
          amount: refundAmountCents,
          reason: 'requested_by_customer',
        })

        stripeRefundId = refund.id
        console.log(LOG_PREFIX, 'Stripe refund created successfully', {
          reservationId,
          paymentIntentId,
          stripeRefundId: refund.id,
          amountCents: refundAmountCents,
          refundStatus: refund.status,
        })
      } catch (stripeError: any) {
        console.error(LOG_PREFIX, 'Stripe refund error', {
          reservationId,
          paymentIntentId,
          refundAmountCents,
          error: stripeError?.message,
        })
        return error(
          ErrorCodes.INTERNAL_ERROR,
          'Failed to process Stripe refund. Reservation was not cancelled.',
          500,
          undefined,
          { message: stripeError?.message }
        )
      }
    } else {
      console.log(LOG_PREFIX, 'Stripe refund not attempted', {
        reservationId,
        reason:
          refundAmountCents === 0
            ? 'refund amount is zero'
            : validatedRequest.refundPaymentMethod !== 'card'
              ? `refund method is "${validatedRequest.refundPaymentMethod ?? 'none'}"`
              : 'unknown',
        refundAmountCents,
        refundPaymentMethod: validatedRequest.refundPaymentMethod ?? null,
      })
    }

    // Execute command using application layer
    const commandHandler = new CancelReservationCommandHandler(repository)

    const reservation = await commandHandler.execute({
      reservationId,
      reason: validatedRequest.reason ?? null,
      refundAmountCents,
      notes: notesWithSnapshot,
    })

    console.log(LOG_PREFIX, 'Reservation cancelled in DB', {
      reservationId,
      confirmationNumber: reservation.confirmationNumber.value,
      refundAmountCents,
      stripeRefundId,
    })

    type CancellationEmailRow = {
      guest: { first_name: string; last_name: string; email: string }
      property: { name: string }
      site: { site_name: string; site_number: string }
    }

    const { data: rowData, error: rowError } = await supabase
      .from('reservations')
      .select(
        'guest:guests(first_name, last_name, email), property:properties(name), site:sites(site_name, site_number)'
      )
      .eq('id', reservationId)
      .single()

    const reservationRow = rowData as CancellationEmailRow | null

    if (!rowError && reservationRow?.guest && reservationRow?.property && reservationRow?.site) {
      const guest = reservationRow.guest as { first_name: string; last_name: string; email: string }
      const propertyRow = reservationRow.property as { name: string }
      const siteRow = reservationRow.site as { site_name: string; site_number: string }
      const guestName = `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim() || 'Guest'
      const siteName = siteRow?.site_name ?? (siteRow?.site_number != null ? `Site ${siteRow.site_number}` : 'Site')

      const refundStatus: 'processing' | 'completed' | 'none' =
        refundAmountCents === 0 
          ? 'none' 
          : refundAmountCents >= paidCents
            ? 'completed'
            : 'processing'

      sendCancellationNotice({
        guestName,
        guestEmail: guest.email,
        confirmationNumber: reservation.confirmationNumber.value,
        propertyName: propertyRow.name,
        siteName,
        checkInDate: reservation.checkInDate.toISOString(),
        checkOutDate: reservation.checkOutDate.toISOString(),
        cancellationDate: new Date().toISOString(),
        ...(validatedRequest.reason ? { cancellationReason: validatedRequest.reason } : {}),
        ...(refundAmountCents > 0 ? { refundAmount: refundAmountCents } : {}),
        ...(validatedRequest.refundPaymentMethod ? { refundPaymentMethod: validatedRequest.refundPaymentMethod } : {}),
        refundStatus,
      }).catch((err) => {
        console.error('[Reservation API v1] Failed to send cancellation notice:', err)
      })
    }

    if (access.companyId) {
      const supabaseServiceRole = createServiceRoleClient()
      const confirmationNumber = reservation.confirmationNumber.value
      await recordActivityLog(supabaseServiceRole, {
        companyId: access.companyId,
        propertyId: reservation.propertyId,
        action: 'cancelled',
        resource: 'reservation',
        userId: user.id,
        details: `Cancelled reservation (confirmation ${confirmationNumber})`,
      })
    }

    // Convert to DTO
    const reservationDTO = toReservationDTO(reservation)

    console.log(LOG_PREFIX, 'Cancel completed successfully', {
      reservationId,
      confirmationNumber: reservation.confirmationNumber.value,
      stripeRefunded: stripeRefundId != null,
      stripeRefundId,
    })

    return success(reservationDTO)
  } catch (err: any) {
    console.error(LOG_PREFIX, 'Cancel error', err)

    // Handle domain validation errors
    if (err.message.includes('already cancelled')) {
      return error(ErrorCodes.VALIDATION_ERROR, err.message, 409)
    }

    if (err.message.includes('exceeds')) {
      return error(ErrorCodes.VALIDATION_ERROR, err.message, 400)
    }

    return error(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to cancel reservation',
      500,
      undefined,
      { message: err.message }
    )
  }
}
