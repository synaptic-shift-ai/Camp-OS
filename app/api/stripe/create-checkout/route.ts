import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import Stripe from "stripe"
import { PLANS, calculatePrice, type BillingCycle } from "@/lib/constants/plans"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-09-30.clover",
})

export async function POST(request: NextRequest) {
  try {
    const { planId, billingCycle, siteCount } = await request.json()

    // Validate input
    if (!planId || !billingCycle) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Look up the plan
    const plan = PLANS.find((p) => p.id === planId)
    if (!plan) {
      return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 })
    }

    // Enterprise plans require sales contact
    if (plan.isEnterprise) {
      return NextResponse.json({ error: "Enterprise plans require sales contact" }, { status: 400 })
    }

    // Get the authenticated user
    const supabase = await createClient()

    // First try to get the session to see what we have
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log("[Stripe Checkout] Session check:", {
      hasSession: !!session,
      sessionError,
      userId: session?.user?.id
    })

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    console.log("[Stripe Checkout] User check:", {
      hasUser: !!user,
      authError,
      userId: user?.id,
      userEmail: user?.email
    })

    if (authError || !user) {
      console.error("[Stripe Checkout] Auth failed - returning 401")
      return NextResponse.json({
        error: "Unauthorized. Please try signing up again or contact support if this persists.",
        debug: process.env.NODE_ENV === 'development' ? { authError: authError?.message } : undefined
      }, { status: 401 })
    }

    const userEmail = user.email
    if (!userEmail) {
      return NextResponse.json({ error: "User email not found" }, { status: 400 })
    }

    const userId = user.id

    // Calculate the price
    const pricing = calculatePrice(plan, billingCycle as BillingCycle)
    const amount = pricing.total * 100 // Convert to cents

    // Create or retrieve Stripe customer
    let customerId: string
    const existingCustomers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    })

    const existingCustomer = existingCustomers.data[0]
    if (existingCustomer) {
      customerId = existingCustomer.id
    } else {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          supabase_user_id: userId,
        },
      })
      customerId = customer.id
    }

    // Create Stripe Checkout Session
    const session_data = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `CampOS ${plan.name} Plan`,
              description: `Up to ${plan.maxSites || "unlimited"} sites - ${billingCycle} billing`,
            },
            unit_amount: amount,
            recurring: {
              interval: billingCycle === "monthly" ? "month" : "year",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/payment/success?session_id={CHECKOUT_SESSION_ID}&plan=${planId}&billing=${billingCycle}&email=${encodeURIComponent(userEmail)}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/payment/failure?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        supabase_user_id: userId,
        planId,
        billingCycle,
        siteCount: siteCount.toString(),
      },
    })

    return NextResponse.json({ url: session_data.url })
  } catch (error) {
    console.error("Stripe checkout error:", error)
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
  }
}
