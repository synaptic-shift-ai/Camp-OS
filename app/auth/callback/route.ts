import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  console.log('[Auth Callback] Processing callback:', {
    hasCode: !!code,
    url: requestUrl.toString()
  })

  if (code) {
    const cookieStore = await cookies()
    let redirectUrl = new URL('/dashboard', requestUrl.origin)

    // Create supabase client with cookie handling that works in route handlers
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

    console.log('[Auth Callback] Exchange result:', {
      hasSession: !!sessionData.session,
      hasUser: !!sessionData.user,
      error: error?.message,
      userId: sessionData.user?.id
    })

    if (!error && sessionData.user) {
      const user = sessionData.user

      console.log('[Auth Callback] User authenticated:', {
        userId: user.id,
        userType: user.user_metadata?.user_type,
        email: user.email
      })

      // PRIORITY 1: Honor 'next' parameter if present (sales funnel/specific flow)
      const next = requestUrl.searchParams.get('next')
      if (next) {
        redirectUrl = new URL(next, requestUrl.origin)
        console.log('[Auth Callback] Redirecting to next:', next)
        return NextResponse.redirect(redirectUrl)
      }

      // PRIORITY 2: Route based on user type and status
      const userType = user.user_metadata?.user_type

      console.log('[Auth Callback] Checking user type:', userType)

      // Explorers go to resources hub
      if (userType === 'explorer') {
        redirectUrl = new URL('/resources', requestUrl.origin)
        console.log('[Auth Callback] Redirecting explorer to resources')
        return NextResponse.redirect(redirectUrl)
      }

      // Buyers - check property and subscription status
      const { data: property } = await supabase
        .from('properties')
        .select('id, onboarding_completed, subscription_status')
        .eq('owner_id', user.id)
        .single()

      console.log('[Auth Callback] Property check:', {
        hasProperty: !!property,
        onboardingComplete: property?.onboarding_completed,
        subscriptionStatus: property?.subscription_status
      })

      // No property = payment not completed, send to plan selection
      if (!property) {
        redirectUrl = new URL('/choose-plan', requestUrl.origin)
        console.log('[Auth Callback] No property - redirecting to plan selection')
        return NextResponse.redirect(redirectUrl)
      }

      // Has property but onboarding incomplete
      if (!property.onboarding_completed) {
        redirectUrl = new URL('/onboarding', requestUrl.origin)
        console.log('[Auth Callback] Onboarding incomplete - redirecting to onboarding')
        return NextResponse.redirect(redirectUrl)
      }

      // Fully set up - go to dashboard
      console.log('[Auth Callback] Fully set up - redirecting to dashboard')
      return NextResponse.redirect(redirectUrl)
    }
  }

  // If there's an error or no code, redirect to login with error
  console.error('[Auth Callback] Failed - no code or exchange error')
  return NextResponse.redirect(
    new URL('/login?error=Could not authenticate user', requestUrl.origin)
  )
}
