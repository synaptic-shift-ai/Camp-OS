/**
 * Tests for Messaging Validation Schemas
 *
 * Unit tests for Zod schemas validating campaign, schedule,
 * one-off message, and template inputs.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  CreateCampaignSchema,
  PreviewCampaignSchema,
  ScheduleCampaignSchema,
  SendOneMessageSchema,
} from './schemas'

// ============================================================================
// Helpers
// ============================================================================

const validCampaignBase = {
  name: 'Summer Promo',
  channel: 'email' as const,
  body: 'Check out our summer deals!',
  subject: 'Summer Sale',
}

// ============================================================================
// CreateCampaignSchema
// ============================================================================

describe('CreateCampaignSchema', () => {
  test('rejects missing name', () => {
    const { name, ...noName } = validCampaignBase
    const result = CreateCampaignSchema.safeParse(noName)
    expect(result.success).toBe(false)
  })

  test('rejects missing channel', () => {
    const { channel, ...noChannel } = validCampaignBase
    const result = CreateCampaignSchema.safeParse(noChannel)
    expect(result.success).toBe(false)
  })

  test('rejects missing body', () => {
    const { body, ...noBody } = validCampaignBase
    const result = CreateCampaignSchema.safeParse(noBody)
    expect(result.success).toBe(false)
  })

  test('rejects invalid channel value', () => {
    const result = CreateCampaignSchema.safeParse({
      ...validCampaignBase,
      channel: 'carrier_pigeon',
    })
    expect(result.success).toBe(false)
  })

  test('rejects email campaign without subject (refine logic)', () => {
    const result = CreateCampaignSchema.safeParse({
      ...validCampaignBase,
      channel: 'email',
      subject: '',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const subjectIssue = result.error.issues.find((i) =>
        i.path.includes('subject'),
      )
      expect(subjectIssue).toBeDefined()
    }
  })

  test('accepts valid email campaign with subject', () => {
    const result = CreateCampaignSchema.safeParse(validCampaignBase)
    expect(result.success).toBe(true)
  })

  test('accepts valid SMS campaign without subject', () => {
    const result = CreateCampaignSchema.safeParse({
      ...validCampaignBase,
      channel: 'sms',
      subject: undefined,
    })
    expect(result.success).toBe(true)
  })

  test('accepts valid "both" channel campaign', () => {
    const result = CreateCampaignSchema.safeParse({
      ...validCampaignBase,
      channel: 'both',
      subject: 'Multi-channel message',
    })
    expect(result.success).toBe(true)
  })
})

// ============================================================================
// PreviewCampaignSchema
// ============================================================================

describe('PreviewCampaignSchema', () => {
  test('accepts preview without campaign name', () => {
    const { name, ...withoutName } = validCampaignBase
    const result = PreviewCampaignSchema.safeParse(withoutName)
    expect(result.success).toBe(true)
  })

  test('accepts preview with empty campaign name', () => {
    const result = PreviewCampaignSchema.safeParse({
      ...validCampaignBase,
      name: '',
    })
    expect(result.success).toBe(true)
  })

  test('accepts email preview without subject while composing', () => {
    const result = PreviewCampaignSchema.safeParse({
      channel: 'email',
      body: 'Hello campers',
    })
    expect(result.success).toBe(true)
  })

  test('still requires message body', () => {
    const result = PreviewCampaignSchema.safeParse({
      channel: 'email',
      subject: 'Hello',
      body: '',
    })
    expect(result.success).toBe(false)
  })
})

// ============================================================================
// ScheduleCampaignSchema
// ============================================================================

describe('ScheduleCampaignSchema', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-21T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('rejects past dates', () => {
    const result = ScheduleCampaignSchema.safeParse({
      scheduled_at: '2020-01-01T00:00:00Z',
    })
    expect(result.success).toBe(false)
  })

  test('accepts future dates', () => {
    const result = ScheduleCampaignSchema.safeParse({
      scheduled_at: '2027-06-01T10:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  test('rejects date less than 1 minute in the future', () => {
    const result = ScheduleCampaignSchema.safeParse({
      scheduled_at: '2026-05-21T12:00:30Z', // 30 seconds from now
    })
    expect(result.success).toBe(false)
  })

  test('rejects invalid date string', () => {
    const result = ScheduleCampaignSchema.safeParse({
      scheduled_at: 'not-a-date',
    })
    expect(result.success).toBe(false)
  })
})

// ============================================================================
// SendOneMessageSchema
// ============================================================================

describe('SendOneMessageSchema', () => {
  test('validates required channel and body', () => {
    const result = SendOneMessageSchema.safeParse({
      channel: 'sms',
      body: 'Hello from camp!',
    })
    expect(result.success).toBe(true)
  })

  test('rejects invalid channel', () => {
    const result = SendOneMessageSchema.safeParse({
      channel: 'fax',
      body: 'Hello',
    })
    expect(result.success).toBe(false)
  })

  test('rejects missing body', () => {
    const result = SendOneMessageSchema.safeParse({
      channel: 'sms',
    })
    expect(result.success).toBe(false)
  })

  test('rejects email channel without subject', () => {
    const result = SendOneMessageSchema.safeParse({
      channel: 'email',
      body: 'Hello',
      subject: '',
    })
    expect(result.success).toBe(false)
  })

  test('accepts email channel with subject', () => {
    const result = SendOneMessageSchema.safeParse({
      channel: 'email',
      body: 'Hello',
      subject: 'Greetings',
    })
    expect(result.success).toBe(true)
  })
})

