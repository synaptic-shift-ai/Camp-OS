'use client'

/**
 * Enhanced Payment Step Component
 *
 * Step 5 for manual bookings with full payment integration.
 * Supports multiple payment modes: cash/check, card (Stripe), and payment link.
 */

import { useState } from 'react'
import { useFormContext, Controller } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  CreditCard,
  Banknote,
  Mail,
  DollarSign,
  Info,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PriceBreakdown } from '@/lib/booking/types'

type PaymentMode = 'cash' | 'check' | 'card' | 'send_link'

interface PaymentStepProps {
  /** Calculated price breakdown */
  priceBreakdown: PriceBreakdown | null
  /** Whether pricing is loading */
  isLoadingPrice?: boolean
  /** Guest email for payment link */
  guestEmail?: string
  /** Callback when payment mode changes */
  onPaymentModeChange?: (mode: PaymentMode) => void
  /** Whether Stripe is connected for this property */
  stripeConnected?: boolean
  /** Optional CSS class name */
  className?: string
}

const PAYMENT_MODE_OPTIONS = [
  {
    value: 'cash' as PaymentMode,
    label: 'Cash/Check',
    description: 'Record manual payment',
    icon: Banknote,
  },
  {
    value: 'card' as PaymentMode,
    label: 'Process Card',
    description: 'Charge card now via Stripe',
    icon: CreditCard,
  },
  {
    value: 'send_link' as PaymentMode,
    label: 'Send Payment Link',
    description: 'Email payment link to guest',
    icon: Mail,
  },
]

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export function PaymentStep({
  priceBreakdown,
  isLoadingPrice = false,
  guestEmail,
  onPaymentModeChange,
  stripeConnected = true,
  className,
}: PaymentStepProps) {
  const { register, control, watch, setValue } = useFormContext()
  const paymentMode = watch('paymentMode') as PaymentMode

  const handlePaymentModeChange = (mode: PaymentMode) => {
    setValue('paymentMode', mode)
    onPaymentModeChange?.(mode)
  }

  // Calculate amounts
  const total = priceBreakdown?.total ?? 0
  const depositAmount = priceBreakdown?.deposit_amount ?? 0
  const depositRequired = priceBreakdown?.deposit_required ?? false
  const amountDueNow = priceBreakdown?.amount_due_now ?? total
  const amountDueLater = priceBreakdown?.amount_due_later ?? 0

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Payment Information
        </CardTitle>
        <CardDescription>
          Choose how you want to handle payment for this reservation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pricing Summary */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">Total Amount</span>
            {isLoadingPrice ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="text-lg font-semibold">{formatCurrency(total)}</span>
            )}
          </div>

          {depositRequired && (
            <>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span>Deposit Required</span>
                <span>{formatCurrency(depositAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Due Now</span>
                <span className="font-medium text-primary">
                  {formatCurrency(amountDueNow)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Due Later</span>
                <span>{formatCurrency(amountDueLater)}</span>
              </div>
            </>
          )}

          {/* Price Breakdown Details */}
          {priceBreakdown && (
            <div className="pt-2 space-y-1 text-xs text-muted-foreground">
              {priceBreakdown.base_price_per_night && priceBreakdown.number_of_nights && (
                <div className="flex justify-between">
                  <span>
                    {formatCurrency(priceBreakdown.base_price_per_night)} x{' '}
                    {priceBreakdown.number_of_nights} nights
                  </span>
                  <span>{formatCurrency(priceBreakdown.subtotal)}</span>
                </div>
              )}
              {priceBreakdown.user_fees?.map((fee) => (
                <div key={fee.id} className="flex justify-between">
                  <span>{fee.title}</span>
                  <span>{formatCurrency(fee.amount)}</span>
                </div>
              ))}
              {priceBreakdown.user_discounts?.map((discount) => (
                <div key={discount.id} className="flex justify-between text-green-600">
                  <span>{discount.title}</span>
                  <span>-{formatCurrency(discount.amount)}</span>
                </div>
              ))}
              {priceBreakdown.taxes && priceBreakdown.taxes > 0 && (
                <div className="flex justify-between">
                  <span>{priceBreakdown.tax_name || 'Tax'}</span>
                  <span>{formatCurrency(priceBreakdown.taxes)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Payment Mode Selection */}
        <div className="space-y-3">
          <Label>Payment Method</Label>
          <Controller
            name="paymentMode"
            control={control}
            defaultValue="cash"
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={(value: string) => handlePaymentModeChange(value as PaymentMode)}
                className="grid grid-cols-1 md:grid-cols-3 gap-3"
              >
                {PAYMENT_MODE_OPTIONS.map((option) => {
                  const isDisabled =
                    (option.value === 'card' || option.value === 'send_link') &&
                    !stripeConnected
                  const isSelected = field.value === option.value
                  const Icon = option.icon

                  return (
                    <div key={option.value}>
                      <RadioGroupItem
                        value={option.value}
                        id={`payment-mode-${option.value}`}
                        disabled={isDisabled}
                        className="sr-only"
                      />
                      <Label
                        htmlFor={`payment-mode-${option.value}`}
                        className={cn(
                          'flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-all',
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-muted hover:border-muted-foreground/30',
                          isDisabled && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-6 w-6 mb-2',
                            isSelected ? 'text-primary' : 'text-muted-foreground'
                          )}
                        />
                        <span className="font-medium text-sm">{option.label}</span>
                        <span className="text-xs text-muted-foreground text-center mt-1">
                          {option.description}
                        </span>
                      </Label>
                    </div>
                  )
                })}
              </RadioGroup>
            )}
          />

          {!stripeConnected && (
            <Alert variant="default" className="mt-2">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Card payments and payment links require Stripe to be connected.
                Go to Settings to connect your Stripe account.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Separator />

        {/* Cash/Check Mode */}
        {(paymentMode === 'cash' || paymentMode === 'check') && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Type</Label>
                <Controller
                  name="paymentMethod"
                  control={control}
                  defaultValue="cash"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                        <SelectItem value="credit_card">Credit Card (Manual)</SelectItem>
                        <SelectItem value="debit_card">Debit Card (Manual)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paidAmount">Amount Paid ($)</Label>
                <Input
                  id="paidAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...register('paidAmount')}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty if payment will be collected later
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Card Payment Mode */}
        {paymentMode === 'card' && stripeConnected && (
          <div className="space-y-4">
            <Alert>
              <CreditCard className="h-4 w-4" />
              <AlertDescription>
                <strong>Card payment will be processed at submission.</strong>
                <br />
                The guest&apos;s card will be charged {formatCurrency(amountDueNow)} when
                you submit the reservation.
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
              A Stripe payment form will appear after you click &quot;Create Reservation&quot;.
              You&apos;ll need the guest&apos;s card details to complete the payment.
            </p>
          </div>
        )}

        {/* Send Payment Link Mode */}
        {paymentMode === 'send_link' && stripeConnected && (
          <div className="space-y-4">
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                <strong>Payment link will be sent to:</strong>
                <br />
                {guestEmail || 'Guest email not provided'}
              </AlertDescription>
            </Alert>
            {!guestEmail && (
              <Alert variant="destructive">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Please enter the guest&apos;s email address in Step 3 to send a payment link.
                </AlertDescription>
              </Alert>
            )}
            <p className="text-sm text-muted-foreground">
              The reservation will be created as &quot;pending&quot; and the guest will receive
              an email with a secure link to complete payment.
            </p>
          </div>
        )}

        {/* Payment Notes */}
        <div className="space-y-2">
          <Label htmlFor="paymentNotes">Payment Notes (Internal)</Label>
          <Textarea
            id="paymentNotes"
            placeholder="Any notes about the payment (not visible to guest)..."
            rows={2}
            {...register('paymentNotes')}
          />
        </div>
      </CardContent>
    </Card>
  )
}
