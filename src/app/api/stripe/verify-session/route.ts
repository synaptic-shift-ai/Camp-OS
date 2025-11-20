import { type NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-09-30.clover",
})

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const sessionId = searchParams.get("session_id")

  if (!sessionId) {
    return NextResponse.json({ success: false, error: "Missing session ID" }, { status: 400 })
  }

  try {
    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["customer", "subscription"],
    })

    // Check payment status
    if (session.payment_status !== "paid") {
      return NextResponse.json({
        success: false,
        error: "Payment not completed",
        status: session.payment_status,
      })
    }

    // Extract metadata
    const planId = session.metadata?.planId
    const billingCycle = session.metadata?.billingCycle
    const siteCount = session.metadata?.siteCount

    return NextResponse.json({
      success: true,
      planId,
      billingCycle,
      siteCount,
      email: session.customer_details?.email,
      customerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
      subscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id,
      amount: session.amount_total ? session.amount_total / 100 : 0,
    })
  } catch (error) {
    console.error("Error verifying session:", error)
    return NextResponse.json({ success: false, error: "Failed to verify session" }, { status: 500 })
  }
}
