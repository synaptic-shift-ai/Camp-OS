/**
 * Server-side checks for company visibility in the dashboard (anon key + RLS).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/contracts/db'

/**
 * True if the user has a property_staff row for a property whose company_id matches.
 * Uses only property_staff + properties (no companies SELECT), so it works when companies RLS is owner-only.
 */
export async function userHasStaffAssignmentToCompany(
  supabase: SupabaseClient<Database>,
  userId: string,
  companyId: string
): Promise<boolean> {
  const { data: assignments, error: staffError } = await supabase
    .from('property_staff')
    .select('property_id')
    .eq('user_id', userId)

  if (staffError || !assignments?.length) {
    return false
  }

  const propertyIds = assignments
    .map((a) => a.property_id)
    .filter((id): id is string => id !== null)

  if (propertyIds.length === 0) {
    return false
  }

  const { data: matching, error: propError } = await supabase
    .from('properties')
    .select('id')
    .eq('company_id', companyId)
    .in('id', propertyIds)
    .limit(1)

  if (propError || !matching?.length) {
    return false
  }

  return true
}
