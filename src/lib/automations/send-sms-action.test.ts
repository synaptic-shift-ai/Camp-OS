import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { EventContext } from './types'

const { sendSMSMock, logDeliveryMock, updateDeliveryStatusMock, isOptedOutMock, fromMock } =
  vi.hoisted(() => ({
    sendSMSMock: vi.fn(),
    logDeliveryMock: vi.fn(),
    updateDeliveryStatusMock: vi.fn(),
    isOptedOutMock: vi.fn(),
    fromMock: vi.fn(),
  }))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}))

vi.mock('@/lib/messaging/providers/sms', () => ({
  sendSMS: sendSMSMock,
}))

vi.mock('@/lib/communications/delivery-logger', () => ({
  logDelivery: logDeliveryMock,
  updateDeliveryStatus: updateDeliveryStatusMock,
}))

vi.mock('@/lib/communications/opt-out-checker', () => ({
  isOptedOut: isOptedOutMock,
}))

import { createActionRegistry } from './action-registry'

function makeQuery(result: { data: unknown; error: unknown }) {
  const query: Record<string, unknown> = {}
  query.select = () => query
  query.eq = () => query
  query.is = () => query
  query.limit = () => query
  query.single = () => Promise.resolve(result)
  return query
}

function makeContext(overrides: Partial<Record<string, unknown>> = {}): EventContext {
  return {
    property: { id: 'prop-1', company_id: 'co-1' },
    guest: {
      id: 'guest-1',
      first_name: 'Maria',
      last_name: 'Santos',
      phone: '+639174740855',
    },
    reservation: { id: 'res-1' },
    ...overrides,
  } as unknown as EventContext
}

function getHandler() {
  const registry = createActionRegistry()
  const handler = registry.get('send_sms')
  if (!handler) throw new Error('send_sms handler not registered')
  return handler
}

beforeEach(() => {
  sendSMSMock.mockReset().mockResolvedValue({ success: true, providerMessageId: 'sns-id-1' })
  logDeliveryMock.mockReset().mockResolvedValue({ id: 'log-1' })
  updateDeliveryStatusMock.mockReset().mockResolvedValue({ id: 'log-1' })
  isOptedOutMock.mockReset().mockResolvedValue(false)
  fromMock.mockReset().mockReturnValue(makeQuery({ data: null, error: null }))
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('send_sms action', () => {
  test('inline message: renders merge fields, sends, logs sent then delivered', async () => {
    await getHandler().execute(
      { message: 'Hi {{guest.first_name}}, your booking is confirmed' },
      makeContext(),
    )

    expect(sendSMSMock).toHaveBeenCalledWith(
      '+639174740855',
      'Hi Maria, your booking is confirmed',
    )
    expect(logDeliveryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'co-1',
        propertyId: 'prop-1',
        guestId: 'guest-1',
        channel: 'sms',
        recipientAddress: '+639174740855',
        subject: null,
        status: 'sent',
      }),
    )
    expect(updateDeliveryStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({ logId: 'log-1', status: 'delivered' }),
    )
  })

  test('template slug: resolves sms_templates body and renders it', async () => {
    fromMock.mockReturnValueOnce(
      makeQuery({
        data: { id: 'tpl-1', body: 'Hello {{guest.first_name}}, see you soon!' },
        error: null,
      }),
    )

    await getHandler().execute({ template: 'pre_arrival_sms' }, makeContext())

    expect(fromMock).toHaveBeenCalledWith('sms_templates')
    expect(sendSMSMock).toHaveBeenCalledWith('+639174740855', 'Hello Maria, see you soon!')
    expect(logDeliveryMock).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: 'tpl-1', channel: 'sms', status: 'sent' }),
    )
  })

  test('template not found: no send, error logged', async () => {
    await getHandler().execute({ template: 'missing_template' }, makeContext())

    expect(sendSMSMock).not.toHaveBeenCalled()
    expect(logDeliveryMock).not.toHaveBeenCalled()
  })

  test('opted-out guest: logs skipped, never sends', async () => {
    isOptedOutMock.mockResolvedValue(true)

    await getHandler().execute({ message: 'Hello' }, makeContext())

    expect(isOptedOutMock).toHaveBeenCalledWith(expect.anything(), 'co-1', 'guest-1', 'sms')
    expect(sendSMSMock).not.toHaveBeenCalled()
    expect(logDeliveryMock).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'sms', status: 'skipped' }),
    )
  })

  test('missing message and template: no send, no throw', async () => {
    await expect(getHandler().execute({}, makeContext())).resolves.toBeUndefined()
    expect(sendSMSMock).not.toHaveBeenCalled()
  })

  test('missing guest phone: no send, no throw', async () => {
    const context = makeContext({
      guest: { id: 'guest-1', first_name: 'Maria', last_name: 'Santos', phone: null },
    })

    await expect(getHandler().execute({ message: 'Hello' }, context)).resolves.toBeUndefined()
    expect(sendSMSMock).not.toHaveBeenCalled()
  })

  test('send failure: delivery status updated to failed with reason', async () => {
    sendSMSMock.mockResolvedValue({ success: false, error: 'ThrottledException' })

    await getHandler().execute({ message: 'Hello' }, makeContext())

    expect(updateDeliveryStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        logId: 'log-1',
        status: 'failed',
        failureReason: 'ThrottledException',
      }),
    )
  })
})
