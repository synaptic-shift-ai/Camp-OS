import { type NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-09-30.clover",
})

function getRedirectBaseUrl(request: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL;
  const reqUrl = request.url ? new URL(request.url) : null
  const protocol =
    request.headers.get("x-forwarded-proto") ??
    reqUrl?.protocol?.replace(":", "") ??
    "https"
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    reqUrl?.host ??
    ""
  const fromHeaders = host ? `${protocol}://${host}` : ""
  const origin = (fromEnv || fromHeaders || reqUrl?.origin || "").replace(/\/$/, "")
  return origin || (reqUrl?.origin ?? "http://localhost:3000")
}

export async function GET(request: NextRequest) {
  const baseUrl = getRedirectBaseUrl(request)
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  // Handle OAuth errors
  if (error) {
    console.error("Stripe OAuth error:", error)
    return NextResponse.redirect(
      new URL("/onboarding?step=stripe_connect&error=oauth_failed", baseUrl)
    )
  }

  // Verify state for CSRF protection and extract property ID
  if (!state) {
    return NextResponse.redirect(
      new URL("/onboarding?step=stripe_connect&error=invalid_state", baseUrl)
    )
  }

  let propertyId: string
  try {
    // State should be JSON with propertyId
    const stateData = JSON.parse(state)
    propertyId = stateData.propertyId

    if (!propertyId) {
      throw new Error("Missing propertyId in state")
    }
  } catch (parseError) {
    console.error("Error parsing state:", parseError)
    return NextResponse.redirect(
      new URL("/onboarding?step=stripe_connect&error=invalid_state", baseUrl)
    )
  }

  // Exchange authorization code for access token
  if (code) {
    try {
      // Authenticate user
      const supabase = await createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.redirect(
          new URL("/onboarding?step=stripe_connect&error=unauthorized", baseUrl)
        )
      }

      // Exchange code for Stripe connected account ID
      const response = await stripe.oauth.token({
        grant_type: "authorization_code",
        code,
      })

      const stripeAccountId = response.stripe_user_id

      if (!stripeAccountId) {
        throw new Error("No stripe_user_id in response")
      }

      // Use service role client to bypass RLS
      const supabaseAdmin = createServiceRoleClient()

      // Verify property ownership
      const { data: property, error: propertyError } = await supabaseAdmin
        .from("properties")
        .select("id, owner_id")
        .eq("id", propertyId)
        .single()

      if (propertyError || !property) {
        console.error("Property not found:", propertyError)
        return NextResponse.redirect(
          new URL("/onboarding?step=stripe_connect&error=property_not_found", baseUrl)
        )
      }

      if (property.owner_id !== user.id) {
        console.error("Unauthorized property access")
        return NextResponse.redirect(
          new URL("/onboarding?step=stripe_connect&error=unauthorized", baseUrl)
        )
      }

      // Update property with Stripe account details
      const { error: updateError } = await supabaseAdmin
        .from("properties")
        .update({
          stripe_account_id: stripeAccountId,
          stripe_connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", propertyId)

      if (updateError) {
        console.error("Error updating property with Stripe account:", updateError)
        return NextResponse.redirect(
          new URL("/onboarding?step=stripe_connect&error=update_failed", baseUrl)
        )
      }

      // Success - redirect back to wizard Stripe step
      return NextResponse.redirect(
        new URL("/onboarding?step=stripe_connect&stripe_connected=true", baseUrl)
      )
    } catch (error) {
      console.error("Error exchanging Stripe code:", error)
      return NextResponse.redirect(
        new URL("/onboarding?step=stripe_connect&error=exchange_failed", baseUrl)
      )
    }
  }

  return NextResponse.redirect(new URL("/onboarding?step=stripe_connect", baseUrl))
}
