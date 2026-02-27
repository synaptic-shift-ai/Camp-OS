/**
 * Reservations API v1 - Update Reservation
 *
 * PATCH /api/v1/reservations/[id]/update - Update reservation details
 */

import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params
    const supabase = await createClient()

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    // Parse request body
    const body = await request.json()
    const {
      check_in_date,
      check_out_date,
      num_adults,
      num_children,
      num_pets,
      special_requests,
    } = body

    // Validate required fields
    if (!check_in_date || !check_out_date || num_adults === undefined) {
      return error(ErrorCodes.VAL_001, request, {
        message: 'Missing required fields: check_in_date, check_out_date, num_adults',
      })
    }

    // Validate dates
    const checkIn = new Date(check_in_date)
    const checkOut = new Date(check_out_date)

    if (checkOut <= checkIn) {
      return error(ErrorCodes.VAL_001, request, {
        message: 'Check-out date must be after check-in date',
      })
    }

    if (num_adults < 1) {
      return error(ErrorCodes.VAL_001, request, {
        message: 'At least one adult is required',
      })
    }

    // Fetch the reservation to verify ownership (BP-4: Multi-tenant isolation)
    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select('*, sites(property_id)')
      .eq('id', reservationId)
      .single()

    if (fetchError || !reservation) {
      return error(ErrorCodes.RES_001, request)
    }

    // Verify tenant access via company ownership
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    const { data: property } = await supabase
      .from('properties')
      .select('id, company_id, owner_id')
      .eq('id', reservation.sites.property_id)
      .single()

    const isOwner = property?.owner_id === user.id
    const isCompanyOwner = company && property?.company_id === company.id

    if (!isOwner && !isCompanyOwner) {
      return error(ErrorCodes.AUTH_002, request)
    }

    const { data: conflicts, error: conflictsError } = await supabase
      .from('reservations')
      .select('id')
      .eq('site_id', reservation.site_id)
      .neq('id', reservationId)
      .in('status', ['confirmed', 'checked_in', 'pending'])
      .lt('check_in_date', check_out_date)
      .gt('check_out_date', check_in_date)

    if (conflictsError) {
      return error('RES_009', 'The dates are already taken, Please select different dates', 409, request)
    }

    if (conflicts && conflicts.length > 0) {
      return error('RES_009', 'The dates are already taken, Please select different dates', 409, request)
    }

    // Calculate new number of nights
    const diffTime = checkOut.getTime() - checkIn.getTime()
    const _numNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    // Update the reservation
    const { data: updatedReservation, error: updateError } = await supabase
      .from('reservations')
      .update({
        check_in_date: check_in_date,
        check_out_date: check_out_date,
        // num_nights: numNights,
        num_adults: num_adults,
        num_children: num_children || 0,
        num_pets: num_pets || 0,
        special_requests: special_requests || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reservationId)
      .eq('property_id', reservation.sites.property_id)
      .select()
      .single()

    if (updateError) {
      console.error('[Reservations API v1] Update error:', updateError)
      return error(ErrorCodes.SYS_001, request, {
        message: 'Failed to update reservation',
      })
    }

    return success({ reservation: updatedReservation }, request)
  } catch (err) {
    console.error('[Reservations API v1] Update error:', err)
    return error(ErrorCodes.SYS_001, request, {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}
