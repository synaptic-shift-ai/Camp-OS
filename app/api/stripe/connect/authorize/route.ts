import { type NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-09-30.clover",
})

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  // Handle OAuth errors
  if (error) {
    console.error("Stripe OAuth error:", error)
    return NextResponse.redirect(
      new URL("/onboarding?error=oauth_failed", request.url)
    )
  }

  // Verify state for CSRF protection and extract property ID
  if (!state) {
    return NextResponse.redirect(
      new URL("/onboarding?error=invalid_state", request.url)
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
      new URL("/onboarding?error=invalid_state", request.url)
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
          new URL("/onboarding?error=unauthorized", request.url)
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
          new URL("/onboarding?error=property_not_found", request.url)
        )
      }

      if (property.owner_id !== user.id) {
        console.error("Unauthorized property access")
        return NextResponse.redirect(
          new URL("/onboarding?error=unauthorized", request.url)
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
          new URL("/onboarding?error=update_failed", request.url)
        )
      }

      // Success - redirect back to wizard review step
      return NextResponse.redirect(
        new URL(`/dashboard/sites?step=review_launch&stripe_connected=true&propertyId=${propertyId}`, request.url)
      )
    } catch (error) {
      console.error("Error exchanging Stripe code:", error)
      return NextResponse.redirect(
        new URL("/onboarding?error=exchange_failed", request.url)
      )
    }
  }

  return NextResponse.redirect(new URL("/onboarding", request.url))
}
