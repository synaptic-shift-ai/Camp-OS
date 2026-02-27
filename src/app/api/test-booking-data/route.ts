/**
 * Quick Test Endpoint - Verify Booking Page Data
 *
 * Access this at: http://localhost:3000/api/test-booking-data
 *
 * This tests if properties can be fetched for booking pages
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch ALL properties (regardless of onboarding status)
    const { data: allProperties, error: allError } = await supabase
      .from('properties')
      .select('id, name, booking_page_slug, onboarding_completed, stripe_account_id, stripe_connected_at')
      .order('created_at', { ascending: false })

    if (allError) {
      return NextResponse.json({
        error: 'Database query failed',
        details: allError.message,
      }, { status: 500 })
    }

    // Fetch properties that are booking-ready
    const { data: readyProperties } = await supabase
      .from('properties')
      .select('id, name, booking_page_slug, onboarding_completed, stripe_account_id')
      .eq('onboarding_completed', true)
      .not('booking_page_slug', 'is', null)

    return NextResponse.json({
      success: true,
      all_properties_count: allProperties?.length || 0,
      ready_properties_count: readyProperties?.length || 0,
      all_properties: allProperties,
      ready_properties: readyProperties,
      test_urls: readyProperties?.map(p => ({
        name: p.name,
        url: `http://localhost:3000/book/${p.booking_page_slug}`,
        stripe_ready: !!p.stripe_account_id
      }))
    })
  } catch (error: any) {
    return NextResponse.json({
      error: 'Unexpected error',
      details: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}
