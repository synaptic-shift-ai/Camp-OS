/**
 * Messaging Validation Schemas
 *
 * Zod schemas for validating campaign and template inputs.
 */

import { z } from 'zod'

// ============================================================================
// Shared enums
// ============================================================================

const channelSchema = z.enum(['email', 'sms', 'both'])

const audienceFilterSchema = z
  .object({
    location: z.string().optional(),
    season: z.string().optional(),
    guest_ids: z.array(z.string().uuid()).optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    site_ids: z.array(z.string().uuid()).optional(),
    site_types: z.array(z.string()).optional(),
  })
  .optional()

const campaignFieldsSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  channel: channelSchema,
  segment_type: z.string().optional(),
  audience_filter: audienceFilterSchema,
  template_id: z.string().uuid().nullable().optional(),
  subject: z.string().optional(),
  body: z.string().min(1, 'Message body is required'),
})

type CampaignFieldsInput = z.infer<typeof campaignFieldsSchema>

function requiresEmailSubject(data: CampaignFieldsInput): boolean {
  if (data.channel === 'email' || data.channel === 'both') {
    return !!data.subject && data.subject.trim().length > 0
  }
  return true
}

// ============================================================================
// Campaign Schemas
// ============================================================================

export const CreateCampaignSchema = campaignFieldsSchema.refine(requiresEmailSubject, {
  message: 'Subject is required for email campaigns',
  path: ['subject'],
})

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>

export const UpdateCampaignSchema = z
  .object({
    name: z.string().min(1, 'Campaign name is required').optional(),
    channel: channelSchema.optional(),
    segment_type: z.string().optional(),
    audience_filter: z
      .object({
        location: z.string().optional(),
        season: z.string().optional(),
        guest_ids: z.array(z.string().uuid()).optional(),
        date_from: z.string().optional(),
        date_to: z.string().optional(),
        site_ids: z.array(z.string().uuid()).optional(),
        site_types: z.array(z.string()).optional(),
      })
      .optional(),
    template_id: z.string().uuid().nullable().optional(),
    subject: z.string().nullable().optional(),
    body: z.string().min(1, 'Message body is required').optional(),
    status: z.enum(['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled']).optional(),
  })
  .refine(
    (data) => {
      if (data.channel === 'email' || data.channel === 'both') {
        return data.subject === undefined || (typeof data.subject === 'string' && data.subject.trim().length > 0)
      }
      return true
    },
    {
      message: 'Subject is required for email campaigns',
      path: ['subject'],
    },
  )

export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>

export const PreviewCampaignSchema = campaignFieldsSchema
  .omit({ name: true })
  .extend({ name: z.string().optional() })

export type PreviewCampaignInput = z.infer<typeof PreviewCampaignSchema>

export const ScheduleCampaignSchema = z
  .object({
    scheduled_at: z
      .string()
      .refine(
        (val) => {
          const date = new Date(val)
          return !isNaN(date.getTime()) && date > new Date()
        },
        { message: 'scheduled_at must be a valid ISO date in the future' },
      ),
  })
  .refine(
    (val) => {
      const date = new Date(val.scheduled_at)
      // Must be at least 1 minute in the future to avoid race conditions
      return date.getTime() - Date.now() > 60_000
    },
    {
      message: 'scheduled_at must be at least 1 minute in the future',
      path: ['scheduled_at'],
    },
  )

export type ScheduleCampaignInput = z.infer<typeof ScheduleCampaignSchema>

export const SendOneMessageSchema = z
  .object({
    channel: channelSchema,
    subject: z.string().optional(),
    body: z.string().min(1, 'Message body is required'),
  })
  .refine(
    (data) => {
      if (data.channel === 'email' || data.channel === 'both') {
        return !!data.subject && data.subject.trim().length > 0
      }
      return true
    },
    {
      message: 'Subject is required for email messages',
      path: ['subject'],
    },
  )

export type SendOneMessageInput = z.infer<typeof SendOneMessageSchema>


