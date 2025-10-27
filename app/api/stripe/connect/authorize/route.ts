import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  // Handle OAuth errors
  if (error) {
    console.error("Stripe OAuth error:", error)
    return NextResponse.redirect(new URL("/onboarding/stripe-connect?error=oauth_failed", request.url))
  }

  // Verify state for CSRF protection
  // In production, you would verify the state matches what was stored in sessionStorage
  if (!state) {
    return NextResponse.redirect(new URL("/onboarding/stripe-connect?error=invalid_state", request.url))
  }

  // Exchange authorization code for access token
  if (code) {
    try {
      // In production, you would exchange the code for an access token:
      // const response = await fetch('https://connect.stripe.com/oauth/token', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      //   body: new URLSearchParams({
      //     client_secret: process.env.STRIPE_SECRET_KEY,
      //     code,
      //     grant_type: 'authorization_code'
      //   })
      // })
      // const data = await response.json()
      // Store data.stripe_user_id and data.access_token in your database

      // For demo purposes, redirect to completion
      return NextResponse.redirect(new URL("/onboarding/complete", request.url))
    } catch (error) {
      console.error("Error exchanging Stripe code:", error)
      return NextResponse.redirect(new URL("/onboarding/stripe-connect?error=exchange_failed", request.url))
    }
  }

  return NextResponse.redirect(new URL("/onboarding/stripe-connect", request.url))
}
