# CLAUDE.md - Camp-OS Next.js MVP

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

**Camp-OS** is a multi-tenant SaaS platform for campground booking and management, built as a modern Next.js application. The goal is to ship an MVP quickly using a streamlined tech stack.

### Key Principles
- **Single Next.js app** - Simpler than multi-project monorepo
- **MVP-first** - Ship fast, refactor later
- **Multi-tenant from start** - Subdomain-based isolation (e.g., `pinevalley.camp-os.com`)
- **Type-safe** - TypeScript strict mode throughout
- **Component-driven** - Reusable UI components with Shadcn/UI patterns

---

## Tech Stack

### Frontend
- **Next.js 14.2.25** - App Router with Server Components
- **React 19** - Latest stable
- **TypeScript 5** - Strict mode enabled
- **TailwindCSS 3.4.17** - Utility-first styling
- **Shadcn/UI** - 23+ Radix UI-based components
- **Framer Motion** - Animations
- **Lucide React** - Icons

### Backend & Database
- **Supabase** - PostgreSQL database + authentication
  - `@supabase/ssr` - Server-side rendering support
  - `@supabase/supabase-js` - Client library
- **Next.js API Routes** - Serverless API endpoints in `/app/api`
- **Row-Level Security (RLS)** - Database-level tenant isolation

### Forms & Validation
- **react-hook-form** - Form state management
- **Zod** - Schema validation (imported, ready to use)
- **@hookform/resolvers** - Zod integration for forms

### Utilities
- **date-fns** - Date manipulation
- **class-variance-authority** - Component variant styling
- **clsx** + **tailwind-merge** - Conditional CSS classes

### Dev Tools
- **ESLint** - Linting (currently disabled during builds)
- **TypeScript** - Type checking (currently disabled during builds)
- **PostCSS** - CSS processing

---

## Project Structure

```
Saas_CampOS/
├── app/                              # Next.js App Router
│   ├── (auth)/                       # Auth route group
│   │   ├── login/                    # Login page
│   │   └── register/                 # Registration page
│   ├── (marketing)/                  # Marketing route group
│   │   ├── page.tsx                  # Landing page
│   │   ├── features/
│   │   ├── pricing/
│   │   ├── blog/
│   │   └── contact/
│   ├── api/                          # API endpoints
│   │   └── tenant/                   # Tenant resolution endpoint
│   ├── dashboard/                    # Protected dashboard
│   │   ├── page.tsx                  # Overview/home
│   │   ├── analytics/                # Revenue & occupancy analytics
│   │   ├── guests/                   # Guest management
│   │   ├── payments/                 # Transaction history
│   │   ├── reservations/             # Booking management
│   │   ├── settings/                 # Property settings
│   │   └── sites/                    # Campsite management
│   ├── ui-library/                   # Component showcase
│   ├── layout.tsx                    # Root layout
│   ├── globals.css                   # Global styles
│   └── error.tsx                     # Error boundary
│
├── components/                       # React components
│   ├── ui/                           # Shadcn/UI components (23 files)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── table.tsx
│   │   └── ... (accordion, alert, avatar, badge, etc.)
│   ├── ui-library/                   # Custom animated components
│   │   ├── spotlight-card.tsx
│   │   ├── glowing-tilt-card.tsx
│   │   ├── magnetic-button.tsx
│   │   └── animated-text.tsx
│   ├── sections/                     # Marketing page sections
│   │   ├── hero.tsx
│   │   ├── features.tsx
│   │   ├── testimonials.tsx
│   │   └── pricing.tsx
│   ├── tenant-provider.tsx           # Multi-tenant context
│   ├── theme-provider.tsx            # Dark/light mode
│   ├── header.tsx                    # Main navigation
│   └── footer.tsx                    # Site footer
│
├── lib/                              # Utilities & business logic
│   ├── supabase/                     # Supabase configuration
│   │   ├── client.ts                 # Client-side Supabase
│   │   ├── server.ts                 # Server-side Supabase
│   │   └── middleware.ts             # Auth middleware
│   ├── tenant.ts                     # Tenant identification logic
│   └── utils.ts                      # Utility functions (cn, etc.)
│
├── hooks/                            # React hooks
│   └── use-toast.ts                  # Toast notifications
│
├── scripts/                          # Database migrations (SQL)
│   ├── 001_create_multi_tenant_schema.sql
│   └── 002_add_subdomain_support.sql
│
├── public/                           # Static assets
│   ├── images/
│   └── fonts/
│
├── styles/                           # Additional CSS
│   └── globals.css                   # TailwindCSS imports
│
├── .env.local                        # Environment variables (gitignored)
├── next.config.mjs                   # Next.js configuration
├── tailwind.config.ts                # TailwindCSS config
├── tsconfig.json                     # TypeScript config
├── components.json                   # Shadcn/UI config
└── package.json                      # Dependencies & scripts
```

---

## Development Commands

```bash
# Start development server
npm run dev
# Runs on http://localhost:3000
# Subdomain testing: use tools like ngrok or local DNS

# Build for production
npm run build
# ⚠️ Currently ignores ESLint and TypeScript errors

# Start production server
npm run start

# Run linting
npm run lint
# ⚠️ Currently disabled during builds (ignoreDuringBuilds: true)
```

### Missing Commands (To Be Added)
```bash
# TODO: Add these commands
npm run type-check       # TypeScript validation
npm run test             # Run tests (Vitest)
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

---

## Database Schema

### Tables (Supabase PostgreSQL)

1. **properties** - Tenant/campground organizations
   - Primary tenant entity with subdomain, slug, owner_id
   - Stores property details (name, address, timezone, amenities)
   - Each property is a separate tenant

2. **sites** - Individual bookable campsites
   - Belongs to a property (tenant-scoped)
   - Type, occupancy, pricing, hookups, amenities
   - Status: available, occupied, maintenance, unavailable

3. **guests** - Guest database
   - Contact information, location data
   - Emergency contacts, preferences
   - Multi-tenant isolated

4. **reservations** - Booking records
   - Confirmation number, dates, guest count
   - Payment tracking, status
   - Links guests to sites

5. **payments** - Transaction history
   - Amount, method, status, Stripe references
   - Linked to reservations

6. **property_staff** - Multi-user access control
   - Roles: owner, manager, staff, viewer
   - Permissions per property

### Security
- **Row-Level Security (RLS)** enabled on all tables
- **Tenant isolation** enforced at database level
- **Indexes** optimized for common queries
- **Check constraints** for status enums

### Type Generation
```bash
# TODO: Generate TypeScript types from Supabase schema
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/database.types.ts
```

---

## Environment Variables

Required in `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## Implementation Best Practices

### Purpose
These rules ensure maintainability, safety, and developer velocity for this multi-tenant SaaS platform.
**MUST** rules are critical; **SHOULD** rules are strongly recommended.

---

### 1 - Before Coding

- **BP-1 (MUST)** Ask the user clarifying questions if requirements are ambiguous.
- **BP-2 (SHOULD)** Draft and confirm an approach for complex work.
- **BP-3 (SHOULD)** If ≥ 2 approaches exist, list clear pros and cons.
- **BP-4 (MUST)** For multi-tenant features, confirm tenant isolation requirements.
- **BP-5 (SHOULD)** Check if similar patterns already exist in the codebase before creating new ones.

---

### 2 - While Coding

- **C-1 (MUST)** Follow TDD when practical: scaffold stub → write failing test → implement.
- **C-2 (MUST)** Name functions with existing domain vocabulary (campground, booking, site, tenant, guest, property) for consistency.
- **C-3 (SHOULD NOT)** Introduce classes when small testable functions suffice.
- **C-4 (SHOULD)** Prefer simple, composable, testable functions.
- **C-5 (SHOULD)** Use branded types for IDs when adding type generation:
  ```typescript
  type TenantId = Brand<string, 'TenantId'>
  type PropertyId = Brand<string, 'PropertyId'>
  type SiteId = Brand<string, 'SiteId'>
  type BookingId = Brand<string, 'BookingId'>
  ```
- **C-6 (MUST)** Use `import type { ... }` for type-only imports.
- **C-7 (SHOULD NOT)** Add comments except for critical caveats; rely on self-explanatory code.
- **C-8 (SHOULD)** Default to `type`; use `interface` only when extending library types or when interface merging is required.
- **C-9 (SHOULD NOT)** Extract a new function unless:
  - It will be reused elsewhere
  - It's the only way to unit-test untestable logic
  - It drastically improves readability of an opaque block
- **C-10 (MUST)** For multi-tenant data access, always include tenant validation in queries.
- **C-11 (MUST)** Use Zod schemas for API validation and integrate with react-hook-form.
- **C-12 (MUST)** Use Server Components by default; only use Client Components when needed for interactivity.
- **C-13 (SHOULD)** Colocate related files (component + styles + tests in same directory when it makes sense).

---

### 3 - Testing

- **T-1 (MUST)** Add tests for new functionality. Prefer integration tests over heavy mocking.
- **T-2 (MUST)** Colocate unit tests with source files when simple (`*.test.ts` in same directory).
- **T-3 (MUST)** NEVER use hardcoded temporal data (dates, times) or brittle magic values in tests. Use dynamic generation based on runtime.
  ```typescript
  // ❌ BAD - Hardcoded date
  const checkInDate = '2025-06-01';

  // ✅ GOOD - Dynamic date
  const checkInDate = addDays(new Date(), 7);
  ```
- **T-4 (MUST)** Use test data factories for consistent, maintainable test data generation.
- **T-5 (SHOULD)** Parameterize tests across edge cases using `test.each()`.
- **T-6 (SHOULD)** Test the entire structure in one assertion if possible:
  ```typescript
  expect(result).toEqual([expectedValue]); // Good

  expect(result).toHaveLength(1);         // Bad
  expect(result[0]).toBe(expectedValue);  // Bad
  ```
- **T-7 (MUST)** For multi-tenant features, include tenant isolation tests.
- **T-8 (SHOULD NOT)** Test conditions that are caught by the TypeScript type checker.
- **T-9 (SHOULD NOT)** Add a test unless it can fail for a real defect. Trivial asserts are forbidden.
- **T-10 (MUST)** Test description should state exactly what the final expect verifies.

---

### 4 - Database & Supabase

- **D-1 (MUST)** Type Supabase client properly with generated types from `lib/database.types.ts`.
- **D-2 (MUST)** Always include `property_id` (tenant ID) in WHERE clauses for multi-tenant data access.
- **D-3 (MUST)** Rely on Row Level Security (RLS) policies for tenant isolation.
- **D-4 (MUST)** Handle Supabase errors gracefully and provide user-friendly messages.
- **D-5 (SHOULD)** Use Server Components for data fetching when possible (better performance).
- **D-6 (SHOULD)** Use Supabase Realtime for live updates (availability, booking status).

---

### 5 - Code Organization

- **O-1 (SHOULD)** Use Shadcn/UI components from `components/ui/` for consistent design.
- **O-2 (SHOULD)** Group related components in feature directories when complexity grows.
- **O-3 (MUST)** Keep API routes in `app/api/` following Next.js conventions.
- **O-4 (SHOULD)** Use Server Actions for mutations when appropriate (simpler than API routes).
- **O-5 (SHOULD)** Store business logic in `lib/` not in page or component files.

---

### 6 - Build Quality Gates

- **G-1 (MUST)** Fix `next.config.mjs` to enable error checking (remove `ignoreDuringBuilds`).
- **G-2 (MUST)** `npm run lint` must pass before commits.
- **G-3 (MUST)** `npm run type-check` must pass before commits (once added).
- **G-4 (SHOULD)** `npm run test` should pass before commits (once testing is set up).

---

### 7 - Git & Commits

- **GH-1 (MUST)** Use Conventional Commits format: https://www.conventionalcommits.org/en/v1.0.0
  ```
  feat(auth): add login form validation
  fix(booking): prevent double-booking same dates
  chore(deps): update Supabase to latest
  ```
- **GH-2 (SHOULD NOT)** Refer to Claude, Anthropic, or AI in commit messages.
- **GH-3 (SHOULD)** Keep commits focused on single logical changes.

---

## Writing Functions Best Practices

When evaluating whether a function is good, use this checklist:

1. **Readability First** - Can you easily follow what it's doing? If yes, stop here.
2. **Cyclomatic Complexity** - Does it have very high complexity (many nested ifs)? If yes, refactor.
3. **Data Structures** - Are there better structures that would simplify this? (maps, sets, trees, etc.)
4. **Unused Parameters** - Remove any unused parameters.
5. **Type Casts** - Move unnecessary type casts to function arguments.
6. **Testability** - Can this be tested without mocking core features? If not, can it be tested via integration tests?
7. **Hidden Dependencies** - Does it have untested dependencies that can be factored into arguments?
8. **Naming** - Brainstorm 3 better names and see if the current name is best and consistent with codebase.
9. **Multi-tenant Safety** - Does this function properly validate tenant access and prevent data leakage?

**IMPORTANT:** You SHOULD NOT refactor out a separate function unless:
- The refactored function is used in more than one place
- The refactored function is easily unit testable while the original is not AND you can't test it any other way
- The original function is extremely hard to follow and you resort to putting comments everywhere

---

## Writing Tests Best Practices

1. **SHOULD** parameterize inputs; never embed unexplained literals like `42` or `"foo"`.
2. **SHOULD NOT** add a test unless it can fail for a real defect. Trivial asserts are forbidden.
3. **SHOULD** ensure test description states exactly what the final expect verifies.
4. **SHOULD** compare results to independent, pre-computed expectations, never to the function's output re-used as the oracle.
5. **SHOULD** follow the same lint, type-safety, and style rules as production code.
6. **SHOULD** express invariants or axioms (e.g., booking availability rules) rather than single hard-coded cases.
7. **SHOULD** group unit tests for a function under `describe(functionName, () => ...)`.
8. **SHOULD** use `expect.any(...)` for variable IDs, timestamps.
9. **SHOULD** use strong assertions over weaker ones: `expect(x).toEqual(1)` not `expect(x).toBeGreaterThanOrEqual(1)`.
10. **SHOULD** test edge cases, realistic input, unexpected input, and value boundaries.
11. **SHOULD NOT** test conditions caught by TypeScript type checker.
12. **MUST** test tenant isolation for multi-tenant features.
13. **CRITICAL: NEVER** use hardcoded dates, times, or IDs that will break over time. Use dynamic generation.

---

## Multi-Tenant Architecture

### Tenant Identification
- **Subdomain-based**: `pinevalley.camp-os.com` → property with subdomain `pinevalley`
- **Tenant Context**: `TenantProvider` wraps app, provides current property info
- **API Endpoint**: `/api/tenant` resolves tenant from request headers

### Tenant Isolation Patterns

```typescript
// ✅ GOOD - Server Component with tenant-aware query
export default async function SitesPage() {
  const tenant = await getCurrentTenant();

  const { data: sites } = await supabase
    .from('sites')
    .select('*')
    .eq('property_id', tenant.propertyId); // ← Tenant filter

  return <SiteList sites={sites} />;
}

// ❌ BAD - Missing tenant filter
const { data: sites } = await supabase
  .from('sites')
  .select('*'); // ← SECURITY ISSUE: Returns all tenants' data!
```

### Testing Tenant Isolation

```typescript
// Always test that tenant A cannot access tenant B's data
test('should not return sites from different property', async () => {
  const propertyA = createTestProperty({ subdomain: 'pinevalley' });
  const propertyB = createTestProperty({ subdomain: 'oakridge' });

  const siteA = createTestSite({ property_id: propertyA.id });
  const siteB = createTestSite({ property_id: propertyB.id });

  const result = await fetchSites(propertyA.id);

  expect(result).toContainEqual(siteA);
  expect(result).not.toContainEqual(siteB);
});
```

---

## Next.js Specific Patterns

### Server vs Client Components

```typescript
// ✅ Server Component (default) - for data fetching
export default async function Page() {
  const data = await fetchData();
  return <div>{data}</div>;
}

// ✅ Client Component - for interactivity
'use client';
import { useState } from 'react';

export function InteractiveForm() {
  const [value, setValue] = useState('');
  return <input value={value} onChange={e => setValue(e.target.value)} />;
}
```

### API Routes

```typescript
// app/api/sites/route.ts
export async function GET(request: Request) {
  const tenant = await getTenantFromRequest(request);

  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('property_id', tenant.propertyId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ data });
}
```

### Server Actions (Alternative to API Routes)

```typescript
// app/actions/sites.ts
'use server';

export async function createSite(formData: FormData) {
  const tenant = await getCurrentTenant();

  const { data, error } = await supabase
    .from('sites')
    .insert({
      property_id: tenant.propertyId,
      site_number: formData.get('site_number'),
      // ...
    });

  if (error) throw error;

  revalidatePath('/dashboard/sites');
  return data;
}
```

---

## Current Status & Known Issues

### ✅ Working
- UI framework complete (50+ components)
- Database schema with RLS policies
- Multi-tenant routing (subdomain detection)
- Authentication setup (Supabase)
- Responsive design (mobile-first)

### ⚠️ Partially Working
- Dashboard pages (display mock data, not connected to DB)
- Tenant context (identifies tenants but needs testing)

### ❌ Not Implemented
- **CRITICAL: Build config broken** - Errors ignored in `next.config.mjs`
- CRUD API endpoints (only `/api/tenant` exists)
- Form validation (Zod imported but not integrated)
- Testing infrastructure (0% coverage)
- Database type generation
- Real-time features
- Stripe payment processing
- Email notifications
- Search/filter functionality

---

## Immediate Priorities

1. **Fix `next.config.mjs`** - Remove `ignoreDuringBuilds: true`
2. **Generate types** - `npx supabase gen types typescript`
3. **Setup testing** - Add Vitest configuration
4. **Create first API** - `/api/sites` with real database connection
5. **Connect dashboard** - Replace mock data with Supabase queries

---

## Remember Shortcuts

### QNEW
When user types "qnew":
```
Understand all BEST PRACTICES listed in CLAUDE.md.
Your code SHOULD ALWAYS follow these best practices.
Pay special attention to multi-tenant data isolation requirements.
```

### QPLAN
When user types "qplan":
```
Analyze similar parts of the codebase and determine whether your plan:
- is consistent with rest of codebase
- introduces minimal changes
- reuses existing Shadcn/UI components and patterns
- maintains tenant isolation for multi-tenant features
- follows Next.js 14 App Router conventions
```

### QCODE
When user types "qcode":
```
Implement your plan and make sure your new tests pass.
Always run tests to make sure you didn't break anything else.
Always run quality checks before committing.
```

### QCHECK
When user types "qcheck":
```
You are a SKEPTICAL senior software engineer.
Perform this analysis for every MAJOR code change you introduced:

1. CLAUDE.md checklist Writing Functions Best Practices.
2. CLAUDE.md checklist Writing Tests Best Practices.
3. CLAUDE.md checklist Implementation Best Practices.
4. Multi-tenant security: Does this change properly isolate tenant data?
5. Next.js patterns: Are you using Server/Client Components correctly?
```

### QCHECKF
When user types "qcheckf":
```
You are a SKEPTICAL senior software engineer.
Perform this analysis for every MAJOR function you added or edited:

1. CLAUDE.md checklist Writing Functions Best Practices.
```

### QCHECKT
When user types "qcheckt":
```
You are a SKEPTICAL senior software engineer.
Perform this analysis for every MAJOR test you added or edited:

1. CLAUDE.md checklist Writing Tests Best Practices.
```

### QUX
When user types "qux":
```
Imagine you are a human UX tester of the feature you implemented.
Output a comprehensive list of scenarios you would test, sorted by highest priority.
Consider both camper (customer) and campground operator (admin) perspectives.
Include mobile, desktop, and offline scenarios.
```

### QGIT
When user types "qgit":
```
Add all changes to staging, create a commit, and push to remote.

Follow Conventional Commits format:
<type>[optional scope]: <description>

Common scopes for this codebase:
- auth: authentication/authorization
- booking: reservation system
- ui: user interface components
- api: API endpoints
- db: database/migration changes
- test: testing improvements
- tenant: multi-tenancy features
```

---

## Additional Resources

- [Next.js 14 Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Shadcn/UI Components](https://ui.shadcn.com)
- [Conventional Commits](https://www.conventionalcommits.org)
- [React Hook Form](https://react-hook-form.com)
- [Zod Validation](https://zod.dev)
