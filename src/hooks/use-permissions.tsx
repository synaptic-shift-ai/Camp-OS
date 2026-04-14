'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { EffectiveRole } from '@/lib/rbac/roles'
import { roleMeetsMinimum } from '@/lib/rbac/roles'
import type { StaffCategory } from '@/lib/rbac/staff-categories'
import { hasCategory } from '@/lib/rbac/staff-categories'

// ─── Context value ─────────────────────────────────────────────────────────────

export interface PermissionContextValue {
  /** Normalised role, or null if still loading / unauthenticated. */
  role: EffectiveRole | null
  /** Raw role from the database. */
  rawRole: string | null
  /** Staff categories assigned to the user. */
  categories: StaffCategory[]
  /** Set of all permission keys granted to this user. */
  permissions: ReadonlySet<string>
  /** Check if a specific permission is granted. */
  can: (key: string) => boolean
  /** Check if any of the given permissions are granted. */
  canAny: (keys: string[]) => boolean
  /** Check if all of the given permissions are granted. */
  canAll: (keys: string[]) => boolean
  /** Check if user has exactly the given role. */
  isRole: (role: EffectiveRole) => boolean
  /** Check if user's role meets or exceeds the minimum. */
  isAtLeastRole: (minimum: EffectiveRole) => boolean
  /** Check if user has a specific staff category (or 'all'). */
  hasCategory: (cat: StaffCategory) => boolean
  /** Whether the permissions are still being fetched. */
  isLoading: boolean
  /** Error from the API call, if any. */
  error: string | null
  /** Manually trigger a permission refresh. */
  refreshPermissions: () => void
}

// ─── Null context (for unauthenticated / no property) ────────────────────────

const NULL_CONTEXT: PermissionContextValue = {
  role: null,
  rawRole: null,
  categories: [],
  permissions: new Set(),
  can: () => false,
  canAny: () => false,
  canAll: () => false,
  isRole: () => false,
  isAtLeastRole: () => false,
  hasCategory: () => false,
  isLoading: false,
  error: null,
  refreshPermissions: () => {},
}

const PermissionContext = createContext<PermissionContextValue>(NULL_CONTEXT)

// ─── Provider ─────────────────────────────────────────────────────────────────

interface PermissionProviderProps {
  propertyId: string | null | undefined
  children: ReactNode
}

export function PermissionProvider({ propertyId, children }: PermissionProviderProps) {
  const [role, setRole] = useState<EffectiveRole | null>(null)
  const [rawRole, setRawRole] = useState<string | null>(null)
  const [categories, setCategories] = useState<StaffCategory[]>([])
  const [permissions, setPermissions] = useState<ReadonlySet<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ref to force re-fetch on demand
  const refreshTrigger = useRef(0)

  // Polling timer ref (60s interval)
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchPermissions = useCallback(async () => {
    if (!propertyId) {
      setRole(null)
      setRawRole(null)
      setCategories([])
      setPermissions(new Set())
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/v1/me/permissions?propertyId=${encodeURIComponent(propertyId)}`,
        { credentials: 'include' },
      )

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error?.message ?? `Request failed with status ${res.status}`)
        setRole(null)
        setRawRole(null)
        setCategories([])
        setPermissions(new Set())
        return
      }

      const result = await res.json()

      if (!result.success || !result.data) {
        setError('Invalid response from permissions API')
        setRole(null)
        setRawRole(null)
        setCategories([])
        setPermissions(new Set())
        return
      }

      const d = result.data
      setRole(d.role)
      setRawRole(d.rawRole)
      setCategories(d.categories ?? [])
      setPermissions(new Set(d.permissions ?? []))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch permissions'
      setError(message)
      setRole(null)
      setRawRole(null)
      setCategories([])
      setPermissions(new Set())
    } finally {
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshTrigger ref read triggers intentional re-fetch
  }, [propertyId, refreshTrigger.current])

  // Re-fetch when propertyId changes, plus 60s polling and window focus refresh
  useEffect(() => {
    // Initial fetch
    void fetchPermissions()

    // Poll every 60 seconds
    pollingTimerRef.current = setInterval(() => {
      void fetchPermissions()
    }, 60_000)

    // Re-fetch on window focus (tab switch)
    const onFocus = () => { void fetchPermissions() }
    window.addEventListener('focus', onFocus)

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current)
      window.removeEventListener('focus', onFocus)
    }
  }, [fetchPermissions])

  const refreshPermissions = useCallback(() => {
    refreshTrigger.current += 1
    void fetchPermissions()
  }, [fetchPermissions])

  const value = useMemo<PermissionContextValue>(() => ({
    role,
    rawRole,
    categories,
    permissions,
    can: (key: string) => permissions.has(key),
    canAny: (keys: string[]) => keys.some((k) => permissions.has(k)),
    canAll: (keys: string[]) => keys.every((k) => permissions.has(k)),
    isRole: (r: EffectiveRole) => role === r,
    isAtLeastRole: (minimum: EffectiveRole) => role ? roleMeetsMinimum(role, minimum) : false,
    hasCategory: (cat: StaffCategory) => hasCategory(categories, cat),
    isLoading,
    error,
    refreshPermissions,
  }), [role, rawRole, categories, permissions, isLoading, error, refreshPermissions])

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePermissions(): PermissionContextValue {
  return useContext(PermissionContext)
}
