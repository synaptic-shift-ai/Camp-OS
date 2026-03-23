import { describe, expect, test } from 'vitest'
import {
  buildGuestCancellationPolicyData,
  formatGuestCancellationRulesLines,
  GUEST_CANCELLATION_POLICY_FALLBACK,
  guestHasStructuredCancellationRules,
  parseCancellationPolicyDisplayBlocks,
} from './guest-cancellation-policy'

describe('buildGuestCancellationPolicyData', () => {
  test('uses cancellation_policy column when set', () => {
    const result = buildGuestCancellationPolicyData({
      cancellation_policy: '  Column text  ',
      cancellation_policy_config: null,
      settings: { cancellationPolicy: 'Settings text' },
    })
    expect(result.policy_display_text).toBe('Column text')
  })

  test('falls back to settings cancellationPolicy when column empty', () => {
    const result = buildGuestCancellationPolicyData({
      cancellation_policy: '   ',
      cancellation_policy_config: null,
      settings: { cancellationPolicy: 'From settings' },
    })
    expect(result.policy_display_text).toBe('From settings')
  })

  test('uses fallback when column and settings text are empty', () => {
    const result = buildGuestCancellationPolicyData({
      cancellation_policy: null,
      cancellation_policy_config: null,
      settings: {},
    })
    expect(result.policy_display_text).toBe(GUEST_CANCELLATION_POLICY_FALLBACK)
  })

  test('parses refund_tiers from cancellation_policy_config', () => {
    const result = buildGuestCancellationPolicyData({
      cancellation_policy: null,
      cancellation_policy_config: {
        refund_tiers: [
          { refund_percentage: 50, days_before_reservation: 7 },
          { refund_percentage: 'bad' as unknown as number, days_before_reservation: 1 },
        ],
      },
      settings: {},
    })
    expect(result.refund_tiers).toEqual([{ refund_percentage: 50, days_before_reservation: 7 }])
  })
})

describe('guestHasStructuredCancellationRules', () => {
  test('returns true when refund tiers exist', () => {
    expect(
      guestHasStructuredCancellationRules({
        policy_display_text: 'x',
        refund_tiers: [{ refund_percentage: 100, days_before_reservation: 14 }],
      })
    ).toBe(true)
  })

  test('returns false when only policy text exists', () => {
    expect(
      guestHasStructuredCancellationRules({
        policy_display_text: 'x',
        refund_tiers: [],
      })
    ).toBe(false)
  })
})

describe('parseCancellationPolicyDisplayBlocks', () => {
  test('returns full text as intro when there are no bullet separators', () => {
    const { intro, bullets, footer } = parseCancellationPolicyDisplayBlocks('One paragraph only.')
    expect(intro).toBe('One paragraph only.')
    expect(bullets).toEqual([])
    expect(footer).toBeNull()
  })

  test('splits on bullet character into intro and bullet lines', () => {
    const raw =
      'Guests may cancel: ● 100% if 7+ days ● 50% if 3+ days ● No refund under 2 days.'
    const { intro, bullets, footer } = parseCancellationPolicyDisplayBlocks(raw)
    expect(intro).toBe('Guests may cancel:')
    expect(bullets).toEqual([
      '100% if 7+ days',
      '50% if 3+ days',
      'No refund under 2 days.',
    ])
    expect(footer).toBeNull()
  })

  test('moves trailing "All cancellation requests…" out of the last bullet for full-width alignment', () => {
    const raw =
      'Guests may cancel under the following terms: ● 100% Refund: Full if 7+ days. ● 50% Refund: Half if 3+ days. ● No Refund: None under 2 days. All cancellation requests must be submitted prior to deadlines.'
    const { intro, bullets, footer } = parseCancellationPolicyDisplayBlocks(raw)
    expect(intro).toBe('Guests may cancel under the following terms:')
    expect(bullets).toEqual([
      '100% Refund: Full if 7+ days.',
      '50% Refund: Half if 3+ days.',
      'No Refund: None under 2 days.',
    ])
    expect(footer).toBe(
      'All cancellation requests must be submitted prior to deadlines.'
    )
  })
})

describe('formatGuestCancellationRulesLines', () => {
  test('formats tiers sorted by days before check-in descending', () => {
    const lines = formatGuestCancellationRulesLines({
      policy_display_text: 'x',
      refund_tiers: [
        { refund_percentage: 50, days_before_reservation: 3 },
        { refund_percentage: 100, days_before_reservation: 14 },
      ],
    })
    expect(lines[0]).toContain('14')
    expect(lines[1]).toContain('3')
  })
})
