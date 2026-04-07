import type { User } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'

export type RecordLoginActivityResult =
  | { logged: true }
  | { logged: false; reason: string }

function displayNameForActivityDetails(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const fullName = typeof meta?.full_name === 'string' ? meta.full_name.trim() : ''
  if (fullName.length > 0) return fullName
  return user.email ?? 'User'
}

async function resolveCompanyIdForUser(
  admin: ReturnType<typeof createServiceRoleClient>,
  userId: string
): Promise<string | null> {
  const { data: owned, error: ownedError } = await admin
    .from('companies')
    .select('id')
    .eq('owner_id', userId)
    .limit(1)
    .maybeSingle()

  if (!ownedError && owned?.id) {
    return owned.id
  }

  const { data: staffRow, error: staffError } = await admin
    .from('property_staff')
    .select('property_id')
    .eq('user_id', userId)
    .not('property_id', 'is', null)
    .limit(1)
    .maybeSingle()

  if (staffError || !staffRow?.property_id) {
    return null
  }

  const { data: propertyRow } = await admin
    .from('properties')
    .select('company_id')
    .eq('id', staffRow.property_id)
    .maybeSingle()

  return propertyRow?.company_id ?? null
}

export async function recordLoginActivityLogForUser(user: User): Promise<RecordLoginActivityResult> {
  if (!user.app_metadata?.custom_email_verified) {
    return { logged: false, reason: 'unverified' }
  }
  if (user.user_metadata?.user_type === 'explorer') {
    return { logged: false, reason: 'explorer' }
  }

  const admin = createServiceRoleClient()
  const companyId = await resolveCompanyIdForUser(admin, user.id)

  if (!companyId) {
    return { logged: false, reason: 'no_company' }
  }

  const displayName = displayNameForActivityDetails(user)

  await recordActivityLog(admin, {
    companyId,
    propertyId: null,
    action: 'login',
    resource: 'user',
    userId: user.id,
    details: `${displayName} logged in`,
  })

  return { logged: true }
}

export async function recordLogoutActivityLogForUser(user: User): Promise<RecordLoginActivityResult> {
  if (!user.app_metadata?.custom_email_verified) {
    return { logged: false, reason: 'unverified' }
  }

  if (user.user_metadata?.user_type === 'explorer') {
    return { logged: false, reason: 'explorer' }
  }

  const admin = createServiceRoleClient()
  const companyId = await resolveCompanyIdForUser(admin, user.id)

  if (!companyId) {
    return { logged: false, reason: 'no_company' }
  }

  const displayName = displayNameForActivityDetails(user)

  await recordActivityLog(admin, {
    companyId,
    propertyId: null,
    action: 'logout',
    resource: 'user',
    userId: user.id,
    details: `${displayName} logged out`,
  })

  return { logged: true }
}

export async function recordPasswordChangeActivityLogForUser(user: User): Promise<RecordLoginActivityResult> {
  if (!user.app_metadata?.custom_email_verified) {
    return { logged: false, reason: 'unverified' }
  }

  if (user.user_metadata?.user_type === 'explorer') {
    return { logged: false, reason: 'explorer' }
  }

  const admin = createServiceRoleClient()
  const companyId = await resolveCompanyIdForUser(admin, user.id)

  if (!companyId) {
    return { logged: false, reason: 'no_company' }
  }

  const displayName = displayNameForActivityDetails(user)

  await recordActivityLog(admin, {
    companyId,
    propertyId: null,
    action: 'password_change',
    resource: 'account settings',
    userId: user.id,
    details: `${displayName} updated their account password`,
  })

  return { logged: true }
}