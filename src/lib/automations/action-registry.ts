import type { ActionType, EventContext } from './types'

export interface ActionHandler {
  execute(actionConfig: Record<string, unknown>, context: EventContext): Promise<void>
}

export type ActionHandlerMap = Map<ActionType, ActionHandler>

/**
 * Registry of action handlers — most are stubs, send_email has a real implementation.
 */
export function createActionRegistry(): ActionHandlerMap {
  const registry = new Map<ActionType, ActionHandler>()

  // send_notification: in-app notification with activity log
  registry.set('send_notification', {
    async execute(config, context) {
      const channel = config.channel as string | undefined
      const priority = config.priority as string | undefined
      const message = config.message as string | undefined

      console.log(`[Automation Action] send_notification executed`, {
        channel,
        priority,
        message,
        propertyId: context.property?.id,
      })

      // Best-effort: create an activity log entry for the notification
      try {
        const { createServiceRoleClient } = await import('@/lib/supabase/service-role')
        const { recordActivityLog } = await import('@/shared/activity-log/record-activity-log')

        const supabase = createServiceRoleClient()
        const companyId = context.property?.company_id as string | undefined
        const propertyId = context.property?.id as string | undefined

        if (companyId && propertyId) {
          await recordActivityLog(
            supabase,
            {
              companyId,
              propertyId,
              action: 'notification',
              resource: 'automation',
              userId: null,
              details: `[${priority ?? 'normal'}] ${message ?? 'Automation notification'} (channel: ${channel ?? 'in-app'})`,
            },
            { failOpen: true },
          )
        }
      } catch (logErr) {
        // Non-blocking: activity log failure should not affect the automation
        console.error('[send_notification] Failed to create activity log entry', logErr)
      }
    },
  })

  const remainingStubTypes: ActionType[] = [
    'block_reservation',
    'flag_for_review',
    'apply_price_modifier',
    'apply_discount',
    'apply_surcharge',
    'require_document',
    'require_deposit',
    'enforce_policy',
    'create_work_order',
    'assign_staff',
    'update_site_status',
    'send_sms',
    'log_activity',
    'create_audit_entry',
  ]

  for (const type of remainingStubTypes) {
    registry.set(type, {
      async execute(config) {
        console.log(`[Automation Action] ${type} executed (stub)`, { config })
      },
    })
  }

  // Real send_email handler: queries DB for template, renders with context, sends via SMTP
  registry.set('send_email', {
    async execute(config, context) {
      const templateSlug = config.template as string | undefined
      if (!templateSlug) {
        console.error('[send_email] No template slug in action_config')
        return
      }

      try {
        const { createServiceRoleClient } = await import('@/lib/supabase/service-role')
        const { sendEmail, getFrom } = await import('@/lib/email/emailit')
        const { renderWithContext } = await import('@/lib/email/template-renderer')

        const supabase = createServiceRoleClient()

        // Resolve company_id from context
        const companyId = (context.property?.company_id ?? context.property?.company_id) as string | undefined
        if (!companyId) {
          console.error('[send_email] Cannot determine company_id from context')
          return
        }

        const propertyId = context.property?.id as string | undefined

        // Template resolution: property-specific → tenant-level
        let template: { subject_template: string; html_template: string } | null = null

        if (propertyId) {
          const { data } = await supabase
            .from('email_templates')
            .select('subject_template, html_template')
            .eq('company_id', companyId)
            .eq('property_id', propertyId)
            .eq('slug', templateSlug)
            .eq('is_active', true)
            .limit(1)
            .single()
          if (data) template = data
        }

        if (!template) {
          const { data } = await supabase
            .from('email_templates')
            .select('subject_template, html_template')
            .eq('company_id', companyId)
            .is('property_id', null)
            .eq('slug', templateSlug)
            .eq('is_active', true)
            .limit(1)
            .single()
          if (data) template = data
        }

        if (!template) {
          console.error(`[send_email] Template "${templateSlug}" not found for tenant ${companyId}`)
          return
        }

        // Resolve recipient email
        const guestEmail = context.guest?.email as string | undefined
        if (!guestEmail) {
          console.error('[send_email] No guest.email in event context')
          return
        }

        // Render with real context (enriched with computed fields + plain-text fallback)
        const { subject, html, text } = renderWithContext(
          template.subject_template,
          template.html_template,
          context as unknown as Record<string, unknown>,
        )

        const result = await sendEmail({
          from: getFrom(),
          to: guestEmail,
          subject,
          html,
          text,
        })

        if (!result.success) {
          console.error(`[send_email] Failed to send "${templateSlug}":`, result.error)
        } else {
          console.log(`[send_email] Sent "${templateSlug}" to ${guestEmail} (id: ${result.id})`)
        }
      } catch (err) {
        console.error(`[send_email] Error sending template "${templateSlug}":`, err)
      }
    },
  })

  return registry
}
