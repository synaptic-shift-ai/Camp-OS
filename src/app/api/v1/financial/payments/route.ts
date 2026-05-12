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
import { getEffectiveGuestCreditAvailableCents } from '@/modules/Financial/application/guestCreditBalance'
import {
  buildSiteStayReceiptLineItem,
  formatEntityAddressLines,
  formatReceiptDate,
  isGenericReservationChargeNote,
  paymentMethodToLabel,
  paymentSourceToLabel,
  receiptNumberFromPaymentId,
  sendPaymentReceivedInvoiceEmail,
  siteDisplayLabel,
  type PaymentReceiptLineItem,
} from '@/lib/email/send-payment-received-invoice'
import { triggerPaymentAutomations } from '@/lib/automations/run-pipeline'
import { recordPaymentReceiptEmailDelivery } from '@/lib/communications/payment-receipt-delivery'

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
      console.warn('[Financial API v1] Record payment: request body validation failed', {
        issues: validated.error.issues.map((i) => ({
          path: i.path.join('.') || '(root)',
          code: i.code,
          message: i.message,
        })),
      })
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
    let reservationTotals:
      | {
          total_amount: number
          paid_amount: number | null
          status: string
          payment_status: string | null
          confirmation_number: string
          guest_id: string | null
        }
      | null = null

    if (reservation_id) {
      const { data: reservation } = await supabase
        .from('reservations')
        .select(
          'id, property_id, total_amount, paid_amount, status, payment_status, confirmation_number, guest_id',
        )
        .eq('id', reservation_id)
        .single()

      if (!reservation) {
        return NextResponse.json(
          error(ErrorCodes.RESOURCE_NOT_FOUND, 'Reservation not found'),
          { status: 404 },
        )
      }
      propertyId = reservation.property_id
      reservationTotals = {
        total_amount: reservation.total_amount as number,
        paid_amount: (reservation.paid_amount as number | null) ?? 0,
        status: reservation.status as string,
        payment_status: (reservation.payment_status as string | null) ?? null,
        confirmation_number: reservation.confirmation_number as string,
        guest_id: (reservation.guest_id as string | null) ?? null,
      }
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
      console.warn('[Financial API v1] Record payment: could not resolve property_id', {
        reservationId: reservation_id ?? null,
        guestId: guest_id ?? null,
        source,
      })
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

    // Guest credit: allow spend up to max(ledger, guests.guest_credit_cents) so UI and API agree.
    if (sourceEnum === TransactionSource.GUEST_CREDIT && guest_id && propertyId) {
      const creditServiceRole = createServiceRoleClient()
      const effective = await getEffectiveGuestCreditAvailableCents(
        creditServiceRole,
        guest_id,
        propertyId,
      )

      if (effective.effectiveAvailableCents < amount_cents) {
        console.warn('[Financial API v1] Record payment: guest credit rejected — insufficient spendable balance', {
          guestId: guest_id,
          propertyId,
          reservationId: reservation_id ?? null,
          requestedAmountCents: amount_cents,
          effectiveAvailableCents: effective.effectiveAvailableCents,
          ledgerBalanceCents: effective.ledger.creditBalance,
          ledgerTotalCreditsCents: effective.ledger.totalCredits,
          ledgerTotalUsedCents: effective.ledger.totalUsed,
          guestsTableGuestCreditCents: effective.guestsColumnCents,
        })
        return NextResponse.json(
          error(ErrorCodes.VALIDATION_ERROR, 'Insufficient guest credit balance', {
            available: effective.effectiveAvailableCents,
            requested: amount_cents,
            ledger_balance_cents: effective.ledger.creditBalance,
            guests_table_guest_credit_cents: effective.guestsColumnCents,
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

    // Decrement denormalized guest credit (guests.guest_credit_cents), matching refund guest_credit handling.
    // GET credit-balance prefers this column when set; ledger alone left the balance unchanged in the UI.
    if (sourceEnum === TransactionSource.GUEST_CREDIT && guest_id && propertyId && amount_cents > 0) {
      try {
        const { data: guestRow, error: guestLookupError } = await serviceRole
          .from('guests')
          .select('id, guest_credit_cents')
          .eq('id', guest_id)
          .eq('property_id', propertyId)
          .maybeSingle()

        if (guestLookupError) {
          console.error('[Financial API v1] Record payment: guest credit lookup failed (non-blocking)', {
            guestId: guest_id,
            propertyId,
            error: guestLookupError,
          })
        } else if (guestRow) {
          const previousCredit = (guestRow.guest_credit_cents as number | null) ?? 0
          const nextCredit = Math.max(0, previousCredit - amount_cents)
          const { error: guestUpdateError } = await serviceRole
            .from('guests')
            .update({
              guest_credit_cents: nextCredit,
              updated_at: new Date().toISOString(),
            })
            .eq('id', guest_id)
            .eq('property_id', propertyId)

          if (guestUpdateError) {
            console.error('[Financial API v1] Record payment: guest credit decrement failed (non-blocking)', {
              guestId: guest_id,
              propertyId,
              error: guestUpdateError,
            })
          }
        } else {
          console.warn('[Financial API v1] Record payment: guest not found for guest credit decrement (non-blocking)', {
            guestId: guest_id,
            propertyId,
          })
        }
      } catch (e) {
        console.error('[Financial API v1] Record payment: guest credit decrement threw (non-blocking)', e)
      }
    }

    // Update reservation snapshot amounts so dashboards reflect the payment immediately.
    // (The reservations UI reads paid_amount/payment_status from reservations, not just the ledger.)
    if (reservation_id && propertyId && reservationTotals) {
      const previousPaid = reservationTotals.paid_amount ?? 0
      const nextPaid = previousPaid + amount_cents

      const totalAmount = reservationTotals.total_amount ?? 0
      const nextPaymentStatus =
        nextPaid >= totalAmount ? 'paid' : nextPaid > 0 ? 'partial' : 'pending'

      const reservationUpdate: Record<string, unknown> = {
        paid_amount: nextPaid,
        payment_status: nextPaymentStatus,
        updated_at: new Date().toISOString(),
      }

      // If a reservation is pending, confirm it only when fully paid.
      if (reservationTotals.status === 'pending' && nextPaid >= totalAmount) {
        reservationUpdate.status = 'confirmed'
      }

      const { error: reservationUpdateError } = await serviceRole
        .from('reservations')
        .update(reservationUpdate)
        .eq('id', reservation_id)
        .eq('property_id', propertyId)

      if (reservationUpdateError) {
        console.error('[Financial API v1] Record payment: reservation update failed (non-blocking)', {
          reservationId: reservation_id,
          propertyId,
          error: reservationUpdateError,
        })
      }
    }

    const paymentRecordId = payment.id
    const targetGuestId = guest_id ?? reservationTotals?.guest_id ?? null
    if (targetGuestId && amount_cents > 0) {
      void (async () => {
        try {
          const chargePromise =
            reservation_id != null && reservation_id.length > 0
              ? serviceRole
                  .from('financial_transactions')
                  .select('amount_cents, notes, created_at')
                  .eq('reservation_id', reservation_id)
                  .eq('property_id', propertyId)
                  .eq('type', 'charge')
                  .eq('status', 'completed')
                  .eq('is_voided', false)
                  .order('created_at', { ascending: true })
              : Promise.resolve({ data: [] as { amount_cents: number; notes: string | null; created_at: string }[] })

          const stayContextPromise =
            reservation_id != null && reservation_id.length > 0
              ? (async () => {
                  const { data: res } = await serviceRole
                    .from('reservations')
                    .select('site_id, check_in_date, check_out_date')
                    .eq('id', reservation_id)
                    .eq('property_id', propertyId)
                    .maybeSingle()
                  if (!res?.site_id || !res.check_in_date || !res.check_out_date) {
                    return null
                  }
                  const { data: site } = await serviceRole
                    .from('sites')
                    .select('site_name, site_number')
                    .eq('id', res.site_id)
                    .eq('property_id', propertyId)
                    .maybeSingle()
                  return { reservation: res, site }
                })()
              : Promise.resolve(null)

          const [guestRes, propertyRes, chargeRes, stayContext] = await Promise.all([
            serviceRole
              .from('guests')
              .select('email, first_name, last_name, address, city, state, zip_code, country')
              .eq('id', targetGuestId)
              .eq('property_id', propertyId)
              .maybeSingle(),
            serviceRole
              .from('properties')
              .select('name, address, city, state, zip_code, country, email, phone, company_id')
              .eq('id', propertyId)
              .maybeSingle(),
            chargePromise,
            stayContextPromise,
          ])

          const guestRow = guestRes.data
          const propertyRow = propertyRes.data
          const chargeRows = chargeRes.data ?? []

          const guestEmail = typeof guestRow?.email === 'string' ? guestRow.email.trim() : ''
          if (!guestEmail) {
            console.warn('[Financial API v1] Record payment: skip payment receipt email — guest has no email', {
              guestId: targetGuestId,
              propertyId,
            })
            return
          }

          const first = typeof guestRow?.first_name === 'string' ? guestRow.first_name.trim() : ''
          const last = typeof guestRow?.last_name === 'string' ? guestRow.last_name.trim() : ''
          const guestName = [first, last].filter(Boolean).join(' ') || 'Guest'
          const propertyName =
            propertyRow && typeof propertyRow.name === 'string' && propertyRow.name.length > 0
              ? propertyRow.name
              : 'Campground'

          const propertyAddressLines = propertyRow
            ? formatEntityAddressLines({
                address: propertyRow.address,
                city: propertyRow.city,
                state: propertyRow.state,
                zip_code: propertyRow.zip_code,
                country: propertyRow.country,
              })
            : []

          const guestAddressLines = guestRow
            ? formatEntityAddressLines({
                address: guestRow.address,
                city: guestRow.city,
                state: guestRow.state,
                zip_code: guestRow.zip_code,
                country: guestRow.country,
              })
            : []

          const confirmationNumber =
            reservationTotals?.confirmation_number ?? 'Payment on file'

          const receiptNumber = receiptNumberFromPaymentId(paymentRecordId)
          const receiptSubject = `Payment receipt #${receiptNumber} — ${confirmationNumber} · ${propertyName}`

          const previousPaid = reservationTotals?.paid_amount ?? 0
          const newPaidTotalCents = reservation_id ? previousPaid + amount_cents : null
          const totalReservationCents = reservationTotals?.total_amount ?? null
          const reservationTotalPositiveCents =
            totalReservationCents != null && totalReservationCents > 0
              ? totalReservationCents
              : null

          let lineItems: PaymentReceiptLineItem[] = []
          let chargesSubtotalCents = 0

          const siteLabel =
            stayContext?.site != null ? siteDisplayLabel(stayContext.site) : null
          const siteStayLine =
            reservation_id &&
            stayContext?.reservation &&
            siteLabel &&
            typeof stayContext.reservation.check_in_date === 'string' &&
            typeof stayContext.reservation.check_out_date === 'string' &&
            reservationTotalPositiveCents != null
              ? buildSiteStayReceiptLineItem({
                  siteLabel,
                  checkInDate: stayContext.reservation.check_in_date,
                  checkOutDate: stayContext.reservation.check_out_date,
                  totalChargeCents: reservationTotalPositiveCents,
                })
              : null

          const loneCompletedCharge = chargeRows.length === 1 ? chargeRows[0] : null
          const useSiteStayReceiptLine =
            Boolean(reservation_id && siteStayLine && reservationTotalPositiveCents != null) &&
            (chargeRows.length === 0 ||
              (loneCompletedCharge != null &&
                reservationTotalPositiveCents != null &&
                Math.abs((loneCompletedCharge.amount_cents as number) - reservationTotalPositiveCents) <= 1 &&
                isGenericReservationChargeNote(loneCompletedCharge.notes)))

          if (useSiteStayReceiptLine && siteStayLine && reservationTotalPositiveCents != null) {
            lineItems = [siteStayLine]
            chargesSubtotalCents = reservationTotalPositiveCents
          } else if (reservation_id && chargeRows.length > 0) {
            lineItems = chargeRows.map((r) => {
              const cents = r.amount_cents as number
              const desc =
                typeof r.notes === 'string' && r.notes.trim().length > 0 ? r.notes.trim() : 'Charge'
              return {
                quantity: 1,
                description: desc,
                unitPriceCents: cents,
                amountCents: cents,
              }
            })
            chargesSubtotalCents = lineItems.reduce((sum, row) => sum + row.amountCents, 0)
          } else if (reservation_id && totalReservationCents != null && totalReservationCents > 0) {
            lineItems = [
              {
                quantity: 1,
                description: 'Reservation charges',
                unitPriceCents: totalReservationCents,
                amountCents: totalReservationCents,
              },
            ]
            chargesSubtotalCents = totalReservationCents
          } else {
            lineItems = [
              {
                quantity: 1,
                description: `${paymentSourceToLabel(source)} — ${paymentMethodToLabel(payment_method)}`,
                unitPriceCents: amount_cents,
                amountCents: amount_cents,
              },
            ]
            chargesSubtotalCents = amount_cents
          }

          // Try automation pipeline first (tenant context from RBAC only)
          const rbacCompanyId = access.companyId ?? null
          if (rbacCompanyId) {
            try {
              const receiptCtx = buildPaymentPipelineContext({
                guestEmail,
                lineItems,
                chargesSubtotalCents,
                amountPaidCents: amount_cents,
                totalReservationCents,
                newPaidTotalCents,
                guestName,
                guestAddressLines,
                propertyName,
                propertyAddressLines,
                propertyRow,
                confirmationNumber,
                paymentRecordId,
                paymentMethodLabel: paymentMethodToLabel(payment_method),
                paymentSourceLabel: paymentSourceToLabel(source),
              })
              const pipelineResult = await triggerPaymentAutomations(
                'payment.received',
                propertyId,
                rbacCompanyId,
                receiptCtx,
              )
              if (pipelineResult && pipelineResult.executed > 0) {
                // Pipeline handled the receipt email
                return
              }
            } catch (pipelineErr) {
              console.warn('[Financial API v1] Record payment: automation pipeline failed, falling back to hardcoded template:', pipelineErr)
            }
          }

          // Fallback: hardcoded React Email component
          const receiptResult = await sendPaymentReceivedInvoiceEmail({
            guestEmail,
            guestName,
            guestAddressLines,
            propertyName,
            propertyAddressLines,
            propertyContactEmail:
              propertyRow && typeof propertyRow.email === 'string' ? propertyRow.email.trim() : null,
            propertyContactPhone:
              propertyRow && typeof propertyRow.phone === 'string' ? propertyRow.phone.trim() : null,
            confirmationNumber,
            receiptNumber,
            receiptDate: formatReceiptDate(new Date()),
            lineItems,
            chargesSubtotalCents,
            amountPaidCents: amount_cents,
            paymentMethodLabel: paymentMethodToLabel(payment_method),
            paymentSourceLabel: paymentSourceToLabel(source),
            totalReservationCents,
            newPaidTotalCents,
          })

          if (!receiptResult.success) {
            console.warn('[Financial API v1] Record payment: payment receipt email send failed', {
              guestId: targetGuestId,
              error: receiptResult.error,
            })
          }

          const companyIdForLog =
            rbacCompanyId ??
            (propertyRow && typeof propertyRow.company_id === 'string' ? propertyRow.company_id : null)
          if (!companyIdForLog) {
            console.warn('[Financial API v1] Record payment: skip receipt log — property has no company_id', {
              propertyId,
              guestId: targetGuestId,
            })
            return
          }

          await recordPaymentReceiptEmailDelivery({
            supabase: serviceRole,
            companyId: companyIdForLog,
            propertyId,
            reservationId: reservation_id ?? null,
            guestId: targetGuestId,
            recipientEmail: guestEmail,
            subject: receiptSubject,
            sendResult: receiptResult.success
              ? { success: true }
              : { success: false, error: receiptResult.error },
          })
        } catch (e) {
          console.error('[Financial API v1] Record payment: payment receipt email threw (non-blocking)', e)
        }
      })()
    }

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

// ============================================================================
// Payment pipeline context builder
// ============================================================================

/** Format cents to dollar string, e.g. 12500 → $125.00 */
function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

/** Format cents to plain number string, e.g. 12500 → 125.00 */
function formatCentsPlain(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

/** Build HTML table rows for receipt line items */
function buildLineItemsHtml(lineItems: PaymentReceiptLineItem[]): string {
  if (lineItems.length === 0) return ''
  return lineItems
    .map((row) => {
      const unitPrice = row.unitPricePerNight
        ? `${formatCents(row.unitPriceCents)}/night`
        : formatCentsPlain(row.unitPriceCents)
      return `<tr><td style="border-bottom:1px solid #eee;color:#222;font-size:13px;padding:12px;text-align:center;vertical-align:top;">${row.quantity}</td><td style="border-bottom:1px solid #eee;color:#222;font-size:13px;padding:12px;vertical-align:top;">${escapeHtml(row.description)}</td><td style="border-bottom:1px solid #eee;color:#222;font-size:13px;padding:12px;text-align:right;vertical-align:top;">${unitPrice}</td><td style="border-bottom:1px solid #eee;color:#222;font-size:13px;padding:12px;text-align:right;vertical-align:top;font-weight:600;">${formatCents(row.amountCents)}</td></tr>`
    })
    .join('\n')
}

/** Escape HTML entities for safe inclusion in templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Build HTML for property address lines (each on its own <p>) */
function buildPropertyAddressLinesHtml(addressLines: string[]): string {
  return addressLines
    .map((line) => `<p style="margin:0;color:#444;font-size:13px;line-height:20px;">${escapeHtml(line)}</p>`)
    .join('')
}

/** Build the pipeline context for payment receipt automation */
function buildPaymentPipelineContext(params: {
  guestEmail: string
  lineItems: PaymentReceiptLineItem[]
  chargesSubtotalCents: number
  amountPaidCents: number
  totalReservationCents: number | null
  newPaidTotalCents: number | null
  guestName: string
  guestAddressLines: string[]
  propertyName: string
  propertyAddressLines: string[]
  propertyRow: { email?: string | null; phone?: string | null } | null
  confirmationNumber: string
  paymentRecordId: string
  paymentMethodLabel: string
  paymentSourceLabel: string
}): {
  guestEmail: string
  guestName: string
  receiptNumber: string
  confirmationNumber: string
  receiptDate: string
  lineItemsHtml: string
  subtotal: string
  amountPaid: string
  remainingBalance: string
  paymentMethodLabel: string
  paymentSourceLabel: string
  propertyName: string
  propertyAddress: string
  propertyAddressLinesHtml: string
  propertyContactInfo: string
  billedTo: string
  documentTitle: string
  reservationTotalsNote: string
} {
  const receiptNumber = receiptNumberFromPaymentId(params.paymentRecordId)
  const receiptDate = formatReceiptDate(new Date())

  // Compute remaining balance
  const remainingCents =
    params.totalReservationCents != null && params.newPaidTotalCents != null
      ? Math.max(0, params.totalReservationCents - params.newPaidTotalCents)
      : null

  // Build billed-to block
  const billedTo = [params.guestName, ...params.guestAddressLines]
    .filter(Boolean)
    .join('\n')

  // Build property contact info string
  const contactParts: string[] = []
  if (params.propertyRow?.email) contactParts.push(` at ${params.propertyRow.email}`)
  if (params.propertyRow?.phone) contactParts.push(` or ${params.propertyRow.phone}`)
  const propertyContactInfo = contactParts.join('')

  // Build reservation totals note
  let reservationTotalsNote = ''
  if (params.totalReservationCents != null) {
    let note = `Reservation total ${formatCents(params.totalReservationCents)}`
    if (params.newPaidTotalCents != null) {
      note += ` · Total paid after this receipt ${formatCents(params.newPaidTotalCents)}`
    }
    note += '.'
    reservationTotalsNote = `<p style="margin:0;color:#777;font-size:12px;line-height:18px;">${escapeHtml(note)}</p>`
  }

  // Compute subtotal from line items
  const subtotalCents = params.lineItems.length > 0
    ? params.chargesSubtotalCents
    : params.amountPaidCents

  return {
    guestEmail: params.guestEmail,
    guestName: params.guestName,
    receiptNumber,
    confirmationNumber: params.confirmationNumber,
    receiptDate,
    lineItemsHtml: buildLineItemsHtml(params.lineItems),
    subtotal: formatCents(subtotalCents),
    amountPaid: formatCents(params.amountPaidCents),
    remainingBalance: remainingCents != null ? formatCents(remainingCents) : '$0.00',
    paymentMethodLabel: params.paymentMethodLabel,
    paymentSourceLabel: params.paymentSourceLabel,
    propertyName: params.propertyName,
    propertyAddress: params.propertyAddressLines.join(', '),
    propertyAddressLinesHtml: buildPropertyAddressLinesHtml(params.propertyAddressLines),
    propertyContactInfo,
    billedTo,
    documentTitle: 'PAYMENT RECEIPT',
    reservationTotalsNote,
  }
}
