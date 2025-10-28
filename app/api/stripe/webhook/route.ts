import { type NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

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
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session

        // Only handle subscription checkouts
        if (session.mode !== "subscription") {
          break
        }

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
  const userIdRaw = session.metadata?.supabase_user_id
  const planId = session.metadata?.planId
  const billingCycle = session.metadata?.billingCycle
  const siteCount = session.metadata?.siteCount
  const companyDataRaw = session.metadata?.companyData

  if (!userIdRaw || !planId) {
    console.error("Missing required metadata in checkout session")
    return
  }

  // Type-safe userId after null check
  const userId: string = userIdRaw

  // Parse company data
  let companyData: { companyName: string; properties: Array<{ name: string; siteCount: number }> } | null = null
  if (companyDataRaw) {
    try {
      companyData = JSON.parse(companyDataRaw)
      console.log('[Webhook] Parsed company data:', {
        companyName: companyData?.companyName,
        propertyCount: companyData?.properties?.length
      })
    } catch (err) {
      console.error('[Webhook] Failed to parse company data:', err)
    }
  }

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id

  // Create company record (this is the FIRST database write)
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({
      owner_id: userId,
      name: companyData?.companyName || "My Company",
      stripe_customer_id: customerId,
      subscription_id: subscriptionId,
      subscription_status: "active",
      subscription_plan: planId,
      subscription_created_at: new Date().toISOString(),
      billing_cycle: billingCycle,
    })
    .select("id")
    .single()

  if (companyError || !company) {
    console.error("Error creating company:", companyError)
    return
  }

  console.log('[Webhook] Company created:', company.id)

  // Create property records based on company data
  if (companyData?.properties && companyData.properties.length > 0) {
    const propertiesToCreate = companyData.properties.map((prop) => ({
      owner_id: userId,
      company_id: company.id,
      name: prop.name,
      slug: `${prop.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
      site_count: prop.siteCount,
      onboarding_completed: false, // User needs to complete onboarding wizard
    }))

    const { data: createdProperties, error: propertiesError } = await supabase
      .from("properties")
      .insert(propertiesToCreate)
      .select("id, name")

    if (propertiesError) {
      console.error("Error creating properties:", propertiesError)
      return
    }

    console.log('[Webhook] Properties created:', createdProperties?.length)
  } else {
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
      console.error("Error creating default property:", propertyError)
      return
    }
  }

  // Log subscription event
  await supabase.from("subscription_events").insert({
    company_id: company.id,
    event_type: "subscription_created",
    stripe_event_id: session.id,
    metadata: {
      plan_id: planId,
      billing_cycle: billingCycle,
      site_count: siteCount,
      company_name: companyData?.companyName,
      properties_count: companyData?.properties?.length || 1,
    },
  })

  // Send onboarding email
  await sendOnboardingEmail(session.customer_details?.email!, planId, companyData?.companyName || "My Company")
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
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
      subscription_id: subscription.id,
      subscription_status: subscription.status,
    })
    .eq("id", company.id)

  if (updateError) {
    console.error("Error updating subscription:", updateError)
    return
  }

  // Log event
  await supabase.from("subscription_events").insert({
    company_id: company.id,
    event_type: "subscription_updated",
    stripe_event_id: subscription.id,
    metadata: {
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
    metadata: {
      canceled_at: new Date().toISOString(),
    },
  })
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string

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

  // Log payment event
  await supabase.from("subscription_events").insert({
    company_id: company.id,
    event_type: "payment_succeeded",
    stripe_event_id: invoice.id,
    metadata: {
      amount: invoice.amount_paid / 100,
      currency: invoice.currency,
    },
  })
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
    metadata: {
      amount: invoice.amount_due / 100,
      currency: invoice.currency,
      attempt_count: invoice.attempt_count,
    },
  })
}

async function sendOnboardingEmail(email: string, planId: string, companyName: string) {
  // TODO: Integrate with Resend or your email service
  // For now, just log that we should send an email
  console.log(`[Onboarding Email] Should send to ${email} for ${companyName} (${planId} plan)`)

  // Example with Resend:
  // const resend = new Resend(process.env.RESEND_API_KEY)
  // await resend.emails.send({
  //   from: 'CampOS <onboarding@campos.com>',
  //   to: email,
  //   subject: 'Welcome to CampOS - Your Properties Are Ready',
  //   html: `
  //     <h1>Welcome to CampOS, ${companyName}!</h1>
  //     <p>Thank you for subscribing to the ${planId} plan.</p>
  //     <p>Your properties have been created and are ready for configuration.</p>
  //     <p>Click the link below to complete your onboarding:</p>
  //     <a href="${process.env.NEXT_PUBLIC_APP_URL}/onboarding">Start Onboarding</a>
  //   `
  // })
}
