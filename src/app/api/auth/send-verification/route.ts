import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { sendEmail } from '@/lib/email/emailit'
import { buildVerificationLinkEmailHtml } from '@/lib/email/templates/verification-link'
import { createHash, randomBytes } from 'crypto'

const TOKEN_EXPIRY_HOURS = 24
const RESEND_COOLDOWN_SECONDS = 60

function generateToken(): string {
  return randomBytes(32).toString('hex')
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
  ) || ''
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    if (user.app_metadata?.custom_email_verified) {
      return NextResponse.json(
        { error: 'Email already verified' },
        { status: 400 }
      )
    }

    const appMetadata = user.app_metadata ?? {}
    const lastSentAt = appMetadata.verification_sent_at
      ? new Date(appMetadata.verification_sent_at).getTime()
      : 0
    const now = Date.now()

    if (now - lastSentAt < RESEND_COOLDOWN_SECONDS * 1000) {
      const waitSeconds = Math.ceil(
        (RESEND_COOLDOWN_SECONDS * 1000 - (now - lastSentAt)) / 1000
      )
      return NextResponse.json(
        { error: `Please wait ${waitSeconds} seconds before requesting another email` },
        { status: 429 }
      )
    }

    const token = generateToken()
    const tokenHash = hashToken(token)
    const expiresAt = new Date(now + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString()

    const serviceClient = createServiceRoleClient()
    const { error: updateError } = await serviceClient.auth.admin.updateUserById(
      user.id,
      {
        app_metadata: {
          ...appMetadata,
          verification_token_hash: tokenHash,
          verification_expires_at: expiresAt,
          verification_sent_at: new Date(now).toISOString(),
        },
      }
    )

    if (updateError) {
      console.error('[SendVerification] Failed to store token:', updateError)
      const message =
        updateError.message?.includes('JWT') || updateError.message?.includes('invalid')
          ? 'Supabase service role key is invalid or for a different project. Use the service_role key from the same project as NEXT_PUBLIC_SUPABASE_URL (Dashboard → Project Settings → API).'
          : updateError.message || 'Failed to generate verification link'
      return NextResponse.json(
        { error: message },
        { status: 500 }
      )
    }

    const baseUrl = getBaseUrl()
    const verifyUrl = `${baseUrl}/api/auth/confirm-email?token=${token}&uid=${user.id}`
    const html = await buildVerificationLinkEmailHtml(verifyUrl)

    const emailResult = await sendEmail({
      to: user.email!,
      subject: 'Verify your email - CampOS',
      html,
      text: `Verify your CampOS email by clicking this link: ${verifyUrl}\n\nThis link expires in ${TOKEN_EXPIRY_HOURS} hours.`,
    })

    if (!emailResult.success) {
      console.error('[SendVerification] Email send failed:', emailResult.error)
      return NextResponse.json(
        { error: emailResult.error },
        { status: 502 }
      )
    }

    console.log('[SendVerification] Verification link sent to', user.email)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[SendVerification] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
