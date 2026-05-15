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

  // send_notification: creates activity log entries for in-app notifications
  registry.set('send_notification', {
    async execute(config, context) {
      try {
        const { createServiceRoleClient } = await import('@/lib/supabase/service-role')
        const { recordActivityLog } = await import('@/shared/activity-log/record-activity-log')

        const supabase = createServiceRoleClient()
        const propertyId = context.property?.id as string | undefined
        const companyId = context.property?.company_id as string | undefined
        if (!companyId || !propertyId) {
          console.warn('[send_notification] Missing companyId or propertyId in context')
          return
        }

        const channel = (config.channel as string) ?? 'staff'
        const priority = (config.priority as string) ?? 'medium'
        const message = (config.message as string) ?? 'Automation notification'

        await recordActivityLog(
          supabase,
          {
            companyId,
            propertyId,
            action: 'notification',
            resource: 'automation',
            userId: null,
            details: `[${priority.toUpperCase()}] ${channel}: ${message}`,
          },
          { failOpen: true },
        )

        console.log(`[send_notification] Activity log created: [${priority}] ${channel}: ${message}`)
      } catch (err) {
        console.error('[send_notification] Failed to create activity log entry:', err)
      }
    },
  })

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
        const { enrichContext, renderWithContext, replaceVariables } = await import(
          '@/lib/email/template-renderer'
        )
        const { render } = await import('@react-email/components')
        const { PreArrivalEmail, buildPreArrivalEmailPropsFromEventContext } = await import(
          '@/lib/email/templates/pre-arrival'
        )

        const supabase = createServiceRoleClient()

        // Resolve company_id from context
        const companyId = (context.property?.company_id ?? context.property?.company_id) as string | undefined
        if (!companyId) {
          console.error('[send_email] Cannot determine company_id from context')
          return
        }

        const propertyId = context.property?.id as string | undefined
        const guestId = context.guest?.id as string | undefined

        // Template resolution: property-specific → tenant-level
        let template: { id: string; subject_template: string; html_template: string } | null = null

        if (propertyId) {
          const { data } = await supabase
            .from('email_templates')
            .select('id, subject_template, html_template')
            .eq('company_id', companyId)
            .eq('property_id', propertyId)
            .eq('slug', templateSlug)
            .eq('status', 'active')
            .limit(1)
            .single()
          if (data) template = data
        }

        if (!template) {
          const { data } = await supabase
            .from('email_templates')
            .select('id, subject_template, html_template')
            .eq('company_id', companyId)
            .is('property_id', null)
            .eq('slug', templateSlug)
            .eq('status', 'active')
            .limit(1)
            .single()
          if (data) template = data
        }

        if (!template) {
          console.error(`[send_email] Template "${templateSlug}" not found for tenant ${companyId}`)
          return
        }

        // Resolve recipient email based on recipient_source
        const recipientSource = (config.recipient_source as string) ?? 'guest'
        let recipientEmail: string | undefined

        if (recipientSource === 'staff') {
          recipientEmail = context.staff?.email as string | undefined
        } else if (recipientSource === 'vendor') {
          recipientEmail = context.vendor?.email as string | undefined
        } else {
          // Default: guest
          recipientEmail = context.guest?.email as string | undefined
        }

        if (!recipientEmail) {
          console.error(`[send_email] No recipient email resolved (source: ${recipientSource})`)
          return
        }

        // ── Opt-out check (non-blocking) ────────────────────────────────────
        if (guestId && propertyId) {
          try {
            const { isOptedOut } = await import('@/lib/communications/opt-out-checker')
            const { logDelivery } = await import('@/lib/communications/delivery-logger')

            const optedOut = await isOptedOut(supabase, companyId, guestId, 'email')
            if (optedOut) {
              await logDelivery({
                supabase,
                companyId,
                propertyId,
                guestId,
                templateId: template.id,
                channel: 'email',
                recipientAddress: recipientEmail,
                subject: template.subject_template,
                status: 'skipped',
              }).catch(() => {})
              console.log(`[send_email] Skipped "${templateSlug}" — guest ${guestId} opted out`)
              return
            }
          } catch (optOutErr) {
            console.error('[send_email] Opt-out check failed, proceeding with send:', optOutErr)
          }
        }

        // ── Fetch branding (non-blocking) ────────────────────────────────────
        let branding: import('@/lib/communications/branding-applier').BrandingConfig | null = null
        if (propertyId) {
          try {
            const { getPropertyBranding } = await import('@/lib/communications/branding-applier')
            branding = await getPropertyBranding(supabase, propertyId)
          } catch (brandingErr) {
            console.error('[send_email] Branding fetch failed, sending without branding:', brandingErr)
          }
        }

        // ── Render body: React template for pre_arrival; merge-field HTML otherwise ──
        const ctxRecord = context as unknown as Record<string, unknown>
        let subject: string
        let html: string
        let text: string

        if (templateSlug === 'pre_arrival') {
          const preArrivalBranding = branding
            ? { logoUrl: branding.logoUrl, primaryColor: branding.primaryColor }
            : null
          const preArrivalProps = buildPreArrivalEmailPropsFromEventContext(ctxRecord, preArrivalBranding)
          if (preArrivalProps) {
            const enriched = enrichContext(ctxRecord)
            subject = replaceVariables(template.subject_template, enriched)
            html = await render(PreArrivalEmail(preArrivalProps))
            text = html
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<\/p>/gi, '\n\n')
              .replace(/<[^>]+>/g, '')
              .replace(/\n{3,}/g, '\n\n')
              .trim()
          } else {
            const rendered = renderWithContext(
              template.subject_template,
              template.html_template,
              ctxRecord,
              branding
                ? {
                    logoUrl: branding.logoUrl,
                    primaryColor: branding.primaryColor,
                    secondaryColor: branding.secondaryColor,
                    senderName: branding.senderName,
                    propertyName: branding.propertyName,
                  }
                : undefined,
            )
            subject = rendered.subject
            html = rendered.html
            text = rendered.text
          }
        } else {
          const rendered = renderWithContext(
            template.subject_template,
            template.html_template,
            ctxRecord,
            branding
              ? {
                  logoUrl: branding.logoUrl,
                  primaryColor: branding.primaryColor,
                  secondaryColor: branding.secondaryColor,
                  senderName: branding.senderName,
                  propertyName: branding.propertyName,
                }
              : undefined,
          )
          subject = rendered.subject
          html = rendered.html
          text = rendered.text
        }

        // ── Generate unsubscribe URL & inject ────────────────────────────────
        let finalHtml = html
        let finalText = text
        if (guestId && propertyId) {
          try {
            const { generateUnsubscribeToken } = await import('@/lib/communications/unsubscribe')
            const token = generateUnsubscribeToken(guestId, propertyId)
            const unsubscribeUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.camposapp.com'}/api/public/unsubscribe/${token}`
            finalHtml = html.replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl)
            finalText = text.replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl)
          } catch (tokenErr) {
            console.error('[send_email] Unsubscribe token generation failed:', tokenErr)
          }
        }

        // ── Log delivery (non-blocking) ──────────────────────────────────────
        let deliveryLog: import('@/lib/communications/delivery-logger').CommunicationLogRow | null = null
        try {
          const { logDelivery } = await import('@/lib/communications/delivery-logger')
          deliveryLog = await logDelivery({
            supabase,
            companyId,
            propertyId: propertyId ?? '',
            reservationId: context.reservation?.id as string | null,
            guestId: guestId ?? null,
            templateId: template.id,
            channel: 'email',
            recipientAddress: recipientEmail,
            subject,
            status: 'sent',
          })
        } catch (logErr) {
          console.error('[send_email] Delivery log failed, sending anyway:', logErr)
        }

        // ── Send email ───────────────────────────────────────────────────────
        const result = await sendEmail({
          from: getFrom(),
          to: recipientEmail,
          subject,
          html: finalHtml,
          text: finalText,
        })

        const smtpRetryCount = Math.max(0, result.attempts - 1)

        // ── Update delivery status (non-blocking) ────────────────────────────
        if (deliveryLog) {
          try {
            const { updateDeliveryStatus } = await import('@/lib/communications/delivery-logger')
            if (result.success) {
              await updateDeliveryStatus({
                supabase,
                logId: deliveryLog.id,
                status: 'delivered',
                deliveredAt: new Date().toISOString(),
                retryCount: smtpRetryCount,
              })
            } else {
              await updateDeliveryStatus({
                supabase,
                logId: deliveryLog.id,
                status: 'failed',
                failureReason: result.error,
                retryCount: smtpRetryCount,
              })
            }
          } catch (statusErr) {
            console.error('[send_email] Delivery status update failed:', statusErr)
          }
        }

        if (!result.success) {
          console.error(`[send_email] Failed to send "${templateSlug}":`, result.error)
        } else {
          console.log(`[send_email] Sent "${templateSlug}" to ${recipientEmail} (id: ${result.id})`)
        }
      } catch (err) {
        console.error(`[send_email] Error sending template "${templateSlug}":`, err)
      }
    },
  })

  return registry
}
