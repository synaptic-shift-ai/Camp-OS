import { type NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"
import { resend, getFrom } from "@/lib/email/resend"
import { randomBytes } from "crypto"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-09-30.clover",
})

// Create Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

export async function POST(request: NextRequest) {
  console.log('[Webhook] ========== STRIPE WEBHOOK RECEIVED ==========')
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get("stripe-signature")

  console.log('[Webhook] Has signature:', !!signature)
  console.log('[Webhook] Webhook secret configured:', !!process.env.STRIPE_WEBHOOK_SECRET)

  if (!signature) {
    console.error('[Webhook] ❌ Missing stripe-signature header')
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
    console.log('[Webhook] ✓ Signature verified successfully')
    console.log('[Webhook] Event type:', event.type)
    console.log('[Webhook] Event ID:', event.id)
  } catch (err) {
    console.error('[Webhook] ❌ Signature verification failed:', err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        console.log('[Webhook] Checkout session mode:', session.mode)

        // Only handle subscription checkouts
        if (session.mode !== "subscription") {
          console.log('[Webhook] ⚠ Skipping non-subscription checkout')
          break
        }

        console.log('[Webhook] Processing subscription checkout...')
        await handleCheckoutSessionCompleted(session)
        break
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(subscription)
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentSucceeded(invoice)
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentFailed(invoice)
        break
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentIntentSucceeded(paymentIntent)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("Webhook handler error:", err)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('[Webhook] ========== CHECKOUT SESSION COMPLETED ==========')
  console.log('[Webhook] Session ID:', session.id)
  console.log('[Webhook] Session metadata:', session.metadata)

  const userIdRaw = session.metadata?.supabase_user_id
  const planId = session.metadata?.planId
  const billingCycle = session.metadata?.billingCycle
  const siteCount = session.metadata?.siteCount
  const companyDataRaw = session.metadata?.companyData

  if (!userIdRaw || !planId) {
    console.error('[Webhook] ❌ Missing required metadata:', {
      hasUserId: !!userIdRaw,
      hasPlanId: !!planId,
      metadata: session.metadata
    })
    return
  }

  console.log('[Webhook] ✓ Required metadata present:', { userId: userIdRaw, planId })

  // Type-safe userId after null check
  const userId: string = userIdRaw

  // Parse company data
  let companyData: { companyName: string; properties: Array<{ name: string; siteCount: number }> } | null = null
  if (companyDataRaw) {
    try {
      companyData = JSON.parse(companyDataRaw)
      console.log('[Webhook] ✓ Parsed company data:', {
        companyName: companyData?.companyName,
        propertyCount: companyData?.properties?.length,
        properties: companyData?.properties
      })
    } catch (err) {
      console.error('[Webhook] ❌ Failed to parse company data:', err)
    }
  } else {
    console.log('[Webhook] ⚠ No company data in metadata')
  }

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id

  console.log('[Webhook] Stripe IDs:', {
    customerId,
    subscriptionId,
    customerEmail: session.customer_details?.email
  })

  // Create company record (this is the FIRST database write)
  console.log('[Webhook] Creating company record...')

  // Generate secure onboarding token for magic link authentication
  const onboardingToken = randomBytes(32).toString('hex')
  const tokenExpiresAt = new Date()
  tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7) // Token expires in 7 days

  const companyInsertData = {
    owner_id: userId,
    name: companyData?.companyName || "My Company",
    stripe_customer_id: customerId,
    subscription_id: subscriptionId,
    subscription_status: "active",
    subscription_plan: planId,
    subscription_created_at: new Date().toISOString(),
    billing_cycle: billingCycle,
    onboarding_token: onboardingToken,
    onboarding_token_expires_at: tokenExpiresAt.toISOString(),
  }
  console.log('[Webhook] Company insert data:', { ...companyInsertData, onboarding_token: '[REDACTED]' })

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert(companyInsertData)
    .select("id")
    .single()

  if (companyError || !company) {
    console.error('[Webhook] ❌ ERROR creating company:', {
      error: companyError,
      code: companyError?.code,
      message: companyError?.message,
      details: companyError?.details,
      hint: companyError?.hint
    })
    return
  }

  console.log('[Webhook] ✅ Company created successfully:', company.id)

  // Create property records based on company data
  if (companyData?.properties && companyData.properties.length > 0) {
    console.log('[Webhook] Creating', companyData.properties.length, 'properties...')
    const propertiesToCreate = companyData.properties.map((prop) => ({
      owner_id: userId,
      company_id: company.id,
      name: prop.name,
      slug: `${prop.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
      site_count: prop.siteCount,
      onboarding_completed: false, // User needs to complete onboarding wizard
    }))

    console.log('[Webhook] Properties to create:', propertiesToCreate)

    const { data: createdProperties, error: propertiesError } = await supabase
      .from("properties")
      .insert(propertiesToCreate)
      .select("id, name")

    if (propertiesError) {
      console.error('[Webhook] ❌ Error creating properties:', {
        error: propertiesError,
        code: propertiesError?.code,
        message: propertiesError?.message,
        details: propertiesError?.details
      })
      return
    }

    console.log('[Webhook] ✅ Properties created:', createdProperties?.length, createdProperties)
  } else {
    console.log('[Webhook] Creating default property...')
    // Fallback: create a single default property
    const { error: propertyError } = await supabase
      .from("properties")
      .insert({
        owner_id: userId,
        company_id: company.id,
        name: "My Campground",
        slug: `campground-${Date.now()}`,
        site_count: siteCount ? parseInt(siteCount) : null,
        onboarding_completed: false,
      })

    if (propertyError) {
      console.error('[Webhook] ❌ Error creating default property:', {
        error: propertyError,
        code: propertyError?.code,
        message: propertyError?.message
      })
      return
    }

    console.log('[Webhook] ✅ Default property created')
  }

  // Log subscription event
  await supabase.from("subscription_events").insert({
    company_id: company.id,
    event_type: "subscription_created",
    stripe_event_id: session.id,
    event_data: {
      plan_id: planId,
      billing_cycle: billingCycle,
      site_count: siteCount,
      company_name: companyData?.companyName,
      properties_count: companyData?.properties?.length || 1,
    },
  })

  // Send onboarding email with magic link token
  await sendOnboardingEmail(
    session.customer_details?.email ?? '',
    planId,
    companyData?.companyName || "My Company",
    onboardingToken
  )
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  console.log('[Webhook] ========== SUBSCRIPTION UPDATED ==========')
  console.log('[Webhook] Customer ID:', customerId)
  console.log('[Webhook] Subscription ID:', subscription.id)
  console.log('[Webhook] Status:', subscription.status)

  // Find company by customer ID (billing is at company level)
  // Add retry logic for race condition with checkout.session.completed
  let company: { id: string } | null = null
  let attempts = 0
  const maxAttempts = 3

  while (!company && attempts < maxAttempts) {
    attempts++
    console.log(`[Webhook] Attempt ${attempts}/${maxAttempts} to find company...`)

    const { data, error: findError } = await supabase
      .from("companies")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .single()

    if (data) {
      company = data
      console.log('[Webhook] ✓ Company found:', company.id)
    } else if (attempts < maxAttempts) {
      console.log('[Webhook] Company not found yet, waiting 500ms before retry...')
      await new Promise(resolve => setTimeout(resolve, 500))
    } else {
      console.error('[Webhook] ❌ Company not found after', maxAttempts, 'attempts:', {
        customerId,
        error: findError
      })
    }
  }

  if (!company) {
    console.error('[Webhook] ⚠️ Skipping subscription update - company will be created by checkout.session.completed')
    return
  }

  // Update subscription status at company level
  console.log('[Webhook] Updating company subscription status...')
  const { error: updateError } = await supabase
    .from("companies")
    .update({
      subscription_id: subscription.id,
      subscription_status: subscription.status,
    })
    .eq("id", company.id)

  if (updateError) {
    console.error('[Webhook] ❌ Error updating subscription:', updateError)
    return
  }

  console.log('[Webhook] ✅ Subscription updated successfully')

  // Log event
  await supabase.from("subscription_events").insert({
    company_id: company.id,
    event_type: "subscription_updated",
    stripe_event_id: subscription.id,
    event_data: {
      status: subscription.status,
    },
  })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  // Find company by customer ID (billing is at company level)
  const { data: company, error: findError } = await supabase
    .from("companies")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single()

  if (findError || !company) {
    console.error("Company not found for customer:", customerId)
    return
  }

  // Update subscription status at company level
  const { error: updateError } = await supabase
    .from("companies")
    .update({
      subscription_status: "canceled",
      subscription_canceled_at: new Date().toISOString(),
    })
    .eq("id", company.id)

  if (updateError) {
    console.error("Error updating subscription:", updateError)
    return
  }

  // Log event
  await supabase.from("subscription_events").insert({
    company_id: company.id,
    event_type: "subscription_canceled",
    stripe_event_id: subscription.id,
    event_data: {
      canceled_at: new Date().toISOString(),
    },
  })
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string

  console.log('[Webhook] ========== INVOICE PAYMENT SUCCEEDED ==========')
  console.log('[Webhook] Customer ID:', customerId)
  console.log('[Webhook] Invoice ID:', invoice.id)
  console.log('[Webhook] Amount:', invoice.amount_paid / 100, invoice.currency)

  // Find company by customer ID (billing is at company level)
  // Add retry logic for race condition
  let company: { id: string } | null = null
  let attempts = 0
  const maxAttempts = 3

  while (!company && attempts < maxAttempts) {
    attempts++
    console.log(`[Webhook] Attempt ${attempts}/${maxAttempts} to find company...`)

    const { data, error: findError } = await supabase
      .from("companies")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .single()

    if (data) {
      company = data
      console.log('[Webhook] ✓ Company found:', company.id)
    } else if (attempts < maxAttempts) {
      console.log('[Webhook] Company not found yet, waiting 500ms before retry...')
      await new Promise(resolve => setTimeout(resolve, 500))
    } else {
      console.error('[Webhook] ❌ Company not found after', maxAttempts, 'attempts:', {
        customerId,
        error: findError
      })
    }
  }

  if (!company) {
    console.error('[Webhook] ⚠️ Skipping payment logging - company should be created by checkout.session.completed')
    console.error('[Webhook] ⚠️ If this persists, check if checkout.session.completed webhook was received')
    return
  }

  // Log payment event
  console.log('[Webhook] Logging payment event...')
  await supabase.from("subscription_events").insert({
    company_id: company.id,
    event_type: "payment_succeeded",
    stripe_event_id: invoice.id,
    event_data: {
      amount: invoice.amount_paid / 100,
      currency: invoice.currency,
    },
  })

  console.log('[Webhook] ✅ Payment event logged')
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string

  // Find company by customer ID (billing is at company level)
  const { data: company, error: findError } = await supabase
    .from("companies")
    .select("id, subscription_status")
    .eq("stripe_customer_id", customerId)
    .single()

  if (findError || !company) {
    console.error("Company not found for customer:", customerId)
    return
  }

  // Update status to past_due if needed at company level
  if (company.subscription_status !== "past_due") {
    await supabase
      .from("companies")
      .update({
        subscription_status: "past_due",
      })
      .eq("id", company.id)
  }

  // Log payment failure
  await supabase.from("subscription_events").insert({
    company_id: company.id,
    event_type: "payment_failed",
    stripe_event_id: invoice.id,
    event_data: {
      amount: invoice.amount_due / 100,
      currency: invoice.currency,
      attempt_count: invoice.attempt_count,
    },
  })
}

async function sendOnboardingEmail(email: string, planId: string, companyName: string, token: string) {
  console.log(`[Onboarding Email] Sending to ${email} for ${companyName} (${planId} plan)`)

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const onboardingUrl = `${baseUrl}/onboarding?token=${token}`

    const { data, error } = await resend.emails.send({
      from: getFrom(),
      to: email,
      subject: `Welcome to CampOS - Let's Set Up ${companyName}!`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

            <!-- Header -->
            <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #f0f0f0;">
              <h1 style="color: #DC2626; margin: 0; font-size: 28px;">🏕️ CampOS</h1>
            </div>

            <!-- Main Content -->
            <div style="padding: 30px 0;">
              <h2 style="color: #1a1a1a; font-size: 24px; margin-bottom: 20px;">Welcome to CampOS, ${companyName}!</h2>

              <p style="font-size: 16px; color: #555; margin-bottom: 20px;">
                Thank you for subscribing to the <strong>${planId.charAt(0).toUpperCase() + planId.slice(1)}</strong> plan. Your payment has been confirmed and your properties are ready to configure!
              </p>

              <div style="background: #f9fafb; border-left: 4px solid #DC2626; padding: 20px; margin: 30px 0;">
                <h3 style="margin-top: 0; color: #1a1a1a; font-size: 18px;">🚀 Next Steps</h3>
                <ol style="margin: 15px 0; padding-left: 20px; color: #555;">
                  <li style="margin-bottom: 10px;"><strong>Complete your property setup</strong> - Add details, photos, and amenities (2 minutes)</li>
                  <li style="margin-bottom: 10px;"><strong>Create your campsites</strong> - Define sites and set pricing (5 minutes)</li>
                  <li style="margin-bottom: 10px;"><strong>Connect Stripe</strong> - Link your account to receive payouts (3 minutes)</li>
                  <li style="margin-bottom: 10px;"><strong>Launch!</strong> - Go live and start accepting bookings</li>
                </ol>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="${onboardingUrl}"
                   style="display: inline-block; background: #DC2626; color: white; text-decoration: none; padding: 16px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Start Property Setup →
                </a>
              </div>

              <p style="font-size: 14px; color: #888; text-align: center; margin-top: 30px;">
                Or copy and paste this link into your browser:<br>
                <a href="${onboardingUrl}" style="color: #DC2626; word-break: break-all;">${onboardingUrl}</a>
              </p>
            </div>

            <!-- Footer -->
            <div style="border-top: 2px solid #f0f0f0; padding-top: 20px; margin-top: 40px; text-align: center; color: #888; font-size: 14px;">
              <p>Need help getting started?</p>
              <p>
                <a href="mailto:support@campgroundos.com" style="color: #DC2626; text-decoration: none;">Contact our support team</a>
              </p>
              <p style="margin-top: 20px; font-size: 12px; color: #aaa;">
                © ${new Date().getFullYear()} CampOS. All rights reserved.
              </p>
            </div>
          </body>
        </html>
      `
    })

    if (error) {
      console.error('[Onboarding Email] ❌ Failed to send:', error)
      return
    }

    console.log('[Onboarding Email] ✅ Sent successfully:', data?.id)
  } catch (error) {
    console.error('[Onboarding Email] ❌ Error:', error)
  }
}

/**
 * Handle payment_intent.succeeded webhook event
 *
 * Called when a guest completes payment for their campsite reservation.
 * Creates Stripe Customer, attaches PaymentMethod, updates reservation status.
 *
 * Flow:
 * 1. Extract reservation_id from PaymentIntent metadata
 * 2. Fetch reservation and guest details
 * 3. Create Stripe Customer (if guest doesn't have one)
 * 4. Attach PaymentMethod to Customer
 * 5. Save stripe_customer_id to guest record
 * 6. Update reservation: status='confirmed', payment_status='paid'
 *
 * TODO: Full implementation in next session
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('[Webhook] ========== PAYMENT INTENT SUCCEEDED ==========')
  console.log('[Webhook] PaymentIntent ID:', paymentIntent.id)
  console.log('[Webhook] Amount:', paymentIntent.amount)
  console.log('[Webhook] Metadata:', paymentIntent.metadata)

  // TODO: Implement full handler
  console.log('[Webhook] ⚠️ handlePaymentIntentSucceeded not yet implemented')
  console.log('[Webhook] This needs to:')
  console.log('[Webhook]   1. Create Stripe Customer for guest')
  console.log('[Webhook]   2. Attach PaymentMethod to Customer')
  console.log('[Webhook]   3. Save stripe_customer_id to guest record')
  console.log('[Webhook]   4. Update reservation to confirmed/paid status')
}
