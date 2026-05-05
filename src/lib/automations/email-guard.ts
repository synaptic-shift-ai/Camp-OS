/**
 * Email Guard
 *
 * Checks if an active automation with a send_email action exists
 * AND a matching email template is available. Only if BOTH are true,
 * the automation can handle the email (and the direct call should be skipped).
 *
 * Safe default: if the guard query fails, returns false so the direct
 * email is still sent.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { TriggerType } from './types'
import { seedDefaultEmailAutomations } from './seed-defaults'

// ============================================================================
// Helper: verify automation actions + email template
// ============================================================================

/**
 * Given a list of automation IDs, check if any have a send_email action
 * and if the specified email template exists for the company.
 */
async function checkAutomationCanHandle(
  supabase: ReturnType<typeof createServiceRoleClient>,
  automationIds: string[],
  templateSlug: string,
  companyId?: string,
): Promise<boolean> {
  // 1. Check if any of these automations have a send_email action
  const { data: actions, error: actionError } = await supabase
    .from('automation_actions' as any)
    .select('automation_id')
    .in('automation_id', automationIds)
    .eq('action_type', 'send_email')
    .limit(1)

  if (actionError || !actions || actions.length === 0) {
    console.log('[EmailGuard] No send_email actions found for automations:', automationIds)
    return false
  }

  console.log('[EmailGuard] send_email actions found:', actions.length)

  // 2. Check if an email template with this slug exists for the property's company
  let templateQuery = supabase
    .from('email_templates')
    .select('id')
    .eq('slug', templateSlug)
    .eq('is_active', true)
    .limit(1)

  // Check company-level template
  if (companyId) {
    templateQuery = supabase
      .from('email_templates')
      .select('id')
      .eq('slug', templateSlug)
      .eq('is_active', true)
      .eq('company_id', companyId)
      .limit(1)
  }

  const { data: templates, error: templateError } = await templateQuery

  if (templateError || !templates || templates.length === 0) {
    console.log('[EmailGuard] No email template found:', { templateSlug, companyId })
    return false
  }

  console.log('[EmailGuard] Templates found:', templates.length)
  console.log('[EmailGuard] Result: automation CAN handle email')

  // Both checks pass — automation can handle the email
  return true
}

// ============================================================================
// Main guard
// ============================================================================

/**
 * Check if an active automation with send_email action exists
 * AND a matching email template is available for the property/company.
 *
 * Returns true only if both checks pass — meaning the automation engine
 * will handle sending the email and the direct call can be skipped.
 */
export async function canAutomationHandleEmail(
  triggerTypes: TriggerType | TriggerType[],
  propertyId: string,
  templateSlug: string,
): Promise<boolean> {
  try {
    const triggerArray = Array.isArray(triggerTypes) ? triggerTypes : [triggerTypes]
    console.log('[EmailGuard] Checking:', { triggerTypes: triggerArray, propertyId, templateSlug })

    const supabase = createServiceRoleClient()

    // 1. Find active automations with this trigger that have a send_email action
    //    Look for both property-scoped and system (property_id IS NULL) automations.
    //    We need the company_id to scope system automations.
    const { data: property } = await supabase
      .from('properties')
      .select('company_id')
      .eq('id', propertyId)
      .single()

    const companyId = (property as Record<string, unknown> | null)?.company_id as string | undefined

    const orParts = [`property_id.eq.${propertyId}`]
    if (companyId) {
      orParts.push(`and(property_id.is.null,company_id.eq.${companyId})`)
    }

    const { data: automations, error: autError } = await supabase
      .from('automations' as any)
      .select('id')
      .or(orParts.join(','))
      .eq('is_active', true)
      .in('trigger_type', Array.isArray(triggerTypes) ? triggerTypes : [triggerTypes])

    if (autError || !automations || automations.length === 0) {
      console.log('[EmailGuard] No active automations found for triggers:', triggerArray)
      // Lazy seed: create default automations and re-check
      if (companyId) {
        try {
          await seedDefaultEmailAutomations(propertyId, companyId)

          // Re-query after seeding
          const { data: seeded, error: seedError } = await supabase
            .from('automations' as any)
            .select('id')
            .or(orParts.join(','))
            .eq('is_active', true)
            .in('trigger_type', Array.isArray(triggerTypes) ? triggerTypes : [triggerTypes])

          if (seedError || !seeded || seeded.length === 0) {
            return false
          }

          // Continue with seeded results
          const automationIdsAfterSeed = (seeded as any[]).map(
            (a: any) => (a as Record<string, unknown>).id as string,
          )
          return checkAutomationCanHandle(supabase, automationIdsAfterSeed, templateSlug, companyId)
        } catch (seedErr) {
          console.error('[email-guard] Lazy seed failed:', seedErr)
          return false
        }
      } else {
        return false
      }
    }

    const automationIds = (automations as any[]).map(
      (a: any) => (a as Record<string, unknown>).id as string,
    )

    console.log('[EmailGuard] Active automations found:', automationIds.length)

    return checkAutomationCanHandle(supabase, automationIds, templateSlug, companyId)
  } catch (err) {
    // Safe default: if anything goes wrong, let the direct email through
    console.error('[email-guard] Guard check failed, falling back to direct email', {
      triggerTypes,
      propertyId,
      templateSlug,
      error: err instanceof Error ? err.message : String(err),
    })
    return false
  }
}
