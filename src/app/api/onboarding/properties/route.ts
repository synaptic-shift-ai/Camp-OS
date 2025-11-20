/**
 * DEPRECATED: Properties API - Onboarding
 *
 * Deprecation Date: 2025-11-05
 * Sunset Date: 2026-02-05 (90 days)
 * Migration Path: Use /api/v1/properties instead
 *
 * Phase 2, Week 5-6: Property Management Module
 * This endpoint is DEPRECATED in favor of /api/v1/properties
 *
 * CRITICAL: This endpoint caused the Oct 30, 2025 incident
 * when selective field fetching omitted onboarding_completed.
 * The new v1 endpoint fixes this with complete entity fetching.
 *
 * Following CLAUDE.md:
 * - D-2: Multi-tenant isolation (company_id filter)
 * - BP-4: Enforce tenant context
 * - C-6: Use import type for type-only imports
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { validateApiResponse } from "@/types/api/property.schema"
import type { PropertyListResponse } from "@/types/api/property.schema"

export async function GET() {
  // Log deprecation warning
  console.warn('[DEPRECATED] GET /api/onboarding/properties called. Migrate to /api/v1/properties')
  console.warn('  Sunset Date: 2026-02-05 (90 days from deprecation)')
  console.warn('  Migration Guide: Use GET /api/v1/properties with same authentication')

  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Create service role client (bypasses RLS to avoid potential recursion issues)
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Get user's company (D-2: Tenant isolation)
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("owner_id", user.id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    // CRITICAL: Use SELECT * to get ALL fields
    // Previous incident: Selective select caused missing onboarding_completed field
    // DO NOT change this to selective field fetching without updating schema
    console.log('[Properties API] Fetching properties for company:', company.id)
    const { data: properties, error: propertiesError } = await supabaseAdmin
      .from("properties")
      .select("*")  // SELECT * ensures all fields present
      .eq("company_id", company.id)  // BP-4: Tenant isolation
      .order("created_at", { ascending: true })

    if (propertiesError) {
      console.error("[Properties API] Error fetching properties:", propertiesError)
      return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 })
    }

    console.log('[Properties API] Found properties:', properties?.length || 0)
    if (properties && properties.length > 0) {
      console.log('[Properties API] Property IDs:', properties.map(p => p.id))
      console.log('[Properties API] Onboarding status:', properties.map(p => ({
        id: p.id,
        name: p.name,
        onboarding_completed: p.onboarding_completed
      })))
    }

    // Build response
    const response = {
      properties: properties || [],
    }

    // SERVER-SIDE VALIDATION
    // This validates response BEFORE sending to client
    // Would have caught the Oct 30 incident (missing fields)
    let validatedResponse: PropertyListResponse
    try {
      validatedResponse = validateApiResponse(response, '/api/onboarding/properties')
    } catch (validationError) {
      // Validation failed - this should NEVER happen
      // Indicates database schema mismatch or missing fields
      console.error('[CRITICAL] Response validation failed:', validationError)

      // TODO: Alert engineering team via monitoring service
      // alertCriticalApiValidationFailure('/api/onboarding/properties', validationError)

      return NextResponse.json(
        { error: "Internal server error - invalid response format" },
        { status: 500 }
      )
    }

    // Add deprecation headers (following RFC 8594)
    const apiResponse = NextResponse.json(validatedResponse)
    apiResponse.headers.set('Deprecation', 'true')
    apiResponse.headers.set('Sunset', 'Wed, 05 Feb 2026 00:00:00 GMT')
    apiResponse.headers.set('Link', '</api/v1/properties>; rel="alternate"')
    apiResponse.headers.set(
      'Warning',
      '299 - "Deprecated API - Migrate to /api/v1/properties by 2026-02-05"'
    )

    return apiResponse
  } catch (error) {
    console.error("Properties API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
