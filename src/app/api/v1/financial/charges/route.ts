/**
 * Financial API v1 - Charges
 *
 * POST /api/v1/financial/charges - Create a charge against a reservation or guest
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { CreateChargeRequestSchema } from '@/types/api/v1/schemas/financial'
import { Transaction } from '@/modules/Financial/domain/Transaction'
import { TransactionType } from '@/modules/Financial/domain/value-objects/TransactionType'
import { TransactionSource } from '@/modules/Financial/domain/value-objects/TransactionSource'
import { RecognitionStatus } from '@/modules/Financial/domain/value-objects/RecognitionStatus'
import { PaymentMethod } from '@/modules/Financial/domain/value-objects/PaymentMethod'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'
import { SupabaseTransactionRepository } from '@/modules/Financial/infrastructure/SupabaseTransactionRepository'
import { toTransactionDTO } from '@/modules/Financial/application/DTOs/TransactionDTO'

/**
 * POST /api/v1/financial/charges
 *
 * Create a charge (e.g., damage fee, late fee, additional service).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_001, 'Unauthorized'),
        { status: 401 },
      )
    }

    const body = await request.json()
    const validated = CreateChargeRequestSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validated.error.errors,
        }),
        { status: 400 },
      )
    }

    const { reservation_id, guest_id, description, amount_cents, source, recognition_status } =
      validated.data

    // Resolve property_id from reservation or guest
    let propertyId: string | null = null

    if (reservation_id) {
      const { data: reservation } = await supabase
        .from('reservations')
        .select('id, property_id')
        .eq('id', reservation_id)
        .single()

      if (!reservation) {
        return NextResponse.json(
          error(ErrorCodes.RESOURCE_NOT_FOUND, 'Reservation not found'),
          { status: 404 },
        )
      }
      propertyId = reservation.property_id
    }

    if (!propertyId && guest_id) {
      const { data: guest } = await supabase
        .from('guests')
        .select('id, property_id')
        .eq('id', guest_id)
        .single()

      if (!guest) {
        return NextResponse.json(
          error(ErrorCodes.RESOURCE_NOT_FOUND, 'Guest not found'),
          { status: 404 },
        )
      }
      propertyId = guest.property_id
    }

    if (!propertyId) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Could not determine property'),
        { status: 400 },
      )
    }

    // RBAC
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId,
      minimumRole: 'admin',
      permission: 'financial.record_payment',
    })
    if (isDenied(access)) return access

    // Create charge via DDD
    const serviceRole = createServiceRoleClient()
    const repo = new SupabaseTransactionRepository(serviceRole)
    const amount = MoneyAmount.create(amount_cents)

    const sourceEnum = source === 'guest_credit'
      ? TransactionSource.GUEST_CREDIT
      : source === 'manual'
        ? TransactionSource.MANUAL
        : source === 'pos'
          ? TransactionSource.POS
          : source === 'system'
            ? TransactionSource.SYSTEM
            : TransactionSource.RESERVATION

    const charge = Transaction.create(
      crypto.randomUUID(),
      propertyId,
      reservation_id ?? null,
      TransactionType.CHARGE,
      amount,
      PaymentMethod.CASH, // Charges are typically manual/internal
      user.id,
      null, // invoiceId
      description,
      sourceEnum,
      null, // processorEventId
      guest_id ?? null,
    )

    // Complete charge unless recognition_status is explicitly 'pending'
    if (recognition_status !== 'pending') {
      charge.complete()
      const statusMap = {
        recognized: RecognitionStatus.RECOGNIZED,
        deferred: RecognitionStatus.DEFERRED,
        written_off: RecognitionStatus.WRITTEN_OFF,
      } as const
      if (
        recognition_status === 'recognized' ||
        recognition_status === 'deferred' ||
        recognition_status === 'written_off'
      ) {
        charge.applyRecognitionStatus(statusMap[recognition_status])
      }
    }

    await repo.save(charge)
    const dto = toTransactionDTO(charge)

    // If this charge is tied to a reservation, update the reservation snapshot totals
    // so dashboards/ledger stats reflect the new total immediately.
    if (reservation_id) {
      const { data: reservation, error: reservationError } = await serviceRole
        .from('reservations')
        .select('id, property_id, total_amount, paid_amount, status, payment_status')
        .eq('id', reservation_id)
        .eq('property_id', propertyId)
        .single()

      if (reservationError || !reservation) {
        console.error('[Financial API v1] Create charge: reservation snapshot lookup failed (non-blocking)', {
          reservationId: reservation_id,
          propertyId,
          error: reservationError,
        })
      } else {
        const currentTotal = (reservation.total_amount ?? 0) as number
        const nextTotal = currentTotal + amount_cents
        const paidAmount = (reservation.paid_amount ?? 0) as number

        const isFullyPaid = paidAmount >= nextTotal
        const nextPaymentStatus = paidAmount > 0 ? (isFullyPaid ? 'paid' : 'partial') : 'pending'

        // Preserve non-confirmation states; only adjust between pending/confirmed.
        const nextReservationStatus =
          isFullyPaid ? 'confirmed' : reservation.status === 'confirmed' ? 'pending' : reservation.status

        const { error: updateError } = await serviceRole
          .from('reservations')
          .update({
            total_amount: nextTotal,
            payment_status: nextPaymentStatus,
            status: nextReservationStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', reservation_id)
          .eq('property_id', propertyId)

        if (updateError) {
          console.error('[Financial API v1] Create charge: reservation snapshot update failed (non-blocking)', {
            reservationId: reservation_id,
            propertyId,
            error: updateError,
          })
        }
      }
    }
    return NextResponse.json(success(dto), { status: 201 })
  } catch (err: unknown) {
    console.error('[Financial API v1] Create charge error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to create charge', { message }),
      { status: 500 },
    )
  }
}
