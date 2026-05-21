/**
 * Tests for Template Personalization
 *
 * Unit tests for personalization helpers: variable validation,
 * template rendering, data building, and SMS length checks.
 */

import { describe, test, expect } from 'vitest'
import {
  personalizeMessage,
  validateTemplateVariables,
  buildPersonalizationData,
  SUPPORTED_VARIABLES,
} from './personalization'

// ============================================================================
// personalizeMessage
// ============================================================================

describe('personalizeMessage', () => {
  test('replaces {{guest_first_name}} with actual value', () => {
    const result = personalizeMessage(
      'Hello {{guest_first_name}}, welcome!',
      { guest_first_name: 'Alice' },
    )
    expect(result).toBe('Hello Alice, welcome!')
  })

  test('replaces multiple variables in one template', () => {
    const result = personalizeMessage(
      'Hi {{guest_first_name}} {{guest_last_name}}, your booking on {{booking_date}} is confirmed.',
      {
        guest_first_name: 'Bob',
        guest_last_name: 'Smith',
        booking_date: 'May 21, 2026',
      },
    )
    expect(result).toBe('Hi Bob Smith, your booking on May 21, 2026 is confirmed.')
  })

  test('leaves unknown variables as-is', () => {
    const result = personalizeMessage(
      'Hello {{unknown_var}}, welcome!',
      { guest_first_name: 'Alice' },
    )
    expect(result).toBe('Hello {{unknown_var}}, welcome!')
  })

  test('handles empty template (returns empty string)', () => {
    const result = personalizeMessage('', { guest_first_name: 'Alice' })
    expect(result).toBe('')
  })

  test('handles no variables in template (returns as-is)', () => {
    const template = 'No variables here, just plain text.'
    const result = personalizeMessage(template, { guest_first_name: 'Alice' })
    expect(result).toBe(template)
  })
})

// ============================================================================
// validateTemplateVariables
// ============================================================================

describe('validateTemplateVariables', () => {
  test('rejects unsupported variables like {{invalid_var}}', () => {
    const result = validateTemplateVariables('Hello {{invalid_var}}')
    expect(result.valid).toBe(false)
    expect(result.unsupported).toContain('invalid_var')
  })

  test('accepts all supported variables', () => {
    const template = SUPPORTED_VARIABLES
      .map((v) => `{{${v}}}`)
      .join(' ')
    const result = validateTemplateVariables(template)
    expect(result.valid).toBe(true)
    expect(result.unsupported).toEqual([])
  })

  test('returns empty unsupported array for text with no variables', () => {
    const result = validateTemplateVariables('Plain text, no variables.')
    expect(result.valid).toBe(true)
    expect(result.unsupported).toEqual([])
  })
})

// ============================================================================
// buildPersonalizationData
// ============================================================================

describe('buildPersonalizationData', () => {
  test('builds correct map from guest data', () => {
    const guest = {
      first_name: 'Alice',
      last_name: 'Smith',
      email: 'alice@example.com',
      phone: '+1234567890',
    }
    const result = buildPersonalizationData(guest)

    expect(result.guest_first_name).toBe('Alice')
    expect(result.guest_last_name).toBe('Smith')
    expect(result.guest_email).toBe('alice@example.com')
    expect(result.guest_phone).toBe('+1234567890')
  })

  test('includes booking data when provided', () => {
    const guest = { first_name: 'Bob', last_name: 'Jones', email: 'bob@test.com', phone: '' }
    const booking = {
      created_at: '2026-01-15T10:00:00Z',
      check_in_date: '2026-06-01T14:00:00Z',
      check_out_date: '2026-06-05T11:00:00Z',
    }

    const result = buildPersonalizationData(guest, booking)

    expect(result.booking_date).toBeTruthy()
    expect(result.check_in_date).toBeTruthy()
    expect(result.check_out_date).toBeTruthy()
    // Verify the dates are formatted as human-readable strings
    expect(result.check_in_date).toContain('2026')
  })

  test('includes location from property when provided', () => {
    const guest = { first_name: 'Eve', last_name: 'Doe', email: 'eve@test.com', phone: '' }
    const property = { name: 'Lakeside Cabin', address: '123 Lake Rd' }

    const result = buildPersonalizationData(guest, null, property)

    expect(result.location).toBe('Lakeside Cabin')
  })

  test('handles missing guest fields gracefully', () => {
    const guest = {}
    const result = buildPersonalizationData(guest)

    expect(result.guest_first_name).toBe('')
    expect(result.guest_last_name).toBe('')
    expect(result.guest_email).toBe('')
    expect(result.guest_phone).toBe('')
  })
})

// ============================================================================
// SMS Length Check
// ============================================================================

describe('SMS length check', () => {
  test('warns when personalized body exceeds 160 characters', () => {
    // Build a message that is exactly over 160 chars after personalization
    const longName = 'A'.repeat(150)
    const template = `Hello {{guest_first_name}}, this is a test message that should exceed one hundred and sixty characters.`
    const personalized = personalizeMessage(template, { guest_first_name: longName })

    expect(personalized.length).toBeGreaterThan(160)
  })

  test('short personalized body stays under 160 characters', () => {
    const template = 'Hi {{guest_first_name}}, your code is 1234.'
    const personalized = personalizeMessage(template, { guest_first_name: 'Al' })

    expect(personalized.length).toBeLessThanOrEqual(160)
  })
})
