import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // Get cookie value from document.cookie
          const value = `; ${document.cookie}`
          const parts = value.split(`; ${name}=`)
          if (parts.length === 2) return parts.pop()?.split(';').shift()
          return null
        },
        set(name: string, value: string, options: any) {
          // Set cookie with proper attributes for SSR
          let cookie = `${name}=${value}`

          if (options?.maxAge) {
            cookie += `; max-age=${options.maxAge}`
          }

          // Critical: Set SameSite=Lax to allow cookies to be sent on email link clicks
          cookie += '; SameSite=Lax'

          // Set path to root to ensure cookie is accessible everywhere
          cookie += '; path=/'

          // Set secure flag for production HTTPS
          if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
            cookie += '; Secure'
          }

          document.cookie = cookie

          console.log('[Supabase Client] Set cookie:', {
            name,
            hasValue: !!value,
            sameSite: 'Lax',
            path: '/',
            secure: window.location.protocol === 'https:'
          })
        },
        remove(name: string, options: any) {
          // Remove cookie by setting max-age to 0
          document.cookie = `${name}=; path=/; max-age=0`
        },
      },
    }
  )
}
