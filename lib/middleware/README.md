# Middleware Type System

**CAM-135**: Core Middleware Types
**Parent**: CAM-129 - CRITICAL BUG - Middleware hardening

This directory contains the type-safe middleware system for the CampOS multi-tenant SaaS platform.

## Overview

The middleware type system provides compile-time type safety throughout the request/response chain, preventing common bugs like:
- Accidental mixing of domain IDs (UserId vs CompanyId)
- Missing authentication/tenant context at runtime
- Type errors when refactoring middleware logic
- Infinite redirect loops from missing wizard context

## Files

- **`types.ts`** - Core type definitions, branded types, and type guards
- **`types.test.ts`** - Runtime validation tests for type guards
- **`README.md`** - This file

## Key Concepts

### Branded Types

Branded types prevent accidental mixing of structurally identical types:

```typescript
import { UserId, CompanyId, createUserId, createCompanyId } from './types'

const userId = createUserId('123')
const companyId = createCompanyId('123')

// TypeScript prevents this at compile time:
const mixup: UserId = companyId  // ❌ Compile error!
```

**Available Branded IDs**:
- `UserId` - Supabase Auth user identifier
- `CompanyId` - Tenant/billing entity identifier
- `PropertyId` - Campground location identifier
- `SessionId` - Request tracking identifier

### Context Types

Context types accumulate state as requests pass through middleware:

```typescript
import type {
  MiddlewareContext,
  AuthContext,
  TenantContext,
  WizardContext
} from './types'

// Minimal context (start of middleware chain)
const ctx: MiddlewareContext = {
  sessionId: createSessionId('...'),
  pathname: '/dashboard',
  searchParams: new URLSearchParams()
}

// After auth middleware
const authCtx: MiddlewareContext = {
  ...ctx,
  auth: {
    userId: createUserId('...'),
    email: 'user@example.com',
    emailVerified: true,
    emailConfirmedAt: '2025-01-01T00:00:00Z',
    userMetadata: {}
  }
}

// After tenant middleware
const tenantCtx: MiddlewareContext = {
  ...authCtx,
  tenant: {
    companyId: createCompanyId('...'),
    subscriptionStatus: 'active'
  }
}
```

### Request Extensions

Request types guarantee context presence at compile time:

```typescript
import type {
  MiddlewareRequest,
  AuthenticatedRequest,
  TenantResolvedRequest,
  WizardRequest
} from './types'

// Any middleware function
function someMiddleware(req: MiddlewareRequest) {
  // Can access: sessionId, pathname, searchParams
  // Cannot assume: auth, tenant, wizard (may be undefined)
}

// Auth-required middleware
function authMiddleware(req: AuthenticatedRequest) {
  // TypeScript guarantees auth context exists
  const userId = req.middlewareContext.auth.userId  // ✅ Safe!
}

// Tenant-required middleware (multi-tenant operations)
function tenantMiddleware(req: TenantResolvedRequest) {
  // TypeScript guarantees both auth AND tenant context exist
  const companyId = req.middlewareContext.tenant.companyId  // ✅ Safe!
  const userId = req.middlewareContext.auth.userId  // ✅ Safe!
}

// Wizard middleware (onboarding exception)
function wizardMiddleware(req: WizardRequest) {
  // TypeScript guarantees wizard context exists
  const inWizard = req.middlewareContext.wizard.inWizard  // ✅ Always true
}
```

### Type Guards

Type guards provide runtime validation:

```typescript
import {
  isAuthContext,
  isTenantContext,
  isWizardContext,
  isAuthenticatedRequest,
  isTenantResolvedRequest
} from './types'

// Runtime validation
function processRequest(req: MiddlewareRequest) {
  if (isAuthenticatedRequest(req)) {
    // TypeScript now knows req.middlewareContext.auth is defined
    console.log(req.middlewareContext.auth.userId)
  }

  if (isTenantResolvedRequest(req)) {
    // TypeScript now knows both auth and tenant are defined
    console.log(req.middlewareContext.tenant.companyId)
  }
}
```

## Usage Examples

### Example 1: Authentication Middleware

```typescript
import type { MiddlewareRequest, AuthenticatedRequest } from './types'
import { createUserId, type AuthContext } from './types'
import { NextResponse } from 'next/server'

export async function authMiddleware(
  req: MiddlewareRequest
): Promise<NextResponse | MiddlewareRequest> {
  // Get user from Supabase
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Redirect to login
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Create auth context
  const authContext: AuthContext = {
    userId: createUserId(user.id),
    email: user.email!,
    emailVerified: !!user.email_confirmed_at,
    emailConfirmedAt: user.email_confirmed_at,
    userMetadata: user.user_metadata
  } as AuthContext

  // Add to request context
  const authenticatedReq = {
    ...req,
    middlewareContext: {
      ...req.middlewareContext,
      auth: authContext
    }
  } as AuthenticatedRequest

  return authenticatedReq
}
```

### Example 2: Tenant Middleware

```typescript
import type { AuthenticatedRequest, TenantResolvedRequest } from './types'
import { createCompanyId, type TenantContext } from './types'
import { NextResponse } from 'next/server'

export async function tenantMiddleware(
  req: AuthenticatedRequest
): Promise<NextResponse | MiddlewareRequest> {
  const userId = req.middlewareContext.auth.userId

  // Query company for tenant context
  const { data: company } = await supabase
    .from('companies')
    .select('id, subscription_status, subscription_plan, stripe_customer_id')
    .eq('owner_id', userId)
    .single()

  if (!company) {
    // No subscription - redirect to plan selection
    const url = req.nextUrl.clone()
    url.pathname = '/choose-plan'
    return NextResponse.redirect(url)
  }

  // Create tenant context
  const tenantContext: TenantContext = {
    companyId: createCompanyId(company.id),
    subscriptionStatus: company.subscription_status,
    subscriptionPlan: company.subscription_plan,
    stripeCustomerId: company.stripe_customer_id
  } as TenantContext

  // Add to request context
  const tenantReq = {
    ...req,
    middlewareContext: {
      ...req.middlewareContext,
      tenant: tenantContext
    }
  } as TenantResolvedRequest

  return tenantReq
}
```

### Example 3: Wizard Exception Middleware

```typescript
import type { MiddlewareRequest, WizardRequest } from './types'
import { type WizardContext } from './types'

export function checkWizardException(
  req: MiddlewareRequest
): req is WizardRequest {
  const wizardParam = req.middlewareContext.searchParams.get('wizard')
  const pathname = req.middlewareContext.pathname

  if (wizardParam === 'true' || pathname.startsWith('/onboarding')) {
    // Add wizard context to prevent redirect loops
    const wizardContext: WizardContext = {
      inWizard: true,
      wizardQueryParam: wizardParam || 'path-based'
    } as WizardContext

    // Mutate request to add wizard context
    ;(req as any).middlewareContext.wizard = wizardContext

    return true
  }

  return false
}
```

## Testing

All type guards have comprehensive test coverage:

```bash
npm test lib/middleware/types.test.ts
```

Tests verify:
- ✅ Valid contexts are accepted
- ✅ Invalid contexts are rejected
- ✅ Branded ID constructors work correctly
- ✅ Type guards provide proper type narrowing

## Best Practices

### DO ✅

1. **Use branded types for all domain IDs**
   ```typescript
   const userId = createUserId(user.id)  // ✅ Good
   ```

2. **Use type guards before accessing optional context**
   ```typescript
   if (isAuthenticatedRequest(req)) {
     const userId = req.middlewareContext.auth.userId  // ✅ Safe
   }
   ```

3. **Use typed request extensions for middleware signatures**
   ```typescript
   function tenantMiddleware(req: TenantResolvedRequest) {
     // TypeScript guarantees tenant context exists
   }
   ```

4. **Import types using `import type`**
   ```typescript
   import type { UserId, CompanyId } from './types'  // ✅ Good
   ```

### DON'T ❌

1. **Don't use raw strings for domain IDs**
   ```typescript
   const userId: UserId = user.id  // ❌ Bad - TypeScript error
   ```

2. **Don't assume optional context exists**
   ```typescript
   const userId = req.middlewareContext.auth.userId  // ❌ Bad - may be undefined
   ```

3. **Don't skip type guards for runtime validation**
   ```typescript
   // ❌ Bad - no runtime validation
   const auth = req.middlewareContext.auth
   ```

4. **Don't mix branded types**
   ```typescript
   const userId: UserId = createCompanyId('123')  // ❌ Compile error
   ```

## Migration Guide

### Updating Existing Middleware

To migrate existing middleware to use the type system:

1. **Import types**:
   ```typescript
   import type { MiddlewareRequest, AuthenticatedRequest } from '@/lib/middleware/types'
   import { createUserId, isAuthenticatedRequest } from '@/lib/middleware/types'
   ```

2. **Update function signatures**:
   ```typescript
   // Before
   export async function middleware(request: NextRequest) {
     // ...
   }

   // After
   export async function middleware(request: MiddlewareRequest) {
     // ...
   }
   ```

3. **Use branded IDs**:
   ```typescript
   // Before
   const userId = user.id

   // After
   const userId = createUserId(user.id)
   ```

4. **Add type guards**:
   ```typescript
   // Before
   if (request.middlewareContext.auth) {
     const userId = request.middlewareContext.auth.userId
   }

   // After
   if (isAuthenticatedRequest(request)) {
     const userId = request.middlewareContext.auth.userId  // Type-safe!
   }
   ```

## Middleware Composition Pattern

**CAM-139**: Implement Middleware Composition Pattern

The composition pattern provides a controlled way to chain middleware functions with explicit execution order and short-circuit capabilities.

### Using `composeMiddleware`

```typescript
import { composeMiddleware } from './compose'
import { authMiddleware } from './auth'
import { tenantMiddleware } from './tenant'

// Compose middleware with explicit execution order
const middleware = composeMiddleware(
  authMiddleware,      // 1. Verify authentication
  tenantMiddleware,    // 2. Verify tenant/subscription
  onboardingMiddleware // 3. Check onboarding status
)

// Use in Next.js middleware.ts
export async function middleware(request: NextRequest) {
  const req = initializeRequest(request)
  return await middleware(req)
}
```

### Execution Order

Middleware executes **left to right** in the order provided:

```typescript
composeMiddleware(first, second, third)
// Executes: first → second → third
```

### Short-Circuit Mechanism

If any middleware returns a `NextResponse`, execution **stops immediately**:

```typescript
const middleware = composeMiddleware(
  authMiddleware,      // Returns redirect → stops here
  tenantMiddleware,    // Never executes
  dashboardMiddleware  // Never executes
)
```

### Context Propagation

Each middleware receives the accumulated context from previous middleware:

```typescript
// Middleware 1: Add auth context
const authMiddleware = async (req) => ({
  ...req,
  middlewareContext: { ...req.middlewareContext, auth: {...} }
})

// Middleware 2: Receives auth context
const tenantMiddleware = async (req) => {
  const userId = req.middlewareContext.auth.userId // ✅ Available!
  // ...
}
```

### Conditional Middleware

Use `conditionalMiddleware` for route-specific logic:

```typescript
import { composeMiddleware, conditionalMiddleware } from './compose'

const protectedRoutes = conditionalMiddleware(
  (req) => req.middlewareContext.pathname.startsWith('/dashboard'),
  tenantMiddleware
)

const middleware = composeMiddleware(
  authMiddleware,    // Runs for all routes
  protectedRoutes    // Only runs for /dashboard/* routes
)
```

### Debugging with `loggingMiddleware`

Wrap middleware with logging for development debugging:

```typescript
import { composeMiddleware, loggingMiddleware } from './compose'

const middleware = composeMiddleware(
  loggingMiddleware('Auth', authMiddleware),
  loggingMiddleware('Tenant', tenantMiddleware),
  loggingMiddleware('Onboarding', onboardingMiddleware)
)

// Output:
// [Auth] START - /dashboard (session: abc123)
// [Auth] END - /dashboard (15ms) → Request
// [Tenant] START - /dashboard (session: abc123)
// [Tenant] END - /dashboard (23ms) → Response
// [Onboarding] (skipped - short-circuit)
```

### Type Safety

The composition pattern is fully type-safe:

```typescript
// TypeScript validates the entire chain
const middleware: MiddlewareFunction = composeMiddleware(
  authMiddleware,      // ✅ MiddlewareFunction
  tenantMiddleware,    // ✅ MiddlewareFunction
  onboardingMiddleware // ✅ MiddlewareFunction
)
```

### Testing Composition

Test composed middleware as a unit:

```typescript
import { composeMiddleware } from './compose'
import { authMiddleware } from './auth'
import { tenantMiddleware } from './tenant'

it('should execute middleware in order', async () => {
  const middleware = composeMiddleware(authMiddleware, tenantMiddleware)
  const result = await middleware(mockRequest)

  expect(result.middlewareContext.auth).toBeDefined()
  expect(result.middlewareContext.tenant).toBeDefined()
})
```

## Related Issues

- **CAM-135** - Core Middleware Types (base types)
- **CAM-136** - Auth Middleware Refactor (uses composition)
- **CAM-137** - Tenant Middleware Refactor (uses composition)
- **CAM-138** - Wizard Access Logic Extraction (uses WizardContext)
- **CAM-139** - Middleware Composition Pattern (this implementation)
- **CAM-140** - Update Main Middleware with Composition (next step)
- **CAM-129** - Parent: Middleware Hardening Initiative

## References

- [CAM-132 Middleware Audit](../../docs/architecture/MIDDLEWARE_AUDIT_CAM-132.md) - Identified type safety gaps
- [CAM-133 Execution Order Spec](../../specs/CAM-129-middleware-spec.md) - Defines middleware flow
- [CLAUDE.md](../../CLAUDE.md) - Project coding standards (C-5: branded types, C-6: import type)
