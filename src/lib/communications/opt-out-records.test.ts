import { describe, expect, it } from 'vitest'
import { mapCommunicationOptOutRow } from './opt-out-records'

describe('mapCommunicationOptOutRow', () => {
  it('maps a communication_opt_outs row into the opt-outs panel record shape', () => {
    const optedOutAt = new Date('2026-05-13T08:00:00.000Z').toISOString()

    const result = mapCommunicationOptOutRow({
      id: 'opt-out-1',
      channel: 'email',
      opted_out_at: optedOutAt,
      source: 'unsubscribe_link',
      guest: {
        first_name: 'Riley',
        last_name: 'Guest',
        email: 'riley@example.com',
      },
    })

    expect(result).toEqual({
      id: 'opt-out-1',
      guestName: 'Riley Guest',
      guestEmail: 'riley@example.com',
      channel: 'EMAIL',
      optedOutAt,
      source: 'unsubscribe_link',
    })
  })

  it('uses Unknown and an empty email when the guest row is unavailable', () => {
    const optedOutAt = new Date('2026-05-13T08:05:00.000Z').toISOString()

    const result = mapCommunicationOptOutRow({
      id: 'opt-out-2',
      channel: 'sms',
      opted_out_at: optedOutAt,
      source: 'manual',
      guest: null,
    })

    expect(result).toEqual({
      id: 'opt-out-2',
      guestName: 'Unknown',
      guestEmail: '',
      channel: 'SMS',
      optedOutAt,
      source: 'manual',
    })
  })
})
