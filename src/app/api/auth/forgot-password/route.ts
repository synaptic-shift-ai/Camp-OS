import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { sendEmail } from '@/lib/email/emailit'
import { buildResetPasswordLinkEmailHtml } from '@/lib/email/templates/reset-password-link'
import { createHash, randomBytes } from 'crypto'
import type { User } from '@supabase/supabase-js'

const TOKEN_EXPIRY_HOURS = 1
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
    'http://localhost:3000'
  )
}

async function findUserByEmail(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  email: string
): Promise<User | null> {
  const normalized = email.trim().toLowerCase()
  const {
    data: { users },
  } = await serviceClient.auth.admin.listUsers({ perPage: 500 })
  return users.find((u) => u.email?.toLowerCase() === normalized) ?? null
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.trim() : null
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required.' },
        { status: 400 }
      )
    }

    const serviceClient = createServiceRoleClient()
    const user = await findUserByEmail(serviceClient, email)
    if (!user) {
      return NextResponse.json(
        { error: 'No account found for this email.' },
        { status: 404 }
      )
    }

    const appMetadata = user.app_metadata ?? {}
    const lastSentAt = appMetadata.reset_password_sent_at
      ? new Date(appMetadata.reset_password_sent_at).getTime()
      : 0
    const now = Date.now()

    if (now - lastSentAt < RESEND_COOLDOWN_SECONDS * 1000) {
      const waitSeconds = Math.ceil(
        (RESEND_COOLDOWN_SECONDS * 1000 - (now - lastSentAt)) / 1000
      )
      return NextResponse.json(
        { error: `Please wait ${waitSeconds} seconds before requesting another reset link.` },
        { status: 429 }
      )
    }

    const token = generateToken()
    const tokenHash = hashToken(token)
    const expiresAt = new Date(
      now + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
    ).toISOString()

    const { error: updateError } = await serviceClient.auth.admin.updateUserById(
      user.id,
      {
        app_metadata: {
          ...appMetadata,
          reset_password_token_hash: tokenHash,
          reset_password_expires_at: expiresAt,
          reset_password_sent_at: new Date(now).toISOString(),
        },
      }
    )

    if (updateError) {
      console.error('[ForgotPassword] Failed to store token:', updateError)
      return NextResponse.json(
        { error: 'Failed to generate reset link. Please try again.' },
        { status: 500 }
      )
    }

    const baseUrl = getBaseUrl()
    const resetUrl = `${baseUrl}/reset-password?token=${token}&uid=${user.id}`
    const html = await buildResetPasswordLinkEmailHtml(
      resetUrl,
      undefined,
      `${TOKEN_EXPIRY_HOURS} hour${TOKEN_EXPIRY_HOURS === 1 ? '' : 's'}`
    )

    const emailResult = await sendEmail({
      to: user.email!,
      subject: 'Reset your password - CampOS',
      html,
      text: `Reset your CampOS password by clicking this link: ${resetUrl}\n\nThis link expires in ${TOKEN_EXPIRY_HOURS} hour(s).`,
    })

    if (!emailResult.success) {
      console.error('[ForgotPassword] Email send failed:', emailResult.error)
      return NextResponse.json(
        { error: emailResult.error },
        { status: 502 }
      )
    }

    console.log('[ForgotPassword] Reset link sent to', user.email)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ForgotPassword] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
