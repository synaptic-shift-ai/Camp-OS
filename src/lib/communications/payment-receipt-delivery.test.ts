import { describe, expect, it, vi } from 'vitest'
import { recordPaymentReceiptEmailDelivery } from './payment-receipt-delivery'

describe('recordPaymentReceiptEmailDelivery', () => {
  it('logs queued then updates to sent on success', async () => {
    const supabase = {} as any

    const logDeliveryFn = vi.fn().mockResolvedValue({
      id: 'log-1',
    })
    const updateDeliveryStatusFn = vi.fn().mockResolvedValue({
      id: 'log-1',
      status: 'sent',
    })

    const result = await recordPaymentReceiptEmailDelivery({
      supabase,
      companyId: 'company-1',
      propertyId: 'property-1',
      reservationId: 'reservation-1',
      guestId: 'guest-1',
      recipientEmail: 'guest@example.com',
      subject: 'Payment receipt #ABC',
      sendResult: { success: true, attempts: 1 },
      logDeliveryFn,
      updateDeliveryStatusFn,
    })

    expect(logDeliveryFn).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-1',
        propertyId: 'property-1',
        reservationId: 'reservation-1',
        guestId: 'guest-1',
        channel: 'email',
        recipientAddress: 'guest@example.com',
        subject: 'Payment receipt #ABC',
        status: 'queued',
      }),
    )

    expect(updateDeliveryStatusFn).toHaveBeenCalledWith(
      expect.objectContaining({
        logId: 'log-1',
        status: 'sent',
        failureReason: null,
        retryCount: 0,
      }),
    )

    expect(result).toEqual(expect.objectContaining({ id: 'log-1' }))
  })

  it('does not set retryCount when sendResult omits attempts', async () => {
    const supabase = {} as any
    const logDeliveryFn = vi.fn().mockResolvedValue({ id: 'log-x' })
    const updateDeliveryStatusFn = vi.fn().mockResolvedValue({ id: 'log-x' })

    await recordPaymentReceiptEmailDelivery({
      supabase,
      companyId: 'c',
      propertyId: 'p',
      recipientEmail: 'a@b.com',
      subject: 'S',
      sendResult: { success: true },
      logDeliveryFn,
      updateDeliveryStatusFn,
    })

    const payload = updateDeliveryStatusFn.mock.calls[0]?.[0] as Record<string, unknown> | undefined
    expect(payload).toBeDefined()
    expect(payload).not.toHaveProperty('retryCount')
  })

  it('logs queued then updates to failed with failure reason on error', async () => {
    const supabase = {} as any

    const logDeliveryFn = vi.fn().mockResolvedValue({
      id: 'log-2',
    })
    const updateDeliveryStatusFn = vi.fn().mockResolvedValue({
      id: 'log-2',
      status: 'failed',
      failure_reason: 'SMTP down',
    })

    await recordPaymentReceiptEmailDelivery({
      supabase,
      companyId: 'company-2',
      propertyId: 'property-2',
      reservationId: null,
      guestId: 'guest-2',
      recipientEmail: 'guest2@example.com',
      subject: 'Payment receipt #DEF',
      sendResult: { success: false, error: 'SMTP down', attempts: 4 },
      logDeliveryFn,
      updateDeliveryStatusFn,
    })

    expect(updateDeliveryStatusFn).toHaveBeenCalledWith(
      expect.objectContaining({
        logId: 'log-2',
        status: 'failed',
        failureReason: 'SMTP down',
        retryCount: 3,
      }),
    )
  })

  it('returns null when initial log insert fails', async () => {
    const supabase = {} as any
    const logDeliveryFn = vi.fn().mockResolvedValue(null)
    const updateDeliveryStatusFn = vi.fn()

    const result = await recordPaymentReceiptEmailDelivery({
      supabase,
      companyId: 'company-3',
      propertyId: 'property-3',
      recipientEmail: 'guest3@example.com',
      subject: 'Payment receipt #GHI',
      sendResult: { success: true },
      logDeliveryFn,
      updateDeliveryStatusFn: updateDeliveryStatusFn as any,
    })

    expect(result).toBeNull()
    expect(updateDeliveryStatusFn).not.toHaveBeenCalled()
  })
})

