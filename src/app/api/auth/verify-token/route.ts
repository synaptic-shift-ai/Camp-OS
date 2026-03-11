import { type NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

/**
 * Base URL we tell Supabase to redirect to after sign-in. Must match a URL in
 * Supabase Dashboard → Auth → URL Configuration → Redirect URLs.
 */
function getRedirectBaseUrl(request: NextRequest): string {
  const fromEnv = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    ""
  ).replace(/\/$/, "")
  if (fromEnv) return fromEnv
  const reqUrl = request.url ? new URL(request.url) : null
  const protocol =
    request.headers.get("x-forwarded-proto") ?? reqUrl?.protocol?.replace(":", "") ?? "https"
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    reqUrl?.host ??
    ""
  const fromRequest = host ? `${protocol}://${host}`.replace(/\/$/, "") : ""
  return fromRequest || reqUrl?.origin || "http://localhost:3000"
}

/**
 * Magic Link Token Verification Endpoint
 *
 * Validates the onboarding token from email link and authenticates the user automatically.
 * Redirect URL must be in Supabase Dashboard → Auth → URL Configuration → Redirect URLs.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: unknown }
    const token = body.token

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 })
    }

    const baseUrl = getRedirectBaseUrl(request)
    const redirectTo = `${baseUrl}/onboarding`
    console.log('[Token Verification] Verifying token:', token.substring(0, 8) + '...', 'redirectTo:', redirectTo)

    // Use service role client to query companies table without authentication
    const supabaseService = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Find company by token
    const { data: company, error: companyError } = await supabaseService
      .from("companies")
      .select("id, owner_id, name, onboarding_token_expires_at, onboarding_token_used_at, onboarding_completed")
      .eq("onboarding_token", token)
      .single()

    if (companyError || !company) {
      console.error('[Token Verification] ❌ Invalid token:', companyError)
      return NextResponse.json(
        { error: "Invalid or expired token", reason: "invalid" },
        { status: 401 }
      )
    }

    if (company.onboarding_completed) {
      console.error('[Token Verification] ❌ Onboarding already completed for company:', company.id)
      return NextResponse.json(
        {
          error: "You've already completed onboarding. This link is no longer valid.",
          reason: "already_completed",
        },
        { status: 401 }
      )
    }

    if (company.onboarding_token_used_at) {
      console.error('[Token Verification] ❌ Token already used at:', company.onboarding_token_used_at)
      return NextResponse.json(
        { error: "This link has already been used.", reason: "already_used" },
        { status: 401 }
      )
    }

    const expiresAt = new Date(company.onboarding_token_expires_at)
    if (expiresAt < new Date()) {
      console.error('[Token Verification] ❌ Token expired at:', expiresAt)
      return NextResponse.json(
        { error: "This link has expired.", reason: "expired" },
        { status: 401 }
      )
    }

    console.log('[Token Verification] ✓ Token valid for company:', company.id)

    // Get the user's email for authentication
    const { data: user, error: userError } = await supabaseService.auth.admin.getUserById(company.owner_id)

    if (userError || !user) {
      console.error('[Token Verification] ❌ User not found:', userError)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    console.log('[Token Verification] ✓ User found:', user.user.email)

    // Generate a one-time link token for automatic sign-in
    // This is the official Supabase way to authenticate a user via magic link
    const { data: magicLinkData, error: magicLinkError } = await supabaseService.auth.admin.generateLink({
      type: 'magiclink',
      email: user.user.email!,
      options: {
        redirectTo,
      }
    })

    if (magicLinkError || !magicLinkData) {
      console.error('[Token Verification] ❌ Failed to generate magic link:', magicLinkError)
      return NextResponse.json({ error: "Failed to generate authentication link" }, { status: 500 })
    }

    console.log('[Token Verification] ✓ Magic link generated')

    // Mark token as used
    await supabaseService
      .from("companies")
      .update({
        onboarding_token_used_at: new Date().toISOString()
      })
      .eq("id", company.id)

    console.log('[Token Verification] ✓ Token marked as used')

    // Return the authentication URL
    // The hashed_token from the magic link is what actually authenticates the user
    return NextResponse.json({
      success: true,
      authUrl: magicLinkData.properties.action_link,
      companyId: company.id,
      companyName: company.name
    })
  } catch (error) {
    console.error('[Token Verification] ❌ Unexpected error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
