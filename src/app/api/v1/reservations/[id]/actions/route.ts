/**
 * Reservations API v1 - Process Reservation Actions
 *
 * POST /api/v1/reservations/[id]/actions
 *
 * Executes booking lifecycle actions (extend, renew, modify).
 * Validates permissions, checks availability, and processes the action.
 */

import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { canModifyReservationsModule } from '@/lib/dashboard/reservations-module-access'
import { processExtension,
  processRenewal,
  offerRenewal,
  declineRenewal,
} from '@/lib/booking/actions'
import type { ProcessActionRequest } from '@/lib/booking/types'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params
    const body: ProcessActionRequest = await request.json()

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

    // RBAC: verify user has reservation action access to this property
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: reservation.property_id,
      minimumRole: 'staff',
      permission: 'reservations.read',
    })
    if (isDenied(access)) return access

    // Fetch property for tenant context
    const { data: property } = await supabase
      .from('properties')
      .select('id, company_id')
      .eq('id', reservation.property_id)
      .single()


    // Process action based on type
    let result

    switch (body.action) {
      case 'extend': {
        const canModifyReservation = await canModifyReservationsModule(
          supabase,
          reservation.property_id,
          user.id,
        )
        if (!canModifyReservation) {
          return error(
            ErrorCodes.AUTH_006.code,
            'You do not have permission to modify the reservation',
            ErrorCodes.AUTH_006.status,
            request,
          )
        }

        const { newCheckIn, newCheckOut, notes, selectedDiscountIds } = body.params

        if (!newCheckIn && !newCheckOut) {
          return error(ErrorCodes.VAL_001, request, {
            message: 'Must provide newCheckIn or newCheckOut for extension',
          })
        }

        result = await processExtension(
          reservationId,
          newCheckOut,
          newCheckIn,
          user.id,
          notes,
          selectedDiscountIds
        )
        break
      }

      case 'renew': {
        const { nextPeriod, renewalDeadline, depositAmount, notes } = body.params

        if (!nextPeriod || !renewalDeadline || !depositAmount) {
          return error(ErrorCodes.VAL_001, request, {
            message: 'Must provide nextPeriod, renewalDeadline, and depositAmount for renewal',
          })
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
          return error(ErrorCodes.VAL_001, request, {
            message: 'Must provide renewalDeadline',
          })
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
        return error(ErrorCodes.VAL_001, request, {
          message: `Unknown action type: ${body.action}`,
        })
    }

    // Return result
    if (!result.success) {
      return error(ErrorCodes.SYS_001, request, {
        message: result.error?.message || 'Action failed',
      })
    }

    if (access.companyId && result.reservation) {
      const supabaseServiceRole = createServiceRoleClient()
      const updated = result.reservation
      const confirmationNumber =
        typeof updated.confirmation_number === 'string'
          ? updated.confirmation_number
          : reservationId
      await recordActivityLog(supabaseServiceRole, {
        companyId: access.companyId,
        propertyId: reservation.property_id,
        action: body.action,
        resource: 'reservation',
        userId: user.id,
        details: `${body.action} reservation (confirmation ${confirmationNumber})`,
      })
    }

    return success(result, request)
  } catch (err) {
    console.error('[Reservations API v1] Actions error:', err)
    return error(ErrorCodes.SYS_001, request, {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}
