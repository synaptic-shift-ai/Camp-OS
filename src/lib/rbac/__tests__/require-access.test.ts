import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

// Mock resolveUserPropertyAccess before importing require-access
vi.mock('../resolve-access', () => ({
  resolveUserPropertyAccess: vi.fn(),
}))

import { resolveUserPropertyAccess } from '../resolve-access'
import { checkPropertyAccess, requirePropertyAccess, requirePropertyMembership, isDenied } from '../require-access'
import type { ResolvedAccess } from '../resolve-access'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeAccess(overrides: Partial<ResolvedAccess> = {}): ResolvedAccess {
  return {
    userId: 'user-1',
    propertyId: 'prop-1',
    companyId: 'co-1',
    role: 'staff',
    rawRole: 'staff',
    categories: [],
    isOwner: false,
    isElevated: false,
    isPlatformAdmin: false,
    ...overrides,
  }
}

const mockSupabase = {} as any

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── checkPropertyAccess ───────────────────────────────────────────────────────

describe('checkPropertyAccess', () => {
  // 1. Returns access when user has property membership (no requirements)
  it('returns access when user has property membership (no requirements)', async () => {
    const access = makeAccess({ role: 'staff' })
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(access)

    const result = await checkPropertyAccess(mockSupabase, 'user-1', { propertyId: 'prop-1' })

    expect(result.denied).toBe(false)
    if (!result.denied) {
      expect(result.access.role).toBe('staff')
    }
  })

  // 2. Returns 404 when property not found
  it('returns 404 when property not found', async () => {
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(null)

    const result = await checkPropertyAccess(mockSupabase, 'user-1', { propertyId: 'prop-1' })

    expect(result.denied).toBe(true)
    if (result.denied) {
      expect(result.response.status).toBe(404)
    }
  })

  // 3. minimumRole 'admin' denies staff (403)
  it('minimumRole \'admin\' denies staff (403)', async () => {
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(makeAccess({ role: 'staff' }))

    const result = await checkPropertyAccess(mockSupabase, 'user-1', {
      propertyId: 'prop-1',
      minimumRole: 'admin',
    })

    expect(result.denied).toBe(true)
    if (result.denied) expect(result.response.status).toBe(403)
  })

  // 4. minimumRole 'admin' grants admin
  it('minimumRole \'admin\' grants admin', async () => {
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(makeAccess({ role: 'admin' }))

    const result = await checkPropertyAccess(mockSupabase, 'user-1', {
      propertyId: 'prop-1',
      minimumRole: 'admin',
    })

    expect(result.denied).toBe(false)
  })

  // 5. minimumRole 'admin' grants owner
  it('minimumRole \'admin\' grants owner', async () => {
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(makeAccess({ role: 'owner', isOwner: true }))

    const result = await checkPropertyAccess(mockSupabase, 'user-1', {
      propertyId: 'prop-1',
      minimumRole: 'admin',
    })

    expect(result.denied).toBe(false)
  })

  // 6. minimumRole 'manager' grants manager
  it('minimumRole \'manager\' grants manager', async () => {
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(makeAccess({ role: 'manager' }))

    const result = await checkPropertyAccess(mockSupabase, 'user-1', {
      propertyId: 'prop-1',
      minimumRole: 'manager',
    })

    expect(result.denied).toBe(false)
  })

  // 7. minimumRole 'manager' denies staff (403)
  it('minimumRole \'manager\' denies staff (403)', async () => {
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(makeAccess({ role: 'staff' }))

    const result = await checkPropertyAccess(mockSupabase, 'user-1', {
      propertyId: 'prop-1',
      minimumRole: 'manager',
    })

    expect(result.denied).toBe(true)
    if (result.denied) expect(result.response.status).toBe(403)
  })

  // 8. Permission check grants admin with matching permission
  it('permission check grants admin with matching permission', async () => {
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(makeAccess({ role: 'admin' }))

    const result = await checkPropertyAccess(mockSupabase, 'user-1', {
      propertyId: 'prop-1',
      permission: 'financial.refund',
    })

    expect(result.denied).toBe(false)
  })

  // 9. Permission check denies staff without category for that permission (403)
  it('permission check denies staff without category for that permission (403)', async () => {
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(
      makeAccess({ role: 'staff', categories: ['housekeeping'] }),
    )

    const result = await checkPropertyAccess(mockSupabase, 'user-1', {
      propertyId: 'prop-1',
      permission: 'financial.refund',
    })

    expect(result.denied).toBe(true)
    if (result.denied) expect(result.response.status).toBe(403)
  })

  // 10. Permission check grants staff with category that provides the permission
  it('permission check grants staff with category that provides the permission', async () => {
    // front_desk category provides 'financial.view_balance'
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(
      makeAccess({ role: 'staff', categories: ['front_desk'] }),
    )

    const result = await checkPropertyAccess(mockSupabase, 'user-1', {
      propertyId: 'prop-1',
      permission: 'financial.view_balance',
    })

    expect(result.denied).toBe(false)
  })

  // 11. Permission check denies manager without the specific permission (403)
  it('permission check denies manager without the specific permission (403)', async () => {
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(makeAccess({ role: 'manager' }))

    // Manager does not have 'automations.add_system_automations'
    const result = await checkPropertyAccess(mockSupabase, 'user-1', {
      propertyId: 'prop-1',
      permission: 'automations.add_system_automations',
    })

    expect(result.denied).toBe(true)
    if (result.denied) expect(result.response.status).toBe(403)
  })

  // 12. anyCategory grants staff when category matches
  // Note: need a minimumRole so the function doesn't return early before checking anyCategory
  it('anyCategory grants staff when category matches', async () => {
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(
      makeAccess({ role: 'staff', categories: ['housekeeping'] }),
    )

    const result = await checkPropertyAccess(mockSupabase, 'user-1', {
      propertyId: 'prop-1',
      minimumRole: 'staff',
      anyCategory: ['housekeeping'],
    })

    expect(result.denied).toBe(false)
  })

  // 13. anyCategory denies staff when category doesn't match (403)
  // Note: need a minimumRole so the function doesn't return early before checking anyCategory
  it('anyCategory denies staff when category doesn\'t match (403)', async () => {
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(
      makeAccess({ role: 'staff', categories: ['housekeeping'] }),
    )

    const result = await checkPropertyAccess(mockSupabase, 'user-1', {
      propertyId: 'prop-1',
      minimumRole: 'staff',
      anyCategory: ['maintenance'],
    })

    expect(result.denied).toBe(true)
    if (result.denied) expect(result.response.status).toBe(403)
  })

  // 14. anyOfRoles grants when user's role is in the list
  it('anyOfRoles grants when user\'s role is in the list', async () => {
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(makeAccess({ role: 'manager' }))

    const result = await checkPropertyAccess(mockSupabase, 'user-1', {
      propertyId: 'prop-1',
      anyOfRoles: ['admin', 'manager'],
    })

    expect(result.denied).toBe(false)
  })

  // 15. anyOfRoles denies when user's role is NOT in the list (403)
  it('anyOfRoles denies when user\'s role is NOT in the list (403)', async () => {
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(makeAccess({ role: 'staff' }))

    const result = await checkPropertyAccess(mockSupabase, 'user-1', {
      propertyId: 'prop-1',
      anyOfRoles: ['admin', 'manager'],
    })

    expect(result.denied).toBe(true)
    if (result.denied) expect(result.response.status).toBe(403)
  })

  // 16. Platform admin bypasses all checks
  it('platform admin bypasses all checks (even with minimumRole \'owner\')', async () => {
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(
      makeAccess({ role: 'staff', isPlatformAdmin: true }),
    )

    const result = await checkPropertyAccess(mockSupabase, 'user-1', {
      propertyId: 'prop-1',
      minimumRole: 'owner',
    })

    expect(result.denied).toBe(false)
  })
})

// ─── isDenied ──────────────────────────────────────────────────────────────────

describe('isDenied', () => {
  // 17. Returns true for NextResponse
  it('returns true for NextResponse', () => {
    const response = NextResponse.json({ error: 'denied' }, { status: 403 })
    expect(isDenied(response as any)).toBe(true)
  })

  // 18. Returns false for ResolvedAccess
  it('returns false for ResolvedAccess', () => {
    const access = makeAccess()
    expect(isDenied(access)).toBe(false)
  })
})

// ─── requirePropertyAccess ─────────────────────────────────────────────────────

describe('requirePropertyAccess', () => {
  // 19. Returns ResolvedAccess on success
  it('returns ResolvedAccess on success', async () => {
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(makeAccess({ role: 'admin' }))

    const result = await requirePropertyAccess(mockSupabase, 'user-1', {
      propertyId: 'prop-1',
      minimumRole: 'admin',
    })

    expect(isDenied(result)).toBe(false)
  })

  // 20. Returns NextResponse on denial
  it('returns NextResponse on denial', async () => {
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(makeAccess({ role: 'staff' }))

    const result = await requirePropertyAccess(mockSupabase, 'user-1', {
      propertyId: 'prop-1',
      minimumRole: 'admin',
    })

    expect(isDenied(result)).toBe(true)
  })
})

// ─── requirePropertyMembership ─────────────────────────────────────────────────

describe('requirePropertyMembership', () => {
  // 21. Returns ResolvedAccess when user has any access
  it('returns ResolvedAccess when user has any access', async () => {
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(makeAccess({ role: 'staff' }))

    const result = await requirePropertyMembership(mockSupabase, 'user-1', 'prop-1')

    expect(isDenied(result)).toBe(false)
  })

  // 22. Returns NextResponse (404) when no access
  it('returns NextResponse (404) when no access', async () => {
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(null)

    const result = await requirePropertyMembership(mockSupabase, 'user-1', 'prop-1')

    expect(isDenied(result)).toBe(true)
  })
})

// ─── Error response format ─────────────────────────────────────────────────────

describe('error response format', () => {
  it('404 response matches AUTH_004 format', async () => {
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(null)

    const result = await checkPropertyAccess(mockSupabase, 'user-1', { propertyId: 'prop-1' })
    expect(result.denied).toBe(true)
    if (result.denied) {
      const body = await result.response.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('AUTH_004')
      expect(body.error.message).toBe('Property not found or access denied')
    }
  })

  it('403 response matches AUTH_003 format', async () => {
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(makeAccess({ role: 'staff' }))

    const result = await checkPropertyAccess(mockSupabase, 'user-1', {
      propertyId: 'prop-1',
      minimumRole: 'admin',
    })
    expect(result.denied).toBe(true)
    if (result.denied) {
      const body = await result.response.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('AUTH_003')
      expect(body.error.message).toBe('Insufficient role for this operation')
    }
  })
})

// ─── Multiple requirements ─────────────────────────────────────────────────────

describe('multiple requirements', () => {
  // 23. Multiple requirements (minimumRole + permission) all must pass
  it('minimumRole + permission both pass for admin with permission', async () => {
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(makeAccess({ role: 'admin' }))

    const result = await checkPropertyAccess(mockSupabase, 'user-1', {
      propertyId: 'prop-1',
      minimumRole: 'admin',
      permission: 'financial.refund',
    })

    expect(result.denied).toBe(false)
  })

  it('minimumRole passes but permission fails for manager', async () => {
    // Manager doesn't have 'financial.refund'
    vi.mocked(resolveUserPropertyAccess).mockResolvedValue(makeAccess({ role: 'manager' }))

    const result = await checkPropertyAccess(mockSupabase, 'user-1', {
      propertyId: 'prop-1',
      minimumRole: 'manager',
      permission: 'financial.refund',
    })

    expect(result.denied).toBe(true)
    if (result.denied) expect(result.response.status).toBe(403)
  })
})
