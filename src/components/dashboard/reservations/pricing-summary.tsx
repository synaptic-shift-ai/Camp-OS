'use client'

/**
 * Pricing Summary Component
 *
 * Sticky sidebar that displays real-time pricing breakdown for manual reservations.
 * Calculates all fees, discounts, and taxes based on property configuration.
 *
 * Supports both user-defined fees/discounts and legacy fields for backward compatibility.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DollarSign, Info } from 'lucide-react'
import type { PricingConfig, RateDiscountsConfig, DepositConfig, BookingType } from '@/lib/config/types'

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
  onTotalChange?: (totalCents: number) => void
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

export function PricingSummary({
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
  onTotalChange,
}: PricingSummaryProps) {
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  // If no site selected or no config, show placeholder
  if (!selectedSite || !pricingConfig || !rateDiscountsConfig) {
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

  // Effective stay type (match page: weekly requires 7+ nights, monthly 28+)
  const STAY_TYPE_MIN_NIGHTS: Record<BookingType, number> = {
    nightly: 1,
    weekly: 7,
    monthly: 28,
    seasonal: 28,
    long_term: 28,
  }
  const effectiveStayType: BookingType =
    stayType === 'monthly' && numNights >= STAY_TYPE_MIN_NIGHTS.monthly
      ? 'monthly'
      : (stayType === 'monthly' || stayType === 'weekly') && numNights >= STAY_TYPE_MIN_NIGHTS.weekly
        ? 'weekly'
        : 'nightly'

  // Base subtotal and display label from effective stay type (match accordion and blue bar)
  let subtotal: number
  let basePriceLabel: string
  const nightlyRateDollars = selectedSite.base_price_per_night / 100
  switch (effectiveStayType) {
    case 'weekly': {
      const weeklyCents = selectedSite.weekly_rate_cents ?? selectedSite.base_price_per_night * 7
      subtotal = (weeklyCents / 100) * (numNights / 7)
      basePriceLabel = `${formatMoney(weeklyCents / 100)}/week × ${numNights} night${numNights !== 1 ? 's' : ''}`
      break
    }
    case 'monthly': {
      const monthlyCents = selectedSite.monthly_rate_cents ?? selectedSite.base_price_per_night * 28
      subtotal = (monthlyCents / 100) * (numNights / 28)
      basePriceLabel = `${formatMoney(monthlyCents / 100)}/month × ${numNights} night${numNights !== 1 ? 's' : ''}`
      break
    }
    default: {
      subtotal = nightlyRateDollars * numNights
      basePriceLabel = `${formatMoney(nightlyRateDollars)} × ${numNights} night${numNights !== 1 ? 's' : ''}`
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
    // Use new user-defined fees
    for (const fee of userDefinedFees) {
      if (!fee.enabled) continue

      // Check trigger conditions
      let shouldApply = false
      const triggerType = fee.trigger_type || 'always' // Default to always for backward compatibility

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
          // Date range check - for now, just skip if no checkInDate
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
          // For percentage_of_total, we'll calculate after other fees are summed
          // For now, estimate based on subtotal
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
    // Fall back to legacy fees
    // Extra guest fees
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

    // Pet fees
    if ((numPets || 0) > 0 && pricingConfig.pet_fee_cents) {
      calculatedFees.push({
        id: 'legacy-pet',
        title: `Pet Fee (${numPets} ${numPets === 1 ? 'pet' : 'pets'})`,
        amount: pricingConfig.pet_fee_cents / 100,
        is_taxable: true,
      })
    }

    // Cleaning fee
    if (pricingConfig.default_cleaning_fee_cents) {
      calculatedFees.push({
        id: 'legacy-cleaning',
        title: 'Cleaning Fee',
        amount: pricingConfig.default_cleaning_fee_cents / 100,
        is_taxable: true,
      })
    }

    // Service fee
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

  // Helper function to check if date is in range
  const isDateInRange = (checkDate: string | undefined, startDate: string | undefined, endDate: string | undefined): boolean => {
    if (!checkDate) return false
    const check = new Date(checkDate)
    if (startDate && check < new Date(startDate)) return false
    if (endDate && check > new Date(endDate)) return false
    return true
  }

  if (hasUserDefinedDiscounts) {
    // Use new user-defined discounts
    for (const discount of userDefinedDiscounts) {
      if (!discount.enabled) continue

      // Check trigger conditions
      let shouldApply = false

      // Manual discounts are only applied if explicitly selected
      if (discount.trigger_type === 'manual') {
        shouldApply = selectedDiscountIds.includes(discount.id)
      } else {
        // Auto-triggered discounts
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
          // Estimate based on subtotal for now
          discountAmount = subtotal * (discount.value_percentage ?? 0) / 100
          break
      }

      // Apply max discount cap if set
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
    // Fall back to legacy discounts
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

  // Sum up discounts
  const totalDiscountAmount = calculatedDiscounts.reduce((sum, d) => sum + d.amount, 0)
  const discountedSubtotal = subtotal - totalDiscountAmount

  // Sum up fees (both taxable and non-taxable)
  const totalFees = calculatedFees.reduce((sum, f) => sum + f.amount, 0)
  const taxableFees = calculatedFees
    .filter(f => f.is_taxable)
    .reduce((sum, f) => sum + f.amount, 0)

  // Subtotal before tax
  const subtotalBeforeTax = discountedSubtotal + totalFees

  // Tax calculation (on discounted subtotal + taxable fees)
  const taxableAmount = discountedSubtotal + taxableFees
  const taxAmount = taxableAmount * pricingConfig.tax_rate
  const taxLabel = `${pricingConfig.tax_name} (${(pricingConfig.tax_rate * 100).toFixed(2)}%)`

  // Total
  const total = subtotalBeforeTax + taxAmount
  onTotalChange?.(Math.round(total * 100))

  // Deposit calculation (if applicable)
  let depositAmount = 0
  let depositLabel = ''
  if (depositConfig && depositConfig.require_deposit && depositConfig.applies_to_booking_types?.includes(stayType)) {
    if (depositConfig.deposit_type === 'percentage' && depositConfig.deposit_percentage) {
      depositAmount = total * (depositConfig.deposit_percentage / 100)
      depositLabel = `Deposit (${depositConfig.deposit_percentage}%)`
    } else if (depositConfig.deposit_type === 'flat_amount' && depositConfig.deposit_amount_cents) {
      depositAmount = depositConfig.deposit_amount_cents / 100
      depositLabel = 'Deposit'
    } else if (depositConfig.deposit_type === 'first_night') {
      depositAmount = (basePricePerNight + (basePricePerNight * pricingConfig.tax_rate))
      depositLabel = 'Deposit (First Night)'
    }
  }

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

            {/* Discounts */}
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

            {/* User-Defined Fees */}
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

          {/* Deposit info */}
          {depositAmount > 0 && (
            <>
              <Separator />
              <div className="bg-primary/5 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{depositLabel}</span>
                  <span className="font-bold">{formatMoney(depositAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Due at Booking</span>
                  <span>{formatMoney(depositAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Remaining Balance</span>
                  <span>{formatMoney(total - depositAmount)}</span>
                </div>
                {depositConfig?.full_payment_required_days_before && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Full payment due {depositConfig.full_payment_required_days_before} days before check-in
                  </p>
                )}
              </div>
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
