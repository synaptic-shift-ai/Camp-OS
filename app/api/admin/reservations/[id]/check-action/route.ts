/**
 * API Endpoint: Check Availability for Reservation Actions
 *
 * POST /api/admin/reservations/[id]/check-action
 *
 * Checks if a reservation action (extend, renew) is possible given site availability.
 * Returns conflicts, alternatives, and recommendations for the operator.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  checkExtensionAvailability,
  checkRenewalAvailability,
} from '@/lib/booking/availability-check'
import type { CheckActionRequest } from '@/lib/booking/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: reservationId } = await params
    const body: CheckActionRequest = await request.json()

    // Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has access to this reservation's property
    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .select('property_id')
      .eq('id', reservationId)
      .single()

    if (resError || !reservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      )
    }

    // Check property access
    const { data: hasAccess } = await supabase
      .from('properties')
      .select('id')
      .eq('id', reservation.property_id)
      .or(`owner_id.eq.${user.id},id.in.(select property_id from property_staff where user_id='${user.id}')`)
      .single()

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this property' },
        { status: 403 }
      )
    }

    // Perform availability check based on action type
    let result

    if (body.action === 'extend') {
      const { newCheckIn, newCheckOut } = body.params

      if (!newCheckIn && !newCheckOut) {
        return NextResponse.json(
          { error: 'Must provide newCheckIn or newCheckOut for extension' },
          { status: 400 }
        )
      }

      result = await checkExtensionAvailability(
        reservationId,
        newCheckIn,
        newCheckOut
      )
    } else if (body.action === 'renew') {
      const { nextPeriodStart, nextPeriodEnd } = body.params

      if (!nextPeriodStart || !nextPeriodEnd) {
        return NextResponse.json(
          { error: 'Must provide nextPeriodStart and nextPeriodEnd for renewal' },
          { status: 400 }
        )
      }

      result = await checkRenewalAvailability(
        reservationId,
        nextPeriodStart,
        nextPeriodEnd
      )
    } else {
      return NextResponse.json(
        { error: `Unknown action type: ${body.action}` },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[CheckAction] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
