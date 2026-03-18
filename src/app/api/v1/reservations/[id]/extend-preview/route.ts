/**
 * Reservations API v1 - Extend Preview
 *
 * POST /api/v1/reservations/[id]/extend-preview
 *
 * Returns projected total (including discounts and fees) for extending
 * the reservation to the given dates. Uses same pricing as manual reservation flow.
 */

import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { calculateReservationPriceEnhanced } from '@/lib/booking/pricing-enhanced'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params
    const body = await request.json()

    const newCheckIn = body?.newCheckIn
    const newCheckOut = body?.newCheckOut
    const selectedDiscountIds = Array.isArray(body?.selectedDiscountIds)
      ? (body.selectedDiscountIds as string[]).filter((id): id is string => typeof id === 'string')
      : []

    if (!newCheckIn || !newCheckOut) {
      return error(ErrorCodes.VAL_001, request, {
        message: 'newCheckIn and newCheckOut are required',
      })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .select('property_id, site_id, num_adults, num_children, num_pets, check_in_date, check_out_date')
      .eq('id', reservationId)
      .single()

    if (resError || !reservation?.site_id) {
      return error(ErrorCodes.RES_001, request)
    }

    const originalCheckIn = reservation.check_in_date as string
    const originalCheckOut = reservation.check_out_date as string

    const { data: property } = await supabase
      .from('properties')
      .select('id, company_id, owner_id')
      .eq('id', reservation.property_id)
      .single()

    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    const isOwner = property?.owner_id === user.id
    const isCompanyOwner = company && property && property.company_id === company.id
    if (!isOwner && !isCompanyOwner) {
      return error(ErrorCodes.AUTH_002, request)
    }

    const baseOptions = {
      num_adults: reservation.num_adults ?? 1,
      num_children: reservation.num_children ?? 0,
      num_pets: reservation.num_pets ?? 0,
      for_extension: true,
    }

    const originalPriceResult = await calculateReservationPriceEnhanced(
      reservation.site_id,
      originalCheckIn,
      originalCheckOut,
      baseOptions
    )

    if (!originalPriceResult.success || !originalPriceResult.data) {
      const errMsg =
        !originalPriceResult.success && 'error' in originalPriceResult
          ? originalPriceResult.error?.message
          : undefined
      return error(ErrorCodes.SYS_001, request, {
        message: errMsg ?? 'Failed to calculate original period price',
      })
    }

    const originalPeriodTotalCents = originalPriceResult.data.total
    const originalSubtotalCents = originalPriceResult.data.subtotal
    const originalBreakdown = originalPriceResult.data

    let priceResult: Awaited<ReturnType<typeof calculateReservationPriceEnhanced>>

    if (selectedDiscountIds.length > 0) {
      const newNoDiscountResult = await calculateReservationPriceEnhanced(
        reservation.site_id,
        newCheckIn,
        newCheckOut,
        baseOptions
      )

      if (!newNoDiscountResult.success || !newNoDiscountResult.data) {
        const errMsg =
          !newNoDiscountResult.success && 'error' in newNoDiscountResult
            ? newNoDiscountResult.error?.message
            : undefined
        return error(ErrorCodes.SYS_001, request, {
          message: errMsg ?? 'Failed to calculate new period price',
        })
      }

      const extensionAdditionalSubtotalCents = Math.max(
        0,
        newNoDiscountResult.data.subtotal - originalSubtotalCents
      )

      priceResult = await calculateReservationPriceEnhanced(
        reservation.site_id,
        newCheckIn,
        newCheckOut,
        {
          ...baseOptions,
          selected_discount_ids: selectedDiscountIds,
          extension_additional_subtotal_cents: extensionAdditionalSubtotalCents,
        }
      )
    } else {
      priceResult = await calculateReservationPriceEnhanced(
        reservation.site_id,
        newCheckIn,
        newCheckOut,
        baseOptions
      )
    }

    if (!priceResult.success || !priceResult.data) {
      const errMsg =
        !priceResult.success && 'error' in priceResult
          ? priceResult.error?.message
          : undefined
      return error(ErrorCodes.SYS_001, request, {
        message: errMsg ?? 'Failed to calculate projected price',
      })
    }

    return success(
      {
        projectedTotalCents: priceResult.data.total,
        originalPeriodTotalCents,
        originalBreakdown,
        breakdown: priceResult.data,
      },
      request
    )
  } catch (err) {
    console.error('[Reservations API v1] Extend-preview error:', err)
    return error(ErrorCodes.SYS_001, request, {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}
