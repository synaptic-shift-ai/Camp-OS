import { differenceInDays, parseISO, startOfDay } from 'date-fns'
import { render } from '@react-email/components'
import { sendEmail, getFrom } from '@/lib/email/emailit'
import {
  PaymentReceivedInvoiceEmail,
  type PaymentReceiptLineItem,
} from '@/lib/email/templates/payment-received-invoice'

export type { PaymentReceiptLineItem }

export type PaymentReceivedInvoiceEmailInput = {
  guestEmail: string
  guestName: string
  guestAddressLines: string[]
  propertyName: string
  propertyAddressLines: string[]
  propertyContactEmail?: string | null
  propertyContactPhone?: string | null
  confirmationNumber: string
  receiptNumber: string
  receiptDate: string
  lineItems: PaymentReceiptLineItem[]
  chargesSubtotalCents: number
  amountPaidCents: number
  paymentMethodLabel: string
  paymentSourceLabel: string
  totalReservationCents: number | null
  newPaidTotalCents: number | null
}

export type SendPaymentReceivedInvoiceResult =
  | { success: true; id: string }
  | { success: false; error: string }

export function paymentMethodToLabel(method: string): string {
  const labels: Record<string, string> = {
    credit_card: 'Card',
    debit_card: 'Card',
    cash: 'Cash',
    check: 'Check',
    bank_transfer: 'ACH / Bank transfer',
    stripe: 'Card (Stripe)',
    store_credit: 'Store credit',
  }
  return labels[method] ?? method
}

export function paymentSourceToLabel(source: string): string {
  const labels: Record<string, string> = {
    manual: 'Staff-recorded payment',
    guest_credit: 'Guest credit',
    reservation: 'Booking',
    pos: 'Point of sale',
    system: 'System',
  }
  return labels[source] ?? source
}

export function formatEntityAddressLines(parts: {
  address?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  country?: string | null
}): string[] {
  const line1 = (parts.address ?? '').trim()
  const cityPart = [parts.city, parts.state].filter(Boolean).join(', ').trim()
  const zip = (parts.zip_code ?? '').trim()
  const line2 = [cityPart, zip].filter(Boolean).join(' ').trim()
  const line3 = (parts.country ?? '').trim()
  return [line1, line2, line3].filter((l) => l.length > 0)
}

export function formatReceiptDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const year = d.getFullYear()
  return `${month}-${day}-${year}`
}

export function receiptNumberFromPaymentId(paymentId: string): string {
  const compact = paymentId.replace(/-/g, '')
  return compact.slice(0, 10).toUpperCase()
}

/** Night count aligned with BookingEngine DateRange (start-of-day difference). */
export function calculateReservationStayNights(
  checkInDateIso: string,
  checkOutDateIso: string,
): number {
  const checkIn = startOfDay(parseISO(checkInDateIso))
  const checkOut = startOfDay(parseISO(checkOutDateIso))
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
    return 1
  }
  const nights = differenceInDays(checkOut, checkIn)
  return Math.max(1, nights)
}

export function siteDisplayLabel(site: {
  site_name: string | null
  site_number: string | null
}): string | null {
  const name = typeof site.site_name === 'string' ? site.site_name.trim() : ''
  if (name.length > 0) return name
  const num = typeof site.site_number === 'string' ? site.site_number.trim() : ''
  return num.length > 0 ? num : null
}

/** Ledger notes that represent a single lump-sum stay charge (replace with site line on receipt). */
export function isGenericReservationChargeNote(notes: string | null): boolean {
  const n = (notes ?? '').trim().toLowerCase()
  if (n.length === 0) return true
  if (n === 'charge') return true
  if (n.includes('reservation charge')) return true
  if (n.includes('guest self-service')) return true
  return false
}

export function buildSiteStayReceiptLineItem(params: {
  siteLabel: string
  checkInDate: string
  checkOutDate: string
  totalChargeCents: number
}): PaymentReceiptLineItem {
  const nights = calculateReservationStayNights(params.checkInDate, params.checkOutDate)
  const unitPriceCents =
    nights > 0 ? Math.round(params.totalChargeCents / nights) : params.totalChargeCents
  const nightWord = nights === 1 ? 'night' : 'nights'
  return {
    quantity: nights,
    description: `${params.siteLabel} stay (${nights} ${nightWord})`,
    unitPriceCents,
    amountCents: params.totalChargeCents,
    unitPricePerNight: true,
  }
}

export async function sendPaymentReceivedInvoiceEmail(
  input: PaymentReceivedInvoiceEmailInput,
): Promise<SendPaymentReceivedInvoiceResult> {
  try {
    const html = await render(
      PaymentReceivedInvoiceEmail({
        propertyName: input.propertyName,
        propertyAddressLines: input.propertyAddressLines,
        propertyContactEmail: input.propertyContactEmail ?? null,
        propertyContactPhone: input.propertyContactPhone ?? null,
        guestName: input.guestName,
        guestAddressLines: input.guestAddressLines,
        confirmationNumber: input.confirmationNumber,
        receiptNumber: input.receiptNumber,
        receiptDate: input.receiptDate,
        lineItems: input.lineItems,
        chargesSubtotalCents: input.chargesSubtotalCents,
        amountPaidThisReceiptCents: input.amountPaidCents,
        paymentMethodLabel: input.paymentMethodLabel,
        paymentSourceLabel: input.paymentSourceLabel,
        totalReservationCents: input.totalReservationCents,
        newPaidTotalCents: input.newPaidTotalCents,
      }),
    )

    const result = await sendEmail({
      from: getFrom(),
      to: input.guestEmail,
      subject: `Payment receipt #${input.receiptNumber} — ${input.confirmationNumber} · ${input.propertyName}`,
      html,
    })

    return result.success
      ? { success: true, id: result.id }
      : { success: false, error: result.error }
  } catch (err) {
    console.error('[Email] Failed to send payment receipt:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send email',
    }
  }
}
