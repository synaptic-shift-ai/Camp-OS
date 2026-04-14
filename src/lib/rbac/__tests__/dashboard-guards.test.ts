import { describe, it, expect, vi } from 'vitest'
import type { ResolvedAccess } from '../resolve-access'

// Mock resolveUserPropertyAccess at module scope (hoisted by vi.mock)
const mockResolveAccess = vi.fn()
vi.mock('../resolve-access', () => ({
  resolveUserPropertyAccess: (...args: any[]) => mockResolveAccess(...args),
}))

// Import after mock is set up
import {
  resolveDashboardAccess,
  canAccessOperationsModules,
  canAccessPropertySettings,
  canViewStaffRoster,
  canManageStaffRoster,
  canViewFinancials,
  canProcessRefunds,
  canAccessHousekeepingModule,
  canAccessMaintenanceModule,
} from '../dashboard-guards'

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

// ─── canAccessOperationsModules ────────────────────────────────────────────────

describe('canAccessOperationsModules', () => {
  it('owner returns true', () => {
    expect(canAccessOperationsModules(makeAccess({ role: 'owner', isOwner: true }))).toBe(true)
  })

  it('admin returns true', () => {
    expect(canAccessOperationsModules(makeAccess({ role: 'admin' }))).toBe(true)
  })

  it('manager returns true', () => {
    expect(canAccessOperationsModules(makeAccess({ role: 'manager' }))).toBe(true)
  })

  it('staff returns false', () => {
    expect(canAccessOperationsModules(makeAccess({ role: 'staff' }))).toBe(false)
  })
})

// ─── canAccessPropertySettings ─────────────────────────────────────────────────

describe('canAccessPropertySettings', () => {
  it('owner returns true', () => {
    expect(canAccessPropertySettings(makeAccess({ role: 'owner', isOwner: true }))).toBe(true)
  })

  it('admin returns true', () => {
    expect(canAccessPropertySettings(makeAccess({ role: 'admin' }))).toBe(true)
  })

  it('manager returns false', () => {
    expect(canAccessPropertySettings(makeAccess({ role: 'manager' }))).toBe(false)
  })

  it('staff returns false', () => {
    expect(canAccessPropertySettings(makeAccess({ role: 'staff' }))).toBe(false)
  })
})

// ─── canViewStaffRoster ────────────────────────────────────────────────────────

describe('canViewStaffRoster', () => {
  it('manager returns true', () => {
    expect(canViewStaffRoster(makeAccess({ role: 'manager' }))).toBe(true)
  })

  it('staff returns false', () => {
    expect(canViewStaffRoster(makeAccess({ role: 'staff' }))).toBe(false)
  })
})

// ─── canManageStaffRoster ──────────────────────────────────────────────────────

describe('canManageStaffRoster', () => {
  it('admin returns true', () => {
    expect(canManageStaffRoster(makeAccess({ role: 'admin' }))).toBe(true)
  })

  it('manager returns false', () => {
    expect(canManageStaffRoster(makeAccess({ role: 'manager' }))).toBe(false)
  })
})

// ─── canViewFinancials ─────────────────────────────────────────────────────────

describe('canViewFinancials', () => {
  it('owner returns true', () => {
    expect(canViewFinancials(makeAccess({ role: 'owner', isOwner: true }))).toBe(true)
  })

  it('admin returns true (has financial.view_balance)', () => {
    expect(canViewFinancials(makeAccess({ role: 'admin' }))).toBe(true)
  })

  it('manager returns true (has financial.view_balance)', () => {
    expect(canViewFinancials(makeAccess({ role: 'manager' }))).toBe(true)
  })

  it('staff returns false', () => {
    expect(canViewFinancials(makeAccess({ role: 'staff' }))).toBe(false)
  })
})

// ─── canProcessRefunds ─────────────────────────────────────────────────────────

describe('canProcessRefunds', () => {
  it('admin returns true', () => {
    expect(canProcessRefunds(makeAccess({ role: 'admin' }))).toBe(true)
  })

  it('manager returns false', () => {
    expect(canProcessRefunds(makeAccess({ role: 'manager' }))).toBe(false)
  })
})

// ─── canAccessHousekeepingModule ───────────────────────────────────────────────

describe('canAccessHousekeepingModule', () => {
  it('staff with housekeeping category returns true', () => {
    expect(
      canAccessHousekeepingModule(makeAccess({ role: 'staff', categories: ['housekeeping'] })),
    ).toBe(true)
  })

  it('staff without housekeeping category returns false', () => {
    expect(
      canAccessHousekeepingModule(makeAccess({ role: 'staff', categories: ['maintenance'] })),
    ).toBe(false)
  })

  it('manager returns true', () => {
    expect(canAccessHousekeepingModule(makeAccess({ role: 'manager' }))).toBe(true)
  })

  it('owner returns true', () => {
    expect(canAccessHousekeepingModule(makeAccess({ role: 'owner' }))).toBe(true)
  })

  it('staff with \'all\' category returns true', () => {
    expect(
      canAccessHousekeepingModule(makeAccess({ role: 'staff', categories: ['all'] })),
    ).toBe(true)
  })
})

// ─── canAccessMaintenanceModule ────────────────────────────────────────────────

describe('canAccessMaintenanceModule', () => {
  it('staff with maintenance category returns true', () => {
    expect(
      canAccessMaintenanceModule(makeAccess({ role: 'staff', categories: ['maintenance'] })),
    ).toBe(true)
  })

  it('staff without maintenance category returns false', () => {
    expect(
      canAccessMaintenanceModule(makeAccess({ role: 'staff', categories: ['housekeeping'] })),
    ).toBe(false)
  })

  it('admin returns true', () => {
    expect(canAccessMaintenanceModule(makeAccess({ role: 'admin' }))).toBe(true)
  })

  it('owner returns true', () => {
    expect(canAccessMaintenanceModule(makeAccess({ role: 'owner' }))).toBe(true)
  })
})

// ─── resolveDashboardAccess ────────────────────────────────────────────────────

describe('resolveDashboardAccess', () => {
  it('delegates to resolveUserPropertyAccess (verify it is called correctly)', async () => {
    const mockSupabase = {} as any
    const mockAccess = makeAccess({ role: 'admin' })
    mockResolveAccess.mockResolvedValue(mockAccess)

    const result = await resolveDashboardAccess(mockSupabase, 'prop-1', 'user-1')

    expect(mockResolveAccess).toHaveBeenCalledWith(mockSupabase, 'prop-1', 'user-1')
    expect(result).toEqual(mockAccess)
  })
})
