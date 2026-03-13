/**
 * Reservation Action Processing Module
 *
 * Handles the actual execution of booking lifecycle actions:
 * - Extensions (add nights before/after)
 * - Renewals (create next season/month)
 * - Modifications (change dates, sites)
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { checkExtensionAvailability, checkRenewalAvailability } from './availability-check'
import type {
  ProcessActionResponse,
  ReservationWithLifecycle,
  ReservationAction,
  BookingPeriod,
  ExtensionDetails,
  RenewalDetails,
} from './types'
import { calculateBaseSubtotalCents } from './pricing'
import { calculateReservationPriceEnhanced } from './pricing-enhanced'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate nights between two dates
 */
function calculateNights(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn)
  const end = new Date(checkOut)
  const diffTime = end.getTime() - start.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Generate unique confirmation number
 */
function generateConfirmationNumber(): string {
  const prefix = 'CONF'
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

// ============================================================================
// Extension Processing
// ============================================================================

/**
 * Process extension of an existing reservation
 *
 * @param reservationId - Reservation to extend
 * @param newCheckOut - New check-out date (if extending after)
 * @param newCheckIn - New check-in date (if extending before)
 * @param performedBy - User ID performing the action
 * @param notes - Optional notes
 * @returns Process result with updated reservation
 */
export async function processExtension(
  reservationId: string,
  newCheckOut?: string,
  newCheckIn?: string,
  performedBy?: string,
  notes?: string
): Promise<ProcessActionResponse> {
  const supabase = createServiceRoleClient()

  try {
    // 1. Get current reservation
    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select('*, site:sites(*)')
      .eq('id', reservationId)
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

    const currentRes = reservation as unknown as ReservationWithLifecycle
    const currentCheckIn = currentRes.check_in_date
    const currentCheckOut = currentRes.check_out_date

    // 2. Validate availability before processing
    const availCheck = await checkExtensionAvailability(
      reservationId,
      newCheckIn,
      newCheckOut
    )

    if (!availCheck.available && availCheck.status === 'not_available') {
      return {
        success: false,
        error: {
          code: 'EXTENSION_BLOCKED',
          message: 'Site is not available for the requested extension period',
        },
      }
    }

    // 3. Calculate pricing changes (full pricing with discounts/fees when available, else base-only)
    const extensionCheckIn = newCheckIn || currentCheckIn
    const extensionCheckOut = newCheckOut || currentCheckOut

    const originalNights = calculateNights(currentCheckIn, currentCheckOut)
    const newNights = calculateNights(extensionCheckIn, extensionCheckOut)
    const nightsAdded = newNights - originalNights

    const siteId = currentRes.site_id
    const numAdults = (currentRes as { num_adults?: number }).num_adults ?? 1
    const numChildren = (currentRes as { num_children?: number }).num_children ?? 0
    const numPets = (currentRes as { num_pets?: number }).num_pets ?? 0

    const pricingOptions = {
      num_adults: numAdults,
      num_children: numChildren,
      num_pets: numPets,
      for_extension: true,
    }
    const fullPriceResult = await calculateReservationPriceEnhanced(
      siteId,
      extensionCheckIn,
      extensionCheckOut,
      pricingOptions
    )
    const originalPriceResult = await calculateReservationPriceEnhanced(
      siteId,
      currentCheckIn,
      currentCheckOut,
      pricingOptions
    )

    let priceChange: number
    if (
      fullPriceResult.success &&
      fullPriceResult.data &&
      originalPriceResult.success &&
      originalPriceResult.data
    ) {
      // Extension pricing: additional charge = cost of added nights only; new total = current total + that
      priceChange = fullPriceResult.data.total - originalPriceResult.data.total
    } else if (fullPriceResult.success && fullPriceResult.data) {
      priceChange = fullPriceResult.data.total - currentRes.total_amount
    } else {
      const site = currentRes.site as {
        base_price: number
        weekly_rate_cents?: number | null
        monthly_rate_cents?: number | null
      }
      const newTotalCents = calculateBaseSubtotalCents(
        newNights,
        site.base_price,
        site.weekly_rate_cents,
        site.monthly_rate_cents
      )
      priceChange = newTotalCents - currentRes.total_amount
    }

    // 4. Capture state snapshot before changes
    const previousState: Record<string, unknown> = {
      check_in_date: currentCheckIn,
      check_out_date: currentCheckOut,
      total_amount: currentRes.total_amount,
      times_extended: currentRes.times_extended || 0,
    }
    const currentStatus = (currentRes as { status?: string }).status
    const currentPaymentStatus = (currentRes as { payment_status?: string }).payment_status
    if (currentStatus != null) previousState.status = currentStatus
    if (currentPaymentStatus != null) previousState.payment_status = currentPaymentStatus

    // 5. Update reservation (set status to pending when additional charge is due so it shows as not fully paid)
    const updatePayload: Record<string, unknown> = {
      check_in_date: extensionCheckIn,
      check_out_date: extensionCheckOut,
      total_amount: currentRes.total_amount + priceChange,
      times_extended: (currentRes.times_extended || 0) + 1,
      updated_at: new Date().toISOString(),
    }
    if (priceChange > 0) {
      updatePayload.status = 'pending'
      updatePayload.payment_status = 'partial'
    }

    const { data: updatedReservation, error: updateError } = await supabase
      .from('reservations')
      .update(updatePayload)
      .eq('id', reservationId)
      .select('*')
      .single()

    if (updateError || !updatedReservation) {
      return {
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update reservation',
        },
      }
    }

    // 6. Create action audit record
    const extensionDetails: ExtensionDetails = {
      nights_added: nightsAdded,
      original_checkout: currentCheckOut,
      new_checkout: extensionCheckOut,
      direction: newCheckOut ? 'after' : 'before',
      ...(newCheckIn && {
        original_checkin: currentCheckIn,
        new_checkin: extensionCheckIn,
      }),
    }

    const { data: action } = await supabase
      .from('reservation_actions')
      .insert({
        reservation_id: reservationId,
        action_type: 'extended',
        action_details: extensionDetails,
        performed_by: performedBy || null,
        performed_at: new Date().toISOString(),
        price_change_cents: priceChange,
        previous_state: previousState,
        new_state: {
          check_in_date: extensionCheckIn,
          check_out_date: extensionCheckOut,
          total_amount: currentRes.total_amount + priceChange,
          times_extended: (currentRes.times_extended || 0) + 1,
          ...(priceChange > 0 && { status: 'pending', payment_status: 'partial' }),
        },
        notes,
      })
      .select()
      .single()

    // 7. If price increased, create payment installment for the difference
    if (priceChange > 0) {
      await supabase.from('payment_installments').insert({
        reservation_id: reservationId,
        installment_number: (currentRes.times_extended || 0) + 2, // Next installment
        description: `Extension Fee (${nightsAdded} additional nights)`,
        amount_cents: priceChange,
        due_date: new Date().toISOString().split('T')[0], // Due immediately
        status: 'pending',
      })
    }

    return {
      success: true,
      reservation: updatedReservation as unknown as ReservationWithLifecycle,
      action: action as unknown as ReservationAction,
      price_change: priceChange,
      payment_required: priceChange > 0,
      next_steps: [
        ...(priceChange > 0 ? [`Charge guest $${(priceChange / 100).toFixed(2)} for extension`] : []),
        'Send extension confirmation email to guest',
        'Update site availability calendar',
      ],
    }
  } catch (error) {
    console.error('[ProcessExtension] Error:', error)
    return {
      success: false,
      error: {
        code: 'PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
    }
  }
}

// ============================================================================
// Renewal Processing
// ============================================================================

/**
 * Process renewal (create next season/month reservation)
 *
 * @param reservationId - Current reservation
 * @param nextPeriod - Next booking period details
 * @param renewalDeadline - Deadline for guest to accept
 * @param depositAmount - Required deposit (in cents)
 * @param performedBy - User ID performing the action
 * @param notes - Optional notes
 * @returns Process result with new reservation
 */
export async function processRenewal(
  reservationId: string,
  nextPeriod: BookingPeriod,
  renewalDeadline: string,
  depositAmount: number,
  performedBy?: string,
  notes?: string
): Promise<ProcessActionResponse> {
  const supabase = createServiceRoleClient()

  try {
    // 1. Get current reservation
    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select('*, site:sites(*), guest:guests(*)')
      .eq('id', reservationId)
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

    const currentRes = reservation as unknown as ReservationWithLifecycle

    // 2. Check availability for next period
    const availCheck = await checkRenewalAvailability(
      reservationId,
      nextPeriod.start_date,
      nextPeriod.end_date
    )

    if (!availCheck.available) {
      return {
        success: false,
        error: {
          code: 'RENEWAL_BLOCKED',
          message: 'Site is not available for the renewal period',
        },
      }
    }

    // 3. Calculate pricing for next period
    const site = currentRes.site as any
    const nights = calculateNights(nextPeriod.start_date, nextPeriod.end_date)
    const totalAmount = nights * site.base_price

    // 4. Create new reservation for next period
    const { data: nextReservation, error: createError } = await supabase
      .from('reservations')
      .insert({
        property_id: currentRes.property_id,
        site_id: currentRes.site_id,
        guest_id: currentRes.guest_id,
        confirmation_number: generateConfirmationNumber(),
        check_in_date: nextPeriod.start_date,
        check_out_date: nextPeriod.end_date,
        num_adults: currentRes.num_adults,
        num_children: currentRes.num_children,
        num_pets: currentRes.num_pets,
        num_vehicles: currentRes.num_vehicles,
        vehicle_info: currentRes.vehicle_info,
        booking_type: currentRes.booking_type,
        booking_period: nextPeriod,
        total_amount: totalAmount,
        paid_amount: 0,
        status: 'pending',
        payment_status: 'pending',
        source: currentRes.source,
        parent_reservation_id: reservationId,
        renewal_status: 'accepted',
      })
      .select()
      .single()

    if (createError || !nextReservation) {
      return {
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create renewal reservation',
        },
      }
    }

    // 5. Create payment schedule for next period
    const balanceAmount = totalAmount - depositAmount

    // Deposit installment
    await supabase.from('payment_installments').insert({
      reservation_id: nextReservation.id,
      installment_number: 1,
      description: `${nextPeriod.season} Deposit`,
      amount_cents: depositAmount,
      due_date: renewalDeadline,
      status: 'pending',
    })

    // Balance installment (due at season start)
    if (balanceAmount > 0) {
      await supabase.from('payment_installments').insert({
        reservation_id: nextReservation.id,
        installment_number: 2,
        description: `${nextPeriod.season} Balance`,
        amount_cents: balanceAmount,
        due_date: nextPeriod.start_date,
        status: 'pending',
      })
    }

    // 6. Update current reservation with renewal info
    await supabase
      .from('reservations')
      .update({
        renewal_status: 'accepted',
        renewal_offered_at: new Date().toISOString(),
        renewal_deadline: renewalDeadline,
        renewal_notes: notes,
      })
      .eq('id', reservationId)

    // 7. Create action audit record
    const renewalDetails: RenewalDetails = {
      renewal_type: currentRes.booking_type as 'seasonal' | 'monthly' | 'weekly',
      next_reservation_id: nextReservation.id,
      season: nextPeriod.season,
      deposit_paid: depositAmount,
      next_period: nextPeriod,
    }

    const { data: action } = await supabase
      .from('reservation_actions')
      .insert({
        reservation_id: reservationId,
        action_type: 'renewed',
        action_details: renewalDetails,
        performed_by: performedBy || null,
        performed_at: new Date().toISOString(),
        price_change_cents: 0, // Separate reservation
        notes,
      })
      .select()
      .single()

    return {
      success: true,
      reservation: nextReservation as unknown as ReservationWithLifecycle,
      action: action as unknown as ReservationAction,
      price_change: 0,
      payment_required: true,
      next_steps: [
        'Send renewal confirmation email to guest',
        `Collect deposit of $${(depositAmount / 100).toFixed(2)} by ${renewalDeadline}`,
        `Balance of $${(balanceAmount / 100).toFixed(2)} due on ${nextPeriod.start_date}`,
        'Block site for next period',
      ],
    }
  } catch (error) {
    console.error('[ProcessRenewal] Error:', error)
    return {
      success: false,
      error: {
        code: 'PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
    }
  }
}

// ============================================================================
// Renewal Offer (Without Acceptance)
// ============================================================================

/**
 * Offer renewal to a guest (updates status, doesn't create new reservation yet)
 *
 * @param reservationId - Current reservation
 * @param renewalDeadline - Deadline for guest to accept
 * @param notes - Optional notes
 * @returns Process result
 */
export async function offerRenewal(
  reservationId: string,
  renewalDeadline: string,
  performedBy?: string,
  notes?: string
): Promise<ProcessActionResponse> {
  const supabase = createServiceRoleClient()

  try {
    const { data: updated, error } = await supabase
      .from('reservations')
      .update({
        renewal_status: 'offered',
        renewal_offered_at: new Date().toISOString(),
        renewal_deadline: renewalDeadline,
        renewal_notes: notes,
      })
      .eq('id', reservationId)
      .select()
      .single()

    if (error || !updated) {
      return {
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update renewal status',
        },
      }
    }

    // Create audit record
    await supabase.from('reservation_actions').insert({
      reservation_id: reservationId,
      action_type: 'modified',
      action_details: { renewal_offered: true, deadline: renewalDeadline },
      performed_by: performedBy || null,
      performed_at: new Date().toISOString(),
      price_change_cents: 0,
      notes: `Renewal offer sent, deadline: ${renewalDeadline}`,
    })

    return {
      success: true,
      reservation: updated as unknown as ReservationWithLifecycle,
      next_steps: [
        'Send renewal offer email to guest',
        `Guest has until ${renewalDeadline} to accept`,
        'Site will be soft-held until deadline',
      ],
    }
  } catch (error) {
    console.error('[OfferRenewal] Error:', error)
    return {
      success: false,
      error: {
        code: 'PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
    }
  }
}

// ============================================================================
// Decline Renewal
// ============================================================================

/**
 * Mark renewal as declined and release site
 */
export async function declineRenewal(
  reservationId: string,
  performedBy?: string,
  notes?: string
): Promise<ProcessActionResponse> {
  const supabase = createServiceRoleClient()

  try {
    const { data: updated, error } = await supabase
      .from('reservations')
      .update({
        renewal_status: 'declined',
        renewal_notes: notes,
      })
      .eq('id', reservationId)
      .select()
      .single()

    if (error || !updated) {
      return {
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update renewal status',
        },
      }
    }

    // Create audit record
    await supabase.from('reservation_actions').insert({
      reservation_id: reservationId,
      action_type: 'modified',
      action_details: { renewal_declined: true },
      performed_by: performedBy || null,
      performed_at: new Date().toISOString(),
      price_change_cents: 0,
      notes: notes || 'Guest declined renewal offer',
    })

    return {
      success: true,
      reservation: updated as unknown as ReservationWithLifecycle,
      next_steps: ['Site is now available for general booking', 'Send decline acknowledgment email'],
    }
  } catch (error) {
    console.error('[DeclineRenewal] Error:', error)
    return {
      success: false,
      error: {
        code: 'PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
    }
  }
}
