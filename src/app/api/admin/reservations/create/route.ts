import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createReservation } from '@/lib/booking/reservation'
import type { CreateVehicleInputData, CreateChildInputData, SpousePartnerInput, EvacuationContactInput } from '@/lib/booking/types'
import { sendBookingConfirmation } from '@/lib/email/send'
import { addSentryContext, addTenantContext, captureException } from '@/lib/monitoring/sentry-utils'
import { createGuestVehicles, linkVehiclesToReservation } from '@/lib/booking/vehicles'
import { createReservationChildren } from '@/lib/booking/children'
import { updateGuestSpouse } from '@/lib/booking/guest'

/**
 * @deprecated Use POST /api/v1/properties/[propertyId]/reservations/manual instead.
 * This endpoint will be removed on 2025-03-01.
 *
 * Manual Reservation Creation API (LEGACY)
 *
 * POST /api/admin/reservations/create
 *
 * Creates a manual reservation (for phone/walk-in bookings).
 * Supports cash/check payments (skips Stripe).
 * Enforces multi-tenant isolation.
 *
 * Enhanced to support:
 * - Spouse/Partner information (stored on guest)
 * - Children information (stored per reservation)
 * - Vehicle information (stored on guest, linked to reservation)
 * - Evacuation contact (stored on reservation)
 */

interface ManualReservationRequest {
  siteId: string
  checkInDate: string // YYYY-MM-DD
  checkOutDate: string // YYYY-MM-DD
  stayType?: 'nightly' | 'weekly' | 'monthly' | 'seasonal' | 'long_term'
  numAdults: number
  numChildren?: number
  numPets?: number
  numVehicles?: number
  guest: {
    firstName: string
    lastName: string
    email: string
    phone: string
    address?: string
    city?: string
    state?: string
    zipCode?: string
  }
  // New: Family information
  spouse_partner?: SpousePartnerInput
  children?: CreateChildInputData[]
  // New: Vehicle information
  vehicles?: CreateVehicleInputData[]
  // New: Evacuation contact
  evacuation_contact?: EvacuationContactInput
  // Payment
  paymentMode?: 'cash' | 'check' | 'card' | 'send_link'
  paymentMethod?: 'cash' | 'check' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'other'
  paidAmount?: number // In cents (optional - can pay later)
  paymentNotes?: string
  // Discounts/fees
  selectedDiscountIds?: string[]
  selectedFeeIds?: string[]
  // Notes
  specialRequests?: string
  notes?: string
}

export async function POST(request: NextRequest) {
  try {
    // Add Sentry context for debugging
    addSentryContext(request)

    const supabase = await createClient()

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      )
    }

    // Get the user's property ID and name (MVP: assumes one property per user)
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, name')
      .eq('owner_id', user.id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        { error: 'No property found for this user.' },
        { status: 404 }
      )
    }

    const propertyId = property.id
    const propertyName = property.name

    // Add tenant context for multi-tenant debugging
    addTenantContext(propertyId, user.id)

    // Parse request body
    const body: ManualReservationRequest = await request.json()

    // Validate required fields
    if (!body.siteId || !body.checkInDate || !body.checkOutDate) {
      return NextResponse.json(
        { error: 'Missing required fields: siteId, checkInDate, checkOutDate' },
        { status: 400 }
      )
    }

    // Get site name for email
    const { data: site } = await supabase
      .from('sites')
      .select('name')
      .eq('id', body.siteId)
      .eq('property_id', propertyId)
      .single()

    const siteName = site?.name || 'Site'

    if (!body.guest?.firstName || !body.guest?.lastName || !body.guest?.email) {
      return NextResponse.json(
        { error: 'Missing required guest fields: firstName, lastName, email' },
        { status: 400 }
      )
    }

    if (!body.numAdults || body.numAdults < 1) {
      return NextResponse.json(
        { error: 'At least one adult is required' },
        { status: 400 }
      )
    }

    // Prepare reservation input (handle optional fields properly for exactOptionalPropertyTypes)
    const guestInput: any = {
      first_name: body.guest.firstName,
      last_name: body.guest.lastName,
      email: body.guest.email,
      phone: body.guest.phone || '',
    }

    // Only add optional fields if they have values
    if (body.guest.address) guestInput.address = body.guest.address
    if (body.guest.city) guestInput.city = body.guest.city
    if (body.guest.state) guestInput.state = body.guest.state
    if (body.guest.zipCode) guestInput.zip_code = body.guest.zipCode

    const reservationInput: any = {
      property_id: propertyId,
      site_id: body.siteId,
      check_in_date: body.checkInDate,
      check_out_date: body.checkOutDate,
      num_adults: body.numAdults,
      guest: guestInput,
      source: 'phone', // Mark as phone/manual booking
    }

    // Only add optional number fields if they have values
    if (body.numChildren !== undefined) reservationInput.num_children = body.numChildren
    if (body.numPets !== undefined) reservationInput.num_pets = body.numPets
    if (body.numVehicles !== undefined) reservationInput.num_vehicles = body.numVehicles
    if (body.specialRequests) reservationInput.special_requests = body.specialRequests

    // Create the reservation using existing business logic
    const result = await createReservation(reservationInput)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 400 }
      )
    }

    const reservation = result.data
    const supabaseServiceRole = createServiceRoleClient()

    // Handle spouse/partner information (stored on guest)
    if (body.spouse_partner && reservation.guest_id) {
      try {
        await updateGuestSpouse(reservation.guest_id, propertyId, body.spouse_partner)
      } catch (spouseError) {
        console.error('[Manual Reservation] Failed to update spouse info:', spouseError)
        // Don't fail the whole request - reservation was created successfully
      }
    }

    // Handle children information (stored per reservation)
    if (body.children && body.children.length > 0) {
      try {
        await createReservationChildren(reservation.id, propertyId, body.children)
      } catch (childrenError) {
        console.error('[Manual Reservation] Failed to create children records:', childrenError)
        // Don't fail the whole request
      }
    }

    // Handle vehicle information (create on guest, link to reservation)
    if (body.vehicles && body.vehicles.length > 0 && reservation.guest_id) {
      try {
        const vehicleResult = await createGuestVehicles(
          reservation.guest_id,
          propertyId,
          body.vehicles
        )
        if (vehicleResult.success && vehicleResult.data.length > 0) {
          const vehicleIds = vehicleResult.data.map((v) => v.id)
          await linkVehiclesToReservation(reservation.id, vehicleIds)
        }
      } catch (vehicleError) {
        console.error('[Manual Reservation] Failed to create vehicle records:', vehicleError)
        // Don't fail the whole request
      }
    }

    // Handle evacuation contact (stored on reservation)
    if (body.evacuation_contact) {
      try {
        const { error: evacuationError } = await supabaseServiceRole
          .from('reservations')
          .update({
            evacuation_contact_name: body.evacuation_contact.name,
            evacuation_contact_phone: body.evacuation_contact.phone,
            evacuation_contact_relationship: body.evacuation_contact.relationship || null,
          })
          .eq('id', reservation.id)
          .eq('property_id', propertyId)

        if (evacuationError) {
          console.error('[Manual Reservation] Failed to update evacuation contact:', evacuationError)
        }
      } catch (evacuationError) {
        console.error('[Manual Reservation] Failed to update evacuation contact:', evacuationError)
      }
    }

    // For manual bookings with immediate payment, update status to 'confirmed'
    // and record the payment
    if (body.paidAmount && body.paidAmount > 0) {

      // Update reservation to confirmed and paid
      const { error: updateError } = await supabaseServiceRole
        .from('reservations')
        .update({
          status: 'confirmed',
          payment_status: 'paid',
          paid_amount: body.paidAmount,
          notes: body.notes || `Manual booking. Payment method: ${body.paymentMethod}`,
        })
        .eq('id', reservation.id)
        .eq('property_id', propertyId) // Tenant isolation

      if (updateError) {
        console.error('[Manual Reservation] Failed to update payment status:', updateError)
        // Don't fail the whole request - reservation was created successfully
      }

      // Create payment record
      const { error: paymentError } = await supabaseServiceRole
        .from('payments')
        .insert({
          property_id: propertyId,
          reservation_id: reservation.id,
          amount: body.paidAmount,
          payment_method: body.paymentMethod,
          payment_status: 'completed',
          processed_at: new Date().toISOString(),
          notes: `Manual payment - ${body.paymentMethod}`,
        })

      if (paymentError) {
        console.error('[Manual Reservation] Failed to create payment record:', paymentError)
        // Don't fail the whole request
      }
    } else {
      // No immediate payment - mark as confirmed but unpaid
      const { error: updateError } = await supabaseServiceRole
        .from('reservations')
        .update({
          status: 'confirmed',
          payment_status: 'unpaid',
          notes: body.notes || `Manual booking. Payment method: ${body.paymentMethod} (payment pending)`,
        })
        .eq('id', reservation.id)
        .eq('property_id', propertyId) // Tenant isolation

      if (updateError) {
        console.error('[Manual Reservation] Failed to update status:', updateError)
      }
    }

    // Update site status to 'reserved' for manual bookings
    const { error: siteUpdateError } = await supabaseServiceRole
      .from('sites')
      .update({
        status: 'reserved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.siteId)
      .eq('property_id', propertyId) // Tenant isolation

    if (siteUpdateError) {
      console.error('[Manual Reservation] Failed to update site status:', siteUpdateError)
      // Don't fail the whole request - reservation was created successfully
    }

    // Calculate number of nights for email
    const checkIn = new Date(body.checkInDate)
    const checkOut = new Date(body.checkOutDate)
    const numNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))

    // Send confirmation email to guest
    const emailData: any = {
      guestName: `${body.guest.firstName} ${body.guest.lastName}`,
      guestEmail: body.guest.email,
      confirmationNumber: reservation.confirmation_number,
      propertyName: propertyName,
      siteName: siteName,
      checkInDate: body.checkInDate,
      checkOutDate: body.checkOutDate,
      numNights: numNights,
      numAdults: body.numAdults,
      numChildren: body.numChildren || 0,
      totalAmount: reservation.total_amount,
      paidAmount: body.paidAmount || 0,
      paymentStatus: body.paidAmount && body.paidAmount > 0
        ? (body.paidAmount >= reservation.total_amount ? 'paid' : 'partial')
        : 'unpaid',
    }

    // Only add optional fields if they have values
    if (body.specialRequests) {
      emailData.specialRequests = body.specialRequests
    }

    const emailResult = await sendBookingConfirmation(emailData)

    if (!emailResult.success) {
      console.error('[Manual Reservation] Failed to send confirmation email:', emailResult.error)
      // Don't fail the request - reservation was created successfully
    }

    return NextResponse.json({
      success: true,
      reservation: {
        id: reservation.id,
        confirmationNumber: reservation.confirmation_number,
        guestName: `${body.guest.firstName} ${body.guest.lastName}`,
        checkIn: body.checkInDate,
        checkOut: body.checkOutDate,
        totalAmount: reservation.total_amount,
        paidAmount: body.paidAmount || 0,
        status: 'confirmed',
        paymentStatus: body.paidAmount && body.paidAmount > 0 ? 'paid' : 'unpaid',
      },
      message: 'Manual reservation created successfully.',
    })
  } catch (error) {
    console.error('[Manual Reservation] Unexpected error:', error)

    // Capture exception in Sentry with context
    if (error instanceof Error) {
      captureException(error, {
        level: 'error',
        tags: { operation: 'create_manual_reservation' },
      })
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
