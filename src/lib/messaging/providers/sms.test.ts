import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }))

vi.mock('@aws-sdk/client-sns', () => ({
  SNSClient: class {
    send = sendMock
  },
  PublishCommand: class {
    input: unknown
    constructor(input: unknown) {
      this.input = input
    }
  },
}))

import { sendSMS, normalisePhone } from './sms'

const ENV_KEYS = ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'] as const
const savedEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key]
  }
  process.env.AWS_REGION = 'eu-west-1'
  process.env.AWS_ACCESS_KEY_ID = 'test-access-key'
  process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key'
  sendMock.mockReset()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = savedEnv[key]
    }
  }
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('normalisePhone', () => {
  test('strips spaces, dashes, dots and parentheses', () => {
    expect(normalisePhone('+63 917 474 0855')).toBe('+639174740855')
    expect(normalisePhone('+44 (0)20-7946.0958'.replace('(0)', ''))).toBe('+442079460958')
  })

  test('rejects numbers without + prefix or with wrong length', () => {
    expect(normalisePhone('639174740855')).toBeNull()
    expect(normalisePhone('+123')).toBeNull()
    expect(normalisePhone('+1234567890123456')).toBeNull()
  })

  test('rejects non-string input', () => {
    expect(normalisePhone(null)).toBeNull()
    expect(normalisePhone(undefined)).toBeNull()
    expect(normalisePhone(639174740855)).toBeNull()
  })
})

describe('sendSMS', () => {
  test('success maps SNS MessageId to providerMessageId and sends Transactional', async () => {
    sendMock.mockResolvedValueOnce({ MessageId: 'sns-message-id-1' })

    const result = await sendSMS('+63 917 474 0855', 'Hello from CampOS')

    expect(result).toEqual({ success: true, providerMessageId: 'sns-message-id-1' })
    expect(sendMock).toHaveBeenCalledTimes(1)
    const command = sendMock.mock.calls[0]?.[0] as { input: Record<string, unknown> } | undefined
    expect(command?.input).toMatchObject({
      PhoneNumber: '+639174740855',
      Message: 'Hello from CampOS',
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional',
        },
      },
    })
  })

  test('returns error result after exactly 4 attempts when SNS keeps failing', async () => {
    vi.useFakeTimers()
    sendMock.mockRejectedValue(new Error('ThrottledException'))

    const promise = sendSMS('+639174740855', 'Hello')
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toEqual({ success: false, error: 'ThrottledException' })
    expect(sendMock).toHaveBeenCalledTimes(4)
  })

  test('retries transient failure then succeeds', async () => {
    vi.useFakeTimers()
    sendMock
      .mockRejectedValueOnce(new Error('ServiceUnavailable'))
      .mockResolvedValueOnce({ MessageId: 'sns-message-id-2' })

    const promise = sendSMS('+639174740855', 'Hello')
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toEqual({ success: true, providerMessageId: 'sns-message-id-2' })
    expect(sendMock).toHaveBeenCalledTimes(2)
  })

  test('invalid phone returns error result without calling SNS', async () => {
    const result = await sendSMS('not-a-phone', 'Hello')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid phone number')
    expect(sendMock).not.toHaveBeenCalled()
  })

  test('missing env config returns error result without throwing', async () => {
    delete process.env.AWS_REGION

    const result = await sendSMS('+639174740855', 'Hello')

    expect(result.success).toBe(false)
    expect(result.error).toContain('SNS not configured')
    expect(sendMock).not.toHaveBeenCalled()
  })
})
