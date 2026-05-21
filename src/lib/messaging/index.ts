/**
 * Messaging Library — Barrel Export
 *
 * Re-exports all messaging modules for convenient imports.
 */

// Types
export type {
  Channel,
  CampaignStatus,
  RecipientStatus,
  SegmentType,
  AudienceFilter,
  MessageCampaign,
  MessageRecipient,
  GuestMessagePreferences,
  PersonalizationData,
  SendResult,
  CampaignSendSummary,
  DirectSendParams,
} from './messaging-types'

// Schemas
export {
  CreateCampaignSchema,
  PreviewCampaignSchema,
  ScheduleCampaignSchema,
  SendOneMessageSchema,
} from './schemas'
export type {
  CreateCampaignInput,
  PreviewCampaignInput,
  ScheduleCampaignInput,
  SendOneMessageInput,
} from './schemas'

// Segmentation
export {
  getGuestsBySegment,
  filterEligibleGuests,
} from './segmentation'

// Personalization
export {
  SUPPORTED_VARIABLES,
  validateTemplateVariables,
  personalizeMessage,
  buildPersonalizationData,
} from './personalization'

// Send orchestration
export {
  executeCampaignSend,
  executeDirectSend,
} from './send'

// Providers (for direct use if needed)
export { sendCampaignEmail } from './providers/email'
export { sendSMS } from './providers/sms'
