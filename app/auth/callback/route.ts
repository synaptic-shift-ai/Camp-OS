import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Successfully authenticated, check if user needs onboarding
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Check if user has completed onboarding
        const { data: property } = await supabase
          .from('properties')
          .select('id, onboarding_completed')
          .eq('owner_id', user.id)
          .single()

        // If no property or onboarding not completed, redirect to onboarding
        if (!property || !property.onboarding_completed) {
          return NextResponse.redirect(new URL('/onboarding', requestUrl.origin))
        }
      }

      // Use custom redirect if provided, otherwise dashboard
      const next = requestUrl.searchParams.get('next') ?? '/dashboard'
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  // If there's an error or no code, redirect to login with error
  return NextResponse.redirect(
    new URL('/login?error=Could not authenticate user', requestUrl.origin)
  )
}
