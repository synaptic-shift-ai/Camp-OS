/**
 * Wizard Access Middleware Unit Tests
 *
 * CAM-138: Extract Wizard Access Logic to Dedicated Middleware
 *
 * Following CLAUDE.md Testing Best Practices:
 * - T-1: Colocate unit tests with source file
 * - T-3: Pure logic unit tests (no database)
 * - T-6: Test entire structure in one assertion
 * - T-9: No hardcoded temporal data
 * - T-10: Use test data factories
 * - T-11: Parameterize tests across edge cases
 *
 * CRITICAL: These tests validate the wizard exception logic that prevents
 * infinite redirect loops during onboarding after payment.
 */

import { describe, it, expect } from 'vitest'
import type { MiddlewareRequest, SessionId } from './types'
import { createSessionId } from './types'
import {
  detectWizardAccess,
  isInWizardMode,
  shouldApplyWizardException,
  getWizardSafePaths,
  isValidWizardParam,
} from './wizard'

// ============================================================================
// Test Data Factories
// ============================================================================

function createMockRequest(
  pathname = '/dashboard',
  queryParams?: Record<string, string>
): MiddlewareRequest {
  const searchParams = new URLSearchParams(queryParams)

  return {
    middlewareContext: {
      sessionId: createSessionId('test-session-123') as SessionId,
      pathname,
      searchParams,
    },
  } as MiddlewareRequest
}

function createWizardRequest(
  pathname = '/dashboard/sites',
  wizardParam = 'true'
): MiddlewareRequest {
  return createMockRequest(pathname, { wizard: wizardParam })
}

// ============================================================================
// detectWizardAccess Tests
// ============================================================================

describe('detectWizardAccess', () => {
  describe('wizard query parameter detection', () => {
    it('should detect wizard mode with ?wizard=true', () => {
      const request = createWizardRequest('/dashboard/sites', 'true')

      const result = detectWizardAccess(request)

      expect(result).toEqual({
        isWizard: true,
        context: {
          inWizard: true,
          wizardQueryParam: 'true',
        },
      })
    })

    it('should NOT detect wizard mode with ?wizard=false', () => {
      const request = createWizardRequest('/dashboard/sites', 'false')

      const result = detectWizardAccess(request)

      expect(result).toEqual({
        isWizard: false,
      })
    })

    it('should NOT detect wizard mode with ?wizard=1', () => {
      const request = createWizardRequest('/dashboard/sites', '1')

      const result = detectWizardAccess(request)

      expect(result).toEqual({
        isWizard: false,
      })
    })

    it('should detect wizard mode on any path with ?wizard=true', () => {
      const paths = [
        '/dashboard',
        '/dashboard/sites',
        '/dashboard/locations',
        '/dashboard/amenities',
        '/dashboard/rates',
      ]

      paths.forEach((pathname) => {
        const request = createWizardRequest(pathname, 'true')
        const result = detectWizardAccess(request)

        expect(result).toEqual({
          isWizard: true,
          context: {
            inWizard: true,
            wizardQueryParam: 'true',
          },
        })
      })
    })
  })

  describe('onboarding route detection', () => {
    it('should detect wizard mode on /onboarding route', () => {
      const request = createMockRequest('/onboarding')

      const result = detectWizardAccess(request)

      expect(result).toEqual({
        isWizard: true,
        context: {
          inWizard: true,
          wizardQueryParam: '',
        },
      })
    })

    it('should detect wizard mode on /onboarding sub-routes', () => {
      const routes = [
        '/onboarding',
        '/onboarding/setup',
        '/onboarding/property',
        '/onboarding/complete',
      ]

      routes.forEach((pathname) => {
        const request = createMockRequest(pathname)
        const result = detectWizardAccess(request)

        expect(result).toEqual({
          isWizard: true,
          context: {
            inWizard: true,
            wizardQueryParam: '',
          },
        })
      })
    })
  })

  describe('combined detection patterns', () => {
    it('should detect wizard mode with both query param and onboarding route', () => {
      const request = createMockRequest('/onboarding', { wizard: 'true' })

      const result = detectWizardAccess(request)

      expect(result).toEqual({
        isWizard: true,
        context: {
          inWizard: true,
          wizardQueryParam: 'true',
        },
      })
    })
  })

  describe('non-wizard access', () => {
    it('should NOT detect wizard mode on regular dashboard access', () => {
      const request = createMockRequest('/dashboard')

      const result = detectWizardAccess(request)

      expect(result).toEqual({
        isWizard: false,
      })
    })

    it('should NOT detect wizard mode on regular dashboard routes', () => {
      const routes = [
        '/dashboard',
        '/dashboard/bookings',
        '/dashboard/calendar',
        '/dashboard/reports',
      ]

      routes.forEach((pathname) => {
        const request = createMockRequest(pathname)
        const result = detectWizardAccess(request)

        expect(result).toEqual({
          isWizard: false,
        })
      })
    })

    it('should NOT detect wizard mode on auth routes', () => {
      const routes = ['/login', '/signup', '/choose-plan', '/verify-email']

      routes.forEach((pathname) => {
        const request = createMockRequest(pathname)
        const result = detectWizardAccess(request)

        expect(result).toEqual({
          isWizard: false,
        })
      })
    })
  })
})

// ============================================================================
// isInWizardMode Tests
// ============================================================================

describe('isInWizardMode', () => {
  it('should return true when wizard context is present', () => {
    const request = {
      middlewareContext: {
        sessionId: createSessionId('test-123') as SessionId,
        pathname: '/dashboard/sites',
        searchParams: new URLSearchParams({ wizard: 'true' }),
        wizard: {
          inWizard: true,
          wizardQueryParam: 'true',
        },
      },
    } as MiddlewareRequest

    expect(isInWizardMode(request)).toBe(true)
  })

  it('should return false when wizard context is absent', () => {
    const request = createMockRequest('/dashboard')

    expect(isInWizardMode(request)).toBe(false)
  })

  it('should return false when wizard.inWizard is false', () => {
    const request = {
      middlewareContext: {
        sessionId: createSessionId('test-123') as SessionId,
        pathname: '/dashboard',
        searchParams: new URLSearchParams(),
        wizard: {
          inWizard: false,
          wizardQueryParam: '',
        },
      },
    } as any

    expect(isInWizardMode(request)).toBe(false)
  })
})

// ============================================================================
// shouldApplyWizardException Tests
// ============================================================================

describe('shouldApplyWizardException', () => {
  describe('wizard query parameter exception', () => {
    it('should apply exception with ?wizard=true', () => {
      const pathname = '/dashboard/sites'
      const searchParams = new URLSearchParams({ wizard: 'true' })

      const result = shouldApplyWizardException(pathname, searchParams)

      expect(result).toBe(true)
    })

    it('should NOT apply exception with ?wizard=false', () => {
      const pathname = '/dashboard/sites'
      const searchParams = new URLSearchParams({ wizard: 'false' })

      const result = shouldApplyWizardException(pathname, searchParams)

      expect(result).toBe(false)
    })

    it('should NOT apply exception without wizard parameter', () => {
      const pathname = '/dashboard/sites'
      const searchParams = new URLSearchParams()

      const result = shouldApplyWizardException(pathname, searchParams)

      expect(result).toBe(false)
    })
  })

  describe('onboarding route exception', () => {
    it('should apply exception on /onboarding route', () => {
      const pathname = '/onboarding'
      const searchParams = new URLSearchParams()

      const result = shouldApplyWizardException(pathname, searchParams)

      expect(result).toBe(true)
    })

    it('should apply exception on /onboarding sub-routes', () => {
      const routes = [
        '/onboarding',
        '/onboarding/setup',
        '/onboarding/property',
      ]

      routes.forEach((pathname) => {
        const searchParams = new URLSearchParams()
        const result = shouldApplyWizardException(pathname, searchParams)

        expect(result).toBe(true)
      })
    })
  })

  describe('combined exceptions', () => {
    it('should apply exception with both patterns', () => {
      const pathname = '/onboarding'
      const searchParams = new URLSearchParams({ wizard: 'true' })

      const result = shouldApplyWizardException(pathname, searchParams)

      expect(result).toBe(true)
    })
  })

  describe('non-exception cases', () => {
    it('should NOT apply exception on regular dashboard routes', () => {
      const routes = [
        '/dashboard',
        '/dashboard/bookings',
        '/dashboard/calendar',
      ]

      routes.forEach((pathname) => {
        const searchParams = new URLSearchParams()
        const result = shouldApplyWizardException(pathname, searchParams)

        expect(result).toBe(false)
      })
    })
  })
})

// ============================================================================
// getWizardSafePaths Tests
// ============================================================================

describe('getWizardSafePaths', () => {
  it('should return array of safe paths for wizard access', () => {
    const safePaths = getWizardSafePaths()

    expect(safePaths).toEqual([
      '/dashboard/sites',
      '/dashboard/locations',
      '/dashboard/amenities',
      '/dashboard/rates',
      '/onboarding',
    ])
  })

  it('should return same array on multiple calls (pure function)', () => {
    const result1 = getWizardSafePaths()
    const result2 = getWizardSafePaths()

    expect(result1).toEqual(result2)
  })
})

// ============================================================================
// isValidWizardParam Tests
// ============================================================================

describe('isValidWizardParam', () => {
  it('should validate "true" as valid wizard parameter', () => {
    expect(isValidWizardParam('true')).toBe(true)
  })

  it('should reject "false" as invalid', () => {
    expect(isValidWizardParam('false')).toBe(false)
  })

  it('should reject "1" as invalid', () => {
    expect(isValidWizardParam('1')).toBe(false)
  })

  it('should reject "TRUE" as invalid (case-sensitive)', () => {
    expect(isValidWizardParam('TRUE')).toBe(false)
  })

  it('should reject null as invalid', () => {
    expect(isValidWizardParam(null)).toBe(false)
  })

  it('should reject empty string as invalid', () => {
    expect(isValidWizardParam('')).toBe(false)
  })

  it('should reject undefined as invalid', () => {
    expect(isValidWizardParam(undefined as any)).toBe(false)
  })
})

// ============================================================================
// Edge Cases and Security Tests
// ============================================================================

describe('Edge Cases', () => {
  describe('case sensitivity', () => {
    it('should be case-sensitive for wizard parameter', () => {
      const request = createMockRequest('/dashboard/sites', {
        wizard: 'TRUE',
      })

      const result = detectWizardAccess(request)

      expect(result).toEqual({
        isWizard: false,
      })
    })

    it('should be case-sensitive for onboarding path', () => {
      const request = createMockRequest('/ONBOARDING')

      const result = detectWizardAccess(request)

      expect(result).toEqual({
        isWizard: false,
      })
    })
  })

  describe('parameter injection protection', () => {
    it('should handle multiple wizard parameters (takes first)', () => {
      const request = {
        middlewareContext: {
          sessionId: createSessionId('test-123') as SessionId,
          pathname: '/dashboard/sites',
          searchParams: new URLSearchParams('wizard=true&wizard=false'),
        },
      } as MiddlewareRequest

      const result = detectWizardAccess(request)

      // URLSearchParams.get() returns the first value
      expect(result).toEqual({
        isWizard: true,
        context: {
          inWizard: true,
          wizardQueryParam: 'true',
        },
      })
    })
  })

  describe('path traversal protection', () => {
    it('should NOT match onboarding in middle of path', () => {
      const request = createMockRequest('/dashboard/onboarding/sites')

      const result = detectWizardAccess(request)

      expect(result).toEqual({
        isWizard: false,
      })
    })

    it('should NOT match partial onboarding path', () => {
      const request = createMockRequest('/onboard')

      const result = detectWizardAccess(request)

      expect(result).toEqual({
        isWizard: false,
      })
    })
  })
})

// ============================================================================
// Business Logic Tests (Critical for Preventing Redirect Loops)
// ============================================================================

describe('Redirect Loop Prevention', () => {
  it('should detect wizard access for post-payment redirect', () => {
    // After Stripe payment, user is redirected to /dashboard/sites?wizard=true
    const request = createMockRequest('/dashboard/sites', { wizard: 'true' })

    const result = detectWizardAccess(request)

    // CRITICAL: Must detect wizard mode to prevent redirect to /onboarding
    expect(result.isWizard).toBe(true)
  })

  it('should detect wizard access for onboarding entry point', () => {
    // User accesses /onboarding directly (manual or via middleware redirect)
    const request = createMockRequest('/onboarding')

    const result = detectWizardAccess(request)

    // CRITICAL: Must detect wizard mode to prevent redirect loop
    expect(result.isWizard).toBe(true)
  })

  it('should NOT detect wizard mode for regular dashboard access', () => {
    // User with complete onboarding accessing dashboard
    const request = createMockRequest('/dashboard')

    const result = detectWizardAccess(request)

    // Regular access should not be marked as wizard
    expect(result.isWizard).toBe(false)
  })

  it('should apply wizard exception for all wizard steps', () => {
    // Wizard has multiple steps: sites, locations, amenities, rates
    const wizardSteps = [
      '/dashboard/sites?wizard=true',
      '/dashboard/locations?wizard=true',
      '/dashboard/amenities?wizard=true',
      '/dashboard/rates?wizard=true',
    ]

    wizardSteps.forEach((path) => {
      const [pathname, query] = path.split('?')
      const searchParams = new URLSearchParams(query)

      const shouldApply = shouldApplyWizardException(pathname!, searchParams)

      // CRITICAL: Wizard exception must apply at all steps
      expect(shouldApply).toBe(true)
    })
  })
})
