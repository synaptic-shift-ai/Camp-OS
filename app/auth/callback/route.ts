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

    // Debug: Log all available cookies
    const allCookies = cookieStore.getAll()
    console.log('[Auth Callback] Available cookies:', {
      count: allCookies.length,
      names: allCookies.map(c => c.name),
      hasCodeVerifier: allCookies.some(c => c.name.includes('code-verifier'))
    })

    // Collect cookies to be set during session exchange
    const cookiesToSet: Array<{ name: string; value: string; options: any }> = []

    // Create supabase client with cookie handling that collects cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            const cookies = cookieStore.getAll()
            console.log('[Auth Callback] Supabase requesting cookies:', {
              returned: cookies.length,
              names: cookies.map(c => c.name)
            })
            return cookies
          },
          setAll(cookiesToSet_) {
            // Collect cookies instead of setting them immediately
            console.log('[Auth Callback] Supabase wants to set cookies:', {
              count: cookiesToSet_.length,
              names: cookiesToSet_.map(c => c.name)
            })
            cookiesToSet.push(...cookiesToSet_)
          },
        },
      }
    )

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

    console.log('[Auth Callback] Exchange result:', {
      hasSession: !!sessionData.session,
      hasUser: !!sessionData.user,
      error: error?.message,
      userId: sessionData.user?.id,
      cookiesCollected: cookiesToSet.length
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
      } else {
        // PRIORITY 2: Route based on user type and status
        const userType = user.user_metadata?.user_type

        console.log('[Auth Callback] Checking user type:', userType)

        // Explorers go to resources hub
        if (userType === 'explorer') {
          redirectUrl = new URL('/resources', requestUrl.origin)
          console.log('[Auth Callback] Redirecting explorer to resources')
        } else {
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
          }
          // Has property but onboarding incomplete
          else if (!property.onboarding_completed) {
            redirectUrl = new URL('/onboarding', requestUrl.origin)
            console.log('[Auth Callback] Onboarding incomplete - redirecting to onboarding')
          }
          // Fully set up - go to dashboard (already set as default)
          else {
            console.log('[Auth Callback] Fully set up - redirecting to dashboard')
          }
        }
      }

      // Create the redirect response
      const response = NextResponse.redirect(redirectUrl)

      // Now explicitly set all collected cookies on the response
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
        console.log('[Auth Callback] Setting cookie on response:', {
          name,
          hasValue: !!value,
          options
        })
      })

      console.log('[Auth Callback] Returning redirect with cookies:', {
        destination: redirectUrl.pathname,
        cookiesSet: cookiesToSet.length
      })

      return response
    }

    console.error('[Auth Callback] Exchange failed:', {
      error: error?.message,
      hasSessionData: !!sessionData,
      hasUser: !!sessionData?.user
    })
  }

  // If there's an error or no code, redirect to login with error
  console.error('[Auth Callback] Failed - no code or exchange error')
  return NextResponse.redirect(
    new URL('/login?error=Could not authenticate user', requestUrl.origin)
  )
}
