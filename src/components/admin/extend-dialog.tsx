'use client'

/**
 * Extend Reservation Dialog
 *
 * Allows operators to extend a reservation's check-in/out dates.
 * Features real-time availability checking with visual feedback.
 * Shows pricing changes and conflicts before submission.
 */

import { useState, useEffect, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { AlertCircle, Loader2, Calendar } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { isAccessDeniedError } from '@/lib/utils/is-access-denied-error'
import { useActionAvailability } from '@/lib/hooks/use-action-availability'
import { AvailabilityFeedback } from './availability-feedback'
import { useDialogCloseGuard } from '@/hooks/use-dialog-close-guard'
import { calculateBaseSubtotalCents } from '@/lib/booking/pricing'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format } from 'date-fns'
import type { RateDiscountsConfig, UserDefinedDiscount, BookingRulesConfig } from '@/lib/config/types'
import { BookingDateRangePicker, type DateRangeValue } from '@/components/guest/booking-date-range-picker'
import { resolveBookingRulesConfig } from '@/lib/config/resolution'
import {
  extractOpenPeriodFromPropertySettings,
  openPeriodRestrictsBookings,
  isStayWithinOpenPeriodByIsoDates,
  buildOpenPeriodBookingErrorMessage,
} from '@/lib/booking/open-period'
import { resolveRateDiscountsConfig } from '@/lib/config/resolution'
import type { PriceBreakdown } from '@/lib/booking/types'
import {
  AmericanExpressFlatRoundedIcon,
  DiscoverFlatRoundedIcon,
  GenericFlatRoundedIcon,
  MastercardFlatRoundedIcon,
  VisaFlatRoundedIcon,
} from 'react-svg-credit-card-payment-icons'

const SEASON_ALERT_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

interface ExtendDialogProps {
  reservationId: string
  confirmationNumber: string
  guestName: string
  currentCheckIn: string
  currentCheckOut: string
  siteNumber: string
  siteName?: string | undefined
  pricePerNight: number
  totalAmount: number
  weeklyRateCents: number | null
  monthlyRateCents: number | null
  status: string
  rateDiscountsConfig?: RateDiscountsConfig | null | undefined
  trigger?: React.ReactNode
}

type PaymentCardDisplay = {
  brand: string
  last4: string
  exp_month: number
  exp_year: number
}

function PaymentCardLogo({ brand }: { brand: string }) {
  const normalized = brand.trim().toLowerCase()
  switch (normalized) {
    case 'visa':
      return <VisaFlatRoundedIcon width={56} />
    case 'mastercard':
      return <MastercardFlatRoundedIcon width={56} />
    case 'amex':
    case 'american express':
    case 'americanexpress':
      return <AmericanExpressFlatRoundedIcon width={56} />
    case 'discover':
      return <DiscoverFlatRoundedIcon width={56} />
    default:
      return <GenericFlatRoundedIcon width={56} />
  }
}

/**
 * Calculate nights between two dates
 */
function calculateNights(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn + 'T00:00:00')
  const end = new Date(checkOut + 'T00:00:00')
  const diffTime = end.getTime() - start.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Format money from cents
 */
function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function formatSignedMoney(cents: number): string {
  const abs = Math.abs(cents)
  const prefix = cents > 0 ? '+' : cents < 0 ? '-' : ''
  return `${prefix}${formatMoney(abs)}`
}

/**
 * Format nights as "X week ($Y) + Z night(s) ($W/night)" or "X nights @ $Y/night" for display
 */
function formatNightsBreakdown(
  nights: number,
  basePriceCents: number,
  weeklyRateCents: number | null,
  monthlyRateCents: number | null
): string {
  if (nights >= 28 && monthlyRateCents != null) {
    const fullMonths = Math.floor(nights / 28)
    const remainder = nights % 28
    const monthLabel = fullMonths === 1 ? '1 month' : `${fullMonths} months`
    if (remainder === 0) {
      return `${monthLabel} (${formatMoney(monthlyRateCents)})`
    }
    const nightLabel = remainder === 1 ? '1 night' : `${remainder} nights`
    return `${monthLabel} (${formatMoney(monthlyRateCents)}) + ${nightLabel} (${formatMoney(basePriceCents)}/night)`
  }
  if (nights >= 7) {
    const weeklyCents = weeklyRateCents ?? basePriceCents * 7
    const fullWeeks = Math.floor(nights / 7)
    const remainder = nights % 7
    const weekLabel = fullWeeks === 1 ? '1 week' : `${fullWeeks} weeks`
    if (remainder === 0) {
      return `${weekLabel} (${formatMoney(weeklyCents)})`
    }
    const nightLabel = remainder === 1 ? '1 night' : `${remainder} nights`
    return `${weekLabel} (${formatMoney(weeklyCents)}) + ${nightLabel} (${formatMoney(basePriceCents)}/night)`
  }
  return `${nights} night${nights !== 1 ? 's' : ''} @ ${formatMoney(basePriceCents)}/night`
}

/**
 * Format for Pricing Impact: "N nights @ 1 week ($200.00) + 1 night ($30/night)" or "7 nights @ 1 week ($200.00)"
 */
function formatNightsWithBreakdown(
  nights: number,
  basePriceCents: number,
  weeklyRateCents: number | null,
  monthlyRateCents: number | null
): string {
  const breakdown = formatNightsBreakdown(nights, basePriceCents, weeklyRateCents, monthlyRateCents)
  if (nights >= 7) {
    return `${nights} nights @ ${breakdown}`
  }
  return breakdown
}

function formatDiscountOptionLabel(d: UserDefinedDiscount): string {
  const valuePart =
    d.discount_type === 'flat_amount'
      ? `$${((d.value_cents ?? 0) / 100).toFixed(2)} off`
      : `${d.value_percentage ?? 0}% off`

  let triggerPart = ''
  if (d.trigger_type === 'manual') {
    triggerPart = 'Manual'
  } else if (d.trigger_type === 'min_nights' && d.trigger_conditions?.min_nights != null) {
    triggerPart = `${d.trigger_conditions.min_nights}+ nights`
  } else if (d.trigger_type === 'min_guests' && d.trigger_conditions?.min_guests != null) {
    triggerPart = `${d.trigger_conditions.min_guests}+ guests`
  } else if (d.trigger_type === 'date_range' && d.trigger_conditions?.end_date) {
    triggerPart = `until ${format(new Date(d.trigger_conditions.end_date), 'MMM d')}`
  }

  if (triggerPart) {
    return `${d.title} (${valuePart}) — ${triggerPart}`
  }
  return `${d.title} (${valuePart})`
}

function parseLocalYmd(ymd: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!match) return new Date()
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

export function ExtendDialog({
  reservationId,
  confirmationNumber,
  guestName,
  currentCheckIn,
  currentCheckOut,
  siteNumber,
  siteName,
  pricePerNight,
  totalAmount,
  weeklyRateCents,
  monthlyRateCents,
  status,
  rateDiscountsConfig,
  trigger,
}: ExtendDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [cardPreviewLoading, setCardPreviewLoading] = useState(false)
  const [paymentCard, setPaymentCard] = useState<PaymentCardDisplay | null>(null)
  const [projectedTotalCents, setProjectedTotalCents] = useState<number | null>(null)
  const [originalPeriodTotalCents, setOriginalPeriodTotalCents] = useState<number | null>(null)
  const [projectedBreakdown, setProjectedBreakdown] = useState<PriceBreakdown | null>(null)
  const [originalBreakdown, setOriginalBreakdown] = useState<PriceBreakdown | null>(null)
  const [dateRange, setDateRange] = useState<DateRangeValue>()
  const [bookingRulesConfig, setBookingRulesConfig] = useState<BookingRulesConfig | null>(null)
  const [propertyName, setPropertyName] = useState<string | null>(null)
  const [openPeriodFrom, setOpenPeriodFrom] = useState<string | null>(null)
  const [openPeriodUntil, setOpenPeriodUntil] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  // Form state
  const [newCheckIn, setNewCheckIn] = useState(currentCheckIn)
  const [newCheckOut, setNewCheckOut] = useState(currentCheckOut)
  const [notes, setNotes] = useState('')
  const [selectedDiscountId, setSelectedDiscountId] = useState<string | undefined>(undefined)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setNewCheckIn(currentCheckIn)
      setNewCheckOut(currentCheckOut)
      setDateRange({
        from: new Date(`${currentCheckIn}T00:00:00`),
        to: new Date(`${currentCheckOut}T00:00:00`),
      })
      setNotes('')
      setError(null)
      setPaymentCard(null)
      setProjectedTotalCents(null)
      setOriginalPeriodTotalCents(null)
      setSelectedDiscountId(undefined)
      setProjectedBreakdown(null)
      setOriginalBreakdown(null)
    }
  }, [open, currentCheckIn, currentCheckOut])

  useEffect(() => {
    if (!open || status !== 'confirmed' || !dateRange?.from) return
    setNewCheckIn(format(dateRange.from, 'yyyy-MM-dd'))
    setNewCheckOut(dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : '')
  }, [open, status, dateRange])

  useEffect(() => {
    if (!open || !reservationId) return
    setCardPreviewLoading(true)
    setPaymentCard(null)
    fetch(`/api/v1/reservations/${reservationId}`)
      .then((res) => res.json())
      .then((json) => {
        const pc = json?.data?.payment_card
        if (
          json?.success === true &&
          pc &&
          typeof pc.last4 === 'string' &&
          typeof pc.brand === 'string' &&
          typeof pc.exp_month === 'number' &&
          typeof pc.exp_year === 'number'
        ) {
          setPaymentCard({
            brand: pc.brand,
            last4: pc.last4,
            exp_month: pc.exp_month,
            exp_year: pc.exp_year,
          })
        }
        if (json?.success === true) {
          const data = json.data
          setPropertyName(typeof data?.property_name === 'string' ? data.property_name : null)
          const { openPeriodFrom: from, openPeriodUntil: until } =
            extractOpenPeriodFromPropertySettings(data?.property_settings)
          setOpenPeriodFrom(from)
          setOpenPeriodUntil(until)
          setBookingRulesConfig(
            resolveBookingRulesConfig(
              (data?.booking_rules_config as BookingRulesConfig | null) ?? null,
              null
            ).config
          )
        }
      })
      .catch(() => {
        // Keep paymentCard null
      })
      .finally(() => setCardPreviewLoading(false))
  }, [open, reservationId])

  // Check if dates have changed
  const hasChanges = newCheckIn !== currentCheckIn || newCheckOut !== currentCheckOut

  const { guardedOnOpenChange, unsavedChangesDialog } = useDialogCloseGuard({
    isDirty: hasChanges,
    open,
    onOpenChange: setOpen,
  })

  // Base-only pricing impact (fallback when full preview not available)
  const pricingImpact = useMemo(() => {
    if (!hasChanges) return null
    const originalNights = calculateNights(currentCheckIn, currentCheckOut)
    const newNights = calculateNights(newCheckIn, newCheckOut)
    const newTotalCents = calculateBaseSubtotalCents(
      newNights,
      pricePerNight,
      weeklyRateCents,
      monthlyRateCents
    )
    const priceChange = newTotalCents - totalAmount
    return {
      originalNights,
      newNights,
      nightsAdded: newNights - originalNights,
      priceChange,
      newTotalCents,
    }
  }, [hasChanges, currentCheckIn, currentCheckOut, newCheckIn, newCheckOut, pricePerNight, totalAmount, weeklyRateCents, monthlyRateCents])

  // Fetch full projected total (discounts + fees) when dates change
  useEffect(() => {
    if (!hasChanges || !newCheckIn || !newCheckOut || newCheckOut <= newCheckIn) {
      setProjectedTotalCents(null)
      setOriginalPeriodTotalCents(null)
      setProjectedBreakdown(null)
      setOriginalBreakdown(null)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    setProjectedTotalCents(null)
    setOriginalPeriodTotalCents(null)
    setProjectedBreakdown(null)
    setOriginalBreakdown(null)
    const selectedDiscountIds = selectedDiscountId ? [selectedDiscountId] : []
    fetch(`/api/v1/reservations/${reservationId}/extend-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newCheckIn, newCheckOut, selectedDiscountIds }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data?.success && typeof data?.data?.projectedTotalCents === 'number') {
          setProjectedTotalCents(data.data.projectedTotalCents)
          const orig = data?.data?.originalPeriodTotalCents
          setOriginalPeriodTotalCents(typeof orig === 'number' ? orig : null)
          const breakdown = data?.data?.breakdown
          const origBreakdown = data?.data?.originalBreakdown
          setProjectedBreakdown(
            breakdown && typeof breakdown === 'object' ? (breakdown as PriceBreakdown) : null
          )
          setOriginalBreakdown(
            origBreakdown && typeof origBreakdown === 'object'
              ? (origBreakdown as PriceBreakdown)
              : null
          )
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProjectedTotalCents(null)
          setOriginalPeriodTotalCents(null)
          setProjectedBreakdown(null)
          setOriginalBreakdown(null)
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reservationId, hasChanges, newCheckIn, newCheckOut, selectedDiscountId])

  // When extension pricing applies: additional charge = cost of added nights only; new total = current total + additional charge
  const useExtensionPricing =
    projectedTotalCents != null && originalPeriodTotalCents != null
  const displayPriceChange = useExtensionPricing
    ? (projectedBreakdown?.total ?? projectedTotalCents) -
    (originalBreakdown?.total ?? originalPeriodTotalCents)
    : (projectedTotalCents ?? pricingImpact?.newTotalCents ?? 0) - totalAmount

  const displayNewTotalCents = useExtensionPricing
    ? totalAmount + displayPriceChange
    : projectedTotalCents ?? pricingImpact?.newTotalCents ?? 0

  const additionalFeesDelta = useMemo(() => {
    if (!useExtensionPricing || !projectedBreakdown || !originalBreakdown) return []
    const projectedFees = Array.isArray(projectedBreakdown.user_fees) ? projectedBreakdown.user_fees : []
    const originalFees = Array.isArray(originalBreakdown.user_fees) ? originalBreakdown.user_fees : []
    const originalById = new Map(originalFees.map((f) => [f.id, f.amount]))
    return projectedFees
      .map((f) => ({
        id: f.id,
        title: f.title,
        amount: f.amount - (originalById.get(f.id) ?? 0),
      }))
      .filter((f) => f.amount !== 0)
  }, [useExtensionPricing, projectedBreakdown, originalBreakdown])

  const additionalDiscountsDelta = useMemo(() => {
    if (!useExtensionPricing || !projectedBreakdown || !originalBreakdown) return []
    const projectedDiscounts = Array.isArray(projectedBreakdown.user_discounts)
      ? projectedBreakdown.user_discounts
      : []
    const originalDiscounts = Array.isArray(originalBreakdown.user_discounts)
      ? originalBreakdown.user_discounts
      : []
    const originalById = new Map(originalDiscounts.map((d) => [d.id, d.amount]))
    return projectedDiscounts
      .map((d) => ({
        id: d.id,
        title: d.title,
        // Discounts are positive cents but subtract from total — delta shown as negative when added
        amount: (d.amount - (originalById.get(d.id) ?? 0)) * -1,
      }))
      .filter((d) => d.amount !== 0)
  }, [useExtensionPricing, projectedBreakdown, originalBreakdown])

  const additionalTaxDelta = useMemo(() => {
    if (!useExtensionPricing || !projectedBreakdown || !originalBreakdown) return null
    const projectedTax = projectedBreakdown.taxes ?? 0
    const originalTax = originalBreakdown.taxes ?? 0
    return projectedTax - originalTax
  }, [useExtensionPricing, projectedBreakdown, originalBreakdown])

  const additionalLodgingDelta = useMemo(() => {
    if (!useExtensionPricing || !projectedBreakdown || !originalBreakdown) return null
    return (projectedBreakdown.subtotal ?? 0) - (originalBreakdown.subtotal ?? 0)
  }, [useExtensionPricing, projectedBreakdown, originalBreakdown])

  const adjustmentLineItems = useMemo(() => {
    if (!useExtensionPricing) return []
    const items: Array<{ key: string; label: string; amount: number; tone?: 'positive' | 'negative' }> = []

    if ((additionalLodgingDelta ?? 0) !== 0) {
      items.push({
        key: 'lodging',
        label: pricingImpact?.nightsAdded && pricingImpact.nightsAdded > 0
          ? `Lodging (${pricingImpact.nightsAdded} night${pricingImpact.nightsAdded !== 1 ? 's' : ''})`
          : 'Lodging adjustment',
        amount: additionalLodgingDelta ?? 0,
      })
    }

    for (const fee of additionalFeesDelta) {
      items.push({ key: `fee:${fee.id}`, label: fee.title, amount: fee.amount })
    }

    for (const discount of additionalDiscountsDelta) {
      items.push({
        key: `discount:${discount.id}`,
        label: discount.title,
        amount: discount.amount,
        tone: 'negative',
      })
    }

    if ((additionalTaxDelta ?? 0) !== 0) {
      const taxRate = projectedBreakdown?.tax_rate
      const taxLabel =
        taxRate != null && typeof taxRate === 'number'
          ? `${projectedBreakdown?.tax_name || 'Tax'} (${(taxRate * 100).toFixed(2)}%)`
          : projectedBreakdown?.tax_name || 'Tax'
      items.push({ key: 'tax', label: taxLabel, amount: additionalTaxDelta ?? 0 })
    }

    return items
  }, [
    useExtensionPricing,
    additionalLodgingDelta,
    additionalFeesDelta,
    additionalDiscountsDelta,
    additionalTaxDelta,
    projectedBreakdown,
    pricingImpact?.nightsAdded,
  ])

  // Real-time availability checking
  const { checking, result, error: availError } = useActionAvailability(
    reservationId,
    'extend',
    {
      newCheckIn: newCheckIn !== currentCheckIn ? newCheckIn : undefined,
      newCheckOut: newCheckOut !== currentCheckOut ? newCheckOut : undefined,
    }
  )

  // Determine if we can submit
  const canSubmit =
    hasChanges &&
    !loading &&
    !checking &&
    result?.available &&
    (result.status === 'fully_available' || result.status === 'partially_available')

  const handleExtend = async () => {
    if (!canSubmit) return

    try {
      setLoading(true)
      setError(null)

      // Validate dates
      const checkInDate = new Date(newCheckIn + 'T00:00:00')
      const checkOutDate = new Date(newCheckOut + 'T00:00:00')

      if (checkOutDate <= checkInDate) {
        throw new Error('Check-out date must be after check-in date')
      }

      // Ensure at least one date has changed
      if (newCheckIn === currentCheckIn && newCheckOut === currentCheckOut) {
        throw new Error('Please change at least one date to extend the reservation')
      }

      if (
        openPeriodRestrictsBookings(openPeriodFrom, openPeriodUntil) &&
        !isStayWithinOpenPeriodByIsoDates(
          newCheckIn,
          newCheckOut,
          openPeriodFrom,
          openPeriodUntil
        )
      ) {
        const fromIso = openPeriodFrom?.trim()
        const untilIso = openPeriodUntil?.trim()
        throw new Error(
          fromIso && untilIso && propertyName
            ? buildOpenPeriodBookingErrorMessage(propertyName, fromIso, untilIso)
            : 'Selected dates are outside the property booking season.'
        )
      }

      const response = await fetch(`/api/v1/reservations/${reservationId}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'extend',
          params: {
            newCheckIn: newCheckIn !== currentCheckIn ? newCheckIn : undefined,
            newCheckOut: newCheckOut !== currentCheckOut ? newCheckOut : undefined,
            notes: notes.trim() || undefined,
            selectedDiscountIds: selectedDiscountId ? [selectedDiscountId] : [],
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to extend reservation')
      }

      // Success - close dialog and refresh the page
      toast({
        title: 'Reservation extended',
        description: 'Reservation dates were updated successfully.',
        variant: "success",
      })
      setOpen(false)
      router.refresh()
    } catch (err) {
      if (isAccessDeniedError(err)) {
        toast({
          title: 'Access denied',
          description: "You don't have permission for this action. Contact your property administrator if you believe this is an error.",
          variant: 'destructive',
          className: SEASON_ALERT_TOAST_CLASS,
        })
        return
      }
      console.error('[ExtendDialog] Error:', err)
      toast({
        title: 'Extend failed',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: 'destructive',
        className: SEASON_ALERT_TOAST_CLASS,
      })
    } finally {
      setLoading(false)
    }
  }

  const availableDiscounts = useMemo<UserDefinedDiscount[]>(() => {
    const resolved = resolveRateDiscountsConfig(rateDiscountsConfig)
    const all = resolved.user_defined_discounts ?? []
    return all
      .filter(
        (d) =>
          d.enabled &&
          ['manual', 'min_nights', 'min_guests', 'date_range'].includes(d.trigger_type)
      )
      .sort((a, b) => {
        const order = (t: UserDefinedDiscount['trigger_type']) =>
          t === 'manual' ? 0 : t === 'min_nights' ? 1 : t === 'min_guests' ? 2 : 3
        const byTrigger = order(a.trigger_type) - order(b.trigger_type)
        if (byTrigger !== 0) return byTrigger
        return (a.display_order ?? 0) - (b.display_order ?? 0)
      })
  }, [rateDiscountsConfig])

  return (
    <>
    <Sheet open={open} onOpenChange={guardedOnOpenChange}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Calendar className="mr-2 h-4 w-4" />
            Extend Stay
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-[90vw] max-w-[90vw] overflow-y-auto sm:max-w-[600px]">
        <SheetHeader>
          <SheetTitle>Extend Reservation</SheetTitle>
          <SheetDescription>
            Add nights before or after the current reservation for {guestName}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Reservation Info */}
          <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5">
            <div className="text-sm">
              <span className="font-medium">Confirmation:</span>{' '}
              <span className="text-muted-foreground">{confirmationNumber}</span>
            </div>
            <div className="text-sm">
              <span className="font-medium">Guest:</span>{' '}
              <span className="text-muted-foreground capitalize">{guestName}</span>
            </div>
            <div className="flex flex-nowrap items-center gap-2 text-sm">
              <span className="font-medium shrink-0">Payment card:</span>
              {cardPreviewLoading ? (
                <span className="text-muted-foreground">Loading…</span>
              ) : paymentCard ? (
                <span className="inline-flex min-w-0 items-center gap-3 align-middle">
                  <span className="inline-flex h-10 w-14 shrink-0 items-center justify-center">
                    <PaymentCardLogo brand={paymentCard.brand} />
                  </span>
                  <span className="min-w-0 truncate font-mono text-base text-foreground">
                    **** **** **** {paymentCard.last4}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  No card payment on file for this booking
                </span>
              )}
            </div>
            <div className="text-sm">
              <span className="font-medium">Site:</span>{' '}
              <span className="text-muted-foreground">
                #{siteNumber}
                {siteName && <span className="ml-1">({siteName})</span>}
              </span>
            </div>
          </div>

          {/* Current Dates */}
          <div className="rounded-lg border border-dashed p-3 space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground uppercase">
              Current Dates
            </div>
            <div className="text-sm">
              <span className="font-medium">Check-in:</span>{' '}
              <span>{new Date(currentCheckIn + 'T00:00:00').toLocaleDateString()}</span>
            </div>
            <div className="text-sm">
              <span className="font-medium">Check-out:</span>{' '}
              <span>{new Date(currentCheckOut + 'T00:00:00').toLocaleDateString()}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {calculateNights(currentCheckIn, currentCheckOut)} nights
            </div>
          </div>

          {status === 'confirmed' ? (
            <div className="space-y-2">
              <BookingDateRangePicker
                variant="dashboard"
                label="New Check-in & Check-out"
                value={dateRange}
                onChange={setDateRange}
                className="w-full max-w-[22rem]"
                sameDayBookingEnabled={bookingRulesConfig?.same_day_booking_enabled ?? true}
                blackoutDates={bookingRulesConfig?.blackout_dates ?? []}
                {...(bookingRulesConfig?.booking_window_days != null
                  ? { bookingWindowDays: bookingRulesConfig.booking_window_days }
                  : {})}
                {...(bookingRulesConfig?.advance_notice_days != null
                  ? { advanceNoticeDays: bookingRulesConfig.advance_notice_days }
                  : {})}
                openPeriodFrom={openPeriodFrom}
                openPeriodUntil={openPeriodUntil}
                numberOfMonths={1}
                disabled={loading}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <BookingDateRangePicker
                variant="dashboard"
                label="New Check-out Date"
                value={{
                  from: parseLocalYmd(currentCheckIn),
                  to: newCheckOut ? parseLocalYmd(newCheckOut) : undefined,
                }}
                onChange={(range) => {
                  const picked = range?.to ?? range?.from
                  if (!picked) return
                  const nextCheckout = format(picked, 'yyyy-MM-dd')
                  if (openPeriodFrom && nextCheckout < openPeriodFrom) return
                  if (openPeriodUntil && nextCheckout > openPeriodUntil) return
                  setNewCheckOut(nextCheckout)
                }}
                className="w-full max-w-[22rem]"
                sameDayBookingEnabled={bookingRulesConfig?.same_day_booking_enabled ?? true}
                blackoutDates={bookingRulesConfig?.blackout_dates ?? []}
                {...(bookingRulesConfig?.booking_window_days != null
                  ? { bookingWindowDays: bookingRulesConfig.booking_window_days }
                  : {})}
                {...(bookingRulesConfig?.advance_notice_days != null
                  ? { advanceNoticeDays: bookingRulesConfig.advance_notice_days }
                  : {})}
                openPeriodFrom={openPeriodFrom}
                openPeriodUntil={openPeriodUntil}
                numberOfMonths={1}
                disabled={loading}
              />
            </div>
          )}

          <div>
            <Label htmlFor="discounts">Discounts</Label>
            <Select
              value={selectedDiscountId ?? ''}
              onValueChange={(value) => setSelectedDiscountId(value || undefined)}
              disabled={loading || availableDiscounts.length === 0}
            >
              <SelectTrigger id="discounts">
                <SelectValue
                  placeholder={
                    availableDiscounts.length === 0
                      ? 'No discounts configured for this property'
                      : 'Select a discount'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableDiscounts.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {formatDiscountOptionLabel(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableDiscounts.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Configure discounts under Settings → Discounts.
              </p>
            )}
          </div>

          {/* Pricing Impact - amounts only shown after full pricing loads (or fallback if API fails) */}
          {pricingImpact && (
            <div className="rounded-lg border bg-blue-500/5 border-blue-500/20 p-3 space-y-2">
              <div className="text-sm font-medium text-blue-700">Pricing Impact</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Original:</span>
                  <span>
                    {formatNightsWithBreakdown(
                      pricingImpact.originalNights,
                      pricePerNight,
                      weeklyRateCents,
                      monthlyRateCents
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New:</span>
                  <span>
                    {formatNightsWithBreakdown(
                      pricingImpact.newNights,
                      pricePerNight,
                      weeklyRateCents,
                      monthlyRateCents
                    )}
                  </span>
                </div>
                {previewLoading ? (
                  <div className="pt-2 border-t flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Calculating total (discounts and fees)…</span>
                  </div>
                ) : (
                  <>
                    {adjustmentLineItems.length > 0 && (
                      <div className="pt-2 border-t space-y-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase">
                          Adjustment breakdown
                        </span>
                        {adjustmentLineItems.map((item) => (
                          <div
                            key={item.key}
                            className="flex justify-between text-sm"
                          >
                            <span
                              className={
                                item.tone === 'negative'
                                  ? 'text-green-700'
                                  : undefined
                              }
                            >
                              {item.label}
                            </span>
                            <span
                              className={
                                item.tone === 'negative'
                                  ? 'text-green-700'
                                  : undefined
                              }
                            >
                              {formatSignedMoney(item.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t font-medium">
                      <span>
                        {pricingImpact.nightsAdded > 0 ? 'Additional Charge:' : 'Refund:'}
                      </span>
                      <span
                        className={
                          pricingImpact.nightsAdded > 0 ? 'text-green-600' : 'text-red-600'
                        }
                      >
                        {pricingImpact.nightsAdded > 0 ? '+' : ''}
                        {formatMoney(displayPriceChange)}
                      </span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>New total:</span>
                      <span>{formatMoney(displayNewTotalCents)}</span>
                    </div>
                    {projectedTotalCents != null && (
                      <p className="text-xs text-muted-foreground pt-1">
                        Includes applicable discounts and additional charges for this reservation.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Availability Feedback */}
          {hasChanges && checking && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>Checking availability...</AlertDescription>
            </Alert>
          )}

          {hasChanges && !checking && result && (
            <AvailabilityFeedback
              result={result}
              {...(!previewLoading && {
                overrideAdditionalChargeCents: displayPriceChange,
              })}
            />
          )}

          {hasChanges && availError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{availError}</AlertDescription>
            </Alert>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="e.g., Guest requested early arrival, Weather-related extension, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={loading}
            />
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => guardedOnOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleExtend} disabled={!canSubmit}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Processing...' : 'Extend Reservation'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
    {unsavedChangesDialog}
    </>
  )
}
