import { describe, test, expect } from 'vitest'
import {
  mergePaymentProcessorColumnWithGuestMethods,
  normalizePaymentMethodsOrder,
  resolveEnabledPaymentMethodsFromProperty,
} from './types'

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
  test('replaces guest-method slots and preserves non-guest processor ids after guest methods', () => {
    expect(
      mergePaymentProcessorColumnWithGuestMethods(['stripe', 'campost_payments'], [
        'card',
        'amazon_pay',
      ]),
    ).toEqual(['card', 'amazon_pay', 'campost_payments'])
  })

  test('writes card and amazon_pay when column was only default stripe', () => {
    expect(
      mergePaymentProcessorColumnWithGuestMethods(['stripe'], ['card', 'amazon_pay']),
    ).toEqual(['card', 'amazon_pay'])
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
