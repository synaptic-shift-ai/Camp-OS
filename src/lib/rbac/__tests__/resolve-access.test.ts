import { describe, it, expect, vi } from 'vitest'
import { resolveUserPropertyAccess, resolveUserPropertyAccessOrThrow, AccessDeniedError } from '../resolve-access'

// ─── Mock Supabase helper ──────────────────────────────────────────────────────

function createMockChain() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
}

function createMockSupabase(tableHandlers: Record<string, () => Record<string, any>>) {
  return {
    from: vi.fn((table: string) => tableHandlers[table]?.() ?? createMockChain()),
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('resolveUserPropertyAccess', () => {
  const _supabase = createMockSupabase({}) as any
  const propertyId = 'prop-1'
  const userId = 'user-1'

  // 1. Owner access when properties.owner_id matches userId (companyId present)
  it('returns owner access when properties.owner_id matches userId (companyId present)', async () => {
    const mock = createMockSupabase({
      properties: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: { company_id: 'co-1', owner_id: userId }, error: null })
        return chain
      },
    })

    const result = await resolveUserPropertyAccess(mock as any, propertyId, userId)

    expect(result).not.toBeNull()
    expect(result!.role).toBe('owner')
    expect(result!.rawRole).toBe('owner')
    expect(result!.companyId).toBe('co-1')
    expect(result!.isOwner).toBe(true)
    expect(result!.isElevated).toBe(true)
  })

  // 2. Owner access when properties.owner_id matches userId (companyId null)
  it('returns owner access when properties.owner_id matches userId (companyId null)', async () => {
    const mock = createMockSupabase({
      properties: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: { company_id: null, owner_id: userId }, error: null })
        return chain
      },
    })

    const result = await resolveUserPropertyAccess(mock as any, propertyId, userId)

    expect(result).not.toBeNull()
    expect(result!.role).toBe('owner')
    expect(result!.companyId).toBeNull()
    expect(result!.isOwner).toBe(true)
  })

  // 3. Owner access via companies.owner_id when properties.owner_id doesn't match
  it('returns owner access via companies.owner_id when properties.owner_id doesn\'t match', async () => {
    const companiesChain = createMockChain()
    companiesChain.maybeSingle.mockResolvedValue({ data: { owner_id: userId }, error: null })

    const mock = createMockSupabase({
      properties: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: { company_id: 'co-1', owner_id: 'other-user' }, error: null })
        return chain
      },
      companies: () => companiesChain,
    })

    const result = await resolveUserPropertyAccess(mock as any, propertyId, userId)

    expect(result).not.toBeNull()
    expect(result!.role).toBe('owner')
    expect(result!.isOwner).toBe(true)
    expect(result!.companyId).toBe('co-1')
  })

  // 4. Returns null when property doesn't exist
  it('returns null when property doesn\'t exist', async () => {
    const mock = createMockSupabase({
      properties: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: null, error: null })
        return chain
      },
    })

    const result = await resolveUserPropertyAccess(mock as any, propertyId, userId)

    expect(result).toBeNull()
  })

  // 5. Returns null when user has no property_staff assignment
  it('returns null when user has no property_staff assignment', async () => {
    const staffChain = createMockChain()
    staffChain.maybeSingle.mockResolvedValue({ data: null, error: null })

    const mock = createMockSupabase({
      properties: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: { company_id: 'co-1', owner_id: 'other-user' }, error: null })
        return chain
      },
      companies: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: { owner_id: 'other-user' }, error: null })
        return chain
      },
      property_staff: () => staffChain,
    })

    const result = await resolveUserPropertyAccess(mock as any, propertyId, userId)

    expect(result).toBeNull()
  })

  // 6. Returns admin role for 'admin' db role
  it('returns admin role for \'admin\' db role', async () => {
    const staffChain = createMockChain()
    staffChain.maybeSingle.mockResolvedValue({ data: { role: 'admin', role_category_id: null }, error: null })

    const mock = createMockSupabase({
      properties: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: { company_id: 'co-1', owner_id: 'other-user' }, error: null })
        return chain
      },
      companies: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: { owner_id: 'other-user' }, error: null })
        return chain
      },
      property_staff: () => staffChain,
    })

    const result = await resolveUserPropertyAccess(mock as any, propertyId, userId)

    expect(result).not.toBeNull()
    expect(result!.role).toBe('admin')
    expect(result!.rawRole).toBe('admin')
    expect(result!.isElevated).toBe(true)
  })

  // 7. Normalizes 'property_admin' to 'admin'
  it('normalizes \'property_admin\' to \'admin\' (effectiveRole= \'admin\', rawRole=\'property_admin\')', async () => {
    const staffChain = createMockChain()
    staffChain.maybeSingle.mockResolvedValue({ data: { role: 'property_admin', role_category_id: null }, error: null })

    const mock = createMockSupabase({
      properties: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: { company_id: 'co-1', owner_id: 'other-user' }, error: null })
        return chain
      },
      companies: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: { owner_id: 'other-user' }, error: null })
        return chain
      },
      property_staff: () => staffChain,
    })

    const result = await resolveUserPropertyAccess(mock as any, propertyId, userId)

    expect(result).not.toBeNull()
    expect(result!.role).toBe('admin')
    expect(result!.rawRole).toBe('property_admin')
  })

  // 8. Returns manager role correctly
  it('returns manager role correctly', async () => {
    const staffChain = createMockChain()
    staffChain.maybeSingle.mockResolvedValue({ data: { role: 'manager', role_category_id: null }, error: null })

    const mock = createMockSupabase({
      properties: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: { company_id: 'co-1', owner_id: 'other-user' }, error: null })
        return chain
      },
      companies: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: { owner_id: 'other-user' }, error: null })
        return chain
      },
      property_staff: () => staffChain,
    })

    const result = await resolveUserPropertyAccess(mock as any, propertyId, userId)

    expect(result).not.toBeNull()
    expect(result!.role).toBe('manager')
    expect(result!.rawRole).toBe('manager')
    expect(result!.isElevated).toBe(true)
  })

  // 9. Returns staff role with categories from property_role_categories
  it('returns staff role with categories from property_role_categories', async () => {
    // property_role_categories query uses .select().eq().in() — no maybeSingle.
    // The chain itself must resolve to { data: [...] }.
    const catChain = createMockChain()
    // Make the chain (thenable) resolve directly to the data
    const catPromise = Promise.resolve({
      data: [{ name: 'housekeeping' }, { name: 'maintenance' }],
      error: null,
    })
    Object.defineProperty(catChain, 'then', { value: (resolve: any) => resolve({ data: [{ name: 'housekeeping' }, { name: 'maintenance' }], error: null }) })

    const staffChain = createMockChain()
    staffChain.maybeSingle.mockResolvedValue({
      data: { role: 'staff', role_category_id: ['cat-1', 'cat-2'] },
      error: null,
    })

    const mock = createMockSupabase({
      properties: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: { company_id: 'co-1', owner_id: 'other-user' }, error: null })
        return chain
      },
      companies: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: { owner_id: 'other-user' }, error: null })
        return chain
      },
      property_staff: () => staffChain,
      property_role_categories: () => catChain,
    })

    const result = await resolveUserPropertyAccess(mock as any, propertyId, userId)

    expect(result).not.toBeNull()
    expect(result!.role).toBe('staff')
    expect(result!.categories).toEqual(['housekeeping', 'maintenance'])
    expect(result!.isElevated).toBe(false)
  })

  // 10. Staff with no categories gets 'all' category (backward compat)
  it('returns staff with \'all\' category when no categories assigned (backward compat)', async () => {
    const staffChain = createMockChain()
    staffChain.maybeSingle.mockResolvedValue({
      data: { role: 'staff', role_category_id: null },
      error: null,
    })

    const mock = createMockSupabase({
      properties: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: { company_id: 'co-1', owner_id: 'other-user' }, error: null })
        return chain
      },
      companies: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: { owner_id: 'other-user' }, error: null })
        return chain
      },
      property_staff: () => staffChain,
    })

    const result = await resolveUserPropertyAccess(mock as any, propertyId, userId)

    expect(result).not.toBeNull()
    expect(result!.role).toBe('staff')
    expect(result!.categories).toEqual(['all'])
  })

  // 11. Ignores inactive/deactivated staff
  it('ignores inactive/deactivated staff (status not \'active\' or \'pending\')', async () => {
    // property_staff query returns null because in('status', ['active', 'pending']) filters out inactive
    const staffChain = createMockChain()
    staffChain.maybeSingle.mockResolvedValue({ data: null, error: null })

    const mock = createMockSupabase({
      properties: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: { company_id: 'co-1', owner_id: 'other-user' }, error: null })
        return chain
      },
      companies: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: { owner_id: 'other-user' }, error: null })
        return chain
      },
      property_staff: () => staffChain,
    })

    const result = await resolveUserPropertyAccess(mock as any, propertyId, userId)

    expect(result).toBeNull()
  })

  // 12. Returns null for inactive status staff (same as 11, but explicit scenario)
  it('returns null for deactivated staff', async () => {
    const staffChain = createMockChain()
    // Deactivated staff won't match the in('status', ['active', 'pending']) filter
    staffChain.maybeSingle.mockResolvedValue({ data: null, error: null })

    const mock = createMockSupabase({
      properties: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: { company_id: 'co-1', owner_id: 'other-user' }, error: null })
        return chain
      },
      companies: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: { owner_id: 'other-user' }, error: null })
        return chain
      },
      property_staff: () => staffChain,
    })

    const result = await resolveUserPropertyAccess(mock as any, propertyId, userId)

    expect(result).toBeNull()
  })
})

describe('resolveUserPropertyAccessOrThrow', () => {
  it('throws AccessDeniedError with 404 when no access', async () => {
    const mock = createMockSupabase({
      properties: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: null, error: null })
        return chain
      },
    })

    await expect(
      resolveUserPropertyAccessOrThrow(mock as any, 'prop-1', 'user-1'),
    ).rejects.toThrow(AccessDeniedError)
  })

  it('sets isPlatformAdmin=true when userMetadata.user_type === \'platform_admin\'', async () => {
    const mock = createMockSupabase({
      properties: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: { company_id: 'co-1', owner_id: 'user-1' }, error: null })
        return chain
      },
    })

    const result = await resolveUserPropertyAccessOrThrow(
      mock as any,
      'prop-1',
      'user-1',
      { user_type: 'platform_admin' },
    )

    expect(result.isPlatformAdmin).toBe(true)
  })

  it('sets isPlatformAdmin=false when userMetadata is missing', async () => {
    const mock = createMockSupabase({
      properties: () => {
        const chain = createMockChain()
        chain.maybeSingle.mockResolvedValue({ data: { company_id: 'co-1', owner_id: 'user-1' }, error: null })
        return chain
      },
    })

    const result = await resolveUserPropertyAccessOrThrow(
      mock as any,
      'prop-1',
      'user-1',
      null,
    )

    expect(result.isPlatformAdmin).toBe(false)
  })
})

describe('AccessDeniedError', () => {
  it('has correct statusCode property', () => {
    const error = new AccessDeniedError('test', 404)
    expect(error.statusCode).toBe(404)
  })

  it('has name \'AccessDeniedError\'', () => {
    const error = new AccessDeniedError('test', 403)
    expect(error.name).toBe('AccessDeniedError')
  })

  it('is instance of Error', () => {
    const error = new AccessDeniedError('test', 403)
    expect(error).toBeInstanceOf(Error)
  })
})
