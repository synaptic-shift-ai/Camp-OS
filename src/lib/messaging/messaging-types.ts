/**
 * Messaging Types
 *
 * TypeScript types matching the messaging migration tables:
 * message_campaigns, message_recipients, guest_message_preferences
 */

// ============================================================================
// Enums (union types matching CHECK constraints)
// ============================================================================

export type Channel = 'email' | 'sms' | 'both'

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled'

export type RecipientStatus = 'pending' | 'queued' | 'sent' | 'delivered' | 'failed' | 'skipped'

export type SegmentType =
  | 'all_guests'
  | 'specific_guest'
  | 'bookings_this_month'
  | 'by_location'
  | 'by_season'
  | 'upcoming_bookings'
  | 'past_guests'
  | 'email_opt_in'
  | 'sms_opt_in'
  | 'by_site'
  | 'by_site_type'

// ============================================================================
// Interfaces (matching migration table columns)
// ============================================================================

export interface AudienceFilter {
  location?: string
  season?: string
  guest_ids?: string[]
  date_from?: string
  date_to?: string
  site_ids?: string[]
  site_types?: string[]
}

export interface MessageCampaign {
  id: string
  company_id: string | null
  property_id: string | null
  name: string
  channel: Channel
  segment_type: string | null
  audience_filter: AudienceFilter
  template_id: string | null
  subject: string | null
  body: string
  status: CampaignStatus
  scheduled_at: string | null
  sent_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface MessageRecipient {
  id: string
  campaign_id: string
  guest_id: string
  email: string | null
  phone: string | null
  personalized_subject: string | null
  personalized_body: string | null
  status: RecipientStatus
  provider_message_id: string | null
  error_message: string | null
  sent_at: string | null
  delivered_at: string | null
  failed_at: string | null
  created_at: string
  updated_at: string
}

export interface GuestMessagePreferences {
  id: string
  guest_id: string
  email_opt_in: boolean
  sms_opt_in: boolean
  email_unsubscribed_at: string | null
  sms_opted_out_at: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// Supporting types
// ============================================================================

export type PersonalizationData = Record<string, string>

export interface SendResult {
  success: boolean
  providerMessageId?: string
  error?: string
}

export interface CampaignSendSummary {
  total: number
  sent: number
  failed: number
  skipped: number
}

export interface DirectSendParams {
  companyId: string
  propertyId: string
  guestId: string
  channel: Channel
  subject?: string
  body: string
  createdBy?: string
}
