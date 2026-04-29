import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createHash } from 'crypto'

const EXPIRY_BUFFER_MS = 60 * 1000

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function validateResetToken(
  appMetadata: Record<string, unknown>,
  token: string,
  _uid: string
): { valid: true } | { valid: false; error: 'expired' | 'invalid_link' } {
  const storedHash = appMetadata.reset_password_token_hash as string | undefined
  const expiresAt = appMetadata.reset_password_expires_at as string | undefined

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

    const appMetadata = (userData.user.app_metadata ?? {}) as Record<string, unknown>
    const result = validateResetToken(appMetadata, token, uid)

    return NextResponse.json(
      result.valid ? { valid: true } : { valid: false, error: result.error }
    )
  } catch (error) {
    console.error('[ResetPassword GET] Unexpected error:', error)
    return NextResponse.json(
      { valid: false, error: 'invalid_link' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const token = typeof body?.token === 'string' ? body.token : null
    const uid = typeof body?.uid === 'string' ? body.uid : null
    const password = typeof body?.password === 'string' ? body.password : null

    if (!token || !uid || !password) {
      return NextResponse.json(
        { error: 'Token, uid, and password are required.' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      )
    }

    const serviceClient = createServiceRoleClient()
    const { data: userData, error: userError } =
      await serviceClient.auth.admin.getUserById(uid)

    if (userError || !userData?.user) {
      return NextResponse.json(
        { error: 'Invalid or expired link. Please request a new one.' },
        { status: 400 }
      )
    }

    const user = userData.user
    const appMetadata = user.app_metadata ?? {}
    const result = validateResetToken(
      appMetadata as Record<string, unknown>,
      token,
      uid
    )

    if (!result.valid) {
      return NextResponse.json(
        {
          error:
            result.error === 'expired'
              ? 'This reset link has expired. Please request a new one from the login page.'
              : 'Invalid or expired link. Please request a new one.',
        },
        { status: 400 }
      )
    }

    const { error: updateError } = await serviceClient.auth.admin.updateUserById(
      uid,
      {
        password,
        app_metadata: {
          ...appMetadata,
          reset_password_token_hash: null,
          reset_password_expires_at: null,
          reset_password_sent_at: null,
        },
      }
    )

    if (updateError) {
      console.error('[ResetPassword] Failed to update password:', updateError)
      return NextResponse.json(
        { error: 'Failed to update password. Please try again.' },
        { status: 500 }
      )
    }

    console.log('[ResetPassword] Password updated for user:', uid)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ResetPassword POST] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
