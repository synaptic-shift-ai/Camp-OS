/**
 * Check-in Workflow Business Logic
 *
 * Handles guest check-in with:
 * - Reservation status validation
 * - Payment balance collection (if needed)
 * - Site status synchronization
 * - Audit trail (timestamps, user tracking)
 */

import Stripe from 'stripe'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { recordPaymentDualWrite } from '@/modules/Financial/application/recordPaymentDualWrite'
import { PaymentMethod } from '@/modules/Financial/domain/value-objects/PaymentMethod'
import type { Reservation, BookingResult } from './types'

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
})

/**
 * Input parameters for check-in workflow
 */
export interface CheckInInput {
  reservation_id: string
  checked_in_by: string // User ID of staff performing check-in
  balance_amount?: number | undefined // Additional payment to collect (in cents)
  payment_method_id?: string | undefined // Stripe PaymentMethod ID (if balance > 0)
  check_in_notes?: string | undefined // Optional staff notes
}

/**
 * Result of check-in operation
 */
export interface CheckInResult {
  reservation: Reservation
  site_id: string
  payment_intent_id?: string | undefined // If payment was processed
}

/**
 * Perform guest check-in
 *
 * Process:
 * 1. Validate reservation exists and status is 'confirmed'
 * 2. Validate check-in date (must be today or past)
 * 3. Process balance payment if amount > 0
 * 4. Update reservation: status='checked_in', timestamps
 * 5. Update site: status='occupied'
 * 6. Create audit trail
 *
 * @param input - Check-in details
 * @returns Updated reservation and site info, or error
 */
export async function performCheckIn(
  input: CheckInInput
): Promise<BookingResult<CheckInResult>> {
  const supabase = createServiceRoleClient()

  // Step 1: Fetch reservation with related data
  const { data: reservation, error: fetchError } = await supabase
    .from('reservations')
    .select('*, site:sites(*), guest:guests(*)')
    .eq('id', input.reservation_id)
    .single()

  if (fetchError || !reservation) {
    return {
      success: false,
      error: {
        code: 'RESERVATION_NOT_FOUND',
        message: 'Reservation not found',
      },
    }
  }

  const typedReservation = reservation as Reservation & { site: any; guest: any }

  // Step 2: Validate reservation status
  if (typedReservation.status !== 'confirmed') {
    return {
      success: false,
      error: {
        code: 'INVALID_STATUS',
        message: `Cannot check in reservation with status: ${typedReservation.status}. Only 'confirmed' reservations can be checked in.`,
        field: 'status',
      },
    }
  }

  // Step 3: Validate check-in date (must be today or in the past)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const checkInDate = new Date(typedReservation.check_in_date)
  checkInDate.setHours(0, 0, 0, 0)

  if (checkInDate > today) {
    return {
      success: false,
      error: {
        code: 'CHECK_IN_TOO_EARLY',
        message: `Cannot check in before the reservation start date: ${typedReservation.check_in_date}`,
        field: 'check_in_date',
      },
    }
  }

  // Step 4: Process balance payment if needed
  let paymentIntentId: string | undefined

  if (input.balance_amount && input.balance_amount > 0) {
    if (!input.payment_method_id) {
      return {
        success: false,
        error: {
          code: 'PAYMENT_METHOD_REQUIRED',
          message: 'Payment method required for balance collection',
          field: 'payment_method_id',
        },
      }
    }

    try {
      // Create PaymentIntent for balance
      const paymentIntent = await stripe.paymentIntents.create({
        amount: input.balance_amount,
        currency: 'usd',
        payment_method: input.payment_method_id,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
        metadata: {
          reservation_id: input.reservation_id,
          property_id: typedReservation.property_id,
          confirmation_number: typedReservation.confirmation_number,
          payment_type: 'check_in_balance',
        },
        description: `Check-in balance for reservation ${typedReservation.confirmation_number}`,
        receipt_email: typedReservation.guest.email,
      })

      if (paymentIntent.status !== 'succeeded') {
        return {
          success: false,
          error: {
            code: 'PAYMENT_FAILED',
            message: `Payment failed: ${paymentIntent.status}`,
          },
        }
      }

      paymentIntentId = paymentIntent.id

      // Create payment record in database
      await supabase.from('payments').insert({
        property_id: typedReservation.property_id,
        reservation_id: input.reservation_id,
        amount: input.balance_amount,
        payment_method: 'credit_card',
        payment_status: 'completed',
        stripe_payment_id: paymentIntentId,
        processed_at: new Date().toISOString(),
        notes: 'Check-in balance payment',
      })

      // Update reservation paid amount
      const newPaidAmount = typedReservation.paid_amount + input.balance_amount
      await supabase
        .from('reservations')
        .update({
          paid_amount: newPaidAmount,
          payment_status: newPaidAmount >= typedReservation.total_amount ? 'paid' : 'partial',
        })
        .eq('id', input.reservation_id)

      // Dual-write to financial_transactions (best-effort)
      await recordPaymentDualWrite({
        supabase,
        propertyId: typedReservation.property_id,
        reservationId: input.reservation_id,
        guestId: typedReservation.guest_id,
        createdByUserId: input.checked_in_by,
        amountCents: input.balance_amount,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        stripePaymentIntentId: paymentIntentId,
        description: 'Check-in balance payment',
        logPrefix: '[CheckIn DualWrite]',
      })
    } catch (error) {
      console.error('Payment processing error:', error)
      return {
        success: false,
        error: {
          code: 'PAYMENT_PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Failed to process payment',
        },
      }
    }
  }

  // Step 5: Update reservation with check-in data
  const checkInTimestamp = new Date().toISOString()

  const { data: updatedReservation, error: updateError } = await supabase
    .from('reservations')
    .update({
      status: 'checked_in',
      checked_in_at: checkInTimestamp,
      checked_in_by: input.checked_in_by,
      balance_paid_at_checkin: input.balance_amount || 0,
      check_in_notes: input.check_in_notes || null,
    })
    .eq('id', input.reservation_id)
    .select('*')
    .single()

  if (updateError || !updatedReservation) {
    console.error('Error updating reservation:', updateError)
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to update reservation status',
      },
    }
  }

  // Step 6: Update site status to 'occupied'
  const { error: siteUpdateError } = await supabase
    .from('sites')
    .update({
      status: 'occupied',
      updated_at: new Date().toISOString(),
    })
    .eq('id', typedReservation.site_id)

  if (siteUpdateError) {
    console.error('Error updating site status:', siteUpdateError)
    // Don't fail the check-in, but log the error
    // Site status can be manually corrected if needed
  }

  return {
    success: true,
    data: {
      reservation: updatedReservation as Reservation,
      site_id: typedReservation.site_id,
      payment_intent_id: paymentIntentId,
    },
  }
}

/**
 * Calculate outstanding balance for a reservation
 *
 * @param reservation - Reservation to calculate balance for
 * @returns Outstanding balance in cents
 */
export function calculateOutstandingBalance(reservation: Reservation): number {
  return Math.max(0, reservation.total_amount - reservation.paid_amount)
}

/**
 * Validate if reservation can be checked in
 *
 * @param reservation - Reservation to validate
 * @returns Validation result with error message if invalid
 */
export function canCheckIn(reservation: Reservation): { valid: boolean; reason?: string } {
  // Must be in 'confirmed' status
  if (reservation.status !== 'confirmed') {
    return {
      valid: false,
      reason: `Reservation status is '${reservation.status}'. Only confirmed reservations can be checked in.`,
    }
  }

  // Check-in date must be today or in the past
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const checkInDate = new Date(reservation.check_in_date)
  checkInDate.setHours(0, 0, 0, 0)

  if (checkInDate > today) {
    return {
      valid: false,
      reason: `Check-in date is ${reservation.check_in_date}. Cannot check in before this date.`,
    }
  }

  // Already checked in
  if (reservation.checked_in_at) {
    return {
      valid: false,
      reason: `Guest already checked in at ${reservation.checked_in_at}`,
    }
  }

  return { valid: true }
}
