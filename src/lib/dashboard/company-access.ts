/**
 * Server-side checks for company visibility in the dashboard (anon key + RLS).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/contracts/db'

/**
 * True if the user has access to a company — either as the direct company owner
 * (companies.owner_id) or via a property_staff assignment to a property that
 * belongs to the company (property_staff → properties.company_id).
 *
 * Callers should pass a service-role client so that RLS does not block the
 * companies lookup for non-owner users.
 */
export async function userHasStaffAssignmentToCompany(
  supabase: SupabaseClient<Database>,
  userId: string,
  companyId: string
): Promise<boolean> {
  // Fast path: user is the direct company owner
  const { data: ownedCompany } = await supabase
    .from('companies')
    .select('id')
    .eq('id', companyId)
    .eq('owner_id', userId)
    .maybeSingle()

  if (ownedCompany?.id) return true

  // Fallback: user is a staff member of at least one property in this company
  const { data: assignments, error: staffError } = await supabase
    .from('property_staff')
    .select('property_id')
    .eq('user_id', userId)

  const propertyIds = (!staffError && assignments?.length)
    ? assignments.map((a) => a.property_id).filter((id): id is string => id !== null)
    : []

  if (propertyIds.length === 0) return false

  const { data: matching, error: propError } = await supabase
    .from('properties')
    .select('id')
    .eq('company_id', companyId)
    .in('id', propertyIds)
    .limit(1)

  return !propError && !!matching?.length
}
