import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { recordLoginActivityLogForUser } from '@/shared/activity-log/record-login-activity-log'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)

  // Check if this is a verification email click
  const verified = requestUrl.searchParams.get('verified')

  console.log('[Auth Callback] Processing callback:', {
    url: requestUrl.toString(),
    isVerification: verified === 'true'
  })

  // Get the authenticated user (session should already exist from signup)
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    console.error('[Auth Callback] No authenticated user:', userError?.message)
    return NextResponse.redirect(
      new URL('/login?error=Session expired. Please sign in again.', requestUrl.origin)
    )
  }

  console.log('[Auth Callback] User found:', {
    userId: user.id,
    userType: user.user_metadata?.user_type,
    emailVerified: user.email_confirmed_at ? true : false
  })

  await recordLoginActivityLogForUser(user)

  // If this is a verification email click, user just verified their email
  // Update the user's email_verified status will happen automatically by Supabase
  // Just redirect them back to where they were or to dashboard
  let redirectUrl = new URL('/dashboard', requestUrl.origin)

  const userType = user.user_metadata?.user_type

  // Explorers go to resources hub
  if (userType === 'explorer') {
    redirectUrl = new URL('/resources', requestUrl.origin)
    console.log('[Auth Callback] Redirecting verified explorer to resources')
  } else if (userType === 'staff') {
    const { data: staffAssignment } = await supabase
      .from('property_staff')
      .select('property_id, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (staffAssignment?.property_id) {
      redirectUrl = new URL(`/dashboard/${staffAssignment.property_id}`, requestUrl.origin)
      console.log('[Auth Callback] Staff user with assignment - redirecting to property dashboard', {
        propertyId: staffAssignment.property_id,
        status: staffAssignment.status,
      })
    } else {
      // Staff user with no property assignment - redirect to login with error
      redirectUrl = new URL('/login?error=No property assigned. Please contact your administrator.', requestUrl.origin)
      console.log('[Auth Callback] Staff user with no assignment - redirecting to login')
    }
  } else {
    // Buyers/owners - check property and subscription status
    const { data: properties } = await supabase
      .from('properties')
      .select('id, onboarding_completed, subscription_status')
      .eq('owner_id', user.id)
      .limit(1)
    const property = properties?.[0] ?? null

    console.log('[Auth Callback] Property check:', {
      hasProperty: !!property,
      onboardingComplete: property?.onboarding_completed,
      subscriptionStatus: property?.subscription_status
    })

    // No property = payment not completed, send to company details first then plan selection
    if (!property) {
      redirectUrl = new URL('/company-details', requestUrl.origin)
      console.log('[Auth Callback] No property - redirecting to company details')
    }
    // Has property but onboarding incomplete
    else if (!property.onboarding_completed) {
      redirectUrl = new URL('/onboarding', requestUrl.origin)
      console.log('[Auth Callback] Onboarding incomplete - redirecting to onboarding')
    }
    // Fully set up - go to dashboard
    else {
      console.log('[Auth Callback] Fully set up - redirecting to dashboard')
    }
  }

  return NextResponse.redirect(redirectUrl)
}
