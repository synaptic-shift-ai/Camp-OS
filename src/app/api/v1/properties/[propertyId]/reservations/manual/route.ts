/**
 * Manual Reservation API v1
 *
 * POST /api/v1/properties/[propertyId]/reservations/manual
 *
 * Creates a manual reservation (phone/walk-in booking) with extended
 * family and vehicle information.
 */

import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import {
  CreateManualReservationRequestSchema,
} from '@/types/api/v1/schemas/reservations'
import { CreateManualReservationCommandHandler } from '@/modules/BookingEngine/application/commands/CreateManualReservationCommand'
import { sendBookingConfirmation } from '@/lib/email/send'

/**
 * POST /api/v1/properties/[propertyId]/reservations/manual
 *
 * Create a manual reservation for phone/walk-in bookings.
 * Supports extended data: spouse/partner, children, vehicles, evacuation contact.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await params
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    // Verify property ownership (BP-4: Multi-tenant isolation)
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, name, owner_id')
      .eq('id', propertyId)
      .single()

    if (propertyError || !property) {
      return error(ErrorCodes.PROP_001, request)
    }

    // Verify user has access to this property
    // Check if user is owner or has staff access
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    const isOwner = property.owner_id === user.id
    const hasCompanyAccess = company !== null

    if (!isOwner && !hasCompanyAccess) {
      return error(ErrorCodes.AUTH_002, request)
    }

    // Parse and validate request body
    const body = await request.json()
    const parsed = CreateManualReservationRequestSchema.safeParse(body)

    if (!parsed.success) {
      return error(
        ErrorCodes.VAL_001,
        request,
        { validationErrors: parsed.error.format() }
      )
    }

    const data = parsed.data

    // Debug: Log what we're looking for
    console.log('[Manual Reservation v1] Looking up site:', { siteId: data.siteId, propertyId })

    // Get site info for email (use service role to bypass RLS since we've verified property ownership)
    const supabaseServiceRole = createServiceRoleClient()

    // First, check if site exists at all (for debugging)
    const { data: siteCheck, error: siteCheckError } = await supabaseServiceRole
      .from('sites')
      .select('id, site_name, property_id')
      .eq('id', data.siteId)
      .single()

    console.log('[Manual Reservation v1] Site lookup result:', { siteCheck, siteCheckError })

    if (siteCheckError || !siteCheck) {
      console.error('[Manual Reservation v1] Site not found in database:', { siteId: data.siteId, error: siteCheckError })
      return error(ErrorCodes.SITE_001, request, { message: `Site ${data.siteId} does not exist` })
    }

    // Verify site belongs to the property
    if (siteCheck.property_id !== propertyId) {
      console.error('[Manual Reservation v1] Site property mismatch:', {
        siteId: data.siteId,
        sitePropertyId: siteCheck.property_id,
        requestPropertyId: propertyId
      })
      return error(ErrorCodes.SITE_001, request, {
        message: `Site ${data.siteId} does not belong to property ${propertyId}`
      })
    }

    const site = siteCheck

    // Execute the command
    console.log('[Manual Reservation v1] Executing command handler with:', {
      siteId: data.siteId,
      propertyId,
      checkInDate: data.checkInDate,
      checkOutDate: data.checkOutDate,
      guestEmail: data.guest.email,
    })

    const handler = new CreateManualReservationCommandHandler()
    let result
    try {
      result = await handler.execute({
        ...data,
        propertyId,
      })
      console.log('[Manual Reservation v1] Command handler succeeded:', { reservationId: result.id })
    } catch (cmdError) {
      console.error('[Manual Reservation v1] Command handler failed:', cmdError)
      throw cmdError
    }

    // Calculate nights for email
    const checkIn = new Date(data.checkInDate)
    const checkOut = new Date(data.checkOutDate)
    const numNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))

    // Send confirmation email (non-blocking)
    // Build email data conditionally (exactOptionalPropertyTypes)
    const emailData: Parameters<typeof sendBookingConfirmation>[0] = {
      guestName: result.guestName,
      guestEmail: data.guest.email,
      confirmationNumber: result.confirmationNumber,
      propertyName: property.name,
      siteName: site.site_name || `Site ${data.siteId.slice(0, 8)}`,
      checkInDate: data.checkInDate,
      checkOutDate: data.checkOutDate,
      numNights,
      numAdults: data.numAdults,
      numChildren: data.numChildren || 0,
      totalAmount: result.totalAmountCents,
      paidAmount: result.paidAmountCents,
      paymentStatus: result.paymentStatus as 'paid' | 'partial' | 'unpaid',
    }
    if (data.specialRequests) emailData.specialRequests = data.specialRequests

    sendBookingConfirmation(emailData).catch((err) => {
      console.error('[Manual Reservation v1] Failed to send confirmation email:', err)
    })

    // Return success response
    return success(
      {
        reservation: {
          id: result.id,
          confirmationNumber: result.confirmationNumber,
          guestName: result.guestName,
          checkInDate: result.checkInDate,
          checkOutDate: result.checkOutDate,
          totalAmountCents: result.totalAmountCents,
          paidAmountCents: result.paidAmountCents,
          status: result.status,
          paymentStatus: result.paymentStatus,
          childrenCount: result.childrenCount,
          vehiclesCount: result.vehiclesCount,
          createdAt: result.createdAt,
        },
      },
      request
    )
  } catch (err) {
    console.error('[Manual Reservation v1] Unexpected error:', err)

    // Handle specific error types
    if (err instanceof Error) {
      if (err.message.includes('not available')) {
        return error(ErrorCodes.RES_002, request, { message: err.message })
      }
      if (err.message.includes('Missing required')) {
        return error(ErrorCodes.VAL_002, request, { message: err.message })
      }
      // Return error details for debugging
      return error(ErrorCodes.SYS_001, request, {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      })
    }

    return error(ErrorCodes.SYS_001, request, {
      message: String(err),
    })
  }
}
