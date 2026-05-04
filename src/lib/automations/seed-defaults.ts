/**
 * Seed Default Email Automations & Email Templates
 *
 * Reads from global `default_email_templates` and `default_automations` tables
 * (populated by migration 20260429000001) and provisions per-company/per-property rows.
 *
 * Email template seeding:
 *   - New slugs → INSERT (copy from default)
 *   - Existing & not modified & version stale → UPDATE with new default content
 *   - Existing & user-modified (is_modified=true) → SKIP
 *
 * Automation seeding:
 *   - New trigger_type+phase combos → create automation + action rows
 *   - Existing & not modified & version stale → UPDATE name/description/sort_order + refresh actions
 *   - Existing & user-modified (is_modified=true) → SKIP
 *
 * Idempotent: safe to call repeatedly.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  createAutomationWithDetails,
  updateAutomationWithDetails,
  type CreateAutomationInput,
} from './queries'

// ============================================================================
// Types
// ============================================================================

interface DefaultEmailTemplate {
  id: string
  slug: string
  name: string
  description: string | null
  subject_template: string | null
  html_template: string | null
  category: string | null
  version: number
}

interface DefaultAutomation {
  id: string
  name: string
  description: string | null
  phase: string
  scope: string | null
  trigger_type: string
  trigger_config: Record<string, unknown> | null
  sort_order: number
  actions: Array<{
    action_type: string
    action_config: Record<string, unknown>
    sort_order: number
  }>
  version: number
}

interface ExistingTemplate {
  slug: string
  is_modified: boolean
  default_version: number | null
}

interface ExistingAutomation {
  id: string
  trigger_type: string
  phase: string
  is_modified: boolean
  default_version: number | null
}

// ============================================================================
// Seed Email Templates
// ============================================================================

/**
 * Ensure email templates for the given company are in sync with
 * `default_email_templates`. Three cases per slug:
 *
 *   1. NOT EXISTS  → INSERT copy (is_system_default=true, is_modified=false)
 *   2. EXISTS + !is_modified + default_version < template.version → UPDATE content
 *   3. EXISTS + is_modified → SKIP (user customized it)
 */
export async function seedEmailTemplates(companyId: string): Promise<void> {
  const supabase = createServiceRoleClient()

  // 1. Fetch all active defaults
  const { data: defaults, error: defaultsError } = await supabase
    .from('default_email_templates')
    .select('id, slug, name, description, subject_template, html_template, category, version')
    .eq('is_active', true)

  if (defaultsError) {
    console.error('[seed-defaults] Failed to fetch default_email_templates:', defaultsError)
    return
  }

  if (!defaults || defaults.length === 0) {
    console.warn('[seed-defaults] No default_email_templates found. Run migration 20260429000001.')
    return
  }

  const defaultTemplates = defaults as DefaultEmailTemplate[]
  const slugs = defaultTemplates.map((t) => t.slug)

  // 2. Fetch existing company-level templates for these slugs
  const { data: existing, error: existingError } = await supabase
    .from('email_templates')
    .select('slug, is_modified, default_version')
    .eq('company_id', companyId)
    .is('property_id', null)
    .in('slug', slugs)

  if (existingError) {
    console.error('[seed-defaults] Failed to fetch existing email_templates:', existingError)
    return
  }

  const existingMap = new Map<string, ExistingTemplate>()
  for (const row of (existing ?? []) as ExistingTemplate[]) {
    existingMap.set(row.slug, row)
  }

  // 3. Classify into inserts vs updates vs skips
  const toInsert: DefaultEmailTemplate[] = []
  const toUpdate: DefaultEmailTemplate[] = []

  for (const tmpl of defaultTemplates) {
    const existingRow = existingMap.get(tmpl.slug)

    if (!existingRow) {
      toInsert.push(tmpl)
    } else if (!existingRow.is_modified && (existingRow.default_version ?? 0) < tmpl.version) {
      toUpdate.push(tmpl)
    }
    // else: user modified → skip
  }

  if (toInsert.length === 0 && toUpdate.length === 0) {
    console.log('[seed-defaults] Email templates up-to-date for company', companyId)
    return
  }

  // 4. Insert missing templates
  if (toInsert.length > 0) {
    const rows = toInsert.map((tmpl) => ({
      company_id: companyId,
      property_id: null,
      slug: tmpl.slug,
      name: tmpl.name,
      description: tmpl.description,
      subject_template: tmpl.subject_template ?? '',
      html_template: tmpl.html_template ?? '',
      category: tmpl.category ?? 'custom',
      is_system_default: true,
      is_modified: false,
      default_version: tmpl.version,
      is_active: true,
    }))

    const { error: insertError } = await supabase
      .from('email_templates')
      .insert(rows)

    if (insertError) {
      console.error('[seed-defaults] Failed to insert email templates:', insertError)
    } else {
      console.log(`[seed-defaults] Inserted ${toInsert.length} email template(s) for company ${companyId}`)
    }
  }

  // 5. Update stale unmodified templates
  for (const tmpl of toUpdate) {
    const { error: updateError } = await supabase
      .from('email_templates')
      .update({
        name: tmpl.name,
        description: tmpl.description,
        subject_template: tmpl.subject_template ?? '',
        html_template: tmpl.html_template ?? '',
        category: tmpl.category ?? 'custom',
        default_version: tmpl.version,
      })
      .eq('company_id', companyId)
      .is('property_id', null)
      .eq('slug', tmpl.slug)
      .eq('is_modified', false)

    if (updateError) {
      console.error(`[seed-defaults] Failed to update template "${tmpl.slug}":`, updateError)
    }
  }

  if (toUpdate.length > 0) {
    console.log(`[seed-defaults] Updated ${toUpdate.length} stale email template(s) for company ${companyId}`)
  }
}

// ============================================================================
// Seed Default Automations
// ============================================================================

/**
 * Seed default email automations for a property by reading from
 * `default_automations`. For each default:
 *
 *   - If no automation with the same trigger_type + phase exists → create it
 *   - If exists AND is_modified=false AND default_version < auto.version → update it
 *   - If exists AND is_modified=true → SKIP
 */
export async function seedDefaultEmailAutomations(
  propertyId: string,
  companyId: string,
): Promise<void> {
  // 1. Ensure email templates exist for the company
  await seedEmailTemplates(companyId)

  const supabase = createServiceRoleClient()

  // 2. Fetch all active default automations
  const { data: defaults, error: defaultsError } = await supabase
    .from('default_automations')
    .select('id, name, description, phase, scope, trigger_type, trigger_config, sort_order, actions, version')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (defaultsError) {
    console.error('[seed-defaults] Failed to fetch default_automations:', defaultsError)
    throw defaultsError
  }

  if (!defaults || defaults.length === 0) {
    console.warn('[seed-defaults] No default_automations found. Run migration 20260429000001.')
    return
  }

  const defaultAutomations = defaults as DefaultAutomation[]

  // 3. Check existing automations for this property — fetch version tracking columns too
  const { data: existing, error: fetchError } = await supabase
    .from('automations' as any)
    .select('id, trigger_type, phase, is_modified, default_version')
    .eq('property_id', propertyId)
    .eq('company_id', companyId)

  if (fetchError) {
    console.error('[seed-defaults] Failed to check existing automations:', fetchError)
    throw fetchError
  }

  const existingRows = (existing ?? []) as ExistingAutomation[]
  const existingByKey = new Map<string, ExistingAutomation>()
  for (const row of existingRows) {
    existingByKey.set(`${row.trigger_type}:${row.phase}`, row)
  }

  // 4. Classify: create / update / skip
  const toCreate: DefaultAutomation[] = []
  const toUpdate: { def: DefaultAutomation; existingId: string }[] = []

  for (const def of defaultAutomations) {
    const key = `${def.trigger_type}:${def.phase}`
    const existingRow = existingByKey.get(key)

    if (!existingRow) {
      toCreate.push(def)
    } else if (!existingRow.is_modified && (existingRow.default_version ?? 0) < def.version) {
      toUpdate.push({ def, existingId: existingRow.id })
    }
    // else: is_modified=true → skip (user customized)
  }

  // 5. Create missing automations
  for (const def of toCreate) {
    const actions = (def.actions ?? []).map((a, idx) => ({
      actionType: a.action_type as CreateAutomationInput['actions'][number]['actionType'],
      actionConfig: a.action_config ?? {},
      sortOrder: a.sort_order ?? idx,
    }))

    await createAutomationWithDetails({
      companyId,
      propertyId,
      name: def.name,
      ...(def.description ? { description: def.description } : {}),
      phase: def.phase as CreateAutomationInput['phase'],
      scope: (def.scope as CreateAutomationInput['scope']) ?? 'property',
      isActive: true,
      triggerType: def.trigger_type as CreateAutomationInput['triggerType'],
      triggerConfig: def.trigger_config ?? {},
      sortOrder: def.sort_order,
      conditionGroups: [],
      actions,
    })
  }

  if (toCreate.length > 0) {
    console.log(`[seed-defaults] Created ${toCreate.length} automation(s) for property ${propertyId}`)
  }

  // 6. Update stale unmodified automations (refresh name/description/actions/version)
  for (const { def, existingId } of toUpdate) {
    const actions = (def.actions ?? []).map((a, idx) => ({
      actionType: a.action_type as CreateAutomationInput['actions'][number]['actionType'],
      actionConfig: a.action_config ?? {},
      sortOrder: a.sort_order ?? idx,
    }))

    await updateAutomationWithDetails(existingId, {
      name: def.name,
      ...(def.description ? { description: def.description } : { description: null }),
      sortOrder: def.sort_order,
      actions,
    })

    // Bump default_version on the automation row
    const { error: versionError } = await supabase
      .from('automations' as any)
      .update({ default_version: def.version })
      .eq('id', existingId)

    if (versionError) {
      console.error(`[seed-defaults] Failed to bump default_version for automation ${existingId}:`, versionError)
    }
  }

  if (toUpdate.length > 0) {
    console.log(`[seed-defaults] Updated ${toUpdate.length} stale automation(s) for property ${propertyId}`)
  }

  if (toCreate.length === 0 && toUpdate.length === 0) {
    console.log('[seed-defaults] All automations up-to-date for property', propertyId)
  }
}
