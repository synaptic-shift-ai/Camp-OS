/**
 * API Endpoint: Process Reservation Actions
 *
 * POST /api/admin/reservations/[id]/actions
 *
 * Executes booking lifecycle actions (extend, renew, modify).
 * Validates permissions, checks availability, and processes the action.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  processExtension,
  processRenewal,
  offerRenewal,
  declineRenewal,
} from '@/lib/booking/actions'
import type { ProcessActionRequest } from '@/lib/booking/types'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const reservationId = params.id
    const body: ProcessActionRequest = await request.json()

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
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }

    // Check property access (owner or staff)
    const { data: hasAccess } = await supabase
      .from('properties')
      .select('id')
      .eq('id', reservation.property_id)
      .or(
        `owner_id.eq.${user.id},id.in.(select property_id from property_staff where user_id='${user.id}' and role in ('owner','manager','staff'))`
      )
      .single()

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have permission to modify this reservation' },
        { status: 403 }
      )
    }

    // Process action based on type
    let result

    switch (body.action) {
      case 'extend': {
        const { newCheckIn, newCheckOut, notes } = body.params

        if (!newCheckIn && !newCheckOut) {
          return NextResponse.json(
            { error: 'Must provide newCheckIn or newCheckOut for extension' },
            { status: 400 }
          )
        }

        result = await processExtension(
          reservationId,
          newCheckOut,
          newCheckIn,
          user.id,
          notes
        )
        break
      }

      case 'renew': {
        const { nextPeriod, renewalDeadline, depositAmount, notes } = body.params

        if (!nextPeriod || !renewalDeadline || !depositAmount) {
          return NextResponse.json(
            {
              error:
                'Must provide nextPeriod, renewalDeadline, and depositAmount for renewal',
            },
            { status: 400 }
          )
        }

        result = await processRenewal(
          reservationId,
          nextPeriod,
          renewalDeadline,
          depositAmount,
          user.id,
          notes
        )
        break
      }

      case 'offer_renewal': {
        const { renewalDeadline, notes } = body.params

        if (!renewalDeadline) {
          return NextResponse.json(
            { error: 'Must provide renewalDeadline' },
            { status: 400 }
          )
        }

        result = await offerRenewal(reservationId, renewalDeadline, user.id, notes)
        break
      }

      case 'decline_renewal': {
        const { notes } = body.params
        result = await declineRenewal(reservationId, user.id, notes)
        break
      }

      default:
        return NextResponse.json(
          { error: `Unknown action type: ${body.action}` },
          { status: 400 }
        )
    }

    // Return result
    if (!result.success) {
      return NextResponse.json(
        { error: result.error?.message || 'Action failed' },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[ProcessAction] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
