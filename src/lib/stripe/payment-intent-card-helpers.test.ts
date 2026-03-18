import { describe, expect, test } from 'vitest'
import type Stripe from 'stripe'
import {
  cardDisplayFromStripeCharge,
  extractPaymentIntentIdFromNotes,
  formatPaymentCardBrand,
  resolvePaymentIntentIdForReservation,
} from './payment-intent-card-helpers'

describe('extractPaymentIntentIdFromNotes', () => {
  test('returns id from Stripe PaymentIntent line', () => {
    expect(
      extractPaymentIntentIdFromNotes('Paid\nStripe PaymentIntent: pi_abc123xyz')
    ).toBe('pi_abc123xyz')
  })

  test('returns id from PaymentIntent line', () => {
    expect(extractPaymentIntentIdFromNotes('PaymentIntent: pi_test_01')).toBe('pi_test_01')
  })

  test('returns null when no match', () => {
    expect(extractPaymentIntentIdFromNotes('no id here')).toBeNull()
    expect(extractPaymentIntentIdFromNotes(null)).toBeNull()
  })
})

describe('resolvePaymentIntentIdForReservation', () => {
  test('prefers stripe_payment_id row when valid', () => {
    expect(
      resolvePaymentIntentIdForReservation('pi_from_row', 'PaymentIntent: pi_from_notes')
    ).toBe('pi_from_row')
  })

  test('falls back to notes when row missing', () => {
    expect(resolvePaymentIntentIdForReservation(null, 'Stripe PaymentIntent: pi_notes')).toBe(
      'pi_notes'
    )
  })

  test('returns null when row invalid and notes empty', () => {
    expect(resolvePaymentIntentIdForReservation('not_a_pi', null)).toBeNull()
  })
})

describe('cardDisplayFromStripeCharge', () => {
  test('returns last4 brand and exp from card details', () => {
    const charge = {
      payment_method_details: {
        card: {
          brand: 'visa',
          last4: '4242',
          exp_month: 12,
          exp_year: 2030,
        },
      },
    } as unknown as Stripe.Charge

    expect(cardDisplayFromStripeCharge(charge)).toEqual({
      brand: 'visa',
      last4: '4242',
      exp_month: 12,
      exp_year: 2030,
    })
  })

  test('returns null when charge is string id', () => {
    expect(cardDisplayFromStripeCharge('ch_123')).toBeNull()
  })

  test('returns null when no card last4', () => {
    expect(
      cardDisplayFromStripeCharge({
        payment_method_details: {},
      } as Stripe.Charge)
    ).toBeNull()
  })
})

describe('formatPaymentCardBrand', () => {
  test('maps common brands', () => {
    expect(formatPaymentCardBrand('visa')).toBe('Visa')
    expect(formatPaymentCardBrand('mastercard')).toBe('Mastercard')
    expect(formatPaymentCardBrand('amex')).toBe('Amex')
  })
})
