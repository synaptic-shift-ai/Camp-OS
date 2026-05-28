/**
 * Reservation Management Functions
 *
 * Handles reservation creation with:
 * - Availability validation
 * - Guest creation/lookup
 * - Price calculation
 * - Atomic database transaction
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateDateRange, generateConfirmationNumber } from './api'
import { checkSiteAvailability } from './availability'
import { calculateReservationPrice } from './pricing'
import { createOrGetGuest } from './guest'
import { recordPaymentDualWrite } from '@/modules/Financial/application/recordPaymentDualWrite'
import { PaymentMethod } from '@/modules/Financial/domain/value-objects/PaymentMethod'
import type { CreateReservationInput, Reservation, BookingResult } from './types'

/**
 * Create a new reservation
 *
 * Process:
 * 1. Validate date range
 * 2. Check site availability
 * 3. Calculate pricing
 * 4. Create or get guest
 * 5. Create reservation record with status='pending'
 *
 * @param input - Reservation details
 * @returns Created reservation or error
 */
export async function createReservation(
  input: CreateReservationInput
): Promise<BookingResult<Reservation>> {
  const supabase = createServiceRoleClient()

  // Step 1: Validate date range
  const dateValidation = validateDateRange(input.check_in_date, input.check_out_date)
  if (!dateValidation.success) {
    return dateValidation as BookingResult<Reservation>
  }

  // Step 2: Check site availability
  const availabilityResult = await checkSiteAvailability(
    input.site_id,
    input.check_in_date,
    input.check_out_date
  )

  if (!availabilityResult.success) {
    return availabilityResult as BookingResult<Reservation>
  }

  if (!availabilityResult.data) {
    return {
      success: false,
      error: {
        code: 'SITE_UNAVAILABLE',
        message: 'Site is not available for the selected dates',
      },
    }
  }

  // Step 3: Calculate pricing
  const pricingResult = await calculateReservationPrice(
    input.site_id,
    input.check_in_date,
    input.check_out_date,
    {
      num_pets: input.num_pets ?? 0,
      num_adults: input.num_adults ?? 1,
      num_children: input.num_children ?? 0,
    }
  )

  if (!pricingResult.success) {
    return pricingResult as BookingResult<Reservation>
  }

  const pricing = pricingResult.data

  // Step 4: Create or get guest
  let guestResult
  if ('guest_id' in input.guest) {
    // Use existing guest ID
    guestResult = {
      success: true,
      data: { id: input.guest.guest_id },
    }
  } else {
    // Create or get guest by email
    guestResult = await createOrGetGuest(input.property_id, input.guest)
  }

  if (!guestResult.success) {
    return guestResult as BookingResult<Reservation>
  }

  const guest = guestResult.data

  // Step 5: Create reservation
  const confirmationNumber = generateConfirmationNumber()

  const reservationData = {
    property_id: input.property_id,
    site_id: input.site_id,
    guest_id: guest.id,
    confirmation_number: confirmationNumber,
    check_in_date: input.check_in_date,
    check_out_date: input.check_out_date,
    num_adults: input.num_adults || 1,
    num_children: input.num_children || 0,
    num_pets: input.num_pets || 0,
    num_vehicles: input.num_vehicles || 1,
    vehicle_info: input.vehicle_info || [],
    // Phase 2c: Write directly to BIGINT columns (already in cents)
    total_amount: pricing.total,
    paid_amount: 0,
    status: 'pending' as const,
    payment_status: 'pending' as const,
    special_requests: input.special_requests || null,
    source: input.source || 'online',
    notes: null,
  }

  const { data: reservation, error: reservationError } = await supabase
    .from('reservations')
    .insert(reservationData)
    .select('*')
    .single()

  if (reservationError || !reservation) {
    console.error('Error creating reservation:', reservationError)
    console.error('Attempted reservation data:', reservationData)
    const errorDetails = reservationError
      ? `${reservationError.message} (code: ${reservationError.code}, hint: ${reservationError.hint || 'none'})`
      : 'Unknown error'
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: `Failed to create reservation: ${errorDetails}`,
      },
    }
  }

  return {
    success: true,
    data: reservation as Reservation,
  }
}

/**
 * Get reservation by ID
 */
export async function getReservationById(
  reservationId: string
): Promise<BookingResult<Reservation>> {
  const supabase = createServiceRoleClient()

  const { data: reservation, error } = await supabase
    .from('reservations')
    .select('*, site:sites(*), guest:guests(*)')
    .eq('id', reservationId)
    .single()

  if (error || !reservation) {
    return {
      success: false,
      error: {
        code: 'RESERVATION_NOT_FOUND',
        message: 'Reservation not found',
      },
    }
  }

  return {
    success: true,
    data: reservation as Reservation,
  }
}

/**
 * Get reservation by confirmation number
 */
export async function getReservationByConfirmation(
  confirmationNumber: string
): Promise<BookingResult<Reservation>> {
  const supabase = createServiceRoleClient()

  const { data: reservation, error } = await supabase
    .from('reservations')
    .select('*, site:sites(*), guest:guests(*)')
    .eq('confirmation_number', confirmationNumber)
    .single()

  if (error || !reservation) {
    return {
      success: false,
      error: {
        code: 'RESERVATION_NOT_FOUND',
        message: 'Reservation not found',
      },
    }
  }

  return {
    success: true,
    data: reservation as Reservation,
  }
}

/**
 * Update reservation payment status after successful payment
 */
export async function confirmReservationPayment(
  reservationId: string,
  paymentDetails: {
    stripe_payment_id: string
    amount: number
  }
): Promise<BookingResult<Reservation>> {
  const supabase = createServiceRoleClient()

  // Fetch reservation to get total_amount for correct paid_amount
  const { data: existingReservation } = await supabase
    .from('reservations')
    .select('total_amount')
    .eq('id', reservationId)
    .single()

  // When fully paid, paid_amount = total_amount (not cash received)
  const paidAmount = existingReservation?.total_amount ?? paymentDetails.amount

  // Update reservation status
  const { data: reservation, error: updateError } = await supabase
    .from('reservations')
    .update({
      status: 'confirmed',
      payment_status: 'paid',
      // Phase 2c: Write directly to BIGINT column (already in cents)
      paid_amount: paidAmount,
    })
    .eq('id', reservationId)
    .select('*')
    .single()

  if (updateError || !reservation) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to confirm reservation payment',
      },
    }
  }

  // Create payment record
  await supabase.from('payments').insert({
    property_id: reservation.property_id,
    reservation_id: reservationId,
    // Phase 2c: Write directly to BIGINT column (already in cents)
    amount: paymentDetails.amount,
    payment_method: 'credit_card',
    payment_status: 'completed',
    stripe_payment_id: paymentDetails.stripe_payment_id,
    processed_at: new Date().toISOString(),
  })

  // Dual-write to financial_transactions (best-effort)
  await recordPaymentDualWrite({
    supabase,
    propertyId: reservation.property_id,
    reservationId,
    guestId: reservation.guest_id,
    createdByUserId: null,
    guestInitiatedLedger: true,
    amountCents: paymentDetails.amount,
    paymentMethod: PaymentMethod.STRIPE,
    stripePaymentIntentId: paymentDetails.stripe_payment_id,
    description: 'Guest self-service reservation payment',
    processorEventId: paymentDetails.stripe_payment_id,
    logPrefix: '[ConfirmPayment DualWrite]',
  })

  return {
    success: true,
    data: reservation as Reservation,
  }
}
