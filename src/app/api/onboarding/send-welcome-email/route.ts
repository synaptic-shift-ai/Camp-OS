/**
 * POST /api/onboarding/send-welcome-email
 *
 * Fallback: send the payment confirmation + onboarding link email when the user
 * lands on the payment success page. Use when the Stripe webhook didn't send it
 * (e.g. webhook not configured, failed, or delayed).
 *
 * Body: { session_id: string }
 */

import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendPaymentWelcomeEmail } from "@/lib/email/send-payment-welcome"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-09-30.clover",
})

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const sessionId = body.session_id as string | undefined
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { sent: false, error: "Missing session_id" },
        { status: 400 }
      )
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["customer_details"],
    })

    if (session.mode !== "subscription" || !session.subscription) {
      return NextResponse.json(
        { sent: false, error: "Invalid or non-subscription session" },
        { status: 400 }
      )
    }

    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id

    const email =
      (session.customer_details?.email as string | undefined) ??
      (session as { customer_email?: string }).customer_email ??
      ""

    if (!email) {
      return NextResponse.json(
        { sent: false, error: "No customer email on session" },
        { status: 400 }
      )
    }

    const planId = session.metadata?.planId as string | undefined
    const companyDataRaw = session.metadata?.companyData as string | undefined
    let companyName = "My Company"
    if (companyDataRaw) {
      try {
        const parsed = JSON.parse(companyDataRaw) as { companyName?: string }
        if (parsed.companyName) companyName = parsed.companyName
      } catch {
        // ignore
      }
    }

    const supabase = createServiceRoleClient()
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, onboarding_token")
      .eq("subscription_id", subscriptionId)
      .limit(1)
      .maybeSingle()

    if (companyError || !company?.onboarding_token) {
      return NextResponse.json(
        { sent: false, error: "Company not ready yet", retry: true },
        { status: 503 }
      )
    }

    const result = await sendPaymentWelcomeEmail(
      email,
      planId ?? "starter",
      companyName,
      company.onboarding_token
    )

    if (result.success) {
      return NextResponse.json({ sent: true })
    }

    return NextResponse.json(
      { sent: false, error: result.error },
      { status: 500 }
    )
  } catch (err) {
    console.error("[send-welcome-email]", err)
    return NextResponse.json(
      { sent: false, error: err instanceof Error ? err.message : "Failed to send" },
      { status: 500 }
    )
  }
}
