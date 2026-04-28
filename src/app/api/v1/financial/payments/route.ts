/**
 * Financial API v1 - Payments (v2)
 *
 * POST /api/v1/financial/payments - Record a payment against a charge, reservation, or guest
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { RecordPaymentV2RequestSchema } from '@/types/api/v1/schemas/financial'
import { Transaction } from '@/modules/Financial/domain/Transaction'
import { TransactionType } from '@/modules/Financial/domain/value-objects/TransactionType'
import { TransactionSource } from '@/modules/Financial/domain/value-objects/TransactionSource'
import { PaymentMethod } from '@/modules/Financial/domain/value-objects/PaymentMethod'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'
import { SupabaseTransactionRepository } from '@/modules/Financial/infrastructure/SupabaseTransactionRepository'
import { toTransactionDTO } from '@/modules/Financial/application/DTOs/TransactionDTO'
import { getGuestCreditBalance } from '@/modules/Financial/application/guestCreditBalance'

function mapPaymentMethod(method: string): PaymentMethod {
  const map: Record<string, PaymentMethod> = {
    credit_card: PaymentMethod.CREDIT_CARD,
    debit_card: PaymentMethod.DEBIT_CARD,
    cash: PaymentMethod.CASH,
    check: PaymentMethod.CHECK,
    bank_transfer: PaymentMethod.BANK_TRANSFER,
    stripe: PaymentMethod.STRIPE,
    store_credit: PaymentMethod.STORE_CREDIT,
  }
  return map[method] ?? PaymentMethod.CASH
}

function mapSource(source: string): TransactionSource {
  const map: Record<string, TransactionSource> = {
    reservation: TransactionSource.RESERVATION,
    manual: TransactionSource.MANUAL,
    pos: TransactionSource.POS,
    system: TransactionSource.SYSTEM,
    guest_credit: TransactionSource.GUEST_CREDIT,
  }
  return map[source] ?? TransactionSource.RESERVATION
}

/**
 * POST /api/v1/financial/payments
 *
 * Record a payment. Supports guest_credit source with balance validation.
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
    const validated = RecordPaymentV2RequestSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validated.error.errors,
        }),
        { status: 400 },
      )
    }

    const {
      charge_id: _charge_id,
      reservation_id,
      guest_id,
      amount_cents,
      payment_method,
      processor,
      source,
    } = validated.data

    // Resolve property_id
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
      minimumRole: 'staff',
      permission: 'financial.record_payment',
    })
    if (isDenied(access)) return access

    const sourceEnum = mapSource(source)
    const amount = MoneyAmount.create(amount_cents)

    // Guest credit balance validation
    if (sourceEnum === TransactionSource.GUEST_CREDIT && guest_id && propertyId) {
      const creditServiceRole = createServiceRoleClient()
      const { creditBalance } = await getGuestCreditBalance(creditServiceRole, guest_id, propertyId)

      if (creditBalance < amount_cents) {
        return NextResponse.json(
          error(ErrorCodes.VALIDATION_ERROR, 'Insufficient guest credit balance', {
            available: creditBalance,
            requested: amount_cents,
          }),
          { status: 400 },
        )
      }
    }

    // Create payment via DDD
    const serviceRole = createServiceRoleClient()
    const repo = new SupabaseTransactionRepository(serviceRole)

    const payment = Transaction.create(
      crypto.randomUUID(),
      propertyId,
      reservation_id ?? null,
      TransactionType.PAYMENT,
      amount,
      mapPaymentMethod(payment_method),
      user.id,
      null, // invoiceId
      null, // notes
      sourceEnum,
      processor ?? null, // processorEventId
      guest_id ?? null,
    )

    payment.complete(processor ?? null)
    await repo.save(payment)

    const dto = toTransactionDTO(payment)
    return NextResponse.json(success(dto), { status: 201 })
  } catch (err: unknown) {
    console.error('[Financial API v1] Record payment error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to record payment', { message }),
      { status: 500 },
    )
  }
}
