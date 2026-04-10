import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { StaffManagementQueries } from '@/lib/dashboard/staff-management-queries'
import { createHash } from 'crypto'

const EXPIRY_BUFFER_MS = 60 * 1000

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function validateStaffInviteToken(
  appMetadata: Record<string, unknown>,
  token: string,
): { valid: true } | { valid: false; error: 'expired' | 'invalid_link' } {
  const storedHash = appMetadata.staff_invite_token_hash as string | undefined
  const expiresAt = appMetadata.staff_invite_expires_at as string | undefined

  if (!storedHash || !expiresAt) {
    return { valid: false, error: 'invalid_link' }
  }

  const isExpired =
    new Date(expiresAt).getTime() < Date.now() - EXPIRY_BUFFER_MS
  if (isExpired) {
    return { valid: false, error: 'expired' }
  }

  const inputHash = hashToken(token)
  if (inputHash !== storedHash) {
    return { valid: false, error: 'invalid_link' }
  }

  return { valid: true }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    const uid = url.searchParams.get('uid')

    if (!token || !uid) {
      return NextResponse.json({ valid: false, error: 'invalid_link' }, { status: 400 })
    }

    const serviceClient = createServiceRoleClient()
    const { data: userData, error: userError } =
      await serviceClient.auth.admin.getUserById(uid)

    if (userError || !userData?.user) {
      return NextResponse.json({ valid: false, error: 'invalid_link' }, { status: 400 })
    }

    const authUser = userData.user
    const appMetadata = (authUser.app_metadata ?? {}) as Record<string, unknown>
    const result = validateStaffInviteToken(appMetadata, token)

    if (!result.valid) {
      return NextResponse.json({ valid: false, error: result.error })
    }

    const userMeta = (authUser.user_metadata ?? {}) as Record<string, unknown>
    const firstName =
      typeof userMeta.first_name === 'string' ? userMeta.first_name : ''
    const lastName =
      typeof userMeta.last_name === 'string' ? userMeta.last_name : ''
    const contactPhone =
      typeof userMeta.contact_phone === 'string'
        ? userMeta.contact_phone
        : authUser.phone ?? ''

    const q = new StaffManagementQueries(serviceClient as any)
    const { roleLabel, categoryNames } =
      await q.getStaffInviteStaffContextByUserId(uid)

    return NextResponse.json({
      valid: true,
      email: authUser.email ?? '',
      firstName,
      lastName,
      contactPhone,
      roleLabel,
      categoryNames,
    })
  } catch (error) {
    console.error('[StaffInviteRegister GET] Unexpected error:', error)
    return NextResponse.json(
      { valid: false, error: 'invalid_link' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const token = typeof body?.token === 'string' ? body.token : null
    const uid = typeof body?.uid === 'string' ? body.uid : null
    const password = typeof body?.password === 'string' ? body.password : null
    const firstName =
      typeof body?.firstName === 'string' ? body.firstName.trim() : ''
    const lastName =
      typeof body?.lastName === 'string' ? body.lastName.trim() : ''
    const contactPhone =
      typeof body?.contactPhone === 'string' ? body.contactPhone.trim() : ''

    if (!token || !uid || !password) {
      return NextResponse.json(
        { error: 'Token, uid, and password are required.' },
        { status: 400 },
      )
    }

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'First name and last name are required.' },
        { status: 400 },
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 },
      )
    }

    const serviceClient = createServiceRoleClient()
    const { data: userData, error: userError } =
      await serviceClient.auth.admin.getUserById(uid)

    if (userError || !userData?.user) {
      return NextResponse.json(
        { error: 'Invalid or expired link. Ask your property admin to resend the invite.' },
        { status: 400 },
      )
    }

    const user = userData.user
    const appMetadata = user.app_metadata ?? {}
    const userMetadata = (user.user_metadata ?? {}) as Record<string, unknown>
    const result = validateStaffInviteToken(
      appMetadata as Record<string, unknown>,
      token,
    )

    if (!result.valid) {
      return NextResponse.json(
        {
          error:
            result.error === 'expired'
              ? 'This invitation link has expired. Ask your property admin to invite you again.'
              : 'Invalid or expired link. Ask your property admin to resend the invite.',
        },
        { status: 400 },
      )
    }

    const nextUserMetadata = {
      ...userMetadata,
      first_name: firstName,
      last_name: lastName,
      contact_phone: contactPhone,
      user_type: 'staff',
    }

    const { error: updateError } = await serviceClient.auth.admin.updateUserById(
      uid,
      {
        password,
        email_confirm: true,
        user_metadata: nextUserMetadata,
        app_metadata: {
          ...appMetadata,
          staff_invite_token_hash: null,
          staff_invite_expires_at: null,
          staff_invite_sent_at: null,
        },
      },
    )

    if (updateError) {
      console.error('[StaffInviteRegister] Failed to update user:', updateError)
      return NextResponse.json(
        { error: 'Failed to set password. Please try again.' },
        { status: 500 },
      )
    }

    const staffQueries = new StaffManagementQueries(serviceClient as any)
    try {
      await staffQueries.activatePendingStaffForUser(uid)
    } catch (staffErr) {
      console.error('[StaffInviteRegister] property_staff activation failed', staffErr)
      return NextResponse.json(
        {
          error:
            'Your password was set, but we could not activate your staff access. Please contact support.',
        },
        { status: 500 },
      )
    }

    console.log('[StaffInviteRegister] Password set for invited staff user:', uid)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[StaffInviteRegister POST] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
