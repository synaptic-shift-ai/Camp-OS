import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createHash } from 'crypto'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'http://localhost:3000'
  )
}

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl()
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const uid = url.searchParams.get('uid')

  if (!token || !uid) {
    return NextResponse.redirect(`${baseUrl}/verify-email?error=invalid_link`)
  }

  try {
    const serviceClient = createServiceRoleClient()
    const { data: userData, error: userError } =
      await serviceClient.auth.admin.getUserById(uid)

    if (userError || !userData?.user) {
      console.error('[ConfirmEmail] User not found:', uid, userError)
      return NextResponse.redirect(`${baseUrl}/verify-email?error=invalid_link`)
    }

    const user = userData.user

    // Already verified via our custom flow — let them through
    if (user.app_metadata?.custom_email_verified) {
      return NextResponse.redirect(`${baseUrl}/verify-email?confirmed=true`)
    }

    const appMetadata = user.app_metadata ?? {}
    const storedHash = appMetadata.verification_token_hash
    const expiresAt = appMetadata.verification_expires_at

    if (!storedHash || !expiresAt) {
      console.error('[ConfirmEmail] No verification token stored for user:', uid)
      return NextResponse.redirect(`${baseUrl}/verify-email?error=expired`)
    }

    if (new Date(expiresAt) < new Date()) {
      console.error('[ConfirmEmail] Token expired for user:', uid)
      return NextResponse.redirect(`${baseUrl}/verify-email?error=expired`)
    }

    const inputHash = hashToken(token)
    if (inputHash !== storedHash) {
      console.error('[ConfirmEmail] Token mismatch for user:', uid)
      return NextResponse.redirect(`${baseUrl}/verify-email?error=invalid_link`)
    }

    const { error: confirmError } = await serviceClient.auth.admin.updateUserById(
      uid,
      {
        app_metadata: {
          ...appMetadata,
          custom_email_verified: true,
          verification_token_hash: null,
          verification_expires_at: null,
          verification_sent_at: null,
        },
      }
    )

    if (confirmError) {
      console.error('[ConfirmEmail] Failed to confirm email:', confirmError)
      return NextResponse.redirect(`${baseUrl}/verify-email?error=failed`)
    }

    console.log('[ConfirmEmail] Email verified for user:', uid)

    return NextResponse.redirect(`${baseUrl}/verify-email?confirmed=true`)
  } catch (error) {
    console.error('[ConfirmEmail] Unexpected error:', error)
    return NextResponse.redirect(`${baseUrl}/verify-email?error=failed`)
  }
}
