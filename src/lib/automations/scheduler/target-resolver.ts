/**
 * Target Resolver
 *
 * Generic entity query builder for the unified scheduler.
 * Reads `trigger_config` and queries the correct table to find
 * entities that should trigger automations.
 */

import type { ScheduledTriggerConfig } from '../types'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface ResolvedTarget {
  entityId: string
  entityType: string
  entity: Record<string, unknown>
}

/**
 * Whitelisted dateField values per target type to prevent SQL injection.
 */
const ALLOWED_DATE_FIELDS: Record<string, ReadonlySet<string>> = {
  reservations: new Set(['check_in_date', 'check_out_date', 'created_at']),
  guests: new Set(['created_at']),
  sites: new Set(['created_at']),
  property: new Set([]),
}

/**
 * Fields that store timestamps (YYYY-MM-DDTHH:MM:SS) rather than dates (YYYY-MM-DD).
 * These need a range query instead of exact equality.
 */
const TIMESTAMP_FIELDS = new Set(['created_at', 'updated_at'])

function getAllowedDateFields(target: string): ReadonlySet<string> {
  return ALLOWED_DATE_FIELDS[target] ?? new Set<string>()
}

/**
 * Compute the target date string (YYYY-MM-DD) applying offsetDays to today.
 */
function zonedDateParts(date: Date, timezone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return {
    year: Number(value('year')),
    month: Number(value('month')),
    day: Number(value('day')),
  }
}

function computeTargetDate(offsetDays: number, timezone: string): string {
  const parts = zonedDateParts(new Date(), timezone)
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + offsetDays))
  return d.toISOString().slice(0, 10)
}

/**
 * Resolve status list from config: prefers `statuses` (array), falls back to
 * legacy `status` (single string or comma-separated).
 */
function resolveStatuses(config: ScheduledTriggerConfig): string[] {
  if (config.statuses && config.statuses.length > 0) {
    return config.statuses
  }
  if (config.status) {
    // Legacy: could be single value or comma-separated
    return config.status.split(',').map(s => s.trim()).filter(Boolean)
  }
  return []
}

/**
 * Apply date field filter to a query, using range for timestamp fields
 * and exact match for date fields.
 */
function applyDateFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  dateField: string,
  targetDate: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (TIMESTAMP_FIELDS.has(dateField)) {
    return query
      .gte(dateField, `${targetDate}T00:00:00`)
      .lte(dateField, `${targetDate}T23:59:59`)
  }
  return query.eq(dateField, targetDate)
}

/**
 * Resolve target entities based on the trigger configuration.
 */
export async function resolveTargets(
  config: ScheduledTriggerConfig,
  propertyId: string,
  companyId: string,
  supabase: SupabaseClient,
  timezone: string,
): Promise<ResolvedTarget[]> {
  const { target } = config

  switch (target) {
    case 'reservations':
      return resolveReservationTargets(config, propertyId, supabase, timezone)
    case 'guests':
      return resolveGuestTargets(config, propertyId, supabase, timezone)
    case 'sites':
      return resolveSiteTargets(config, propertyId, supabase, timezone)
    case 'property':
      return resolvePropertyTargets(propertyId, supabase)
    default:
      console.warn(`[Unified Scheduler] Unknown target type: ${target}`)
      return []
  }
}

/**
 * Resolve reservation targets with date/status filtering.
 */
async function resolveReservationTargets(
  config: ScheduledTriggerConfig,
  propertyId: string,
  supabase: SupabaseClient,
  timezone: string,
): Promise<ResolvedTarget[]> {
  const dateField = config.dateField ?? 'check_in_date'
  const offsetDays = config.offsetDays ?? 0
  const statuses = resolveStatuses(config)

  // Validate dateField against whitelist
  if (!getAllowedDateFields('reservations').has(dateField)) {
    console.warn(`[Unified Scheduler] Invalid dateField for reservations: ${dateField}`)
    return []
  }

  const targetDate = computeTargetDate(offsetDays, timezone)

  let query = supabase
    .from('reservations')
    .select('id, property_id, guest_id, site_id, confirmation_number, check_in_date, check_out_date, status')
    .eq('property_id', propertyId)

  query = applyDateFilter(query, dateField, targetDate)

  if (statuses.length === 1) {
    query = query.eq('status', statuses[0])
  } else if (statuses.length > 1) {
    query = query.in('status', statuses)
  }

  const { data, error } = await query

  if (error) {
    console.error(`[Unified Scheduler] Failed to fetch reservations:`, error)
    return []
  }

  return (data ?? []).map((r) => ({
    entityId: r.id,
    entityType: 'reservation',
    entity: r as unknown as Record<string, unknown>,
  }))
}

/**
 * Resolve guest targets with date/status filtering.
 */
async function resolveGuestTargets(
  config: ScheduledTriggerConfig,
  propertyId: string,
  supabase: SupabaseClient,
  timezone: string,
): Promise<ResolvedTarget[]> {
  const dateField = config.dateField
  const offsetDays = config.offsetDays ?? 0
  const statuses = resolveStatuses(config)

  // Validate dateField against whitelist
  if (dateField && !getAllowedDateFields('guests').has(dateField)) {
    console.warn(`[Unified Scheduler] Invalid dateField for guests: ${dateField}`)
    return []
  }

  let query = supabase
    .from('guests')
    .select('*')
    .eq('property_id', propertyId)

  if (dateField) {
    const targetDate = computeTargetDate(offsetDays, timezone)
    query = applyDateFilter(query, dateField, targetDate)
  }

  if (statuses.length === 1) {
    query = query.eq('status', statuses[0])
  } else if (statuses.length > 1) {
    query = query.in('status', statuses)
  }

  const { data, error } = await query

  if (error) {
    console.error(`[Unified Scheduler] Failed to fetch guests:`, error)
    return []
  }

  return (data ?? []).map((g) => ({
    entityId: g.id,
    entityType: 'guest',
    entity: g as unknown as Record<string, unknown>,
  }))
}

/**
 * Resolve site targets with date/status filtering.
 */
async function resolveSiteTargets(
  config: ScheduledTriggerConfig,
  propertyId: string,
  supabase: SupabaseClient,
  timezone: string,
): Promise<ResolvedTarget[]> {
  const dateField = config.dateField
  const offsetDays = config.offsetDays ?? 0
  const statuses = resolveStatuses(config)

  // Validate dateField against whitelist
  if (dateField && !getAllowedDateFields('sites').has(dateField)) {
    console.warn(`[Unified Scheduler] Invalid dateField for sites: ${dateField}`)
    return []
  }

  let query = supabase
    .from('sites')
    .select('*')
    .eq('property_id', propertyId)

  if (dateField) {
    const targetDate = computeTargetDate(offsetDays, timezone)
    query = applyDateFilter(query, dateField, targetDate)
  }

  if (statuses.length === 1) {
    query = query.eq('status', statuses[0])
  } else if (statuses.length > 1) {
    query = query.in('status', statuses)
  }

  const { data, error } = await query

  if (error) {
    console.error(`[Unified Scheduler] Failed to fetch sites:`, error)
    return []
  }

  return (data ?? []).map((s) => ({
    entityId: s.id,
    entityType: 'site',
    entity: s as unknown as Record<string, unknown>,
  }))
}

/**
 * Resolve property target — single entity, no date/status filter.
 */
async function resolvePropertyTargets(
  propertyId: string,
  supabase: SupabaseClient,
): Promise<ResolvedTarget[]> {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single()

  if (error || !data) {
    console.error(`[Unified Scheduler] Failed to fetch property ${propertyId}:`, error)
    return []
  }

  return [{
    entityId: propertyId,
    entityType: 'property',
    entity: data as unknown as Record<string, unknown>,
  }]
}
