/**
 * Process due scheduled message campaigns.
 *
 * Finds campaigns with status=scheduled and scheduled_at <= now,
 * atomically claims each row, then runs the standard send pipeline.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getGuestsBySegment, filterEligibleGuests } from './segmentation'
import { executeCampaignSend } from './send'
import type { CampaignSendSummary, MessageCampaign, SegmentType } from './messaging-types'

const DEFAULT_BATCH_LIMIT = 20

export type ScheduledCampaignOutcome = {
  campaignId: string
  status: 'processed' | 'failed' | 'skipped'
  summary?: CampaignSendSummary
  error?: string
}

export type ProcessDueScheduledCampaignsResult = {
  processed: number
  skipped: number
  failed: number
  campaigns: ScheduledCampaignOutcome[]
}

type ProcessDueScheduledCampaignsOptions = {
  now?: Date
  limit?: number
}

async function markCampaignFailed(
  serviceClient: SupabaseClient,
  campaignId: string,
  updatedAt: string,
): Promise<void> {
  await serviceClient
    .from('message_campaigns')
    .update({ status: 'failed', updated_at: updatedAt })
    .eq('id', campaignId)
}

export async function processDueScheduledCampaigns(
  serviceClient: SupabaseClient,
  options?: ProcessDueScheduledCampaignsOptions,
): Promise<ProcessDueScheduledCampaignsResult> {
  const now = (options?.now ?? new Date()).toISOString()
  const limit = options?.limit ?? DEFAULT_BATCH_LIMIT

  const result: ProcessDueScheduledCampaignsResult = {
    processed: 0,
    skipped: 0,
    failed: 0,
    campaigns: [],
  }

  const { data: dueCampaigns, error: fetchError } = await serviceClient
    .from('message_campaigns')
    .select('*')
    .eq('status', 'scheduled')
    .not('scheduled_at', 'is', null)
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(limit)

  if (fetchError) {
    throw new Error(`Failed to fetch due campaigns: ${fetchError.message}`)
  }

  if (!dueCampaigns?.length) {
    return result
  }

  for (const campaign of dueCampaigns) {
    const { data: claimed, error: claimError } = await serviceClient
      .from('message_campaigns')
      .update({ status: 'sending', updated_at: now })
      .eq('id', campaign.id)
      .eq('status', 'scheduled')
      .select('*')
      .maybeSingle()

    if (claimError) {
      console.error(`[scheduled-campaigns] Claim failed for ${campaign.id}:`, claimError.message)
      result.failed++
      result.campaigns.push({
        campaignId: campaign.id,
        status: 'failed',
        error: claimError.message,
      })
      continue
    }

    if (!claimed) {
      result.skipped++
      result.campaigns.push({ campaignId: campaign.id, status: 'skipped' })
      continue
    }

    try {
      const propertyId = claimed.property_id
      if (!propertyId) {
        await markCampaignFailed(serviceClient, claimed.id, now)
        result.failed++
        result.campaigns.push({
          campaignId: claimed.id,
          status: 'failed',
          error: 'Missing property_id',
        })
        continue
      }

      let companyId = claimed.company_id as string | null
      if (!companyId) {
        const { data: property } = await serviceClient
          .from('properties')
          .select('company_id')
          .eq('id', propertyId)
          .maybeSingle()

        companyId = property?.company_id ?? null
      }

      if (!companyId) {
        await markCampaignFailed(serviceClient, claimed.id, now)
        result.failed++
        result.campaigns.push({
          campaignId: claimed.id,
          status: 'failed',
          error: 'Missing company_id',
        })
        continue
      }

      const segmentType = (claimed.segment_type ?? 'all_guests') as SegmentType
      const guests = await getGuestsBySegment(
        serviceClient,
        propertyId,
        segmentType,
        claimed.audience_filter,
      )

      const eligibleGuests = await filterEligibleGuests(
        guests,
        claimed.channel,
        serviceClient,
        companyId,
      )

      const summary = await executeCampaignSend(
        serviceClient,
        claimed as unknown as MessageCampaign,
        eligibleGuests,
      )

      result.processed++
      result.campaigns.push({
        campaignId: claimed.id,
        status: 'processed',
        summary,
      })
      console.log(`[scheduled-campaigns] Processed campaign ${claimed.id}:`, summary)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[scheduled-campaigns] Failed to send campaign ${claimed.id}:`, message)
      await markCampaignFailed(serviceClient, claimed.id, now)

      result.failed++
      result.campaigns.push({
        campaignId: claimed.id,
        status: 'failed',
        error: message,
      })
    }
  }

  return result
}
