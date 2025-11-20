/**
 * Supabase Service Role Client
 *
 * SECURITY WARNING: This client bypasses Row Level Security (RLS)
 * Use ONLY for:
 * - Unauthenticated guest bookings
 * - Server-side operations that require elevated permissions
 * - Always validate property_id/tenant_id manually for multi-tenant isolation
 *
 * DO NOT expose this client to client-side code
 */

import { createClient } from '@supabase/supabase-js'

/**
 * Create a Supabase client with service role key
 * WARNING: Bypasses RLS - use with caution
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
