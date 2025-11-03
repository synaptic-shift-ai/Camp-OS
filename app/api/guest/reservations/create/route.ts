/**
 * Guest Reservation Creation API (Public)
 *
 * POST /api/guest/reservations/create
 *
 * Creates a new reservation from the guest booking flow.
 * This is a PUBLIC endpoint (no authentication required).
 *
 * Security considerations:
 * - Rate limiting implemented via middleware
 * - Creates reservation in 'pending' status
 * - Payment must be completed to confirm
 * - Tenant isolation enforced by property_id
 *
 * Flow:
 * 1. Validate input data
 * 2. Check site availability
 * 3. Calculate pricing
 * 4. Create guest record (or link existing)
 * 5. Create pending reservation
 * 6. Return reservation details for payment
 */

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { calculatePriceBreakdown } from '@/lib/booking/pricing'
import type { Database } from '@/contracts/db'
import type { CreateGuestInput } from '@/lib/booking/types'

// Input validation schema
const createGuestReservationSchema = z.object({
  property_id: z.string().uuid('Invalid property ID'),
  site_id: z.string().uuid('Invalid site ID'),
  check_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Check-in date must be YYYY-MM-DD'),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Check-out date must be YYYY-MM-DD'),
  num_adults: z.number().int().min(1, 'At least one adult is required'),
  num_children: z.number().int().min(0).optional(),
  num_pets: z.number().int().min(0).optional(),
  num_vehicles: z.number().int().min(1).optional(),
  vehicle_info: z.array(z.record(z.any())).optional(),
  special_requests: z.string().max(1000).optional(),
  guest: z.object({
    first_name: z.string().min(1, 'First name is required').max(100),
    last_name: z.string().min(1, 'Last name is required').max(100),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(10, 'Phone number must be at least 10 digits'),
    address: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(50).optional(),
    zip_code: z.string().max(20).optional(),
    country: z.string().max(100).optional(),
    emergency_contact_name: z.string().max(100).optional(),
    emergency_contact_phone: z.string().max(50).optional(),
  }),
})

type CreateGuestReservationInput = z.infer<typeof createGuestReservationSchema>

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validatedInput = createGuestReservationSchema.parse(body)

    const supabase = await createClient()

    // ========================================================================
    // Step 1: Verify property exists and is accepting bookings
    // ========================================================================

    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, name, booking_page_slug, onboarding_completed')
      .eq('id', validatedInput.property_id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'PROPERTY_NOT_FOUND', message: 'Property not found' }
        },
        { status: 404 }
      )
    }

    if (!property.onboarding_completed) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'PROPERTY_NOT_READY', message: 'This property is not yet accepting bookings' }
        },
        { status: 400 }
      )
    }

    // ========================================================================
    // Step 2: Verify site exists and is available
    // ========================================================================

    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, site_number, site_name, site_type, base_price, max_occupancy, max_vehicles')
      .eq('id', validatedInput.site_id)
      .eq('property_id', validatedInput.property_id) // Tenant isolation
      .eq('status', 'available')
      .single()

    if (siteError || !site) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'SITE_NOT_AVAILABLE', message: 'Site is not available for booking' }
        },
        { status: 400 }
      )
    }

    // Check capacity
    const totalGuests = validatedInput.num_adults + (validatedInput.num_children || 0)
    if (site.max_occupancy && totalGuests > site.max_occupancy) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CAPACITY_EXCEEDED',
            message: `Site capacity is ${site.max_occupancy} guests. You selected ${totalGuests} guests.`
          }
        },
        { status: 400 }
      )
    }

    // Check vehicle limit
    if (site.max_vehicles && validatedInput.num_vehicles && validatedInput.num_vehicles > site.max_vehicles) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VEHICLE_LIMIT_EXCEEDED',
            message: `Site allows ${site.max_vehicles} vehicles. You selected ${validatedInput.num_vehicles} vehicles.`
          }
        },
        { status: 400 }
      )
    }

    // ========================================================================
    // Step 3: Check for existing guest by email (need guest_id for next check)
    // ========================================================================

    // Check if guest exists by email for this property
    const { data: existingGuestForCheck } = await supabase
      .from('guests')
      .select('id')
      .eq('email', validatedInput.guest.email)
      .eq('property_id', validatedInput.property_id)
      .single()

    // ========================================================================
    // Step 4: Check if this exact reservation already exists (idempotency)
    // ========================================================================

    if (existingGuestForCheck) {
      // Check if this guest already has a pending reservation for these exact dates/site
      const { data: existingReservation } = await supabase
        .from('reservations')
        .select('id, confirmation_number, total_amount')
        .eq('site_id', validatedInput.site_id)
        .eq('guest_id', existingGuestForCheck.id)
        .eq('check_in_date', validatedInput.check_in_date)
        .eq('check_out_date', validatedInput.check_out_date)
        .eq('status', 'pending')
        .eq('payment_status', 'unpaid')
        .single()

      if (existingReservation) {
        // Return existing reservation instead of creating duplicate
        console.log('[Guest Reservation] Returning existing pending reservation:', existingReservation.id)

        const checkIn = new Date(validatedInput.check_in_date)
        const checkOut = new Date(validatedInput.check_out_date)
        const numberOfNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))

        const priceBreakdown = calculatePriceBreakdown({
          basePricePerNight: site.base_price,
          numberOfNights,
          siteType: site.site_type as any,
          numPets: validatedInput.num_pets,
        })

        return NextResponse.json({
          success: true,
          data: {
            reservation_id: existingReservation.id,
            confirmation_number: existingReservation.confirmation_number,
            total_amount_cents: existingReservation.total_amount,
            property_id: validatedInput.property_id,
            site_name: site.site_name || `Site ${site.site_number}`,
            check_in_date: validatedInput.check_in_date,
            check_out_date: validatedInput.check_out_date,
            number_of_nights: numberOfNights,
            price_breakdown: priceBreakdown,
          },
        })
      }
    }

    // ========================================================================
    // Step 5: Check availability (no overlapping confirmed/checked-in reservations)
    // ========================================================================

    const { data: existingReservations, error: availError } = await supabase
      .from('reservations')
      .select('id, status, guest_id')
      .eq('site_id', validatedInput.site_id)
      .not('status', 'in', '(cancelled,no_show)')
      .or(`and(check_in_date.lt.${validatedInput.check_out_date},check_out_date.gt.${validatedInput.check_in_date})`)

    if (availError) {
      console.error('[Guest Reservation] Availability check error:', availError)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'AVAILABILITY_CHECK_FAILED', message: 'Could not verify availability' }
        },
        { status: 500 }
      )
    }

    // Filter out pending reservations from OTHER guests (allow same guest to continue)
    const blockingReservations = existingReservations?.filter(res => {
      // Allow confirmed/checked-in from anyone to block
      if (res.status === 'confirmed' || res.status === 'checked_in') {
        return true
      }
      // For pending reservations, only block if it's from a DIFFERENT guest
      if (res.status === 'pending' && existingGuestForCheck && res.guest_id !== existingGuestForCheck.id) {
        return true
      }
      return false
    }) || []

    if (blockingReservations.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SITE_UNAVAILABLE',
            message: 'This site is not available for the selected dates. Please choose different dates.'
          }
        },
        { status: 409 }
      )
    }

    // ========================================================================
    // Step 6: Calculate pricing
    // ========================================================================

    const checkIn = new Date(validatedInput.check_in_date)
    const checkOut = new Date(validatedInput.check_out_date)
    const numberOfNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))

    if (numberOfNights < 1) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_DATES', message: 'Check-out must be after check-in' }
        },
        { status: 400 }
      )
    }

    const priceBreakdown = calculatePriceBreakdown({
      basePricePerNight: site.base_price,
      numberOfNights,
      siteType: site.site_type as any,
      numPets: validatedInput.num_pets,
    })

    // ========================================================================
    // Step 7: Create or update guest record
    // ========================================================================

    // Reuse the guest lookup we did earlier
    let guestId: string

    if (existingGuestForCheck) {
      // Use existing guest
      guestId = existingGuestForCheck.id

      // Update guest info if provided
      await supabase
        .from('guests')
        .update({
          first_name: validatedInput.guest.first_name,
          last_name: validatedInput.guest.last_name,
          phone: validatedInput.guest.phone,
          address: validatedInput.guest.address || null,
          city: validatedInput.guest.city || null,
          state: validatedInput.guest.state || null,
          zip_code: validatedInput.guest.zip_code || null,
          country: validatedInput.guest.country || null,
          emergency_contact_name: validatedInput.guest.emergency_contact_name || null,
          emergency_contact_phone: validatedInput.guest.emergency_contact_phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', guestId)
    } else {
      // Create new guest
      const { data: newGuest, error: guestError } = await supabase
        .from('guests')
        .insert({
          property_id: validatedInput.property_id,
          first_name: validatedInput.guest.first_name,
          last_name: validatedInput.guest.last_name,
          email: validatedInput.guest.email,
          phone: validatedInput.guest.phone,
          address: validatedInput.guest.address || null,
          city: validatedInput.guest.city || null,
          state: validatedInput.guest.state || null,
          zip_code: validatedInput.guest.zip_code || null,
          country: validatedInput.guest.country || null,
          emergency_contact_name: validatedInput.guest.emergency_contact_name || null,
          emergency_contact_phone: validatedInput.guest.emergency_contact_phone || null,
        })
        .select('id')
        .single()

      if (guestError || !newGuest) {
        console.error('[Guest Reservation] Guest creation error:', guestError)
        return NextResponse.json(
          {
            success: false,
            error: { code: 'GUEST_CREATION_FAILED', message: 'Could not create guest record' }
          },
          { status: 500 }
        )
      }

      guestId = newGuest.id
    }

    // ========================================================================
    // Step 8: Generate confirmation number
    // ========================================================================

    const confirmationNumber = `CAMP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // ========================================================================
    // Step 9: Create pending reservation
    // ========================================================================

    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .insert({
        property_id: validatedInput.property_id,
        site_id: validatedInput.site_id,
        guest_id: guestId,
        confirmation_number: confirmationNumber,
        check_in_date: validatedInput.check_in_date,
        check_out_date: validatedInput.check_out_date,
        num_adults: validatedInput.num_adults,
        num_children: validatedInput.num_children || 0,
        num_pets: validatedInput.num_pets || 0,
        num_vehicles: validatedInput.num_vehicles || 0,
        vehicle_info: validatedInput.vehicle_info || [],
        total_amount: priceBreakdown.total,
        paid_amount: 0,
        status: 'pending', // Must be pending until payment
        payment_status: 'unpaid',
        special_requests: validatedInput.special_requests || null,
        source: 'online',
      })
      .select('id, confirmation_number, total_amount')
      .single()

    if (reservationError || !reservation) {
      console.error('[Guest Reservation] Reservation creation error:', reservationError)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'RESERVATION_CREATION_FAILED', message: 'Could not create reservation' }
        },
        { status: 500 }
      )
    }

    // ========================================================================
    // Step 10: Return reservation details for payment
    // ========================================================================

    return NextResponse.json({
      success: true,
      data: {
        reservation_id: reservation.id,
        confirmation_number: reservation.confirmation_number,
        total_amount_cents: reservation.total_amount,
        property_id: validatedInput.property_id,
        site_name: site.site_name || `Site ${site.site_number}`,
        check_in_date: validatedInput.check_in_date,
        check_out_date: validatedInput.check_out_date,
        number_of_nights: numberOfNights,
        price_breakdown: priceBreakdown,
      },
    })
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: error.errors,
          },
        },
        { status: 400 }
      )
    }

    // Handle unexpected errors
    console.error('[Guest Reservation] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred. Please try again.',
        },
      },
      { status: 500 }
    )
  }
}
