import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Define route categories
  const requiresAuth = ["/dashboard", "/onboarding"]
  const requiresSubscription = ["/dashboard", "/onboarding"]
  const requiresOnboarding = ["/dashboard"]

  const needsAuth = requiresAuth.some((route) => pathname.startsWith(route))
  const needsSubscription = requiresSubscription.some((route) => pathname.startsWith(route))
  const needsOnboardingComplete = requiresOnboarding.some((route) => pathname.startsWith(route))

  // Check 1: Authentication required
  if (!user && needsAuth) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirect", pathname)
    return NextResponse.redirect(url)
  }

  // Check 1.5: Email verification required for dashboard (security gate)
  if (user && pathname.startsWith("/dashboard")) {
    // Check if email is verified
    if (!user.email_confirmed_at) {
      const url = request.nextUrl.clone()
      url.pathname = "/verify-email"
      url.searchParams.set("redirect", pathname)
      return NextResponse.redirect(url)
    }
  }

  // Check 2: Subscription required (for buyers accessing protected routes)
  if (user && needsSubscription) {
    // Get user's company with subscription status
    const { data: company } = await supabase
      .from("companies")
      .select("id, subscription_status")
      .eq("owner_id", user.id)
      .single()

    // No company OR no active subscription - redirect to plan selection
    if (!company || company.subscription_status !== "active") {
      // Don't redirect if already on payment or plan pages
      if (!pathname.startsWith("/choose-plan") && !pathname.startsWith("/payment")) {
        const url = request.nextUrl.clone()
        url.pathname = "/choose-plan"
        return NextResponse.redirect(url)
      }
    }

    // Check 3: Onboarding completion required for dashboard
    if (company && needsOnboardingComplete) {
      // IMPORTANT: Allow wizard pages even with incomplete onboarding
      // The wizard IS the onboarding process
      const isWizardPage = pathname.startsWith("/dashboard/sites") && request.nextUrl.searchParams.get("wizard") === "true"

      if (!isWizardPage) {
        // Check if any properties are incomplete
        const { data: incompleteProperties } = await supabase
          .from("properties")
          .select("id")
          .eq("company_id", company.id)
          .eq("onboarding_completed", false)
          .limit(1)

        // If any properties are incomplete, redirect to onboarding
        if (incompleteProperties && incompleteProperties.length > 0) {
          if (!pathname.startsWith("/onboarding")) {
            const url = request.nextUrl.clone()
            url.pathname = "/onboarding"
            return NextResponse.redirect(url)
          }
        }
      }
    }
  }

  return supabaseResponse
}
