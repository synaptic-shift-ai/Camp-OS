import { type NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

/**
 * Magic Link Token Verification Endpoint
 *
 * Validates the onboarding token from email link and authenticates the user automatically.
 * This allows users to click the email link in any browser and be signed in seamlessly.
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 })
    }

    console.log('[Token Verification] Verifying token:', token.substring(0, 8) + '...')

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
      .select("id, owner_id, name, onboarding_token_expires_at, onboarding_token_used_at")
      .eq("onboarding_token", token)
      .single()

    if (companyError || !company) {
      console.error('[Token Verification] ❌ Invalid token:', companyError)
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })
    }

    // Check if token has already been used
    if (company.onboarding_token_used_at) {
      console.error('[Token Verification] ❌ Token already used at:', company.onboarding_token_used_at)
      return NextResponse.json({ error: "Token has already been used" }, { status: 401 })
    }

    // Check if token has expired
    const expiresAt = new Date(company.onboarding_token_expires_at)
    if (expiresAt < new Date()) {
      console.error('[Token Verification] ❌ Token expired at:', expiresAt)
      return NextResponse.json({ error: "Token has expired" }, { status: 401 })
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
        redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/sites?wizard=true`
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
