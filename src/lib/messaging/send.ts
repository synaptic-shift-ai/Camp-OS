/**
 * Campaign Send Orchestration
 *
 * Orchestrates the full send pipeline for campaigns and direct messages.
 * Creates recipient records, dispatches to providers, and updates status.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Channel,
  MessageCampaign,
  CampaignSendSummary,
  DirectSendParams,
  RecipientStatus,
} from './messaging-types'
import { sendCampaignEmail } from './providers/email'
import { sendSMS } from './providers/sms'
import { personalizeMessage, buildPersonalizationData } from './personalization'
import { logDelivery } from '@/lib/communications/delivery-logger'

// ============================================================================
// Types
// ============================================================================

interface GuestForSend {
  id: string
  property_id: string | null
  first_name: string
  last_name: string
  email: string
  phone: string | null
}

// ============================================================================
// Campaign Send
// ============================================================================

/**
 * Execute a full campaign send.
 *
 * 1. Creates message_recipients records for each eligible guest
 * 2. Sends via appropriate provider (email/SMS) for each recipient
 * 3. Updates recipient status after each send attempt
 * 4. Logs each delivery to communication_log
 * 5. Updates campaign status to 'sent' or 'failed' when done
 *
 * Returns a summary of send results.
 */
export async function executeCampaignSend(
  serviceClient: SupabaseClient,
  campaign: MessageCampaign,
  guests: GuestForSend[],
): Promise<CampaignSendSummary> {
  const summary: CampaignSendSummary = {
    total: guests.length,
    sent: 0,
    failed: 0,
    skipped: 0,
  }

  if (guests.length === 0) {
    await updateCampaignStatus(serviceClient, campaign.id, 'sent')
    return summary
  }

  // Mark campaign as sending
  await updateCampaignStatus(serviceClient, campaign.id, 'sending')

  // Create recipient records
  const recipientRows = guests.map((guest) => {
    const personalizationData = buildPersonalizationData(guest as unknown as Record<string, unknown>)
    const personalizedSubject = campaign.subject
      ? personalizeMessage(campaign.subject, personalizationData)
      : null
    const personalizedBody = personalizeMessage(campaign.body, personalizationData)

    return {
      campaign_id: campaign.id,
      guest_id: guest.id,
      email: guest.email,
      phone: guest.phone,
      personalized_subject: personalizedSubject,
      personalized_body: personalizedBody,
      status: 'pending' as RecipientStatus,
    }
  })

  const { data: recipients, error: insertError } = await serviceClient
    .from('message_recipients')
    .insert(recipientRows)
    .select('id, guest_id, email, phone, personalized_subject, personalized_body')

  if (insertError || !recipients) {
    console.error('[messaging/send] Failed to create recipient records:', insertError?.message)
    await updateCampaignStatus(serviceClient, campaign.id, 'failed')
    summary.failed = guests.length
    return summary
  }

  // Send to each recipient
  const channels = getChannels(campaign.channel)

  for (const recipient of recipients) {
    let recipientSent = false
    let recipientFailed = false

    for (const channel of channels) {
      const result = await sendToRecipient(
        channel,
        recipient,
        campaign,
        serviceClient,
      )

      if (result.success) {
        recipientSent = true
      } else {
        recipientFailed = true
        console.error(
          `[messaging/send] Failed to send to ${recipient.guest_id} via ${channel}:`,
          result.error,
        )
      }
    }

    // Update recipient status
    const now = new Date().toISOString()
    if (recipientFailed && !recipientSent) {
      summary.failed++
      await serviceClient
        .from('message_recipients')
        .update({
          status: 'failed',
          error_message: 'All channel sends failed',
          failed_at: now,
          updated_at: now,
        })
        .eq('id', recipient.id)
    } else if (recipientSent) {
      summary.sent++
      await serviceClient
        .from('message_recipients')
        .update({
          status: 'sent',
          sent_at: now,
          updated_at: now,
        })
        .eq('id', recipient.id)
    } else {
      summary.skipped++
      await serviceClient
        .from('message_recipients')
        .update({
          status: 'skipped',
          updated_at: now,
        })
        .eq('id', recipient.id)
    }
  }

  // Update campaign status
  const finalStatus = summary.failed === guests.length ? 'failed' : 'sent'
  await serviceClient
    .from('message_campaigns')
    .update({
      status: finalStatus,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaign.id)

  return summary
}

// ============================================================================
// Direct Send
// ============================================================================

/**
 * Execute a one-to-one direct message.
 * Creates a 'direct' campaign + single recipient + sends immediately.
 */
export async function executeDirectSend(
  serviceClient: SupabaseClient,
  params: DirectSendParams,
): Promise<CampaignSendSummary> {
  // Fetch the guest
  const { data: guest, error: guestError } = await serviceClient
    .from('guests')
    .select('id, property_id, first_name, last_name, email, phone')
    .eq('id', params.guestId)
    .is('deleted_at', null)
    .single()

  if (guestError || !guest) {
    console.error('[messaging/send] Guest not found:', params.guestId, guestError?.message)
    return { total: 1, sent: 0, failed: 1, skipped: 0 }
  }

  // Create direct campaign
  const { data: campaign, error: campaignError } = await serviceClient
    .from('message_campaigns')
    .insert({
      company_id: params.companyId,
      property_id: params.propertyId,
      name: `Direct message to ${guest.first_name} ${guest.last_name}`,
      channel: params.channel,
      segment_type: 'specific_guest',
      audience_filter: { guest_ids: [params.guestId] },
      subject: params.subject ?? null,
      body: params.body,
      status: 'sending',
      created_by: params.createdBy ?? null,
    })
    .select()
    .single()

  if (campaignError || !campaign) {
    console.error('[messaging/send] Failed to create direct campaign:', campaignError?.message)
    return { total: 1, sent: 0, failed: 1, skipped: 0 }
  }

  // Create recipient + send
  return executeCampaignSend(
    serviceClient,
    campaign as unknown as MessageCampaign,
    [guest as unknown as GuestForSend],
  )
}

// ============================================================================
// Helpers
// ============================================================================

function getChannels(channel: Channel): Array<'email' | 'sms'> {
  if (channel === 'both') return ['email', 'sms']
  return [channel]
}

async function sendToRecipient(
  channel: 'email' | 'sms',
  recipient: {
    id: string
    guest_id: string
    email: string | null
    phone: string | null
    personalized_subject: string | null
    personalized_body: string | null
  },
  campaign: MessageCampaign,
  serviceClient: SupabaseClient,
) {
  const subject = recipient.personalized_subject ?? campaign.subject ?? ''
  const body = recipient.personalized_body ?? campaign.body

  let result

  if (channel === 'email') {
    if (!recipient.email) {
      return { success: false, error: 'No email address' }
    }
    const emailOptions: { textBody?: string; propertyId?: string; supabase?: SupabaseClient } = {
      supabase: serviceClient,
    }
    if (campaign.property_id) {
      emailOptions.propertyId = campaign.property_id
    }
    result = await sendCampaignEmail(recipient.email, subject, body, emailOptions)
  } else {
    if (!recipient.phone) {
      return { success: false, error: 'No phone number' }
    }
    result = await sendSMS(recipient.phone, body)
  }

  // Log to communication_log
  if (campaign.company_id && campaign.property_id) {
    await logDelivery({
      supabase: serviceClient,
      companyId: campaign.company_id,
      propertyId: campaign.property_id,
      guestId: recipient.guest_id,
      templateId: campaign.template_id,
      channel,
      recipientAddress: channel === 'email' ? (recipient.email ?? '') : (recipient.phone ?? ''),
      subject: channel === 'email' ? subject : null,
      status: result.success ? 'sent' : 'failed',
    })
  }

  return result
}

async function updateCampaignStatus(
  serviceClient: SupabaseClient,
  campaignId: string,
  status: string,
): Promise<void> {
  const { error } = await serviceClient
    .from('message_campaigns')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)

  if (error) {
    console.error('[messaging/send] Failed to update campaign status:', error.message)
  }
}
