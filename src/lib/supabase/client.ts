import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  // Use default storage (localStorage) for PKCE code verifier
  // This is necessary because email verification goes through supabase.co domain
  // which cannot access cookies set on our app domain
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
