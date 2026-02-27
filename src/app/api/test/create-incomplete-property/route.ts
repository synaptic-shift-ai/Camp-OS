/**
 * Test Helper API: Create Incomplete Property
 *
 * CAM-143: Fix E2E tests - create test properties for wizard flow
 *
 * This endpoint is ONLY available in non-production environments.
 * It creates a property with onboarding_completed: false for E2E testing.
 *
 * SECURITY: This endpoint is disabled in production to prevent unauthorized
 * property creation that bypasses payment flows.
 *
 * Following CLAUDE.md:
 * - C-6: Use import type for type-only imports
 * - D-1: Type Supabase client properly
 * - D-2: Include tenant isolation (owner_id)
 * - RV-1: Runtime verification required before commit
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function POST(_request: NextRequest) {
  try {
    // CRITICAL: Only allow in non-production environments
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Test endpoints are not available in production' },
        { status: 403 }
      )
    }

    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      )
    }

    // Use service role client to bypass RLS for test data creation
    const supabaseServiceRole = createServiceRoleClient()

    // Generate URL-friendly slug
    const timestamp = Date.now()
    const slug = `test-property-${timestamp}`

    // Create property with minimal required fields
    // onboarding_completed: false triggers wizard flow
    const { data: property, error: createError } = await supabaseServiceRole
      .from('properties')
      .insert({
        owner_id: user.id, // Tenant isolation
        name: 'Test Property',
        slug: slug,
        description: 'Test property for E2E testing',
        address: '123 Test Street',
        city: 'Test City',
        state: 'CA',
        zip_code: '90210',
        phone: '555-1234',
        email: 'test@example.com',
        onboarding_completed: false, // CRITICAL: Triggers wizard flow
        status: 'pending',
      })
      .select()
      .single()

    if (createError) {
      console.error('[Test API] Failed to create incomplete property:', createError)
      return NextResponse.json(
        { error: 'Failed to create test property' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        propertyId: property.id,
        message: 'Test property created successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[Test API] Error creating incomplete property:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
