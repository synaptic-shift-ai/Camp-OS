import type { SupabaseClient } from '@supabase/supabase-js'
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

/** Snapshot before the payment row was applied (matches Record Payment API behavior). */
export type ReservationTotalsForReceipt = {
  total_amount: number
  paid_amount: number | null
  confirmation_number: string
  guest_id?: string | null
}

export type QueuePaymentReceiptEmailInput = {
  serviceRole: SupabaseClient
  propertyId: string
  reservationId: string | null
  guestId: string
  amountCents: number
  paymentRecordId: string
  /** Same strings as Record Payment API (`stripe`, `cash`, …) for receipt labels */
  paymentMethodForLabel: string
  /** Same strings as Record Payment API (`manual`, …) for receipt labels */
  sourceForLabel: string
  rbacCompanyId: string | null
  reservationTotals: ReservationTotalsForReceipt | null
}

/**
 * Line items on the receipt may sum above the reservation contract total when the ledger
 * contains duplicate or mirror charge rows. The dashboard uses `reservations.total_amount`
 * for "Total Charges"; align the emailed charges subtotal when the sum is inflated only.
 */
export function capReceiptChargesSubtotalCents(params: {
  summedChargeLineItemsCents: number
  reservationContractTotalCents: number | null | undefined
}): number {
  const cap =
    params.reservationContractTotalCents != null && params.reservationContractTotalCents > 0
      ? params.reservationContractTotalCents
      : null
  if (cap == null || params.summedChargeLineItemsCents <= cap) {
    return params.summedChargeLineItemsCents
  }
  return cap
}

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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

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

function buildPropertyAddressLinesHtml(addressLines: string[]): string {
  return addressLines
    .map((line) => `<p style="margin:0;color:#444;font-size:13px;line-height:20px;">${escapeHtml(line)}</p>`)
    .join('')
}

function buildPaymentPipelineContext(params: {
  guestId: string
  reservationId: string | null
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
  guestId: string
  reservationId: string | null
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

  const remainingCents =
    params.totalReservationCents != null && params.newPaidTotalCents != null
      ? Math.max(0, params.totalReservationCents - params.newPaidTotalCents)
      : null

  const billedTo = [params.guestName, ...params.guestAddressLines]
    .filter(Boolean)
    .join('\n')

  const contactParts: string[] = []
  if (params.propertyRow?.email) contactParts.push(` at ${params.propertyRow.email}`)
  if (params.propertyRow?.phone) contactParts.push(` or ${params.propertyRow.phone}`)
  const propertyContactInfo = contactParts.join('')

  let reservationTotalsNote = ''
  if (params.totalReservationCents != null) {
    let note = `Reservation total ${formatCents(params.totalReservationCents)}`
    if (params.newPaidTotalCents != null) {
      note += ` · Total paid after this receipt ${formatCents(params.newPaidTotalCents)}`
    }
    note += '.'
    reservationTotalsNote = `<p style="margin:0;color:#777;font-size:12px;line-height:18px;">${escapeHtml(note)}</p>`
  }

  const subtotalCents =
    params.lineItems.length > 0 ? params.chargesSubtotalCents : params.amountPaidCents

  return {
    guestId: params.guestId,
    reservationId: params.reservationId,
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

/**
 * Sends payment receipt email (automation pipeline first, then template fallback)
 * and logs delivery. Intended to be fire-and-forget: `void queuePaymentReceiptEmail(...)`.
 */
export async function queuePaymentReceiptEmail(input: QueuePaymentReceiptEmailInput): Promise<void> {
  const {
    serviceRole,
    propertyId,
    reservationId,
    guestId: targetGuestId,
    amountCents,
    paymentRecordId,
    paymentMethodForLabel,
    sourceForLabel,
    rbacCompanyId,
    reservationTotals,
  } = input

  if (!targetGuestId || amountCents <= 0) return

  try {
    const chargePromise =
      reservationId != null && reservationId.length > 0
        ? serviceRole
            .from('financial_transactions')
            .select('amount_cents, notes, created_at')
            .eq('reservation_id', reservationId)
            .eq('property_id', propertyId)
            .eq('type', 'charge')
            .eq('status', 'completed')
            .eq('is_voided', false)
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [] as { amount_cents: number; notes: string | null; created_at: string }[] })

    const stayContextPromise =
      reservationId != null && reservationId.length > 0
        ? (async () => {
            const { data: res } = await serviceRole
              .from('reservations')
              .select('site_id, check_in_date, check_out_date')
              .eq('id', reservationId)
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
      console.warn('[Financial] Payment receipt email: skip — guest has no email', {
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

    const confirmationNumber = reservationTotals?.confirmation_number ?? 'Payment on file'

    const receiptNumber = receiptNumberFromPaymentId(paymentRecordId)
    const receiptSubject = `Payment receipt #${receiptNumber} — ${confirmationNumber} · ${propertyName}`

    const previousPaid = reservationTotals?.paid_amount ?? 0
    const newPaidTotalCents = reservationId ? previousPaid + amountCents : null
    const totalReservationCents = reservationTotals?.total_amount ?? null
    const reservationTotalPositiveCents =
      totalReservationCents != null && totalReservationCents > 0 ? totalReservationCents : null

    let lineItems: PaymentReceiptLineItem[] = []
    let chargesSubtotalCents = 0

    const siteLabel = stayContext?.site != null ? siteDisplayLabel(stayContext.site) : null
    const siteStayLine =
      reservationId &&
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
      Boolean(reservationId && siteStayLine && reservationTotalPositiveCents != null) &&
      (chargeRows.length === 0 ||
        (loneCompletedCharge != null &&
          reservationTotalPositiveCents != null &&
          Math.abs((loneCompletedCharge.amount_cents as number) - reservationTotalPositiveCents) <= 1 &&
          isGenericReservationChargeNote(loneCompletedCharge.notes)))

    if (useSiteStayReceiptLine && siteStayLine && reservationTotalPositiveCents != null) {
      lineItems = [siteStayLine]
      chargesSubtotalCents = reservationTotalPositiveCents
    } else if (reservationId && chargeRows.length > 0) {
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
    } else if (reservationId && totalReservationCents != null && totalReservationCents > 0) {
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
          description: `${paymentSourceToLabel(sourceForLabel)} — ${paymentMethodToLabel(paymentMethodForLabel)}`,
          unitPriceCents: amountCents,
          amountCents: amountCents,
        },
      ]
      chargesSubtotalCents = amountCents
    }

    chargesSubtotalCents = capReceiptChargesSubtotalCents({
      summedChargeLineItemsCents: chargesSubtotalCents,
      reservationContractTotalCents: totalReservationCents,
    })

    if (rbacCompanyId) {
      try {
        const receiptCtx = buildPaymentPipelineContext({
          guestId: targetGuestId,
          reservationId,
          guestEmail,
          lineItems,
          chargesSubtotalCents,
          amountPaidCents: amountCents,
          totalReservationCents,
          newPaidTotalCents,
          guestName,
          guestAddressLines,
          propertyName,
          propertyAddressLines,
          propertyRow,
          confirmationNumber,
          paymentRecordId,
          paymentMethodLabel: paymentMethodToLabel(paymentMethodForLabel),
          paymentSourceLabel: paymentSourceToLabel(sourceForLabel),
        })
        const pipelineResult = await triggerPaymentAutomations(
          'payment.received',
          propertyId,
          rbacCompanyId,
          receiptCtx,
        )
        if (pipelineResult && pipelineResult.executed > 0) {
          return
        }
      } catch (pipelineErr) {
        console.warn(
          '[Financial] Payment receipt email: automation pipeline failed, falling back to hardcoded template:',
          pipelineErr,
        )
      }
    }

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
      amountPaidCents: amountCents,
      paymentMethodLabel: paymentMethodToLabel(paymentMethodForLabel),
      paymentSourceLabel: paymentSourceToLabel(sourceForLabel),
      totalReservationCents,
      newPaidTotalCents,
    })

    if (!receiptResult.success) {
      console.warn('[Financial] Payment receipt email: send failed', {
        guestId: targetGuestId,
        error: receiptResult.error,
      })
    }

    const companyIdForLog =
      rbacCompanyId ??
      (propertyRow && typeof propertyRow.company_id === 'string' ? propertyRow.company_id : null)
    if (!companyIdForLog) {
      console.warn('[Financial] Payment receipt email: skip delivery log — property has no company_id', {
        propertyId,
        guestId: targetGuestId,
      })
      return
    }

    await recordPaymentReceiptEmailDelivery({
      supabase: serviceRole,
      companyId: companyIdForLog,
      propertyId,
      reservationId,
      guestId: targetGuestId,
      recipientEmail: guestEmail,
      subject: receiptSubject,
      sendResult: receiptResult.success ? { success: true } : { success: false, error: receiptResult.error },
    })
  } catch (e) {
    console.error('[Financial] Payment receipt email: threw (non-blocking)', e)
  }
}
