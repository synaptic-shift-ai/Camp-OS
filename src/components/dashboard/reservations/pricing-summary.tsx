'use client'

/**
 * Pricing Summary Component
 *
 * Sticky sidebar that displays real-time pricing breakdown for manual reservations.
 * Calculates all fees, discounts, and taxes based on property configuration.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DollarSign, Info } from 'lucide-react'
import type { PricingConfig, RateDiscountsConfig, DepositConfig } from '@/lib/config/types'

interface AvailableSite {
  id: string
  name: string
  site_number: string
  base_price_per_night: number
}

interface PricingSummaryProps {
  selectedSite: AvailableSite | null
  numNights: number
  stayType: 'nightly' | 'weekly' | 'monthly' | 'seasonal'
  numAdults: number
  numChildren: number
  numPets: number
  pricingConfig: PricingConfig | null
  rateDiscountsConfig: RateDiscountsConfig | null
  depositConfig: DepositConfig | null
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
}: PricingSummaryProps) {
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

  // Calculate pricing breakdown (convert from cents to dollars)
  const basePricePerNight = selectedSite.base_price_per_night / 100
  let subtotal = basePricePerNight * numNights

  // Apply rate discounts based on stay type and nights
  let discountAmount = 0
  let discountLabel = ''

  if (rateDiscountsConfig.monthly_discount_enabled && numNights >= rateDiscountsConfig.monthly_minimum_nights) {
    discountAmount = subtotal * (rateDiscountsConfig.monthly_discount_percentage / 100)
    discountLabel = `${rateDiscountsConfig.monthly_discount_percentage}% Monthly Discount`
  } else if (rateDiscountsConfig.weekly_discount_enabled && numNights >= rateDiscountsConfig.weekly_minimum_nights) {
    discountAmount = subtotal * (rateDiscountsConfig.weekly_discount_percentage / 100)
    discountLabel = `${rateDiscountsConfig.weekly_discount_percentage}% Weekly Discount`
  }

  const discountedSubtotal = subtotal - discountAmount

  // Extra guest fees
  const totalGuests = numAdults + (numChildren || 0)
  let extraGuestFee = 0
  if (pricingConfig.extra_guest_fee_enabled && totalGuests > pricingConfig.extra_guest_threshold) {
    const extraGuests = totalGuests - pricingConfig.extra_guest_threshold
    extraGuestFee = extraGuests * pricingConfig.extra_guest_fee_cents * numNights / 100
  }

  // Pet fees
  const petFee = (numPets || 0) > 0 ? pricingConfig.pet_fee_cents / 100 : 0

  // Cleaning fee
  const cleaningFee = pricingConfig.default_cleaning_fee_cents ? pricingConfig.default_cleaning_fee_cents / 100 : 0

  // Service fee
  let serviceFee = 0
  let serviceFeeLabel = 'Service Fee'
  if (pricingConfig.service_fee_type === 'percentage' && pricingConfig.service_fee_percentage) {
    serviceFee = (discountedSubtotal + extraGuestFee + petFee + cleaningFee) * (pricingConfig.service_fee_percentage / 100)
    serviceFeeLabel = `Service Fee (${pricingConfig.service_fee_percentage}%)`
  } else if (pricingConfig.service_fee_type === 'flat' && pricingConfig.service_fee_amount_cents) {
    serviceFee = pricingConfig.service_fee_amount_cents / 100
    serviceFeeLabel = 'Service Fee'
  } else if (pricingConfig.service_fee_type === 'per_night' && pricingConfig.service_fee_amount_cents) {
    serviceFee = (pricingConfig.service_fee_amount_cents / 100) * numNights
    serviceFeeLabel = `Service Fee (${numNights} nights)`
  }

  // Subtotal before tax
  const subtotalBeforeTax = discountedSubtotal + extraGuestFee + petFee + cleaningFee + serviceFee

  // Tax
  const taxAmount = subtotalBeforeTax * pricingConfig.tax_rate
  const taxLabel = `${pricingConfig.tax_name} (${(pricingConfig.tax_rate * 100).toFixed(2)}%)`

  // Total
  const total = subtotalBeforeTax + taxAmount

  // Deposit calculation (if applicable)
  let depositAmount = 0
  let depositLabel = ''
  if (depositConfig && depositConfig.require_deposit && depositConfig.applies_to_booking_types.includes(stayType)) {
    if (depositConfig.deposit_type === 'percentage' && depositConfig.deposit_percentage) {
      depositAmount = total * (depositConfig.deposit_percentage / 100)
      depositLabel = `Deposit (${depositConfig.deposit_percentage}%)`
    } else if (depositConfig.deposit_type === 'flat_amount' && depositConfig.deposit_amount_cents) {
      depositAmount = depositConfig.deposit_amount_cents / 100
      depositLabel = 'Deposit'
    } else if (depositConfig.deposit_type === 'first_night') {
      // First night calculation would need more context, using simple estimate
      depositAmount = (basePricePerNight + (basePricePerNight * pricingConfig.tax_rate))
      depositLabel = 'Deposit (First Night)'
    }
  }

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount)
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

          {/* Nightly breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>
                {formatMoney(basePricePerNight)} × {numNights} {numNights === 1 ? 'night' : 'nights'}
              </span>
              <span className="font-medium">{formatMoney(subtotal)}</span>
            </div>

            {/* Discount */}
            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-sm text-green-600">
                <div className="flex items-center gap-2">
                  <span>{discountLabel}</span>
                  <Badge variant="secondary" className="text-xs">
                    {stayType}
                  </Badge>
                </div>
                <span className="font-medium">-{formatMoney(discountAmount)}</span>
              </div>
            )}

            {/* Extra guest fees */}
            {extraGuestFee > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span>
                  Extra Guest Fee ({totalGuests - pricingConfig.extra_guest_threshold} guests)
                </span>
                <span>{formatMoney(extraGuestFee)}</span>
              </div>
            )}

            {/* Pet fee */}
            {petFee > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span>Pet Fee ({numPets} {numPets === 1 ? 'pet' : 'pets'})</span>
                <span>{formatMoney(petFee)}</span>
              </div>
            )}

            {/* Cleaning fee */}
            {cleaningFee > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span>Cleaning Fee</span>
                <span>{formatMoney(cleaningFee)}</span>
              </div>
            )}

            {/* Service fee */}
            {serviceFee > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span>{serviceFeeLabel}</span>
                <span>{formatMoney(serviceFee)}</span>
              </div>
            )}
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
