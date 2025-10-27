import { type NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-09-30.clover",
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("[Stripe Connect] Unauthorized:", authError)
      return NextResponse.redirect(new URL("/onboarding/stripe-connect?error=unauthorized", request.url))
    }

    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const error = searchParams.get("error")

    // Handle OAuth errors from Stripe
    if (error) {
      console.error("[Stripe Connect] OAuth error from Stripe:", error)
      return NextResponse.redirect(new URL("/onboarding/stripe-connect?error=oauth_failed", request.url))
    }

    // Verify state for CSRF protection
    if (!state) {
      console.error("[Stripe Connect] Missing state parameter")
      return NextResponse.redirect(new URL("/onboarding/stripe-connect?error=invalid_state", request.url))
    }

    // Exchange authorization code for Stripe account ID
    if (!code) {
      console.error("[Stripe Connect] Missing authorization code")
      return NextResponse.redirect(new URL("/onboarding/stripe-connect?error=missing_code", request.url))
    }

    // Exchange the authorization code for an access token
    const response = await stripe.oauth.token({
      grant_type: "authorization_code",
      code: code,
    })

    const stripeAccountId = response.stripe_user_id

    if (!stripeAccountId) {
      console.error("[Stripe Connect] No stripe_user_id in response")
      return NextResponse.redirect(new URL("/onboarding/stripe-connect?error=no_account_id", request.url))
    }

    // Get the user's property
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id")
      .eq("owner_id", user.id)
      .single()

    if (propertyError || !property) {
      console.error("[Stripe Connect] No property found for user:", propertyError)
      return NextResponse.redirect(new URL("/onboarding/stripe-connect?error=no_property", request.url))
    }

    // Save the Stripe account ID to the database
    const supabaseServiceRole = createServiceRoleClient()
    const { error: updateError } = await supabaseServiceRole
      .from("properties")
      .update({
        stripe_account_id: stripeAccountId,
        stripe_connected_at: new Date().toISOString(),
      })
      .eq("id", property.id)
      .eq("owner_id", user.id) // Tenant isolation

    if (updateError) {
      console.error("[Stripe Connect] Failed to save Stripe account ID:", updateError)
      return NextResponse.redirect(new URL("/onboarding/stripe-connect?error=save_failed", request.url))
    }

    console.log("[Stripe Connect] Successfully connected account:", stripeAccountId)

    // Redirect to completion page
    return NextResponse.redirect(new URL("/onboarding/complete", request.url))
  } catch (error) {
    console.error("[Stripe Connect] Unexpected error:", error)
    return NextResponse.redirect(new URL("/onboarding/stripe-connect?error=unexpected_error", request.url))
  }
}
