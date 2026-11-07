import { describe, test, expect } from 'vitest'
import {
  mergePaymentProcessorColumnWithGuestMethods,
  normalizePaymentMethodsOrder,
  resolveEnabledPaymentMethodsFromProperty,
} from './types'
import { resolvePaymentProcessor } from './resolution'

describe('normalizePaymentMethodsOrder', () => {
  test('orders methods as Cards then Amazon Pay then Cash App Pay regardless of input order', () => {
    expect(normalizePaymentMethodsOrder(['cashapp', 'amazon_pay', 'card'])).toEqual([
      'card',
      'amazon_pay',
      'cashapp',
    ])
  })
})

describe('mergePaymentProcessorColumnWithGuestMethods', () => {
  // `stripe` is a processor id (see KNOWN_PAYMENT_PROCESSORS), not a guest
  // method, so it is preserved like campost_payments. These cases previously
  // expected it to be dropped; that would make resolvePaymentProcessor pick a
  // different processor purely as a side effect of saving guest checkboxes.
  test('replaces guest-method slots and preserves non-guest processor ids after guest methods', () => {
    expect(
      mergePaymentProcessorColumnWithGuestMethods(['stripe', 'campost_payments'], [
        'card',
        'amazon_pay',
      ]),
    ).toEqual(['card', 'amazon_pay', 'stripe', 'campost_payments'])
  })

  test('writes card and amazon_pay while keeping the stripe processor id', () => {
    expect(
      mergePaymentProcessorColumnWithGuestMethods(['stripe'], ['card', 'amazon_pay']),
    ).toEqual(['card', 'amazon_pay', 'stripe'])
  })

  test('leaves the resolved processor unchanged', () => {
    // The invariant that matters: writing guest methods must not change which
    // processor the property resolves to.
    const before = ['stripe', 'campost_payments']
    const after = mergePaymentProcessorColumnWithGuestMethods(before, ['card', 'amazon_pay'])

    expect(resolvePaymentProcessor(after)).toBe(resolvePaymentProcessor(before))
  })

  test('preserves relative order of multiple non-guest processor ids', () => {
    expect(
      mergePaymentProcessorColumnWithGuestMethods(['campost_payments', 'stripe'], ['card']),
    ).toEqual(['card', 'campost_payments', 'stripe'])
  })
})

describe('resolveEnabledPaymentMethodsFromProperty', () => {
  test('reads from settings when present', () => {
    expect(
      resolveEnabledPaymentMethodsFromProperty(
        { enabled_payment_methods: ['amazon_pay', 'card'] },
        ['stripe'],
      ),
    ).toEqual(['card', 'amazon_pay'])
  })

  test('falls back to payment_processor column when settings key is missing', () => {
    expect(
      resolveEnabledPaymentMethodsFromProperty(undefined, ['card', 'amazon_pay']),
    ).toEqual(['card', 'amazon_pay'])
  })
})
