"use client"

import { useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

/**
 * Guards against accidental navigation when the user has unsaved changes.
 *
 * - Intercepts browser tab close / refresh via `beforeunload`.
 * - Intercepts in-app Next.js navigations by patching `router.push`
 *   and `router.replace` with a confirmation prompt.
 */
export function usePageLeaveGuard(isDirty: boolean) {
  const router = useRouter()
  const dirtyRef = useRef(isDirty)
  dirtyRef.current = isDirty

  // Browser beforeunload for tab close / refresh
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isDirty])

  // Intercept programmatic router.push / router.replace
  useEffect(() => {
    if (!isDirty) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const routerAny = router as any
    const originalPush = routerAny.push.bind(router)
    const originalReplace = routerAny.replace.bind(router)

    routerAny.push = (href: string, ...args: unknown[]) => {
      if (dirtyRef.current) {
        const confirmed = window.confirm(
          "You have unsaved changes. Are you sure you want to leave?"
        )
        if (!confirmed) return Promise.resolve(false)
      }
      return originalPush(href, ...args)
    }

    routerAny.replace = (href: string, ...args: unknown[]) => {
      if (dirtyRef.current) {
        const confirmed = window.confirm(
          "You have unsaved changes. Are you sure you want to leave?"
        )
        if (!confirmed) return Promise.resolve(false)
      }
      return originalReplace(href, ...args)
    }

    return () => {
      routerAny.push = originalPush
      routerAny.replace = originalReplace
    }
  }, [isDirty, router])
}

/**
 * Returns a callback that performs a guarded navigation.
 * Prompts the user if there are unsaved changes.
 */
export function useGuardedNavigate(isDirty: boolean) {
  const router = useRouter()

  return useCallback(
    (href: string) => {
      if (isDirty) {
        const confirmed = window.confirm(
          "You have unsaved changes. Are you sure you want to leave?"
        )
        if (!confirmed) return
      }
      router.push(href)
    },
    [isDirty, router]
  )
}
