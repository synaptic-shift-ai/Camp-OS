import { createClient } from '@supabase/supabase-js'
import type { AuthError, SupabaseClient, User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import type { Database } from '@/contracts/db'
import { createClient as createCookieClient } from '@/lib/supabase/server'

export function getBearerTokenFromRequest(request: NextRequest): string | null {
  const auth = request.headers.get('authorization')
  if (!auth || !auth.startsWith('Bearer ')) {
    return null
  }
  const token = auth.slice('Bearer '.length).trim()
  return token.length > 0 ? token : null
}

/**
 * Supabase client for App Router API routes: session cookies (browser) or Bearer JWT (e.g. Postman).
 * Bearer path sets Authorization on the client so RLS applies to subsequent queries.
 */
export async function createSupabaseClientForApiRoute(request: NextRequest): Promise<{
  supabase: SupabaseClient<Database>
  user: User | null
  error: AuthError | null
}> {
  const bearer = getBearerTokenFromRequest(request)

  if (bearer) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }

    const supabase = createClient<Database>(url, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${bearer}`,
        },
      },
    })

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(bearer)

    return { supabase, user, error }
  }

  const supabase = await createCookieClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  return { supabase, user, error }
}
