import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  console.log('[Auth Callback] Processing callback:', {
    hasCode: !!code,
    url: requestUrl.toString()
  })

  if (code) {
    const supabase = await createClient()
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

    console.log('[Auth Callback] Exchange result:', {
      hasSession: !!sessionData.session,
      hasUser: !!sessionData.user,
      error: error?.message,
      userId: sessionData.user?.id
    })

    if (!error) {
      // Successfully authenticated
      const { data: { user } } = await supabase.auth.getUser()

      console.log('[Auth Callback] User retrieved after exchange:', {
        hasUser: !!user,
        userId: user?.id,
        userType: user?.user_metadata?.user_type
      })

      if (user) {
        // PRIORITY 1: Honor 'next' parameter if present (sales funnel/specific flow)
        const next = requestUrl.searchParams.get('next')
        if (next) {
          return NextResponse.redirect(new URL(next, requestUrl.origin))
        }

        // PRIORITY 2: Route based on user type and status
        const userType = user.user_metadata?.user_type

        // Explorers go to resources hub
        if (userType === 'explorer') {
          return NextResponse.redirect(new URL('/resources', requestUrl.origin))
        }

        // Buyers - check property and subscription status
        const { data: property } = await supabase
          .from('properties')
          .select('id, onboarding_completed, subscription_status')
          .eq('owner_id', user.id)
          .single()

        // No property = payment not completed, send to plan selection
        if (!property) {
          return NextResponse.redirect(new URL('/choose-plan', requestUrl.origin))
        }

        // Has property but onboarding incomplete
        if (!property.onboarding_completed) {
          return NextResponse.redirect(new URL('/onboarding', requestUrl.origin))
        }

        // Fully set up - go to dashboard
        return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
      }

      // Fallback to dashboard if no user (shouldn't happen)
      return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
    }
  }

  // If there's an error or no code, redirect to login with error
  return NextResponse.redirect(
    new URL('/login?error=Could not authenticate user', requestUrl.origin)
  )
}
