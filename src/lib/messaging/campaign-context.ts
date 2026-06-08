/**
 * Campaign Context Builder
 *
 * Builds guest/property/reservation/site context for campaign personalization.
 * Uses the same merge-field paths as email templates (e.g. guest.first_name).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Channel } from './messaging-types'
import { enrichContext, renderWithContext, replaceVariables } from '@/lib/email/template-renderer'
import { getPropertyBranding } from '@/lib/communications/branding-applier'

// ============================================================================
// Context building
// ============================================================================

/**
 * Build merge-field context for a single guest in a campaign.
 * Includes the most recent reservation (and site) for that guest at the property.
 */
export async function buildCampaignGuestContext(
  supabase: SupabaseClient,
  propertyId: string,
  guest: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const guestId = String(guest.id ?? '')
  const context: Record<string, unknown> = {
    guest: { ...guest },
  }

  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single()

  if (property) {
    context.property = property as Record<string, unknown>
  }

  if (guestId) {
    const { data: reservation } = await supabase
      .from('reservations')
      .select('*')
      .eq('property_id', propertyId)
      .eq('guest_id', guestId)
      .order('check_out_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (reservation) {
      context.reservation = reservation as Record<string, unknown>

      const siteId = (reservation as Record<string, unknown>).site_id as string | undefined
      if (siteId) {
        const { data: site } = await supabase
          .from('sites')
          .select('*')
          .eq('id', siteId)
          .single()

        if (site) {
          context.site = site as Record<string, unknown>
        }
      }
    }
  }

  // Legacy flat keys used by SMS campaign editor ({{guest_first_name}}, etc.)
  context.guest_first_name = String(guest.first_name ?? '')
  context.guest_last_name = String(guest.last_name ?? '')
  context.guest_email = String(guest.email ?? '')
  context.guest_phone = String(guest.phone ?? '')
  if (property) {
    const prop = property as Record<string, unknown>
    context.location = String(prop.name ?? prop.address ?? '')
  }

  return context
}

// ============================================================================
// Personalization
// ============================================================================

export type PersonalizedCampaignMessage = {
  subject: string | null
  body: string
}

/**
 * Personalize campaign subject/body using email-template merge fields.
 * Email channel uses full HTML rendering; SMS uses plain-text substitution.
 */
export async function personalizeCampaignMessage(
  supabase: SupabaseClient,
  params: {
    propertyId: string
    channel: Channel
    subject: string | null
    body: string
    context: Record<string, unknown>
  },
): Promise<PersonalizedCampaignMessage> {
  const { propertyId, channel, subject, body, context } = params
  const subjectText = subject ?? ''

  if (channel === 'sms') {
    const enriched = enrichContext(context)
    return {
      subject: subjectText ? replaceVariables(subjectText, enriched) : null,
      body: replaceVariables(body, enriched),
    }
  }

  // Email (and 'both' email body): use template renderer for dotted paths + HTML
  let branding:
    | {
        logoUrl: string | null
        primaryColor: string | null
        secondaryColor: string | null
        senderName: string
        propertyName: string
      }
    | undefined

  try {
    const config = await getPropertyBranding(supabase, propertyId)
    branding = {
      logoUrl: config.logoUrl,
      primaryColor: config.primaryColor,
      secondaryColor: config.secondaryColor,
      senderName: config.senderName,
      propertyName: config.propertyName,
    }
  } catch {
    branding = undefined
  }

  const rendered = renderWithContext(subjectText, body, context, branding)

  return {
    subject: rendered.subject || null,
    body: rendered.html,
  }
}
