/**
 * Deduplication
 *
 * Checks the automation_execution_log to find entities already processed
 * within a deduplication window. Matches the existing pattern from the
 * reminder cron routes exactly.
 *
 * Supports both property-scoped and system-scoped automations:
 * - Property-scoped: queries with property_id = <propertyId>
 * - System-scoped (propertyId = null): queries with property_id IS NULL
 */

import type { SupabaseClient } from '@supabase/supabase-js'

interface DedupeParams {
  automationId: string
  propertyId: string | null
  entityType: string
  dedupeWindow: 'hour' | 'day'
  supabase: SupabaseClient
}

/**
 * Get the set of entity IDs already processed for this automation
 * within the deduplication window.
 *
 * Patterns match the existing cron routes exactly:
 * - "day"  → created_at >= 'YYYY-MM-DDT00:00:00' AND <= 'YYYY-MM-DDT23:59:59'
 * - "hour" → created_at >= 'YYYY-MM-DDTHH:00:00' AND <= 'YYYY-MM-DDTHH:59:59'
 */
export async function getAlreadyProcessedEntityIds(params: DedupeParams): Promise<Set<string>> {
  const { automationId, propertyId, dedupeWindow, supabase } = params

  const now = new Date()
  const today = now.toISOString().slice(0, 10) // YYYY-MM-DD

  let gteStr: string
  let lteStr: string

  if (dedupeWindow === 'day') {
    gteStr = `${today}T00:00:00`
    lteStr = `${today}T23:59:59`
  } else {
    // hour window
    const hourStr = now.toISOString().slice(0, 13) // YYYY-MM-DDTHH
    const nextHourDate = new Date(now.getTime())
    nextHourDate.setUTCHours(nextHourDate.getUTCHours() + 1)
    const nextHourStr = nextHourDate.toISOString().slice(0, 13)

    gteStr = `${hourStr}:00:00`
    lteStr = `${nextHourStr.slice(0, 10)}T${nextHourStr.slice(11)}:59:59`
  }

  // Build query — match by automation_id + time window
  // For system automations (propertyId = null), also check rows where property_id IS NULL
  let query = supabase
    .from('automation_execution_log')
    .select('entity_id')
    .eq('automation_id', automationId)
    .gte('created_at', gteStr)
    .lte('created_at', lteStr)

  if (propertyId === null) {
    // System-scoped automation: check entries with property_id IS NULL
    query = query.is('property_id', null)
  } else {
    // Property-scoped automation: check entries with the specific property_id
    query = query.eq('property_id', propertyId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[Unified Scheduler] Dedupe query failed:', error)
    return new Set()
  }

  const ids = new Set<string>()
  for (const row of data ?? []) {
    if (row.entity_id) {
      ids.add(row.entity_id)
    }
  }

  return ids
}
