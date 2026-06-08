import { describe, test, expect, vi, beforeEach } from 'vitest'
import { personalizeCampaignMessage } from './campaign-context'

vi.mock('@/lib/communications/branding-applier', () => ({
  getPropertyBranding: vi.fn(async () => ({
    logoUrl: null,
    primaryColor: '#ff0000',
    secondaryColor: null,
    senderName: 'Test Camp',
    senderEmail: 'noreply@test.com',
    replyToEmail: null,
    propertyName: 'Pine Ridge',
    propertyAddress: '123 Camp Rd',
  })),
}))

describe('personalizeCampaignMessage', () => {
  const supabase = {} as never
  const propertyId = '00000000-0000-4000-8000-000000000001'

  const baseContext = {
    guest: {
      id: 'guest-1',
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
    },
    property: {
      id: propertyId,
      name: 'Pine Ridge',
      address: '123 Camp Rd',
      city: 'Lakeview',
      state: 'TX',
      zip_code: '75001',
    },
    reservation: {
      check_in_date: '2026-06-01',
      check_out_date: '2026-06-04',
      confirmation_number: 'RES-001',
    },
    site: {
      site_number: 'A-12',
      site_name: 'Lake View',
    },
  }

  test('replaces dotted merge fields in email subject and HTML body', async () => {
    const result = await personalizeCampaignMessage(supabase, {
      propertyId,
      channel: 'email',
      subject: 'Hi {{guest.first_name}}',
      body: '<p>Thanks for staying at {{property.name}} ({{reservation.check_in_date}} to {{reservation.check_out_date}}).</p>',
      context: baseContext,
    })

    expect(result.subject).toBe('Hi Jane')
    expect(result.body).toContain('Thanks for staying at Pine Ridge')
    expect(result.body).not.toContain('{{guest.first_name}}')
    expect(result.body).not.toContain('{{property.name}}')
  })

  test('replaces dotted merge fields in SMS body', async () => {
    const result = await personalizeCampaignMessage(supabase, {
      propertyId,
      channel: 'sms',
      subject: null,
      body: 'Hi {{guest.first_name}}, welcome to {{property.name}}!',
      context: baseContext,
    })

    expect(result.body).toBe('Hi Jane, welcome to Pine Ridge!')
  })

  test('supports legacy flat SMS variables', async () => {
    const result = await personalizeCampaignMessage(supabase, {
      propertyId,
      channel: 'sms',
      subject: null,
      body: 'Hello {{guest_first_name}} at {{location}}',
      context: {
        ...baseContext,
        guest_first_name: 'Jane',
        location: 'Pine Ridge',
      },
    })

    expect(result.body).toBe('Hello Jane at Pine Ridge')
  })
})
