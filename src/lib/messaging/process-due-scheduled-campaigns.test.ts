import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { processDueScheduledCampaigns } from './process-due-scheduled-campaigns'

const getGuestsBySegment = vi.fn()
const filterEligibleGuests = vi.fn()
const executeCampaignSend = vi.fn()

vi.mock('./segmentation', () => ({
  getGuestsBySegment: (...args: unknown[]) => getGuestsBySegment(...args),
  filterEligibleGuests: (...args: unknown[]) => filterEligibleGuests(...args),
}))

vi.mock('./send', () => ({
  executeCampaignSend: (...args: unknown[]) => executeCampaignSend(...args),
}))

const campaignId = '00000000-0000-4000-8000-000000000010'
const propertyId = '00000000-0000-4000-8000-000000000020'
const companyId = '00000000-0000-4000-8000-000000000030'
const scheduledAt = '2026-06-08T15:00:00.000Z'
const now = new Date('2026-06-08T16:00:00.000Z')

function createMockClient(dueCampaigns: Record<string, unknown>[]) {
  const selectDue = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      not: vi.fn().mockReturnValue({
        lte: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: dueCampaigns, error: null }),
          }),
        }),
      }),
    }),
  })

  const claimUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: dueCampaigns[0] ?? null,
            error: null,
          }),
        }),
      }),
    }),
  })

  const from = vi.fn((table: string) => {
    if (table === 'message_campaigns') {
      return {
        select: selectDue,
        update: claimUpdate,
      }
    }

    throw new Error(`Unexpected table: ${table}`)
  })

  return { from } as unknown as SupabaseClient
}

describe('processDueScheduledCampaigns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getGuestsBySegment.mockResolvedValue([{ id: 'guest-1' }])
    filterEligibleGuests.mockResolvedValue([{ id: 'guest-1' }])
    executeCampaignSend.mockResolvedValue({ total: 1, sent: 1, failed: 0, skipped: 0 })
  })

  test('returns empty result when no campaigns are due', async () => {
    const client = createMockClient([])

    const result = await processDueScheduledCampaigns(client, { now })

    expect(result).toEqual({
      processed: 0,
      skipped: 0,
      failed: 0,
      campaigns: [],
    })
    expect(getGuestsBySegment).not.toHaveBeenCalled()
  })

  test('claims and sends due scheduled campaigns', async () => {
    const dueCampaign = {
      id: campaignId,
      company_id: companyId,
      property_id: propertyId,
      channel: 'email',
      segment_type: 'all_guests',
      audience_filter: {},
      subject: 'Hello',
      body: 'Body',
      status: 'scheduled',
      scheduled_at: scheduledAt,
    }

    const client = createMockClient([dueCampaign])

    const result = await processDueScheduledCampaigns(client, { now })

    expect(getGuestsBySegment).toHaveBeenCalledWith(
      client,
      propertyId,
      'all_guests',
      {},
    )
    expect(filterEligibleGuests).toHaveBeenCalledWith(
      [{ id: 'guest-1' }],
      'email',
      client,
      companyId,
    )
    expect(executeCampaignSend).toHaveBeenCalledWith(
      client,
      dueCampaign,
      [{ id: 'guest-1' }],
    )
    expect(result).toEqual({
      processed: 1,
      skipped: 0,
      failed: 0,
      campaigns: [
        {
          campaignId,
          status: 'processed',
          summary: { total: 1, sent: 1, failed: 0, skipped: 0 },
        },
      ],
    })
  })
})
