/**
 * Reservations API v1 - Check Action Availability
 *
 * POST /api/v1/reservations/[id]/check-action
 *
 * Checks if a reservation action (extend, renew) is possible given site availability.
 * Returns conflicts, alternatives, and recommendations for the operator.
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import {
  checkExtensionAvailability,
  checkRenewalAvailability,
} from '@/lib/booking/availability-check'
import type { CheckActionRequest } from '@/lib/booking/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      return error(ErrorCodes.AUTH_001, request)
    }

    // Verify user has access to this reservation's property (BP-4: Multi-tenant isolation)
    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .select('property_id')
      .eq('id', reservationId)
      .single()

    if (resError || !reservation) {
      return error(ErrorCodes.RES_001, request)
    }

    // Check property access via company ownership
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    const { data: property } = await supabase
      .from('properties')
      .select('id, company_id, owner_id')
      .eq('id', reservation.property_id)
      .single()

    const isOwner = property?.owner_id === user.id
    const isCompanyOwner = company && property?.company_id === company.id

    if (!isOwner && !isCompanyOwner) {
      return error(ErrorCodes.AUTH_002, request)
    }

    // Perform availability check based on action type
    let result

    if (body.action === 'extend') {
      const { newCheckIn, newCheckOut } = body.params

      if (!newCheckIn && !newCheckOut) {
        return error(ErrorCodes.VAL_001, request, {
          message: 'Must provide newCheckIn or newCheckOut for extension',
        })
      }

      result = await checkExtensionAvailability(
        reservationId,
        newCheckIn,
        newCheckOut
      )
    } else if (body.action === 'renew') {
      const { nextPeriodStart, nextPeriodEnd } = body.params

      if (!nextPeriodStart || !nextPeriodEnd) {
        return error(ErrorCodes.VAL_001, request, {
          message: 'Must provide nextPeriodStart and nextPeriodEnd for renewal',
        })
      }

      result = await checkRenewalAvailability(
        reservationId,
        nextPeriodStart,
        nextPeriodEnd
      )
    } else {
      return error(ErrorCodes.VAL_001, request, {
        message: `Unknown action type: ${body.action}`,
      })
    }

    return success(result, request)
  } catch (err) {
    console.error('[Reservations API v1] Check-action error:', err)
    return error(ErrorCodes.SYS_001, request, {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}
