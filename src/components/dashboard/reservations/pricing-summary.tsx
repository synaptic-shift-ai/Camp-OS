'use client'

/**
 * Pricing Summary Component
 *
 * Sticky sidebar that displays real-time pricing breakdown for manual reservations.
 * Calculates all fees, discounts, and taxes based on property configuration.
 *
 * Supports both user-defined fees/discounts and legacy fields for backward compatibility.
 */

import { useEffect, useId, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DollarSign, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PricingConfig, RateDiscountsConfig, DepositConfig, BookingType } from '@/lib/config/types'

export type PricingSummaryPaymentOption = 'deposit' | 'full'

interface AvailableSite {
  id: string
  name: string
  site_number: string
  base_price_per_night: number
  weekly_rate_cents?: number
  monthly_rate_cents?: number
}

interface PricingSummaryProps {
  selectedSite: AvailableSite | null
  numNights: number
  stayType: BookingType
  numAdults: number
  numChildren: number
  numPets: number
  pricingConfig: PricingConfig | null
  rateDiscountsConfig: RateDiscountsConfig | null
  depositConfig: DepositConfig | null
  checkInDate?: string
  checkOutDate?: string
  /** Manually selected discount IDs (for manual trigger_type discounts) */
  selectedDiscountIds?: string[]
  /** Manually selected fee IDs (for manual trigger_type fees) */
  selectedFeeIds?: string[]
  paidAmount?: string | undefined
  onTotalChange?: (totalCents: number) => void
  /** Guest credit applied toward this reservation (cents); when positive, summary shows guest credit use */
  guestCreditAppliedCents?: number
  paymentOption?: PricingSummaryPaymentOption
  onPaymentOptionChange?: (option: PricingSummaryPaymentOption) => void
  onAmountDueTodayChange?: (amountCents: number) => void
}

interface CalculatedFee {
  id: string
  title: string
  amount: number
  is_taxable: boolean
}

interface CalculatedDiscount {
  id: string
  title: string
  amount: number
  trigger_type: string
}

export function PricingSummary(props: PricingSummaryProps) {
  if (!props.selectedSite || !props.pricingConfig || !props.rateDiscountsConfig) {
    return (
      <div className="lg:sticky lg:top-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Pricing Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Select dates and a site to see pricing breakdown
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <PricingSummaryContent
      {...props}
      selectedSite={props.selectedSite}
      pricingConfig={props.pricingConfig}
      rateDiscountsConfig={props.rateDiscountsConfig}
    />
  )
}

type PricingSummaryContentProps = Omit<
  PricingSummaryProps,
  'selectedSite' | 'pricingConfig' | 'rateDiscountsConfig'
> & {
  selectedSite: AvailableSite
  pricingConfig: PricingConfig
  rateDiscountsConfig: RateDiscountsConfig
}

function PricingSummaryContent({
  selectedSite,
  numNights,
  stayType,
  numAdults,
  numChildren,
  numPets,
  pricingConfig,
  rateDiscountsConfig,
  depositConfig,
  checkInDate,
  checkOutDate: _checkOutDate,
  selectedDiscountIds = [],
  selectedFeeIds = [],
  paidAmount,
  onTotalChange,
  guestCreditAppliedCents = 0,
  paymentOption: paymentOptionProp,
  onPaymentOptionChange,
  onAmountDueTodayChange,
}: PricingSummaryContentProps) {
  const paymentOptionId = useId()
  const [internalPaymentOption, setInternalPaymentOption] =
    useState<PricingSummaryPaymentOption>('deposit')
  const paymentOption = paymentOptionProp ?? internalPaymentOption

  const handlePaymentOptionChange = (value: PricingSummaryPaymentOption) => {
    if (paymentOptionProp === undefined) {
      setInternalPaymentOption(value)
    }
    onPaymentOptionChange?.(value)
  }

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  // Effective stay type (match page: weekly requires 7+ nights, monthly 28+)
  const STAY_TYPE_MIN_NIGHTS: Record<BookingType, number> = {
    nightly: 1,
    weekly: 7,
    monthly: 28,
    seasonal: 28,
    long_term: 28,
  }

  const hasWeekly = (selectedSite.weekly_rate_cents ?? 0) > 0
  const hasMonthly = (selectedSite.monthly_rate_cents ?? 0) > 0

  const effectiveStayType: BookingType =
    stayType === 'nightly'
      ? numNights >= STAY_TYPE_MIN_NIGHTS.monthly
          ? (hasMonthly ? 'monthly' : hasWeekly ? 'weekly' : 'nightly')
          : numNights >= STAY_TYPE_MIN_NIGHTS.weekly
            ? (hasWeekly ? 'weekly' : 'nightly')
            : 'nightly'
      : stayType === 'monthly' && numNights >= STAY_TYPE_MIN_NIGHTS.monthly
        ? (hasMonthly ? 'monthly' : hasWeekly ? 'weekly' : 'nightly')
        : (stayType === 'monthly' || stayType === 'weekly') &&
            numNights >= STAY_TYPE_MIN_NIGHTS.weekly
          ? (hasWeekly ? 'weekly' : 'nightly')
          : stayType

  // Base subtotal and display label from effective stay type (match accordion and blue bar)
  let subtotal: number
  let basePriceLabel: string
  const nightlyRateDollars = selectedSite.base_price_per_night / 100
  switch (effectiveStayType) {
    case 'weekly': {
      const weeklyCents = selectedSite.weekly_rate_cents ?? selectedSite.base_price_per_night * 7
      const nightlyCents = selectedSite.base_price_per_night
      const fullWeeks = Math.floor(numNights / 7)
      const remainderNights = numNights % 7
      subtotal =
        (fullWeeks * weeklyCents) / 100 + (remainderNights * nightlyCents) / 100
      basePriceLabel =
        remainderNights === 0
          ? `${fullWeeks} week${fullWeeks !== 1 ? 's' : ''} (${formatMoney(weeklyCents / 100)}/week)`
          : `${fullWeeks} week${fullWeeks !== 1 ? 's' : ''} (${formatMoney(weeklyCents / 100)}) + ${remainderNights} night${remainderNights !== 1 ? 's' : ''} (${formatMoney(nightlyCents / 100)}/night)`
      break
    }
    case 'monthly': {
      const monthlyCentsRaw = selectedSite.monthly_rate_cents ?? 0

      if (monthlyCentsRaw <= 0) {
        const weeklyCents = selectedSite.weekly_rate_cents ?? selectedSite.base_price_per_night * 7
        const nightlyCents = selectedSite.base_price_per_night
        const fullWeeks = Math.floor(numNights / 7)
        const remainderNights = numNights % 7
        subtotal = (fullWeeks * weeklyCents) / 100 + (remainderNights * nightlyCents) / 100
        basePriceLabel =
          remainderNights === 0
            ? `${fullWeeks} week${fullWeeks !== 1 ? 's' : ''} (${formatMoney(weeklyCents / 100)}/week)`
            : `${fullWeeks} week${fullWeeks !== 1 ? 's' : ''} (${formatMoney(weeklyCents / 100)}) + ${remainderNights} night${remainderNights !== 1 ? 's' : ''} (${formatMoney(nightlyCents / 100)}/night)`
        break
      }

      const monthlyCents = monthlyCentsRaw
      const nightlyCents = selectedSite.base_price_per_night
      const fullMonths = Math.floor(numNights / 28)
      const remainderNights = numNights % 28
      subtotal = (fullMonths * monthlyCents) / 100 + (remainderNights * nightlyCents) / 100
      basePriceLabel =
        remainderNights === 0
          ? `${fullMonths} month${fullMonths !== 1 ? 's' : ''} (${formatMoney(monthlyCents / 100)}/month)`
          : `${fullMonths} month${fullMonths !== 1 ? 's' : ''} (${formatMoney(monthlyCents / 100)}) + ${remainderNights} night${remainderNights !== 1 ? 's' : ''} (${formatMoney(nightlyCents / 100)}/night)`
      break
    }
    default: {
      subtotal = nightlyRateDollars * numNights
      basePriceLabel = `${formatMoney(nightlyRateDollars)}/night × ${numNights} night${numNights !== 1 ? 's' : ''}`
      break
    }
  }
  const basePricePerNight = selectedSite.base_price_per_night / 100
  const totalGuests = numAdults + (numChildren || 0)

  // =====================================================
  // User-Defined Fees Calculation
  // =====================================================
  const calculatedFees: CalculatedFee[] = []
  const userDefinedFees = pricingConfig.user_defined_fees || []
  const hasUserDefinedFees = userDefinedFees.length > 0

  if (hasUserDefinedFees) {
    for (const fee of userDefinedFees) {
      if (!fee.enabled) continue

      let shouldApply = false
      const triggerType = fee.trigger_type || 'always'

      switch (triggerType) {
        case 'always':
          shouldApply = true
          break
        case 'manual':
          shouldApply = selectedFeeIds.includes(fee.id)
          break
        case 'min_nights':
          shouldApply = numNights >= (fee.trigger_conditions?.min_nights ?? 0)
          break
        case 'min_guests':
          shouldApply = totalGuests >= (fee.trigger_conditions?.min_guests ?? 0)
          break
        case 'has_pets':
          shouldApply = (numPets || 0) > 0
          break
        case 'date_range':
          if (checkInDate) {
            const check = new Date(checkInDate)
            const start = fee.trigger_conditions?.start_date ? new Date(fee.trigger_conditions.start_date) : null
            const end = fee.trigger_conditions?.end_date ? new Date(fee.trigger_conditions.end_date) : null
            shouldApply = (!start || check >= start) && (!end || check <= end)
          }
          break
      }

      if (!shouldApply) continue

      let feeAmount = 0
      switch (fee.fee_type) {
        case 'flat_amount':
          feeAmount = (fee.value_cents ?? 0) / 100
          break
        case 'percentage_of_subtotal':
          feeAmount = subtotal * (fee.value_percentage ?? 0) / 100
          break
        case 'percentage_of_total':
          feeAmount = subtotal * (fee.value_percentage ?? 0) / 100
          break
        case 'per_night':
          feeAmount = ((fee.value_cents ?? 0) / 100) * numNights
          break
        case 'per_guest':
          feeAmount = ((fee.value_cents ?? 0) / 100) * totalGuests
          break
        case 'per_guest_per_night':
          feeAmount = ((fee.value_cents ?? 0) / 100) * totalGuests * numNights
          break
      }

      if (feeAmount > 0) {
        calculatedFees.push({
          id: fee.id,
          title: fee.title,
          amount: feeAmount,
          is_taxable: fee.is_taxable,
        })
      }
    }
  } else {
    const extraGuestThreshold = pricingConfig.extra_guest_threshold ?? 2
    const extraGuestFeeCents = pricingConfig.extra_guest_fee_cents ?? 0
    if (pricingConfig.extra_guest_fee_enabled && totalGuests > extraGuestThreshold && extraGuestFeeCents > 0) {
      const extraGuests = totalGuests - extraGuestThreshold
      const extraGuestFee = extraGuests * extraGuestFeeCents * numNights / 100
      calculatedFees.push({
        id: 'legacy-extra-guest',
        title: `Extra Guest Fee (${extraGuests} guests)`,
        amount: extraGuestFee,
        is_taxable: true,
      })
    }

    if ((numPets || 0) > 0 && pricingConfig.pet_fee_cents) {
      calculatedFees.push({
        id: 'legacy-pet',
        title: `Pet Fee (${numPets} ${numPets === 1 ? 'pet' : 'pets'})`,
        amount: pricingConfig.pet_fee_cents / 100,
        is_taxable: true,
      })
    }

    if (pricingConfig.default_cleaning_fee_cents) {
      calculatedFees.push({
        id: 'legacy-cleaning',
        title: 'Cleaning Fee',
        amount: pricingConfig.default_cleaning_fee_cents / 100,
        is_taxable: true,
      })
    }

    if (pricingConfig.service_fee_type === 'percentage' && pricingConfig.service_fee_percentage) {
      const serviceFee = subtotal * (pricingConfig.service_fee_percentage / 100)
      calculatedFees.push({
        id: 'legacy-service',
        title: `Service Fee (${pricingConfig.service_fee_percentage}%)`,
        amount: serviceFee,
        is_taxable: true,
      })
    } else if (pricingConfig.service_fee_type === 'flat' && pricingConfig.service_fee_amount_cents) {
      calculatedFees.push({
        id: 'legacy-service',
        title: 'Service Fee',
        amount: pricingConfig.service_fee_amount_cents / 100,
        is_taxable: true,
      })
    } else if (pricingConfig.service_fee_type === 'per_night' && pricingConfig.service_fee_amount_cents) {
      calculatedFees.push({
        id: 'legacy-service',
        title: `Service Fee (${numNights} nights)`,
        amount: (pricingConfig.service_fee_amount_cents / 100) * numNights,
        is_taxable: true,
      })
    }
  }

  // =====================================================
  // User-Defined Discounts Calculation
  // =====================================================
  const calculatedDiscounts: CalculatedDiscount[] = []
  const userDefinedDiscounts = rateDiscountsConfig.user_defined_discounts || []
  const hasUserDefinedDiscounts = userDefinedDiscounts.length > 0

  const isDateInRange = (checkDate: string | undefined, startDate: string | undefined, endDate: string | undefined): boolean => {
    if (!checkDate) return false
    const check = new Date(checkDate)
    if (startDate && check < new Date(startDate)) return false
    if (endDate && check > new Date(endDate)) return false
    return true
  }

  if (hasUserDefinedDiscounts) {
    for (const discount of userDefinedDiscounts) {
      if (!discount.enabled) continue

      let shouldApply = false

      if (discount.trigger_type === 'manual') {
        shouldApply = selectedDiscountIds.includes(discount.id)
      } else {
        switch (discount.trigger_type) {
          case 'min_nights':
            shouldApply = numNights >= (discount.trigger_conditions?.min_nights ?? 0)
            break
          case 'min_guests':
            shouldApply = totalGuests >= (discount.trigger_conditions?.min_guests ?? 0)
            break
          case 'date_range':
            shouldApply = isDateInRange(
              checkInDate,
              discount.trigger_conditions?.start_date,
              discount.trigger_conditions?.end_date
            )
            break
        }
      }

      if (!shouldApply) continue

      let discountAmount = 0
      switch (discount.discount_type) {
        case 'flat_amount':
          discountAmount = (discount.value_cents ?? 0) / 100
          break
        case 'percentage_of_subtotal':
          discountAmount = subtotal * (discount.value_percentage ?? 0) / 100
          break
        case 'percentage_of_total':
          discountAmount = subtotal * (discount.value_percentage ?? 0) / 100
          break
      }

      if (discount.max_discount_cents && discountAmount > discount.max_discount_cents / 100) {
        discountAmount = discount.max_discount_cents / 100
      }

      if (discountAmount > 0) {
        calculatedDiscounts.push({
          id: discount.id,
          title: discount.title,
          amount: discountAmount,
          trigger_type: discount.trigger_type,
        })
      }
    }
  } else {
    const monthlyEnabled = rateDiscountsConfig.monthly_discount_enabled ?? false
    const monthlyMinNights = rateDiscountsConfig.monthly_minimum_nights ?? 28
    const monthlyPercentage = rateDiscountsConfig.monthly_discount_percentage ?? 0
    const weeklyEnabled = rateDiscountsConfig.weekly_discount_enabled ?? false
    const weeklyMinNights = rateDiscountsConfig.weekly_minimum_nights ?? 7
    const weeklyPercentage = rateDiscountsConfig.weekly_discount_percentage ?? 0

    if (monthlyEnabled && numNights >= monthlyMinNights && monthlyPercentage > 0) {
      calculatedDiscounts.push({
        id: 'legacy-monthly',
        title: `${monthlyPercentage}% Monthly Discount`,
        amount: subtotal * (monthlyPercentage / 100),
        trigger_type: 'min_nights',
      })
    } else if (weeklyEnabled && numNights >= weeklyMinNights && weeklyPercentage > 0) {
      calculatedDiscounts.push({
        id: 'legacy-weekly',
        title: `${weeklyPercentage}% Weekly Discount`,
        amount: subtotal * (weeklyPercentage / 100),
        trigger_type: 'min_nights',
      })
    }
  }

  // =====================================================
  // Final Calculations
  // =====================================================

  const totalDiscountAmount = calculatedDiscounts.reduce((sum, d) => sum + d.amount, 0)
  const discountedSubtotal = subtotal - totalDiscountAmount

  const totalFees = calculatedFees.reduce((sum, f) => sum + f.amount, 0)
  const taxableFees = calculatedFees
    .filter(f => f.is_taxable)
    .reduce((sum, f) => sum + f.amount, 0)

  const subtotalBeforeTax = discountedSubtotal + totalFees

  const taxableAmount = discountedSubtotal + taxableFees
  const taxAmount = taxableAmount * pricingConfig.tax_rate
  const taxLabel = `${pricingConfig.tax_name} (${(pricingConfig.tax_rate * 100).toFixed(2)}%)`

  const total = subtotalBeforeTax + taxAmount
  onTotalChange?.(Math.round(total * 100))
  const paidAmountValue = Number.parseFloat(paidAmount ?? "")
  const safePaidAmount = Number.isFinite(paidAmountValue) && paidAmountValue > 0 ? paidAmountValue : 0
  const guestCreditDollars =
    typeof guestCreditAppliedCents === 'number' && guestCreditAppliedCents > 0
      ? guestCreditAppliedCents / 100
      : 0
  const totalPaidTowardReservation = guestCreditDollars + safePaidAmount
  const changeAmount = totalPaidTowardReservation > total ? totalPaidTowardReservation - total : 0

  const totalCents = Math.round(total * 100)

  // Deposit calculation (if applicable)
  let depositAmountCents = 0
  let depositLabel = ''
  const depositApplies =
    depositConfig?.require_deposit &&
    depositConfig.applies_to_booking_types?.includes(effectiveStayType)

  if (depositApplies && depositConfig) {
    if (depositConfig.deposit_type === 'percentage' && depositConfig.deposit_percentage) {
      depositAmountCents = Math.round(
        (totalCents * depositConfig.deposit_percentage) / 100,
      )
      depositLabel = `Deposit (${depositConfig.deposit_percentage}%)`
    } else if (depositConfig.deposit_type === 'flat_amount' && depositConfig.deposit_amount_cents) {
      depositAmountCents = depositConfig.deposit_amount_cents
      depositLabel = 'Deposit'
    } else if (depositConfig.deposit_type === 'first_night') {
      depositAmountCents = Math.round(
        (basePricePerNight + basePricePerNight * pricingConfig.tax_rate) * 100,
      )
      depositLabel = 'Deposit (First Night)'
    }
  }

  const depositAmount = depositAmountCents / 100
  const exemptIfPaidInFull = depositConfig?.exempt_if_paid_in_full ?? true
  const showPaymentOption =
    Boolean(depositApplies) &&
    depositAmountCents > 0 &&
    depositAmountCents < totalCents &&
    exemptIfPaidInFull

  const amountDueTodayCents = showPaymentOption
    ? paymentOption === 'deposit'
      ? depositAmountCents
      : totalCents
    : depositApplies && depositAmountCents > 0 && depositAmountCents < totalCents
      ? depositAmountCents
      : totalCents

  const amountDueLaterCents =
    showPaymentOption && paymentOption === 'deposit'
      ? totalCents - depositAmountCents
      : 0

  useEffect(() => {
    if (!showPaymentOption && paymentOptionProp === undefined && internalPaymentOption !== 'full') {
      setInternalPaymentOption('full')
      onPaymentOptionChange?.('full')
    }
  }, [showPaymentOption, paymentOptionProp, internalPaymentOption, onPaymentOptionChange])

  useEffect(() => {
    onAmountDueTodayChange?.(amountDueTodayCents)
  }, [amountDueTodayCents, onAmountDueTodayChange])

  return (
    <div className="lg:sticky lg:top-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pricing Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Site info */}
          <div>
            <p className="font-medium">{selectedSite.name}</p>
            <p className="text-sm text-muted-foreground">
              Site #{selectedSite.site_number}
            </p>
          </div>

          <Separator />

          {/* Base price breakdown (weekly/monthly/nightly) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{basePriceLabel}</span>
              <span className="font-medium">{formatMoney(subtotal)}</span>
            </div>

            {calculatedDiscounts.map((discount) => (
              <div key={discount.id} className="flex items-center justify-between text-sm text-green-600">
                <div className="flex items-center gap-2">
                  <span>{discount.title}</span>
                  {discount.trigger_type !== 'manual' && (
                    <Badge variant="secondary" className="text-xs">
                      Auto
                    </Badge>
                  )}
                </div>
                <span className="font-medium">-{formatMoney(discount.amount)}</span>
              </div>
            ))}

            {calculatedFees.map((fee) => (
              <div key={fee.id} className="flex items-center justify-between text-sm">
                <span>{fee.title}</span>
                <span>{formatMoney(fee.amount)}</span>
              </div>
            ))}
          </div>

          <Separator />

          {/* Tax */}
          <div className="flex items-center justify-between text-sm">
            <span>{taxLabel}</span>
            <span>{formatMoney(taxAmount)}</span>
          </div>

          <Separator />

          {/* Total */}
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold">Total</span>
            <span className="text-2xl font-bold text-primary">{formatMoney(total)}</span>
          </div>

          {guestCreditDollars > 0 && (
            <>
              <Separator />
              <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Guest credit applied</span>
                  <span className="font-semibold tabular-nums text-primary">
                    {formatMoney(guestCreditDollars)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Remaining before cash/card payment</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatMoney(Math.max(0, total - guestCreditDollars))}
                  </span>
                </div>
              </div>
            </>
          )}

          {(safePaidAmount > 0 || changeAmount > 0) && (
            <>
              <Separator />
              <div className="space-y-2">
                {safePaidAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span>Amount paid (cash/card)</span>
                    <span className="font-medium">{formatMoney(safePaidAmount)}</span>
                  </div>
                )}
                {changeAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span>Change</span>
                    <span className="font-semibold text-green-600">{formatMoney(changeAmount)}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {showPaymentOption && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Payment Option</p>
                <RadioGroup
                  value={paymentOption}
                  onValueChange={(value) =>
                    handlePaymentOptionChange(value as PricingSummaryPaymentOption)
                  }
                  className="grid grid-cols-1 gap-2"
                >
                  <label
                    htmlFor={`${paymentOptionId}-deposit`}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                      paymentOption === 'deposit'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/40',
                    )}
                  >
                    <RadioGroupItem
                      value="deposit"
                      id={`${paymentOptionId}-deposit`}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Deposit</p>
                      <p className="text-xs text-muted-foreground">
                        Pay {formatMoney(depositAmount)} now,{' '}
                        {formatMoney(total - depositAmount)} due later
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-primary">
                      {formatMoney(depositAmount)}
                    </span>
                  </label>
                  <label
                    htmlFor={`${paymentOptionId}-full`}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                      paymentOption === 'full'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/40',
                    )}
                  >
                    <RadioGroupItem
                      value="full"
                      id={`${paymentOptionId}-full`}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Pay in Full</p>
                      <p className="text-xs text-muted-foreground">
                        Collect the full reservation total now
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-primary">
                      {formatMoney(total)}
                    </span>
                  </label>
                </RadioGroup>
                {depositConfig?.full_payment_required_days_before && paymentOption === 'deposit' && (
                  <p className="text-xs text-muted-foreground">
                    Full payment due {depositConfig.full_payment_required_days_before} days before check-in
                  </p>
                )}
              </div>
            </>
          )}

          {(showPaymentOption || (depositApplies && depositAmountCents > 0 && !showPaymentOption)) && (
            <>
              <Separator />
              <div className="flex items-center justify-between text-base font-bold">
                <span>{showPaymentOption ? 'Amount Due Now' : 'Due at Booking'}</span>
                <span className="text-primary">{formatMoney(amountDueTodayCents / 100)}</span>
              </div>
              {amountDueLaterCents > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Remaining Balance</span>
                  <span>{formatMoney(amountDueLaterCents / 100)}</span>
                </div>
              )}
              {!showPaymentOption && depositApplies && depositLabel && (
                <p className="text-xs text-muted-foreground">{depositLabel}</p>
              )}
            </>
          )}

          {/* Guest summary */}
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center justify-between">
              <span>Guests</span>
              <span>
                {numAdults} {numAdults === 1 ? 'adult' : 'adults'}
                {numChildren > 0 && `, ${numChildren} ${numChildren === 1 ? 'child' : 'children'}`}
              </span>
            </div>
            {numPets > 0 && (
              <div className="flex items-center justify-between">
                <span>Pets</span>
                <span>{numPets}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
